import { watch, type FSWatcher } from 'chokidar';
import {
  closeSync,
  existsSync,
  openSync,
  readFileSync,
  readSync,
  readdirSync,
  statSync,
} from 'node:fs';
import { join, basename, resolve } from 'node:path';
import { BaseObserver } from './base-observer.js';
import { createChildLogger } from '../../utils/logger.js';
import { extractSkillRefs, extractSkillRefsFromSources } from '../../utils/skill-refs.js';
import type { Trace, TraceStatus, PreprocessedTrace } from '../../types/index.js';

const logger = createChildLogger('codex-observer');

/**
 * Codex 原始事件类型
 */
interface CodexRawEvent {
  timestamp: string;
  type: 'session_meta' | 'event_msg' | 'response_item' | 'turn_context' | 'compacted';
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
  private reconciliationTimer: NodeJS.Timeout | null = null;
  private sessionsDir: string;
  private sessionIndexPath: string;
  private currentSessionId: string | null = null;
  private turnCounter: number = 0;
  private processedFiles: Set<string> = new Set();
  private processedByteOffset: Map<string, number> = new Map();
  private pendingLineFragment: Map<string, string> = new Map();
  private sessionProjectPaths: Map<string, string> = new Map();
  // 启动恢复只保留极小窗口，避免把历史长会话一次性灌回优化链路。
  private readonly bootstrapFileLimit = 1;
  private readonly bootstrapTailLineLimit = 10;
  private readonly reconciliationFileLimit = 3;
  private readonly reconciliationIntervalMs = 3000;
  private readonly readChunkSize = 65536;
  private readonly maxMessageChars = 8000;
  private readonly maxStructuredPreviewChars = 4000;
  private readonly maxSkillReferenceScanChars = 16000;

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
    });

    this.watcher.on('add', (path) => this.handleFileAdd(path));
    this.watcher.on('change', (path) => this.handleFileChange(path));
    this.watcher.on('unlink', (path) => this.handleFileUnlink(path));
    this.primeSessionOffsets();
    this.bootstrapRecentSessionFiles(this.bootstrapFileLimit);
    this.startReconciliationLoop();

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

    if (this.reconciliationTimer) {
      clearInterval(this.reconciliationTimer);
      this.reconciliationTimer = null;
    }

    this.processedFiles.clear();
    this.processedByteOffset.clear();
    this.pendingLineFragment.clear();
    this.sessionProjectPaths.clear();
    logger.info('Codex observer stopped');
  }

  /**
   * 处理新文件
   */
  private handleFileAdd(path: string): void {
    if (!path.endsWith('.jsonl')) {
      return;
    }

    const currentSize = this.getFileSize(path);
    const previousOffset = this.processedByteOffset.get(path) ?? 0;
    const sessionId = this.extractSessionId(path);

    // 对于 watcher 重连或底层抖动后重新上报 add 的场景，
    // 不能直接短路，否则会把这段增量永久漏掉。
    if (this.processedFiles.has(path)) {
      if (currentSize !== null && currentSize !== previousOffset) {
        logger.warn('Recovering session file growth from repeated add event', {
          sessionId,
          path,
          previousOffset,
          currentSize,
        });
        this.processSessionFileInternal(path);
      }
      return;
    }
    this.processedFiles.add(path);

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

  private handleFileUnlink(path: string): void {
    this.processedFiles.delete(path);
    this.processedByteOffset.delete(path);
    this.pendingLineFragment.delete(path);
    logger.debug('Session file removed from observer tracking', { path });
  }

  /**
   * 启动时回放最近活跃的会话文件，避免 daemon 重启后必须等待新文件创建
   */
  private bootstrapRecentSessionFiles(limit: number): void {
    const candidates = this.listRecentSessionFiles(limit);
    for (const path of candidates) {
      if (this.processedFiles.has(path)) continue;
      this.processedFiles.add(path);
      this.processSessionFileInternal(path, {
        bootstrapTailLines: this.bootstrapTailLineLimit,
      });
    }
  }

  private primeSessionOffsets(): void {
    const sessionFiles = this.collectSessionFiles(this.sessionsDir);
    for (const path of sessionFiles) {
      if (this.processedByteOffset.has(path)) continue;
      try {
        this.processedByteOffset.set(path, statSync(path).size);
      } catch {
        // ignore files that disappear during startup scan
      }
    }
    logger.debug('Primed session offsets for Codex observer', {
      sessionFileCount: sessionFiles.length,
    });
  }

  private startReconciliationLoop(): void {
    if (this.reconciliationTimer) {
      clearInterval(this.reconciliationTimer);
    }

    this.reconciliationTimer = setInterval(() => {
      this.reconcileRecentSessionGrowth(this.reconciliationFileLimit);
    }, this.reconciliationIntervalMs);
  }

  private reconcileRecentSessionGrowth(limit = this.reconciliationFileLimit): void {
    const candidates = this.listRecentSessionFiles(limit);
    for (const path of candidates) {
      const currentSize = this.getFileSize(path);
      if (currentSize === null) {
        continue;
      }

      const previousOffset = this.processedByteOffset.get(path);
      const sessionId = this.extractSessionId(path);

      if (!this.processedFiles.has(path)) {
        this.processedFiles.add(path);
        if (currentSize > 0) {
          logger.info('Recovered unseen recent session file during reconciliation', {
            sessionId,
            path,
            currentSize,
          });
          this.processSessionFileInternal(path);
        }
        continue;
      }

      if (previousOffset === undefined || currentSize !== previousOffset) {
        logger.warn('Recovered missed session file growth during reconciliation', {
          sessionId,
          path,
          previousOffset: previousOffset ?? 0,
          currentSize,
        });
        this.processSessionFileInternal(path);
      }
    }
  }

  private listRecentSessionFiles(limit: number): string[] {
    const files = this.collectSessionFiles(this.sessionsDir)
      .map((path) => {
        try {
          return { path, mtimeMs: statSync(path).mtimeMs };
        } catch {
          return null;
        }
      })
      .filter((item): item is { path: string; mtimeMs: number } => item !== null)
      .sort((a, b) => b.mtimeMs - a.mtimeMs)
      .slice(0, Math.max(limit, 0));
    return files.map((item) => item.path);
  }

  private getFileSize(path: string): number | null {
    try {
      return statSync(path).size;
    } catch {
      return null;
    }
  }

  private collectSessionFiles(dir: string): string[] {
    if (!existsSync(dir)) return [];
    const files: string[] = [];
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          files.push(...this.collectSessionFiles(fullPath));
        } else if (entry.isFile() && fullPath.endsWith('.jsonl')) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      logger.debug('Failed to collect session files for bootstrap', { dir, error });
    }
    return files;
  }

  /**
   * 处理 session JSONL 文件（内部实现）
   */
  private processSessionFileInternal(
    path: string,
    options?: { bootstrapTailLines?: number }
  ): void {
    const sessionId = this.extractSessionId(path);
    const traces: PreprocessedTrace[] = [];

    try {
      const bootstrapTailLines = options?.bootstrapTailLines ?? 0;
      const previousOffset = this.processedByteOffset.get(path) ?? 0;
      const { lines: newLines, nextOffset } =
        bootstrapTailLines > 0
          ? this.readSessionTailLines(path, bootstrapTailLines)
          : this.readSessionLinesSinceOffset(path);

      for (const line of newLines) {
        const rawType = this.peekRawEventType(line);
        if (rawType === 'compacted' || rawType === 'event_msg') {
          continue;
        }
        try {
          const event = JSON.parse(line) as CodexRawEvent;
          this.captureSessionProjectPath(sessionId, event);
          if (event.type === 'turn_context') {
            continue;
          }
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

      this.processedByteOffset.set(path, nextOffset);

      logger.debug(`Processed ${traces.length} incremental traces from session ${sessionId}`, {
        nextOffset,
        previousOffset,
        bytesRead: Math.max(nextOffset - previousOffset, 0),
        newLines: newLines.length,
        bootstrapTailLines,
        readMode: bootstrapTailLines > 0 ? 'bootstrap_tail' : 'incremental_offset',
      });
    } catch (error) {
      logger.warn(`Failed to read session file: ${path}`, { error });
    }
  }

  private readSessionLinesSinceOffset(path: string): { lines: string[]; nextOffset: number } {
    const fileSize = statSync(path).size;
    const previousOffset = this.processedByteOffset.get(path) ?? 0;
    if (fileSize < previousOffset) {
      this.pendingLineFragment.delete(path);
    }
    const startOffset = fileSize < previousOffset ? 0 : previousOffset;
    if (fileSize <= startOffset) {
      return { lines: [], nextOffset: fileSize };
    }

    const fd = openSync(path, 'r');
    try {
      const readSize = fileSize - startOffset;
      const buffer = Buffer.alloc(readSize);
      readSync(fd, buffer, 0, readSize, startOffset);
      const previousFragment = this.pendingLineFragment.get(path) ?? '';
      const content = previousFragment + buffer.toString('utf-8');
      const parts = content.split('\n');
      const hasCompleteTrailingLine = content.endsWith('\n');
      const nextFragment = hasCompleteTrailingLine ? '' : (parts.pop() ?? '');
      if (nextFragment) {
        this.pendingLineFragment.set(path, nextFragment);
        logger.debug('Buffered partial Codex session line awaiting completion', {
          sessionId: this.extractSessionId(path),
          path,
          fragmentChars: nextFragment.length,
        });
      } else {
        this.pendingLineFragment.delete(path);
      }
      return {
        lines: parts.filter((line) => line.trim()),
        nextOffset: fileSize,
      };
    } finally {
      closeSync(fd);
    }
  }

  private readSessionTailLines(
    path: string,
    maxLines: number
  ): { lines: string[]; nextOffset: number } {
    const fileSize = statSync(path).size;
    if (fileSize === 0 || maxLines <= 0) {
      return { lines: [], nextOffset: fileSize };
    }

    const fd = openSync(path, 'r');
    try {
      let position = fileSize;
      let remainder = '';
      const lines: string[] = [];

      while (position > 0 && lines.length < maxLines) {
        const readSize = Math.min(this.readChunkSize, position);
        position -= readSize;
        const buffer = Buffer.alloc(readSize);
        readSync(fd, buffer, 0, readSize, position);
        const chunk = buffer.toString('utf-8') + remainder;
        const parts = chunk.split('\n');
        remainder = parts[0] ?? '';
        for (let index = parts.length - 1; index >= 1 && lines.length < maxLines; index -= 1) {
          const line = parts[index];
          if (line.trim()) {
            lines.push(line);
          }
        }
      }

      if (remainder.trim() && lines.length < maxLines) {
        lines.push(remainder);
      }

      return {
        lines: lines.reverse(),
        nextOffset: fileSize,
      };
    } finally {
      closeSync(fd);
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
        this.captureSessionProjectPath(sessionId, event);
        // 提取会话元数据（项目上下文）
        // 从 base_instructions 中提取激活的 skills
        // base_instructions 可能是字符串或 {text: string} 对象
        const baseInstructionsRaw = event.payload.base_instructions;
        const baseInstructions =
          typeof baseInstructionsRaw === 'string'
            ? baseInstructionsRaw
            : (baseInstructionsRaw as { text?: string })?.text || '';
        const activatedSkills = this.extractSkillReferences(
          baseInstructions.slice(0, this.maxSkillReferenceScanChars)
        );

        return {
          sessionId,
          turnId,
          timestamp: event.timestamp,
          eventType: 'status',
          content: {
            activatedSkills,
          },
          skillRefs: activatedSkills,
          metadata: {
            projectPath: this.sessionProjectPaths.get(sessionId),
            originator: event.payload.originator,
            source: event.payload.source,
          },
        };
      }

      case 'response_item':
        return this.preprocessResponseItem(sessionId, turnId, event);

      case 'event_msg':
      case 'turn_context':
      case 'compacted':
        return null;

      default:
        return null;
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
        if (role !== 'user' && role !== 'assistant') {
          return null;
        }
        const fullContent = this.extractMessageContent(payload.content, this.maxMessageChars * 2);
        const skillRefs = this.extractSkillReferences(
          fullContent.slice(0, this.maxSkillReferenceScanChars)
        );
        const content = this.truncateText(fullContent, this.maxMessageChars);

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
        const rawArgs =
          payload.arguments ?? (payload.function as Record<string, unknown>)?.arguments;
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
            args: this.compactStructuredValue(args),
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
            output: this.compactStructuredValue(payload.output),
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
  private extractMessageContent(content: unknown, maxChars = Number.POSITIVE_INFINITY): string {
    if (typeof content === 'string') {
      return this.truncateText(content, maxChars);
    }

    if (Array.isArray(content)) {
      // 处理多模态内容数组
      const textParts: string[] = [];
      let totalLength = 0;
      for (const part of content as Array<string | { type?: string; text?: unknown }>) {
        if (typeof part === 'string') {
          const next = this.truncateText(part, Math.max(maxChars - totalLength, 0));
          textParts.push(next);
          totalLength += next.length;
        } else if (
          (part?.type === 'input_text' || part?.type === 'output_text') &&
          typeof part.text === 'string'
        ) {
          const next = this.truncateText(part.text, Math.max(maxChars - totalLength, 0));
          textParts.push(next);
          totalLength += next.length;
        } else if (part?.type === 'text' && typeof part.text === 'string') {
          const next = this.truncateText(part.text, Math.max(maxChars - totalLength, 0));
          textParts.push(next);
          totalLength += next.length;
        }
        if (totalLength >= maxChars) {
          break;
        }
      }
      return textParts.join('\n');
    }

    return this.truncateText(JSON.stringify(content), maxChars);
  }

  private truncateText(text: string, maxChars: number): string {
    if (text.length <= maxChars) {
      return text;
    }
    return text.slice(0, maxChars) + '…';
  }

  private compactStructuredValue(value: unknown): Record<string, unknown> {
    if (typeof value === 'string') {
      const preview = this.truncateText(value, this.maxStructuredPreviewChars);
      return preview ? { preview, truncated: value.length > this.maxStructuredPreviewChars } : {};
    }
    if (!value || typeof value !== 'object') {
      return { value };
    }

    if (Array.isArray(value)) {
      return {
        kind: 'array',
        itemCount: value.length,
        preview: value.slice(0, 3).map((item) => this.compactPrimitive(item)),
        truncated: value.length > 3,
      };
    }

    const objectValue = value as Record<string, unknown>;
    const entries = Object.entries(objectValue);
    const previewEntries = entries
      .slice(0, 8)
      .map(([key, item]) => [key, this.compactPrimitive(item)]);
    const previewObject = Object.fromEntries(previewEntries);
    const base = {
      kind: 'object',
      keyCount: entries.length,
      preview: previewObject,
      truncated: entries.length > previewEntries.length,
    };

    try {
      const previewJson = JSON.stringify(base);
      if (previewJson.length <= this.maxStructuredPreviewChars) {
        return base;
      }
      return { ...base, preview: this.truncateText(previewJson, this.maxStructuredPreviewChars) };
    } catch {
      return base;
    }
  }

  private compactPrimitive(value: unknown): unknown {
    if (typeof value === 'string') {
      return this.truncateText(value, 240);
    }
    if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
      return value;
    }
    if (Array.isArray(value)) {
      return `[array:${value.length}]`;
    }
    if (value && typeof value === 'object') {
      return `[object:${Object.keys(value as Record<string, unknown>)
        .slice(0, 5)
        .join(',')}]`;
    }
    return String(value);
  }

  private peekRawEventType(line: string): string | null {
    const match = line.slice(0, 256).match(/"type":"([^"]+)"/);
    return match ? match[1] : null;
  }

  /**
   * 提取 skill 引用
   * 格式: [$skillname]
   */
  private extractSkillReferences(text: string): string[] {
    return extractSkillRefs(text);
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
    const projectPath =
      (typeof preprocessed.metadata?.projectPath === 'string'
        ? preprocessed.metadata.projectPath
        : this.sessionProjectPaths.get(preprocessed.sessionId)) ?? undefined;
    const metadata =
      projectPath || preprocessed.metadata
        ? {
            ...(preprocessed.metadata ?? {}),
            ...(projectPath ? { projectPath } : {}),
          }
        : undefined;
    const base = {
      trace_id: `${preprocessed.sessionId}_${preprocessed.turnId}`,
      runtime: 'codex' as const,
      session_id: preprocessed.sessionId,
      turn_id: preprocessed.turnId,
      event_type: preprocessed.eventType,
      timestamp: preprocessed.timestamp,
      skill_refs: preprocessed.skillRefs, // 添加 skill_refs
      status: 'success' as TraceStatus,
      metadata,
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

  private captureSessionProjectPath(sessionId: string, event: CodexRawEvent): void {
    const projectPath = this.extractProjectPathFromPayload(event.payload);
    if (!projectPath) {
      return;
    }

    this.sessionProjectPaths.set(sessionId, projectPath);
  }

  private extractProjectPathFromPayload(payload: Record<string, unknown>): string | null {
    const directCwd = payload.cwd;
    if (typeof directCwd === 'string' && directCwd.trim()) {
      return resolve(directCwd);
    }

    const nestedContext = payload.context;
    if (nestedContext && typeof nestedContext === 'object') {
      const nestedCwd = (nestedContext as Record<string, unknown>).cwd;
      if (typeof nestedCwd === 'string' && nestedCwd.trim()) {
        return resolve(nestedCwd);
      }
    }

    return null;
  }
}

// 导出工厂函数
export function createCodexObserver(sessionsDir?: string): CodexObserver {
  return new CodexObserver(sessionsDir);
}
