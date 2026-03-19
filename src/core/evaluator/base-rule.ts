import type { Trace, EvaluationResult } from '../../types/index.js';

/**
 * 评估规则基类
 */
export abstract class BaseRule {
  protected name: string;
  protected description: string;

  constructor(name: string, description: string) {
    this.name = name;
    this.description = description;
  }

  /**
   * 评估 traces，返回评估结果
   */
  abstract evaluate(traces: Trace[]): EvaluationResult | null;

  /**
   * 获取规则名称
   */
  getName(): string {
    return this.name;
  }

  /**
   * 获取规则描述
   */
  getDescription(): string {
    return this.description;
  }

  /**
   * 提取唯一的 session IDs
   */
  protected extractSessionIds(traces: Trace[]): string[] {
    const sessionIds = new Set(traces.map((t) => t.session_id));
    return Array.from(sessionIds);
  }

  /**
   * 按事件类型过滤 traces
   */
  protected filterByEventType(traces: Trace[], eventType: string): Trace[] {
    return traces.filter((t) => t.event_type === eventType);
  }

  /**
   * 按状态过滤 traces
   */
  protected filterByStatus(traces: Trace[], status: string): Trace[] {
    return traces.filter((t) => t.status === status);
  }

  /**
   * 获取失败的 traces
   */
  protected getFailedTraces(traces: Trace[]): Trace[] {
    return this.filterByStatus(traces, 'failure');
  }

  /**
   * 获取重试的 traces
   */
  protected getRetryTraces(traces: Trace[]): Trace[] {
    return this.filterByEventType(traces, 'retry');
  }

  /**
   * 获取文件变化的 traces
   */
  protected getFileChangeTraces(traces: Trace[]): Trace[] {
    return this.filterByEventType(traces, 'file_change');
  }

  /**
   * 计算置信度
   */
  protected calculateConfidence(
    signalCount: number,
    sessionCount: number,
    minSignals: number = 3,
    minSessions: number = 2
  ): number {
    const signalScore = Math.min(signalCount / minSignals, 1) * 0.6;
    const sessionScore = Math.min(sessionCount / minSessions, 1) * 0.4;
    return Math.min(signalScore + sessionScore, 1);
  }
}