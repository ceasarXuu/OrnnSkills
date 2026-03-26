import { watch, type FSWatcher } from 'chokidar';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, basename, dirname } from 'node:path';
import { BaseObserver } from './base-observer.js';
import { createChildLogger } from '../../utils/logger.js';
import type { Trace, TraceStatus, PreprocessedTrace } from '../../types/index.js';

const logger = createChildLogger('claude-observer');

/**
 * Claude Code 原始事件类型
 */
interface ClaudeRawEvent {
  type: 'user' | 'assistant' | 'summary' | 'queue-operation' | 'file-history-snapshot' | string;
  timestamp: string;
  sessionId: string;
  uuid?: string;
  parentUuid?: string | null;
  cwd?: string;
  gitBranch?: string;
  version?: string;
  message?: {
    role: string;
    content: string | Array<{ type: string; text?: string }>;
  };
  error?: string;
  isApiErrorMessage?: boolean;
  summary?: string;
  leafUuid?: string;
  operation?: string;
  [key: string]: unknown;
}



/**
 * 文件读取位置跟踪
 */
interface FilePosition {
  path: string;
  lastPosition: number;
  lastModified: number;
}

/**
 * Claude Observer
 *
 * 监听 Claude Code 的项目级会话日志文件（~/.claude/projects/{project}/*.jsonl）
 * 基于真实 Claude trace 结构实现
 *
 * 主要特点：
 * 1. 监听项目级目录
 * 2. 适配 Claude 的事件类型结构（user, assistant, summary 等）
 * 3. 实现预处理层，过滤无关信息（queue-operation, file-history-snapshot）
 * 4. 提取 skill 引用和项目上下文
 * 5. 支持增量读取，避免重复处理
 */
export class ClaudeObserver extends BaseObserver {
  private watcher: FSWatcher | null = null;
  private projectsDir: string;
  private currentSessionId: string | null = null;
  private turnCounter: Map<string, number> = new Map();
  private processedFiles: Set<string> = new Set();
  private filePositions: Map<string, FilePosition> = new Map();

  constructor(projectsDir?: string) {
    super('claude');
    this.projectsDir = projectsDir ?? this.getDefaultProjectsDir();
  }

  /**
   * 获取默认 projects 目录
   */
  private getDefaultProjectsDir(): string {
    return join(process.env.HOME ?? process.env.USERPROFILE ?? '', '.claude', 'projects');
  }

  /**
   * 启动 observer
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('Claude observer already running');
      return;
    }

    if (!existsSync(this.projectsDir)) {
      logger.warn(`Claude projects directory not found: ${this.projectsDir}`);
      return;
    }

    this.isRunning = true;
    logger.info('Starting Claude observer', { projectsDir: this.projectsDir });

    // 监听 projects 目录下的所有 JSONL 文件
    const watchPattern = join(this.projectsDir, '**', '*.jsonl');
    this.watcher = watch(watchPattern, {
      persistent: true,
      ignoreInitial: false,
      awaitWriteFinish: {
        stabilityThreshold: 500,
        pollInterval: 100,
      },
    });

    this.watcher.on('add', (path) => this.handleFileAdd(path));
    this.watcher.on('change', (path) => this.handleFileChange(path));

    logger.info('Claude observer started', { watchPattern });
  }

  /**
   * 停止 observer
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }

    logger.info('Claude observer stopped');
  }

  /**
   * 处理新文件
   */
  private handleFileAdd(path: string): void {
    if (!path.endsWith('.jsonl')) {
      return;
    }

    // 避免重复处理
    if (this.processedFiles.has(path)) {
      return;
    }
    this.processedFiles.add(path);

    const sessionId = this.extractSessionId(path);
    const projectName = this.extractProjectName(path);
    this.currentSessionId = sessionId;

    logger.info(`New Claude session detected`, { sessionId, projectName, path });

    // 读取整个文件
    this.processSessionFileInternal(path, false);
  }

  /**
   * 处理文件变化（增量读取）
   */
  private handleFileChange(path: string): void {
    if (!path.endsWith('.jsonl')) {
      return;
    }

    const sessionId = this.extractSessionId(path);
    logger.debug(`Claude session file changed`, { sessionId, path });

    // 增量读取新内容
    this.processSessionFileInternal(path, true);
  }

  /**
   * 处理 session JSONL 文件（内部实现）
   * @param path 文件路径
   * @param incremental 是否增量读取
   */
  private processSessionFileInternal(path: string, incremental: boolean): void {
    const sessionId = this.extractSessionId(path);
    const traces: PreprocessedTrace[] = [];

    try {
      const stats = statSync(path);
      const currentSize = stats.size;
      const currentModified = stats.mtimeMs;

      let startPosition = 0;

      if (incremental) {
        const position = this.filePositions.get(path);
        if (position && position.lastModified === currentModified) {
          // 文件未变化，跳过
          return;
        }
        if (position) {
          startPosition = position.lastPosition;
        }
      }

      // 读取文件内容（全部或增量）
      const content = readFileSync(path, 'utf-8');
      const lines = content.slice(startPosition).split('\n').filter((line) => line.trim());

      for (const line of lines) {
        try {
          const event = JSON.parse(line) as ClaudeRawEvent;
          const preprocessed = this.preprocessEvent(sessionId, event);
          if (preprocessed) {
            traces.push(preprocessed);
          }
        } catch (parseError) {
          logger.debug(`Failed to parse Claude event`, { path, error: parseError });
        }
      }

      // 更新文件位置
      this.filePositions.set(path, {
        path,
        lastPosition: currentSize,
        lastModified: currentModified,
      });

      // 批量发射预处理后的 traces
      if (traces.length > 0) {
        this.emitPreprocessedTraces(sessionId, traces);
      }

      logger.debug(`Processed ${traces.length} traces from Claude session ${sessionId}`, {
        incremental,
        path,
      });
    } catch (error) {
      logger.warn(`Failed to read Claude session file`, { path, error });
    }
  }

  /**
   * 预处理单个事件
   * 保留所有语义内容，只进行格式转换
   * 不过滤任何可能包含语义信息的事件
   */
  private preprocessEvent(sessionId: string, event: ClaudeRawEvent): PreprocessedTrace | null {
    const turnId = this.getNextTurnId(sessionId);
    const timestamp = event.timestamp ?? new Date().toISOString();

    switch (event.type) {
      case 'user':
        return this.preprocessUserEvent(sessionId, turnId, timestamp, event);

      case 'assistant':
        return this.preprocessAssistantEvent(sessionId, turnId, timestamp, event);

      case 'summary':
        // 摘要事件，保留完整信息
        return {
          sessionId,
          turnId,
          timestamp,
          eventType: 'status',
          content: {
            summary: event.summary,
            // 保留完整的 event 数据
            rawEvent: event,
          },
          metadata: {
            type: 'summary',
            leafUuid: event.leafUuid,
          },
        };

      case 'queue-operation':
      case 'file-history-snapshot':
        // 保留这些内部事件，可能包含语义信息
        return {
          sessionId,
          turnId,
          timestamp,
          eventType: 'status',
          content: event,
          metadata: {
            originalType: event.type,
            rawEvent: event,
          },
        };

      default:
        // 保留未知类型的事件，可能包含语义信息
        return {
          sessionId,
          turnId,
          timestamp,
          eventType: 'status',
          content: event,
          metadata: {
            originalType: event.type,
            rawEvent: event,
          },
        };
    }
  }

  /**
   * 预处理用户输入事件
   */
  private preprocessUserEvent(
    sessionId: string,
    turnId: string,
    timestamp: string,
    event: ClaudeRawEvent
  ): PreprocessedTrace | null {
    const content = this.extractMessageContent(event.message?.content);
    const skillRefs = this.extractSkillReferences(content);

    return {
      sessionId,
      turnId,
      timestamp,
      eventType: 'user_input',
      content,
      projectContext: {
        cwd: event.cwd ?? '',
        gitBranch: event.gitBranch,
      },
      skillRefs,
      metadata: {
        uuid: event.uuid,
        version: event.version,
      },
    };
  }

  /**
   * 预处理助手输出事件
   */
  private preprocessAssistantEvent(
    sessionId: string,
    turnId: string,
    timestamp: string,
    event: ClaudeRawEvent
  ): PreprocessedTrace | null {
    const content = this.extractMessageContent(event.message?.content);
    const skillRefs = this.extractSkillReferences(content);

    return {
      sessionId,
      turnId,
      timestamp,
      eventType: 'assistant_output',
      content,
      projectContext: {
        cwd: event.cwd ?? '',
        gitBranch: event.gitBranch,
      },
      skillRefs,
      metadata: {
        uuid: event.uuid,
        parentUuid: event.parentUuid,
        error: event.error,
        isApiErrorMessage: event.isApiErrorMessage,
        version: event.version,
      },
    };
  }

  /**
   * 提取消息内容
   */
  private extractMessageContent(content: unknown): string {
    if (typeof content === 'string') {
      return content;
    }

    if (Array.isArray(content)) {
      // 处理 Claude 的内容数组格式
      const textParts: string[] = [];
      for (const part of content) {
        if (typeof part === 'string') {
          textParts.push(part);
        } else if (part?.type === 'text' && part.text) {
          textParts.push(part.text);
        }
      }
      return textParts.join('\n');
    }

    return JSON.stringify(content);
  }

  /**
   * 提取 skill 引用
   * 格式: [$skillname] 或 @skillname
   */
  private extractSkillReferences(text: string): string[] {
    const refs: string[] = [];

    // 匹配 [$skillname] 格式
    const bracketMatches = text.match(/\[\$([^\]]+)\]/g);
    if (bracketMatches) {
      refs.push(...bracketMatches.map(match => match.slice(2, -1)));
    }

    // 匹配 @skillname 格式（Claude 可能使用的格式）
    // 支持连字符，如 @business-opportunity-assessment
    // 注意：过滤掉代码中的装饰器（如 @dataclass, @prisma 等）
    const atMatches = text.match(/@([\w-]+)/g);
    if (atMatches) {
      const codeKeywords = ['dataclass', 'prisma', 'staticmethod', 'classmethod', 'property', 'app', 'tool'];
      const filteredMatches = atMatches
        .map(match => match.slice(1))
        .filter(match => !codeKeywords.includes(match.toLowerCase()) && match.length > 2);
      refs.push(...filteredMatches);
    }

    return [...new Set(refs)]; // 去重
  }

  /**
   * 发射预处理后的 traces
   */
  private emitPreprocessedTraces(sessionId: string, traces: PreprocessedTrace[]): void {
    // 按类型分组统计
    const typeCount = new Map<string, number>();
    const skillRefs = new Set<string>();
    const projects = new Set<string>();

    for (const trace of traces) {
      typeCount.set(trace.eventType, (typeCount.get(trace.eventType) || 0) + 1);
      if (trace.skillRefs) {
        trace.skillRefs.forEach(ref => skillRefs.add(ref));
      }
      if (trace.projectContext?.cwd) {
        projects.add(trace.projectContext.cwd);
      }

      // 转换为标准 Trace 格式并发射
      const standardTrace = this.convertToStandardTrace(trace);
      this.emitTrace(standardTrace);
    }

    logger.info(`Claude session ${sessionId} trace summary`, {
      totalTraces: traces.length,
      typeBreakdown: Object.fromEntries(typeCount),
      detectedSkills: Array.from(skillRefs),
      projects: Array.from(projects),
    });
  }

  /**
   * 转换为标准 Trace 格式
   */
  private convertToStandardTrace(preprocessed: PreprocessedTrace): Trace {
    const base = {
      trace_id: `${preprocessed.sessionId}_${preprocessed.turnId}`,
      runtime: 'claude' as const,
      session_id: preprocessed.sessionId,
      turn_id: preprocessed.turnId,
      event_type: preprocessed.eventType,
      timestamp: preprocessed.timestamp,
      skill_refs: preprocessed.skillRefs,  // 添加 skill_refs
      status: 'success' as TraceStatus,
    };

    switch (preprocessed.eventType) {
      case 'user_input':
        return {
          ...base,
          user_input: preprocessed.content as string,
        };

      case 'assistant_output':
        return {
          ...base,
          assistant_output: preprocessed.content as string,
        };

      case 'tool_call': {
        const toolContent = preprocessed.content as { tool: string; args: Record<string, unknown> };
        return {
          ...base,
          tool_name: toolContent.tool,
          tool_args: toolContent.args,
        };
      }

      case 'tool_result': {
        const resultContent = preprocessed.content as { output: Record<string, unknown> };
        return {
          ...base,
          tool_result: resultContent.output,
        };
      }

      case 'file_change':
        return {
          ...base,
          files_changed: preprocessed.content as string[],
        };

      case 'status':
      default:
        return base;
    }
  }

  /**
   * 获取下一个 turn ID
   */
  private getNextTurnId(sessionId: string): string {
    const current = this.turnCounter.get(sessionId) || 0;
    const next = current + 1;
    this.turnCounter.set(sessionId, next);
    return `turn_${next}`;
  }

  /**
   * 从文件路径提取 session ID
   */
  private extractSessionId(path: string): string {
    const filename = basename(path, '.jsonl');
    // Claude 的 session ID 就是文件名（UUID 格式）
    return filename;
  }

  /**
   * 从文件路径提取项目名称
   */
  private extractProjectName(path: string): string {
    const projectDir = dirname(path);
    const projectName = basename(projectDir);
    // Claude 的项目目录名是编码后的路径，如 "-Users-xuzhang-kuko"
    // 尝试解码
    return projectName.replace(/^-/, '').replace(/-/g, '/');
  }

  /**
   * 手动处理一个 session 文件（公共 API）
   */
  processSessionFile(filePath: string): void {
    if (!existsSync(filePath)) {
      throw new Error(`Claude session file not found: ${filePath}`);
    }

    logger.info(`Processing Claude session file`, { filePath });
    this.processSessionFileInternal(filePath, false);
  }

  /**
   * 获取当前 session ID
   */
  getCurrentSessionId(): string | null {
    return this.currentSessionId;
  }

  /**
   * 设置 projects 目录
   */
  setProjectsDir(dir: string): void {
    this.projectsDir = dir;
  }

  /**
   * 获取 projects 目录
   */
  getProjectsDir(): string {
    return this.projectsDir;
  }

  /**
   * 获取已处理的文件列表
   */
  getProcessedFiles(): string[] {
    return Array.from(this.processedFiles);
  }

  /**
   * 重置处理状态（用于测试）
   */
  reset(): void {
    this.processedFiles.clear();
    this.filePositions.clear();
    this.turnCounter.clear();
    this.currentSessionId = null;
  }
}

// 导出工厂函数
export function createClaudeObserver(projectsDir?: string): ClaudeObserver {
  return new ClaudeObserver(projectsDir);
}
