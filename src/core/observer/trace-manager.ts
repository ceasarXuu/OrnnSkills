import { join } from 'node:path';
import { createChildLogger } from '../../utils/logger.js';
import { createTraceStore } from '../../storage/ndjson.js';
import { createSQLiteStorage } from '../../storage/sqlite.js';
import type { Trace, RuntimeType } from '../../types/index.js';

const logger = createChildLogger('trace-manager');

/**
 * Trace 存储管理器
 * 负责存储和查询 trace 数据
 */
export class TraceManager {
  private projectRoot: string;
  private db;
  private traceStore;
  private currentSessionId: string | null = null;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;

    // 初始化数据库
    const dbPath = join(projectRoot, '.evo', 'state', 'sessions.db');
    this.db = createSQLiteStorage(dbPath);

    // 初始化 NDJSON trace store
    const tracesDir = join(projectRoot, '.evo', 'state');
    this.traceStore = createTraceStore(tracesDir, 'default');
  }

  /**
   * 初始化
   */
  async init(): Promise<void> {
    await this.db.init();
    logger.info('Trace manager initialized');
  }

  /**
   * 设置当前 session
   */
  setSession(sessionId: string, runtime: RuntimeType, projectId?: string): void {
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

    // 更新 trace store 的 session ID
    const tracesDir = join(this.projectRoot, '.evo', 'state');
    this.traceStore = createTraceStore(tracesDir, sessionId);

    logger.info(`Session set: ${sessionId}`, { runtime, projectId });
  }

  /**
   * 记录 trace
   */
  recordTrace(trace: Trace): void {
    // 保存到 NDJSON
    this.traceStore.append(trace);

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

    logger.debug('Trace recorded', {
      trace_id: trace.trace_id,
      event_type: trace.event_type,
    });
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
    const allTraces = await this.traceStore.readAll();

    let filtered = allTraces.filter((t) => t.session_id === sessionId);

    // 按时间戳排序
    filtered.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    if (limit) {
      filtered = filtered.slice(0, limit);
    }

    return filtered;
  }

  /**
   * 获取最近的 traces
   */
  async getRecentTraces(count: number): Promise<Trace[]> {
    return this.traceStore.readRecent(count);
  }

  /**
   * 按事件类型查询 traces
   */
  async getTracesByEventType(
    sessionId: string,
    eventType: string
  ): Promise<Trace[]> {
    const allTraces = await this.traceStore.readAll();
    return allTraces.filter(
      (t) => t.session_id === sessionId && t.event_type === eventType
    );
  }

  /**
   * 按时间范围查询 traces
   */
  async getTracesByTimeRange(
    sessionId: string,
    startTime: string,
    endTime: string
  ): Promise<Trace[]> {
    const allTraces = await this.traceStore.readAll();
    const start = new Date(startTime).getTime();
    const end = new Date(endTime).getTime();

    return allTraces.filter((t) => {
      if (t.session_id !== sessionId) return false;
      const time = new Date(t.timestamp).getTime();
      return time >= start && time <= end;
    });
  }

  /**
   * 获取失败的 traces
   */
  async getFailedTraces(sessionId: string): Promise<Trace[]> {
    const allTraces = await this.traceStore.readAll();
    return allTraces.filter(
      (t) => t.session_id === sessionId && t.status === 'failure'
    );
  }

  /**
   * 获取重试的 traces
   */
  async getRetryTraces(sessionId: string): Promise<Trace[]> {
    const allTraces = await this.traceStore.readAll();
    return allTraces.filter(
      (t) => t.session_id === sessionId && t.event_type === 'retry'
    );
  }

  /**
   * 获取文件变化的 traces
   */
  async getFileChangeTraces(sessionId: string): Promise<Trace[]> {
    const allTraces = await this.traceStore.readAll();
    return allTraces.filter(
      (t) => t.session_id === sessionId && t.event_type === 'file_change'
    );
  }

  /**
   * 获取 trace 统计信息
   */
  async getTraceStats(sessionId: string): Promise<{
    total: number;
    byEventType: Record<string, number>;
    byStatus: Record<string, number>;
  }> {
    const allTraces = await this.traceStore.readAll();
    const sessionTraces = allTraces.filter((t) => t.session_id === sessionId);

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
  async cleanupOldTraces(retentionDays: number): Promise<number> {
    // 这里可以实现清理逻辑
    // 暂时返回 0
    logger.info(`Cleanup old traces older than ${retentionDays} days`);
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
    this.db.close();
    logger.info('Trace manager closed');
  }
}

// 导出工厂函数
export function createTraceManager(projectRoot: string): TraceManager {
  return new TraceManager(projectRoot);
}