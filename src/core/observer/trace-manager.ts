import { join } from 'node:path';
import { createChildLogger } from '../../utils/logger.js';
import { createTraceStore } from '../../storage/ndjson.js';
import { createSQLiteStorage } from '../../storage/sqlite.js';
import {
  compareTraceTimestampAsc,
  listTraceNdjsonPaths,
  mergeUniqueRecentTraces,
  tailTraceRecords,
} from './trace-manager-helpers.js';
import type { Trace, RuntimeType } from '../../types/index.js';

const logger = createChildLogger('trace-manager');
const RECENT_TRACE_BUFFER_LIMIT = 1000;
const MIN_RECENT_TRACE_HYDRATION = 200;

/**
 * Trace 存储管理器
 * 负责存储和查询 trace 数据
 */
export class TraceManager {
  private db: Awaited<ReturnType<typeof createSQLiteStorage>> | null = null;
  private currentSessionId: string | null = null;
  private dbPath: string;
  private tracesDir: string;
  private sessionStores = new Map<string, ReturnType<typeof createTraceStore>>();
  private sessionTraceCache = new Map<string, Trace[]>();
  private recentTraceBuffer: Trace[] = [];
  private recentTraceBufferHydrated = false;

  constructor(projectRoot: string) {
    // 初始化数据库路径
    this.dbPath = join(projectRoot, '.ornn', 'state', 'sessions.db');
    this.tracesDir = join(projectRoot, '.ornn', 'state');
  }

  private getSessionStore(sessionId: string) {
    const existing = this.sessionStores.get(sessionId);
    if (existing) {
      return existing;
    }

    const store = createTraceStore(this.tracesDir, sessionId);
    this.sessionStores.set(sessionId, store);
    return store;
  }

  private async loadSessionTraceCache(sessionId: string): Promise<Trace[]> {
    const cached = this.sessionTraceCache.get(sessionId);
    if (cached) {
      return cached;
    }

    const traces = await this.getSessionStore(sessionId).readAll();
    traces.sort(compareTraceTimestampAsc);
    this.sessionTraceCache.set(sessionId, traces);
    return traces;
  }

  private rememberRecordedTrace(trace: Trace): void {
    const cached = this.sessionTraceCache.get(trace.session_id);
    if (cached) {
      cached.push(trace);
      cached.sort(compareTraceTimestampAsc);
    }

    this.recentTraceBuffer = mergeUniqueRecentTraces(
      this.recentTraceBuffer.concat(trace),
      RECENT_TRACE_BUFFER_LIMIT
    );
  }

  private loadRecentTracesFromDisk(limit: number): Trace[] {
    const candidates = listTraceNdjsonPaths(this.tracesDir);
    const perFileLimit = Math.max(limit * 2, 50);
    const traces = candidates.flatMap((filePath) => tailTraceRecords(filePath, perFileLimit));
    return mergeUniqueRecentTraces(traces, limit);
  }

  /**
   * 确保 session 已存在，避免 traces_index 外键写入失败
   */
  private ensureSessionExists(trace: Trace): void {
    if (!this.db) throw new Error('TraceManager not initialized');

    const existing = this.db.getSession(trace.session_id);
    if (existing) {
      return;
    }

    this.db.createSession({
      session_id: trace.session_id,
      runtime: trace.runtime,
      project_id: null,
      started_at: trace.timestamp,
      ended_at: null,
      trace_count: 0,
    });

    logger.info('Auto-created missing session for trace recording', {
      session_id: trace.session_id,
      runtime: trace.runtime,
    });
  }

  /**
   * 初始化
   */
  async init(): Promise<void> {
    this.db = await createSQLiteStorage(this.dbPath);
    await this.db.init();
    logger.debug('Trace manager initialized');
  }

  /**
   * 设置当前 session
   */
  setSession(sessionId: string, runtime: RuntimeType, projectId?: string): void {
    if (!this.db) throw new Error('TraceManager not initialized');
    try {
      this.currentSessionId = sessionId;

      // 创建 session 记录
      this.db.createSession({
        session_id: sessionId,
        runtime,
        project_id: projectId ?? null,
        started_at: new Date().toISOString(),
        ended_at: null,
        trace_count: 0,
      });

      // 预热当前 session 对应的 trace store，避免首次写入时再建对象
      this.getSessionStore(sessionId);

      logger.info(`Session set: ${sessionId}`, { runtime, projectId });
    } catch (error) {
      // 回滚状态
      this.currentSessionId = null;
      
      logger.error('Failed to set session', { 
        sessionId, 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  /**
   * 记录 trace（带事务保护和补偿机制）
   */
  recordTrace(trace: Trace): void {
    if (!this.db) throw new Error('TraceManager not initialized');
    let ndjsonWritten = false;
    
    try {
      // 先确保 session 存在，避免数据库外键失败
      this.ensureSessionExists(trace);

      // 先写入 NDJSON（可追加，原子性较好）
      this.getSessionStore(trace.session_id).append(trace);
      this.rememberRecordedTrace(trace);
      ndjsonWritten = true;
      
      // 再写入数据库
      this.db.beginTrans();
      
      // 添加索引到数据库
      this.db.addTraceIndex({
        trace_id: trace.trace_id,
        session_id: trace.session_id,
        runtime: trace.runtime,
        event_type: trace.event_type,
        timestamp: trace.timestamp,
        status: trace.status,
      });

      // 更新 session trace 计数
      this.db.incrementSessionTraceCount(trace.session_id);
      
      this.db.commit();

      logger.debug('Trace recorded', {
        trace_id: trace.trace_id,
        event_type: trace.event_type,
      });
    } catch (error) {
      // 数据库操作失败，回滚事务
      try {
        this.db.rollback();
      } catch (rollbackError) {
        logger.debug('Failed to rollback transaction', {
          trace_id: trace.trace_id,
          rollbackError
        });
      }
      
      // 补偿机制：如果 NDJSON 已写入但数据库失败，标记 trace 为无效
      if (ndjsonWritten) {
        try {
          const invalidatedTrace: Trace = {
            ...trace,
            status: 'failure',
            metadata: { 
              ...trace.metadata, 
              invalidated: true,
              invalidationReason: 'Database write failed'
            }
          };
          this.getSessionStore(trace.session_id).append(invalidatedTrace);
          this.rememberRecordedTrace(invalidatedTrace);
          logger.info('Trace marked as invalidated due to database failure', {
            trace_id: trace.trace_id
          });
        } catch (compensationError) {
          logger.error('Failed to compensate for failed trace', {
            trace_id: trace.trace_id,
            compensationError
          });
        }
      }
      
      logger.debug('Failed to record trace', {
        trace_id: trace.trace_id,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * 批量记录 traces
   */
  recordTraces(traces: Trace[]): void {
    for (const trace of traces) {
      this.recordTrace(trace);
    }
  }

  /**
   * 获取 session 的 traces
   */
  async getSessionTraces(sessionId: string, limit?: number): Promise<Trace[]> {
    let filtered = [...(await this.loadSessionTraceCache(sessionId))];

    if (limit) {
      filtered = filtered.slice(0, limit);
    }

    return filtered;
  }

  /**
   * 获取最近的 traces
   */
  getRecentTraces(count: number): Promise<Trace[]> {
    if (!this.recentTraceBufferHydrated) {
      this.recentTraceBuffer = mergeUniqueRecentTraces(
        this.recentTraceBuffer.concat(
          this.loadRecentTracesFromDisk(Math.max(count, MIN_RECENT_TRACE_HYDRATION))
        ),
        RECENT_TRACE_BUFFER_LIMIT
      );
      this.recentTraceBufferHydrated = true;
    }

    return Promise.resolve(this.recentTraceBuffer.slice(-count));
  }

  /**
   * 按事件类型查询 traces
   */
  async getTracesByEventType(
    sessionId: string,
    eventType: string
  ): Promise<Trace[]> {
    const sessionTraces = await this.getSessionTraces(sessionId);
    return sessionTraces.filter((trace) => trace.event_type === eventType);
  }

  /**
   * 按时间范围查询 traces
   */
  async getTracesByTimeRange(
    sessionId: string,
    startTime: string,
    endTime: string
  ): Promise<Trace[]> {
    const allTraces = await this.getSessionTraces(sessionId);
    const start = new Date(startTime).getTime();
    const end = new Date(endTime).getTime();

    return allTraces.filter((t) => {
      const time = new Date(t.timestamp).getTime();
      return time >= start && time <= end;
    });
  }

  /**
   * 获取失败的 traces
   */
  async getFailedTraces(sessionId: string): Promise<Trace[]> {
    const sessionTraces = await this.getSessionTraces(sessionId);
    return sessionTraces.filter((trace) => trace.status === 'failure');
  }

  /**
   * 获取重试的 traces
   */
  async getRetryTraces(sessionId: string): Promise<Trace[]> {
    const sessionTraces = await this.getSessionTraces(sessionId);
    return sessionTraces.filter((trace) => trace.event_type === 'retry');
  }

  /**
   * 获取文件变化的 traces
   */
  async getFileChangeTraces(sessionId: string): Promise<Trace[]> {
    const sessionTraces = await this.getSessionTraces(sessionId);
    return sessionTraces.filter((trace) => trace.event_type === 'file_change');
  }

  /**
   * 获取 trace 统计信息
   */
  async getTraceStats(sessionId: string): Promise<{
    total: number;
    byEventType: Record<string, number>;
    byStatus: Record<string, number>;
  }> {
    const sessionTraces = await this.getSessionTraces(sessionId);

    const byEventType: Record<string, number> = {};
    const byStatus: Record<string, number> = {};

    for (const trace of sessionTraces) {
      byEventType[trace.event_type] = (byEventType[trace.event_type] ?? 0) + 1;
      byStatus[trace.status] = (byStatus[trace.status] ?? 0) + 1;
    }

    return {
      total: sessionTraces.length,
      byEventType,
      byStatus,
    };
  }

  /**
   * 清理旧的 traces
   */
  cleanupOldTraces(retentionDays: number): number {
    void retentionDays;
    // Retention cleanup is intentionally not implemented here yet. Keep this
    // no-op silent so the hourly daemon tick does not emit misleading logs.
    return 0;
  }

  /**
   * 获取当前 session ID
   */
  getCurrentSessionId(): string | null {
    return this.currentSessionId;
  }

  /**
   * 结束当前 session
   */
  endSession(): void {
    if (this.currentSessionId) {
      logger.info(`Session ended: ${this.currentSessionId}`);
      this.currentSessionId = null;
    }
  }

  /**
   * 关闭
   */
  close(): void {
    this.endSession();
    if (!this.db) throw new Error('TraceManager not initialized');
    for (const store of this.sessionStores.values()) {
      store.close();
    }
    this.sessionStores.clear();
    this.sessionTraceCache.clear();
    this.recentTraceBuffer = [];
    this.recentTraceBufferHydrated = false;
    this.db.close();
    logger.info('Trace manager closed');
  }
}

// 导出工厂函数
export function createTraceManager(projectRoot: string): TraceManager {
  return new TraceManager(projectRoot);
}
