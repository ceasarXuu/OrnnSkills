import { watch, type FSWatcher } from 'chokidar';
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';
import { createInterface } from 'node:readline';
import { BaseObserver } from './base-observer.js';
import { createChildLogger } from '../../utils/logger.js';

const logger = createChildLogger('codex-observer');

/**
 * Codex Observer
 * 监听 Codex 的 JSONL 事件流和 session 日志
 */
export class CodexObserver extends BaseObserver {
  private watcher: FSWatcher | null = null;
  private sessionDir: string;
  private currentSessionId: string | null = null;
  private turnCounter: number = 0;
  private lastFileSize: Map<string, number> = new Map();

  constructor(sessionDir?: string) {
    super('codex');
    this.sessionDir = sessionDir ?? this.getDefaultSessionDir();
  }

  /**
   * 获取默认 session 目录
   */
  private getDefaultSessionDir(): string {
    const home = process.env.HOME ?? process.env.USERPROFILE ?? '';
    return join(home, '.codex', 'sessions');
  }

  /**
   * 启动 observer
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('Observer already running');
      return;
    }

    if (!existsSync(this.sessionDir)) {
      logger.warn(`Session directory not found: ${this.sessionDir}`);
      return;
    }

    this.isRunning = true;
    logger.info('Starting Codex observer', { sessionDir: this.sessionDir });

    // 监听 session 目录的变化
    this.watcher = watch(this.sessionDir, {
      persistent: true,
      ignoreInitial: false,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50,
      },
    });

    this.watcher.on('add', (path) => this.handleFileAdd(path));
    this.watcher.on('change', (path) => this.handleFileChange(path));

    logger.info('Codex observer started');
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

    logger.info('Codex observer stopped');
  }

  /**
   * 处理新文件
   */
  private handleFileAdd(path: string): void {
    if (!path.endsWith('.jsonl')) {
      return;
    }

    const sessionId = this.extractSessionId(path);
    this.currentSessionId = sessionId;
    this.lastFileSize.set(path, 0);

    logger.info(`New session detected: ${sessionId}`, { path });

    // 读取整个文件
    this.processJsonlFile(path);
  }

  /**
   * 处理文件变化
   */
  private handleFileChange(path: string): void {
    if (!path.endsWith('.jsonl')) {
      return;
    }

    const lastSize = this.lastFileSize.get(path) ?? 0;
    const currentSize = this.getFileSize(path);

    if (currentSize > lastSize) {
      // 只读取新增的部分
      this.processJsonlFileIncremental(path, lastSize);
      this.lastFileSize.set(path, currentSize);
    }
  }

  /**
   * 处理 JSONL 文件（全量）
   */
  private processJsonlFile(path: string): void {
    const sessionId = this.extractSessionId(path);

    try {
      const content = readFileSync(path, 'utf-8');
      const lines = content.split('\n').filter((line) => line.trim());

      for (const line of lines) {
        try {
          const event = JSON.parse(line) as Record<string, unknown>;
          this.processEvent(sessionId, event);
        } catch {
          // 忽略解析错误
        }
      }
    } catch (error) {
      logger.warn(`Failed to read JSONL file: ${path}`, { error });
    }
  }

  /**
   * 处理 JSONL 文件（增量）
   */
  private processJsonlFileIncremental(path: string, startOffset: number): void {
    const sessionId = this.extractSessionId(path);

    try {
      const stream = createReadStream(path, {
        start: startOffset,
        encoding: 'utf-8',
      });

      const rl = createInterface({
        input: stream,
        crlfDelay: Infinity,
      });

      rl.on('line', (line) => {
        if (line.trim()) {
          try {
            const event = JSON.parse(line) as Record<string, unknown>;
            this.processEvent(sessionId, event);
          } catch {
            // 忽略解析错误
          }
        }
      });
    } catch (error) {
      logger.warn(`Failed to read JSONL file incrementally: ${path}`, { error });
    }
  }

  /**
   * 处理单个事件
   */
  private processEvent(sessionId: string, event: Record<string, unknown>): void {
    const turnId = `turn_${++this.turnCounter}`;

    // 根据事件类型创建相应的 trace
    switch (event.type) {
      case 'user_input':
        this.emitTrace(
          this.createUserInputTrace(sessionId, turnId, event.content as string)
        );
        break;

      case 'assistant_output':
      case 'assistant_message':
        this.emitTrace(
          this.createAssistantOutputTrace(sessionId, turnId, event.content as string)
        );
        break;

      case 'tool_call':
        this.emitTrace(
          this.createToolCallTrace(sessionId, turnId, event.tool as string, (event.args as Record<string, unknown>) ?? {})
        );
        break;

      case 'tool_result':
        this.emitTrace(
          this.createToolResultTrace(
            sessionId,
            turnId,
            event.tool as string,
            (event.result as Record<string, unknown>) ?? {},
            event.status === 'error' ? 'failure' : 'success'
          )
        );
        break;

      case 'file_change':
      case 'file_write':
      case 'file_edit':
        if (event.files) {
          this.emitTrace(
            this.createFileChangeTrace(sessionId, turnId, event.files as string[])
          );
        }
        break;

      case 'retry':
        this.emitTrace(
          this.createRetryTrace(sessionId, turnId, event.reason as string)
        );
        break;

      case 'error':
        this.emitTrace(
          this.createStatusTrace(sessionId, turnId, 'failure', {
            error: event.error,
          })
        );
        break;

      case 'session_start':
        logger.info(`Session started: ${sessionId}`);
        break;

      case 'session_end':
        logger.info(`Session ended: ${sessionId}`);
        break;

      default:
        // 忽略未知事件类型
        break;
    }
  }

  /**
   * 从文件路径提取 session ID
   */
  private extractSessionId(path: string): string {
    const filename = basename(path, '.jsonl');
    return filename;
  }

  /**
   * 获取文件大小
   */
  private getFileSize(path: string): number {
    try {
      return statSync(path).size;
    } catch {
      return 0;
    }
  }

  /**
   * 手动处理一个 session 文件
   */
  processSessionFile(filePath: string): void {
    if (!existsSync(filePath)) {
      throw new Error(`Session file not found: ${filePath}`);
    }

    logger.info(`Processing session file: ${filePath}`);
    this.processJsonlFile(filePath);
  }

  /**
   * 获取当前 session ID
   */
  getCurrentSessionId(): string | null {
    return this.currentSessionId;
  }

  /**
   * 设置 session 目录
   */
  setSessionDir(dir: string): void {
    this.sessionDir = dir;
  }

  /**
   * 获取 session 目录
   */
  getSessionDir(): string {
    return this.sessionDir;
  }
}

// 导出工厂函数
export function createCodexObserver(sessionDir?: string): CodexObserver {
  return new CodexObserver(sessionDir);
}