import { createReadStream, createWriteStream, existsSync, mkdirSync, appendFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { join, dirname } from 'node:path';
import { createChildLogger } from '../utils/logger.js';
import type { Trace, EvolutionRecord } from '../types/index.js';

const logger = createChildLogger('ndjson');

/**
 * 文件锁工具（基于文件存在性）
 */
class FileLock {
  private lockPath: string;
  private locked: boolean = false;

  constructor(filePath: string) {
    this.lockPath = `${filePath}.lock`;
  }

  /**
   * 获取文件锁（使用指数退避策略）
   */
  lock(): void {
    if (this.locked) {
      return; // 已经持有锁
    }

    // 使用 appendFileSync 的 'wx' 模式实现原子创建
    // 如果文件已存在会抛出错误
    let retries = 0;
    const maxRetries = 100;
    const baseDelay = 10; // 基础延迟 10ms
    const maxDelay = 1000; // 最大延迟 1000ms
    
    while (retries < maxRetries) {
      try {
        appendFileSync(this.lockPath, '', { flag: 'wx' });
        this.locked = true;
        return;
      } catch (error) {
        // 文件已存在，使用指数退避等待后重试
        retries++;
        if (retries >= maxRetries) {
          throw new Error(`Failed to acquire lock after ${maxRetries} retries`);
        }
        
        // 指数退避：delay = min(baseDelay * 2^retries, maxDelay)
        const delay = Math.min(baseDelay * Math.pow(2, retries), maxDelay);
        
        // 使用同步等待，避免 CPU 空转
        const start = Date.now();
        while (Date.now() - start < delay) {
          // 短暂等待
        }
      }
    }
  }

  /**
   * 释放文件锁
   */
  unlock(): void {
    if (!this.locked) {
      return;
    }

    try {
      // 删除锁文件
      if (existsSync(this.lockPath)) {
        // 使用 unlinkSync 删除文件
        const { unlinkSync } = require('node:fs');
        unlinkSync(this.lockPath);
      }
    } catch (error) {
      logger.warn('Failed to unlock file', { error });
    } finally {
      this.locked = false;
    }
  }

  /**
   * 执行带锁的操作
   */
  withLock<T>(operation: () => T): T {
    this.lock();
    try {
      return operation();
    } finally {
      this.unlock();
    }
  }
}

/**
 * NDJSON 读写器
 */
export class NDJSONReader<T> {
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  /**
   * 检查文件是否存在
   */
  exists(): boolean {
    return existsSync(this.filePath);
  }

  /**
   * 逐行读取并解析
   */
  async *readLines(): AsyncGenerator<T> {
    if (!this.exists()) {
      return;
    }

    const stream = createReadStream(this.filePath, { encoding: 'utf-8' });
    const rl = createInterface({
      input: stream,
      crlfDelay: Infinity,
    });

    let lineNumber = 0;
    for await (const line of rl) {
      lineNumber++;
      if (line.trim() === '') continue;

      try {
        const item = JSON.parse(line) as T;
        yield item;
      } catch (error) {
        logger.warn(`Failed to parse line ${lineNumber}`, { error, line: line.substring(0, 100) });
      }
    }
  }

  /**
   * 读取所有记录
   */
  async readAll(): Promise<T[]> {
    const records: T[] = [];
    for await (const record of this.readLines()) {
      records.push(record);
    }
    return records;
  }

  /**
   * 读取最后 N 条记录
   */
  async readLast(n: number): Promise<T[]> {
    const allRecords = await this.readAll();
    return allRecords.slice(-n);
  }

  /**
   * 按条件过滤
   */
  async *filter(predicate: (item: T) => boolean): AsyncGenerator<T> {
    for await (const item of this.readLines()) {
      if (predicate(item)) {
        yield item;
      }
    }
  }

  /**
   * 统计记录数
   */
  async count(): Promise<number> {
    let count = 0;
    for await (const record of this.readLines()) {
      if (record) {
        count++;
      }
    }
    return count;
  }
}

/**
 * NDJSON 写入器
 */
export class NDJSONWriter<T> {
  private filePath: string;
  private fileLock: FileLock;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.fileLock = new FileLock(filePath);
    this.ensureDirectory();
  }

  /**
   * 确保目录存在
   */
  private ensureDirectory(): void {
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * 追加一条记录（带文件锁）
   */
  append(record: T): void {
    const line = JSON.stringify(record) + '\n';
    this.fileLock.withLock(() => {
      appendFileSync(this.filePath, line, 'utf-8');
    });
  }

  /**
   * 批量追加记录（带文件锁）
   */
  appendBatch(records: T[]): void {
    const lines = records.map((r) => JSON.stringify(r)).join('\n') + '\n';
    this.fileLock.withLock(() => {
      appendFileSync(this.filePath, lines, 'utf-8');
    });
  }

  /**
   * 清空文件
   */
  clear(): void {
    const stream = createWriteStream(this.filePath, { flags: 'w' });
    stream.end();
  }

  /**
   * 获取文件路径
   */
  getPath(): string {
    return this.filePath;
  }
}

/**
 * Trace NDJSON 存储
 */
export class TraceStore {
  private writer: NDJSONWriter<Trace>;
  private reader: NDJSONReader<Trace>;

  constructor(tracesDir: string, sessionId: string) {
    const filePath = join(tracesDir, `${sessionId}.ndjson`);
    this.writer = new NDJSONWriter<Trace>(filePath);
    this.reader = new NDJSONReader<Trace>(filePath);
  }

  /**
   * 记录 trace
   */
  append(trace: Trace): void {
    this.writer.append(trace);
    logger.debug('Trace appended', { trace_id: trace.trace_id, event_type: trace.event_type });
  }

  /**
   * 读取所有 traces
   */
  async readAll(): Promise<Trace[]> {
    return this.reader.readAll();
  }

  /**
   * 读取 session 的 traces
   */
  async readBySession(sessionId: string): Promise<Trace[]> {
    const traces: Trace[] = [];
    for await (const trace of this.reader.filter((t) => t.session_id === sessionId)) {
      traces.push(trace);
    }
    return traces;
  }

  /**
   * 读取最近的 traces
   */
  async readRecent(count: number): Promise<Trace[]> {
    return this.reader.readLast(count);
  }

  /**
   * 关闭存储（释放资源）
   */
  close(): void {
    // FileLock 会在每次操作后自动释放锁
    // 这里主要是为了接口一致性
    logger.debug('TraceStore closed');
  }
}

/**
 * Journal NDJSON 存储
 */
export class JournalStore {
  private writer: NDJSONWriter<EvolutionRecord>;
  private reader: NDJSONReader<EvolutionRecord>;

  constructor(journalPath: string) {
    this.writer = new NDJSONWriter<EvolutionRecord>(journalPath);
    this.reader = new NDJSONReader<EvolutionRecord>(journalPath);
  }

  /**
   * 记录演化
   */
  append(record: EvolutionRecord): void {
    this.writer.append(record);
    logger.info('Evolution record appended', {
      shadow_id: record.shadow_id,
      revision: record.revision,
      change_type: record.change_type,
    });
  }

  /**
   * 读取所有记录
   */
  async readAll(): Promise<EvolutionRecord[]> {
    return this.reader.readAll();
  }

  /**
   * 读取指定 revision 范围的记录
   */
  async readRange(fromRevision: number, toRevision: number): Promise<EvolutionRecord[]> {
    const records: EvolutionRecord[] = [];
    for await (const record of this.reader.filter(
      (r) => r.revision >= fromRevision && r.revision <= toRevision
    )) {
      records.push(record);
    }
    return records;
  }

  /**
   * 读取最后 N 条记录
   */
  async readLast(n: number): Promise<EvolutionRecord[]> {
    return this.reader.readLast(n);
  }

  /**
   * 获取最新 revision
   */
  async getLatestRevision(): Promise<number> {
    const records = await this.reader.readLast(1);
    return records.length > 0 ? records[0].revision : 0;
  }

  /**
   * 获取指定 revision 的记录
   */
  async getByRevision(revision: number): Promise<EvolutionRecord | null> {
    for await (const record of this.reader.filter((r) => r.revision === revision)) {
      return record;
    }
    return null;
  }
}

// 导出工厂函数
export function createTraceStore(tracesDir: string, sessionId: string): TraceStore {
  return new TraceStore(tracesDir, sessionId);
}

export function createJournalStore(journalPath: string): JournalStore {
  return new JournalStore(journalPath);
}