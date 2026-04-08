import { watch, type FSWatcher } from 'chokidar';
import { existsSync, readFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { BaseObserver } from './base-observer.js';
import { createChildLogger } from '../../utils/logger.js';
import { extractSkillRefsFromSources } from '../../utils/skill-refs.js';
import type { Trace, TraceStatus, PreprocessedTrace } from '../../types/index.js';

const logger = createChildLogger('codex-observer');

/**
 * Codex 原始事件类型
 */
interface CodexRawEvent {
  timestamp: string;
  type: 'session_meta' | 'event_msg' | 'response_item' | 'turn_context';
  payload: Record<string, unknown>;
}

/**
 * Codex Observer
 *
 * 监听 Codex 的活跃会话日志文件（~/.codex/sessions/YYYY/MM/DD/*.jsonl）
 * 基于真实 Codex trace 结构实现
 *
 * 主要改进：
 * 1. 监听正确的目录：sessions/YYYY/MM/DD 而非 archived_sessions
 * 2. 适配真实的事件类型结构
 * 3. 实现预处理层，过滤无关信息
 * 4. 提取 skill 引用
 */
export class CodexObserver extends BaseObserver {
  private watcher: FSWatcher | null = null;
  private sessionsDir: string;
  private sessionIndexPath: string;
  private currentSessionId: string | null = null;
  private turnCounter: number = 0;
  private processedFiles: Set<string> = new Set();
  private processedLineCount: Map<string, number> = new Map();

  constructor(sessionsDir?: string) {
    super('codex');
    this.sessionsDir = sessionsDir ?? this.getDefaultSessionsDir();
    this.sessionIndexPath = join(this.getCodexHome(), 'session_index.jsonl');
  }

  /**
   * 获取 Codex Home 目录
   */
  private getCodexHome(): string {
    return join(process.env.HOME ?? process.env.USERPROFILE ?? '', '.codex');
  }

  /**
   * 获取默认 sessions 目录
   */
  private getDefaultSessionsDir(): string {
    return join(this.getCodexHome(), 'sessions');
  }

  /**
   * 启动 observer
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('Observer already running');
      return;
    }

    if (!existsSync(this.sessionsDir)) {
      logger.warn(`Sessions directory not found: ${this.sessionsDir}`);
      return;
    }

    this.isRunning = true;
    logger.debug('Starting Codex observer', { sessionsDir: this.sessionsDir });

    // 监听 sessions 目录下的所有 JSONL 文件（递归监听 YYYY/MM/DD 子目录）
    const watchPattern = join(this.sessionsDir, '**', '*.jsonl');
    this.watcher = watch(watchPattern, {
      persistent: true,
      // 紧急止血：避免启动时扫描全部历史会话导致 CPU 飙升
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 500, // 文件写入完成需要一定时间
        pollInterval: 300,
      },
    });

    this.watcher.on('add', (path) => this.handleFileAdd(path));
    this.watcher.on('change', (path) => this.handleFileChange(path));

    logger.debug('Codex observer started', { watchPattern });
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

    this.processedFiles.clear();
    this.processedLineCount.clear();
    logger.info('Codex observer stopped');
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
    this.currentSessionId = sessionId;

    logger.debug(`New session detected: ${sessionId}`, { path });

    // 读取整个文件
    this.processSessionFileInternal(path);
  }

  /**
   * 处理文件变化（增量读取）
   */
  private handleFileChange(path: string): void {
    if (!path.endsWith('.jsonl')) {
      return;
    }

    const sessionId = this.extractSessionId(path);
    logger.debug(`Session file changed: ${sessionId}`, { path });

    // 对于活跃会话，文件会持续追加
    // 这里可以实现增量读取逻辑
    // 简化处理：重新读取整个文件
    this.processSessionFileInternal(path);
  }

  /**
   * 处理 session JSONL 文件（内部实现）
   */
  private processSessionFileInternal(path: string): void {
    const sessionId = this.extractSessionId(path);
    const traces: PreprocessedTrace[] = [];

    try {
      const content = readFileSync(path, 'utf-8');
      const lines = content.split('\n').filter((line) => line.trim());
      const prevProcessed = this.processedLineCount.get(path) ?? 0;
      const startIndex = lines.length < prevProcessed ? 0 : prevProcessed;
      const newLines = lines.slice(startIndex);

      for (const line of newLines) {
        try {
          const event = JSON.parse(line) as CodexRawEvent;
          const preprocessed = this.preprocessEvent(sessionId, event);
          if (preprocessed) {
            traces.push(preprocessed);
          }
        } catch (parseError) {
          logger.debug('Skipping malformed NDJSON line', { sessionId, error: parseError });
        }
      }

      // 批量发射预处理后的 traces
      if (traces.length > 0) {
        this.emitPreprocessedTraces(sessionId, traces);
      }

      this.processedLineCount.set(path, lines.length);

      logger.debug(`Processed ${traces.length} incremental traces from session ${sessionId}`, {
        totalLines: lines.length,
        newLines: newLines.length,
      });
    } catch (error) {
      logger.warn(`Failed to read session file: ${path}`, { error });
    }
  }

  /**
   * 预处理单个事件
   * 保留所有语义内容，只进行格式转换
   * 不过滤任何可能包含语义信息的事件
   */
  private preprocessEvent(sessionId: string, event: CodexRawEvent): PreprocessedTrace | null {
    const turnId = this.getNextTurnIdSync();

    switch (event.type) {
      case 'session_meta': {
        // 提取会话元数据（项目上下文）
        // 从 base_instructions 中提取激活的 skills
        // base_instructions 可能是字符串或 {text: string} 对象
        const baseInstructionsRaw = event.payload.base_instructions;
        const baseInstructions =
          typeof baseInstructionsRaw === 'string'
            ? baseInstructionsRaw
            : (baseInstructionsRaw as { text?: string })?.text || '';
        const activatedSkills = this.extractSkillReferences(baseInstructions);

        return {
          sessionId,
          turnId,
          timestamp: event.timestamp,
          eventType: 'status',
          content: {
            // 保留完整的 payload，不只是部分字段
            ...event.payload,
            activatedSkills,
          },
          skillRefs: activatedSkills,
          metadata: {
            originator: event.payload.originator,
            source: event.payload.source,
            // 保留完整的 baseInstructions，不截断
            baseInstructions,
          },
        };
      }

      case 'response_item':
        return this.preprocessResponseItem(sessionId, turnId, event);

      case 'event_msg':
        // 保留 event_msg，可能包含语义信息
        return {
          sessionId,
          turnId,
          timestamp: event.timestamp,
          eventType: 'status',
          content:
            typeof event.payload === 'string' ? event.payload : JSON.stringify(event.payload),
          metadata: {
            originalType: 'event_msg',
          },
        };

      case 'turn_context':
        // 回合上下文，保留完整信息
        return {
          sessionId,
          turnId,
          timestamp: event.timestamp,
          eventType: 'status',
          content:
            typeof event.payload === 'string' ? event.payload : JSON.stringify(event.payload),
          metadata: {
            originalType: 'turn_context',
          },
        };

      default:
        // 保留未知类型的事件，可能包含语义信息
        return {
          sessionId,
          turnId,
          timestamp: event.timestamp,
          eventType: 'status',
          content: event.payload,
          metadata: {
            originalType: event.type,
            rawEvent: event,
          },
        };
    }
  }

  /**
   * 预处理 response_item 事件
   */
  private preprocessResponseItem(
    sessionId: string,
    turnId: string,
    event: CodexRawEvent
  ): PreprocessedTrace | null {
    const payload = event.payload;
    const itemType = payload?.type as string;

    switch (itemType) {
      case 'message': {
        const role = payload.role as string;
        const content = this.extractMessageContent(payload.content);
        const skillRefs = this.extractSkillReferences(content);

        if (role === 'user') {
          return {
            sessionId,
            turnId,
            timestamp: event.timestamp,
            eventType: 'user_input',
            content,
            skillRefs,
          };
        } else if (role === 'assistant') {
          return {
            sessionId,
            turnId,
            timestamp: event.timestamp,
            eventType: 'assistant_output',
            content,
            skillRefs,
          };
        }
        return null;
      }

      case 'function_call': {
        const toolName =
          (payload.name as string) ||
          ((payload.function as Record<string, unknown>)?.name as string);
        const rawArgs = payload.arguments ?? (payload.function as Record<string, unknown>)?.arguments;
        let args: Record<string, unknown> = {};

        if (typeof rawArgs === 'string') {
          try {
            args = JSON.parse(rawArgs) as Record<string, unknown>;
          } catch {
            args = { raw: rawArgs };
          }
        } else if (rawArgs && typeof rawArgs === 'object') {
          args = rawArgs as Record<string, unknown>;
        }

        const skillRefs = extractSkillRefsFromSources([toolName, args]);
        if (skillRefs.length > 0) {
          logger.debug('Extracted skill refs from Codex tool call', {
            sessionId,
            turnId,
            toolName,
            skillRefs,
          });
        }

        return {
          sessionId,
          turnId,
          timestamp: event.timestamp,
          eventType: 'tool_call',
          skillRefs,
          content: {
            tool: toolName,
            args,
          },
          metadata: {
            callId: payload.call_id,
          },
        };
      }

      case 'function_call_output': {
        return {
          sessionId,
          turnId,
          timestamp: event.timestamp,
          eventType: 'tool_result',
          content: {
            callId: payload.call_id,
            output: payload.output,
          },
        };
      }

      default:
        return null;
    }
  }

  /**
   * 提取消息内容
   */
  private extractMessageContent(content: unknown): string {
    if (typeof content === 'string') {
      return content;
    }

    if (Array.isArray(content)) {
      // 处理多模态内容数组
      const textParts: string[] = [];
      for (const part of content as Array<string | { type?: string; text?: unknown }>) {
        if (typeof part === 'string') {
          textParts.push(part);
        } else if (
          (part?.type === 'input_text' || part?.type === 'output_text') &&
          typeof part.text === 'string'
        ) {
          textParts.push(part.text);
        } else if (part?.type === 'text' && typeof part.text === 'string') {
          textParts.push(part.text);
        }
      }
      return textParts.join('\n');
    }

    return JSON.stringify(content);
  }

  /**
   * 提取 skill 引用
   * 格式: [$skillname]
   */
  private extractSkillReferences(text: string): string[] {
    const matches = text.match(/\[\$([^\]]+)\]/g);
    if (!matches) return [];

    return matches.map((match) => match.slice(2, -1)); // 去掉 [$ 和 ]
  }

  /**
   * 发射预处理后的 traces
   */
  private emitPreprocessedTraces(sessionId: string, traces: PreprocessedTrace[]): void {
    // 按类型分组统计
    const typeCount = new Map<string, number>();
    const skillRefs = new Set<string>();

    for (const trace of traces) {
      typeCount.set(trace.eventType, (typeCount.get(trace.eventType) || 0) + 1);
      if (trace.skillRefs) {
        trace.skillRefs.forEach((ref) => skillRefs.add(ref));
      }

      // 转换为标准 Trace 格式并发射
      const standardTrace = this.convertToStandardTrace(trace);
      this.emitTrace(standardTrace);
    }

    const summary = {
      totalTraces: traces.length,
      typeBreakdown: Object.fromEntries(typeCount),
      detectedSkills: Array.from(skillRefs),
    };
    if (skillRefs.size > 0) {
      logger.info(`Session ${sessionId} trace summary`, summary);
    } else {
      logger.debug(`Session ${sessionId} trace summary`, summary);
    }
  }

  /**
   * 转换为标准 Trace 格式
   */
  private convertToStandardTrace(preprocessed: PreprocessedTrace): Trace {
    const base = {
      trace_id: `${preprocessed.sessionId}_${preprocessed.turnId}`,
      runtime: 'codex' as const,
      session_id: preprocessed.sessionId,
      turn_id: preprocessed.turnId,
      event_type: preprocessed.eventType,
      timestamp: preprocessed.timestamp,
      skill_refs: preprocessed.skillRefs, // 添加 skill_refs
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
   * 获取下一个 turn ID（同步版本）
   */
  private getNextTurnIdSync(): string {
    this.turnCounter++;
    return `turn_${this.turnCounter}`;
  }

  /**
   * 从文件路径提取 session ID
   */
  private extractSessionId(path: string): string {
    const filename = basename(path, '.jsonl');
    // 从 rollout-2026-03-18T01-30-56-019cfcd9-c52d-7270-a188-017d7172715e.jsonl
    // 提取 UUID 部分
    const match = filename.match(/[a-f0-9-]{36}$/);
    return match ? match[0] : filename;
  }

  /**
   * 手动处理一个 session 文件（公共 API）
   */
  processSessionFile(filePath: string): void {
    if (!existsSync(filePath)) {
      throw new Error(`Session file not found: ${filePath}`);
    }

    logger.info(`Processing session file: ${filePath}`);
    this.processSessionFileInternal(filePath);
  }

  /**
   * 获取当前 session ID
   */
  getCurrentSessionId(): string | null {
    return this.currentSessionId;
  }

  /**
   * 设置 sessions 目录
   */
  setSessionsDir(dir: string): void {
    this.sessionsDir = dir;
  }

  /**
   * 获取 sessions 目录
   */
  getSessionsDir(): string {
    return this.sessionsDir;
  }

  /**
   * 读取 session 索引获取会话元数据
   */
  readSessionIndex(): Array<{ id: string; thread_name: string; updated_at: string }> {
    if (!existsSync(this.sessionIndexPath)) {
      return [];
    }

    try {
      const content = readFileSync(this.sessionIndexPath, 'utf-8');
      const lines = content.split('\n').filter((line) => line.trim());

      return lines
        .map((line): { id: string; thread_name: string; updated_at: string } | null => {
          try {
            return JSON.parse(line) as { id: string; thread_name: string; updated_at: string };
          } catch {
            return null;
          }
        })
        .filter(Boolean) as Array<{ id: string; thread_name: string; updated_at: string }>;
    } catch (error) {
      logger.warn('Failed to read session index', { error });
      return [];
    }
  }
}

// 导出工厂函数
export function createCodexObserver(sessionsDir?: string): CodexObserver {
  return new CodexObserver(sessionsDir);
}
