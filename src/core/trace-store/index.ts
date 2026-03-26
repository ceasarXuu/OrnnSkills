/**
 * Trace Store
 *
 * 负责 Trace 的本地存储和管理。
 * 提供 Trace 的持久化、查询、过滤等功能。
 */

import { createChildLogger } from '../../utils/logger.js';
import type { Trace, TraceEventType, TraceStatus, RuntimeType } from '../../types/index.js';

const logger = createChildLogger('trace-store');

export interface TraceStoreOptions {
  projectPath: string;
  maxTraces?: number;
  retentionDays?: number;
}

export interface TraceQuery {
  sessionId?: string;
  runtime?: RuntimeType;
  eventType?: TraceEventType;
  status?: TraceStatus;
  skillRef?: string;
  startTime?: Date;
  endTime?: Date;
  limit?: number;
  offset?: number;
}

export interface TraceStats {
  totalTraces: number;
  byRuntime: Record<RuntimeType, number>;
  byEventType: Record<TraceEventType, number>;
  byStatus: Record<TraceStatus, number>;
  timeRange: {
    earliest: Date | null;
    latest: Date | null;
  };
}

/**
 * Trace Store
 *
 * Responsibilities:
 * 1. Store traces in memory (with optional persistence)
 * 2. Provide query and filter capabilities
 * 3. Manage trace retention
 * 4. Provide statistics
 */
export class TraceStore {
  private options: TraceStoreOptions;
  private traces: Map<string, Trace> = new Map();
  private sessionTraces: Map<string, Set<string>> = new Map();
  private skillTraces: Map<string, Set<string>> = new Map();

  constructor(options: TraceStoreOptions) {
    this.options = {
      maxTraces: 10000,
      retentionDays: 30,
      ...options,
    };
  }

  /**
   * Store a trace
   */
  store(trace: Trace): void {
    // If trace already exists, remove old indexes first to maintain consistency
    if (this.traces.has(trace.trace_id)) {
      logger.debug(`Trace ${trace.trace_id} already exists, updating`);
      this.removeFromIndexes(trace.trace_id);
    }

    try {
      // Index by session
      if (!this.sessionTraces.has(trace.session_id)) {
        this.sessionTraces.set(trace.session_id, new Set());
      }
      this.sessionTraces.get(trace.session_id)!.add(trace.trace_id);

      // Index by skill references
      if (trace.skill_refs) {
        for (const skillRef of trace.skill_refs) {
          const skillId = skillRef.split('@')[0];
          if (!this.skillTraces.has(skillId)) {
            this.skillTraces.set(skillId, new Set());
          }
          this.skillTraces.get(skillId)!.add(trace.trace_id);
        }
      }

      // Store the trace (atomic - only after indexes are updated)
      this.traces.set(trace.trace_id, trace);

      // Check retention
      this.enforceRetention();

      logger.debug(`Stored trace: ${trace.trace_id}`);
    } catch (error) {
      // Rollback: remove from indexes if storage failed
      this.removeFromIndexes(trace.trace_id);
      logger.error(`Failed to store trace ${trace.trace_id}:`, error);
      throw error;
    }
  }

  /**
   * Remove a trace from all indexes (used for rollback and delete)
   */
  private removeFromIndexes(traceId: string): void {
    const trace = this.traces.get(traceId);
    if (!trace) return;

    // Remove from session index
    const sessionTraces = this.sessionTraces.get(trace.session_id);
    if (sessionTraces) {
      sessionTraces.delete(traceId);
      if (sessionTraces.size === 0) {
        this.sessionTraces.delete(trace.session_id);
      }
    }

    // Remove from skill indexes
    if (trace.skill_refs) {
      for (const skillRef of trace.skill_refs) {
        const skillId = skillRef.split('@')[0];
        const skillTraceIds = this.skillTraces.get(skillId);
        if (skillTraceIds) {
          skillTraceIds.delete(traceId);
          if (skillTraceIds.size === 0) {
            this.skillTraces.delete(skillId);
          }
        }
      }
    }
  }

  /**
   * Store multiple traces
   */
  storeBatch(traces: Trace[]): void {
    for (const trace of traces) {
      this.store(trace);
    }
    logger.info(`Stored ${traces.length} traces`);
  }

  /**
   * Get a trace by ID
   */
  get(traceId: string): Trace | undefined {
    return this.traces.get(traceId);
  }

  /**
   * Query traces
   */
  query(query: TraceQuery = {}): Trace[] {
    let results = Array.from(this.traces.values());

    // Filter by session ID
    if (query.sessionId) {
      const sessionTraceIds = this.sessionTraces.get(query.sessionId);
      if (sessionTraceIds) {
        results = results.filter((t) => sessionTraceIds.has(t.trace_id));
      } else {
        return [];
      }
    }

    // Filter by runtime
    if (query.runtime) {
      results = results.filter((t) => t.runtime === query.runtime);
    }

    // Filter by event type
    if (query.eventType) {
      results = results.filter((t) => t.event_type === query.eventType);
    }

    // Filter by status
    if (query.status) {
      results = results.filter((t) => t.status === query.status);
    }

    // Filter by skill reference
    if (query.skillRef) {
      const skillTraceIds = this.skillTraces.get(query.skillRef);
      if (skillTraceIds) {
        results = results.filter((t) => skillTraceIds.has(t.trace_id));
      } else {
        return [];
      }
    }

    // Filter by time range
    if (query.startTime) {
      results = results.filter((t) => new Date(t.timestamp) >= query.startTime!);
    }
    if (query.endTime) {
      results = results.filter((t) => new Date(t.timestamp) <= query.endTime!);
    }

    // Sort by timestamp (newest first)
    results.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Apply offset and limit
    const offset = query.offset || 0;
    const limit = query.limit || results.length;
    results = results.slice(offset, offset + limit);

    return results;
  }

  /**
   * Get traces by session ID
   */
  getBySession(sessionId: string): Trace[] {
    const traceIds = this.sessionTraces.get(sessionId);
    if (!traceIds) return [];

    return Array.from(traceIds)
      .map((id) => this.traces.get(id))
      .filter((t): t is Trace => t !== undefined)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  /**
   * Get traces by skill ID
   */
  getBySkill(skillId: string): Trace[] {
    const traceIds = this.skillTraces.get(skillId);
    if (!traceIds) return [];

    return Array.from(traceIds)
      .map((id) => this.traces.get(id))
      .filter((t): t is Trace => t !== undefined)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  /**
   * Get all traces
   */
  getAll(): Trace[] {
    return Array.from(this.traces.values()).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  /**
   * Get unique session IDs
   */
  getSessionIds(): string[] {
    return Array.from(this.sessionTraces.keys());
  }

  /**
   * Get unique skill IDs
   */
  getSkillIds(): string[] {
    return Array.from(this.skillTraces.keys());
  }

  /**
   * Delete a trace
   */
  delete(traceId: string): boolean {
    const trace = this.traces.get(traceId);
    if (!trace) return false;

    // Remove from indexes first
    this.removeFromIndexes(traceId);

    // Remove from main store
    this.traces.delete(traceId);

    logger.debug(`Deleted trace: ${traceId}`);
    return true;
  }

  /**
   * Clear all traces
   */
  clear(): void {
    this.traces.clear();
    this.sessionTraces.clear();
    this.skillTraces.clear();
    logger.info('Cleared all traces');
  }

  /**
   * Get store statistics
   */
  getStats(): TraceStats {
    const allTraces = this.getAll();

    const byRuntime: Record<RuntimeType, number> = { codex: 0, opencode: 0, claude: 0 };
    const byEventType: Record<TraceEventType, number> = {
      user_input: 0,
      assistant_output: 0,
      tool_call: 0,
      tool_result: 0,
      file_change: 0,
      retry: 0,
      status: 0,
    };
    const byStatus: Record<TraceStatus, number> = {
      success: 0,
      failure: 0,
      retry: 0,
      interrupted: 0,
    };

    let earliest: Date | null = null;
    let latest: Date | null = null;

    for (const trace of allTraces) {
      // Count by runtime
      byRuntime[trace.runtime]++;

      // Count by event type
      byEventType[trace.event_type]++;

      // Count by status
      byStatus[trace.status]++;

      // Track time range
      const timestamp = new Date(trace.timestamp);
      if (!earliest || timestamp < earliest) {
        earliest = timestamp;
      }
      if (!latest || timestamp > latest) {
        latest = timestamp;
      }
    }

    return {
      totalTraces: allTraces.length,
      byRuntime,
      byEventType,
      byStatus,
      timeRange: {
        earliest,
        latest,
      },
    };
  }

  /**
   * Get count of traces
   */
  count(): number {
    return this.traces.size;
  }

  /**
   * Enforce retention policy
   */
  private enforceRetention(): void {
    // Enforce max traces limit
    if (this.options.maxTraces && this.traces.size > this.options.maxTraces) {
      const sortedTraces = this.getAll();
      const toDelete = sortedTraces.slice(this.options.maxTraces);
      for (const trace of toDelete) {
        this.delete(trace.trace_id);
      }
      logger.info(`Enforced max traces limit, deleted ${toDelete.length} old traces`);
    }

    // Enforce retention days
    if (this.options.retentionDays) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.options.retentionDays);

      const allTraces = this.getAll();
      let deletedCount = 0;
      for (const trace of allTraces) {
        if (new Date(trace.timestamp) < cutoffDate) {
          this.delete(trace.trace_id);
          deletedCount++;
        }
      }
      if (deletedCount > 0) {
        logger.info(`Enforced retention policy, deleted ${deletedCount} old traces`);
      }
    }
  }

  /**
   * Export traces to JSON
   */
  exportToJSON(): string {
    return JSON.stringify(this.getAll(), null, 2);
  }

  /**
   * Import traces from JSON
   */
  importFromJSON(json: string): void {
    try {
      const traces: Trace[] = JSON.parse(json);
      this.storeBatch(traces);
      logger.info(`Imported ${traces.length} traces from JSON`);
    } catch (error) {
      logger.error('Failed to import traces from JSON:', error);
      throw error;
    }
  }
}

/**
 * Create a TraceStore instance
 */
export function createTraceStore(options: TraceStoreOptions): TraceStore {
  return new TraceStore(options);
}
