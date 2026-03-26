/**
 * Trace Router
 *
 * 负责接收来自 Observer 的 Trace，并根据 skill_refs 将 Trace 路由到对应的处理逻辑。
 * 这是 Observer 和 Evaluator 之间的中间层。
 */

import { createChildLogger } from '../../utils/logger.js';
import type { Trace, TraceSkillMapping, RuntimeType } from '../../types/index.js';

const logger = createChildLogger('router');

export interface RouterOptions {
  projectPath: string;
  onSkillTrace: (mapping: TraceSkillMapping, trace: Trace) => void;
  onUnknownTrace?: (trace: Trace) => void;
}

export interface RouteResult {
  traceId: string;
  skillRefs: string[];
  routed: boolean;
  mappings: TraceSkillMapping[];
}

/**
 * Trace Router
 *
 * Responsibilities:
 * 1. Receive traces from Observer
 * 2. Extract skill references from traces
 * 3. Route traces to appropriate skill handlers
 * 4. Handle unknown traces (no skill refs)
 */
export class TraceRouter {
  private options: RouterOptions;
  private routeHistory: Map<string, RouteResult> = new Map();
  private readonly maxHistorySize: number = 10000;

  constructor(options: RouterOptions) {
    this.options = options;
  }

  /**
   * Route a trace to appropriate handlers
   */
  route(trace: Trace): RouteResult {
    logger.debug(`Routing trace: ${trace.trace_id}`);

    const skillRefs = trace.skill_refs || [];
    const mappings: TraceSkillMapping[] = [];

    if (skillRefs.length === 0) {
      // No skill references found
      logger.debug(`No skill refs found for trace: ${trace.trace_id}`);
      
      if (this.options.onUnknownTrace) {
        this.options.onUnknownTrace(trace);
      }

      const result: RouteResult = {
        traceId: trace.trace_id,
        skillRefs: [],
        routed: false,
        mappings: [],
      };

      this.routeHistory.set(trace.trace_id, result);
      return result;
    }

    // Route to each skill reference
    for (const skillRef of skillRefs) {
      const mapping = this.createMapping(trace, skillRef);
      mappings.push(mapping);
      
      // Call the handler
      this.options.onSkillTrace(mapping, trace);
    }

    const result: RouteResult = {
      traceId: trace.trace_id,
      skillRefs,
      routed: true,
      mappings,
    };

    this.routeHistory.set(trace.trace_id, result);
    
    // Enforce history size limit
    this.enforceHistoryLimit();
    
    logger.debug(`Routed trace ${trace.trace_id} to ${skillRefs.length} skills`);
    return result;
  }

  /**
   * Enforce history size limit to prevent memory leaks
   */
  private enforceHistoryLimit(): void {
    if (this.routeHistory.size > this.maxHistorySize) {
      // Remove oldest entries (first 20% of max size)
      const entriesToRemove = Math.floor(this.maxHistorySize * 0.2);
      const keys = Array.from(this.routeHistory.keys()).slice(0, entriesToRemove);
      for (const key of keys) {
        this.routeHistory.delete(key);
      }
      logger.debug(`Enforced history limit, removed ${entriesToRemove} old entries`);
    }
  }

  /**
   * Route multiple traces
   */
  routeBatch(traces: Trace[]): RouteResult[] {
    return traces.map((trace) => this.route(trace));
  }

  /**
   * Get routing history for a trace
   */
  getRouteHistory(traceId: string): RouteResult | undefined {
    return this.routeHistory.get(traceId);
  }

  /**
   * Get all routing history
   */
  getAllRouteHistory(): RouteResult[] {
    return Array.from(this.routeHistory.values());
  }

  /**
   * Clear routing history
   */
  clearHistory(): void {
    this.routeHistory.clear();
  }

  /**
   * Create a trace-skill mapping
   */
  private createMapping(trace: Trace, skillRef: string): TraceSkillMapping {
    // Parse skill reference format: "skill-name" or "skill-name@shadow-id"
    const parts = skillRef.split('@');
    const skillId = parts[0];
    const shadowId = parts[1] || null;

    // Calculate confidence based on context
    const confidence = this.calculateConfidence(trace, skillId);

    return {
      trace_id: trace.trace_id,
      skill_id: skillId,
      shadow_id: shadowId,
      confidence,
      reason: this.generateReason(trace, skillId, confidence),
    };
  }

  /**
   * Calculate confidence score for skill mapping
   */
  private calculateConfidence(trace: Trace, skillId: string): number {
    let confidence = 0.5; // Base confidence

    // Higher confidence if skill is explicitly mentioned in user input
    if (trace.user_input?.toLowerCase().includes(skillId.toLowerCase())) {
      confidence += 0.3;
    }

    // Higher confidence if skill is in assistant output
    if (trace.assistant_output?.toLowerCase().includes(skillId.toLowerCase())) {
      confidence += 0.2;
    }

    // Cap at 1.0
    return Math.min(confidence, 1.0);
  }

  /**
   * Generate reason for mapping
   */
  private generateReason(trace: Trace, skillId: string, confidence: number): string {
    const reasons: string[] = [];

    if (trace.user_input?.toLowerCase().includes(skillId.toLowerCase())) {
      reasons.push('mentioned in user input');
    }

    if (trace.assistant_output?.toLowerCase().includes(skillId.toLowerCase())) {
      reasons.push('mentioned in assistant output');
    }

    if (reasons.length === 0) {
      reasons.push('extracted from context');
    }

    return `Skill "${skillId}" mapped with ${Math.round(confidence * 100)}% confidence: ${reasons.join(', ')}`;
  }

  /**
   * Filter traces by runtime
   */
  filterByRuntime(traces: Trace[], runtime: RuntimeType): Trace[] {
    return traces.filter((t) => t.runtime === runtime);
  }

  /**
   * Filter traces by skill reference
   */
  filterBySkill(traces: Trace[], skillId: string): Trace[] {
    return traces.filter((t) => 
      t.skill_refs?.some((ref) => ref === skillId || ref.startsWith(`${skillId}@`))
    );
  }

  /**
   * Get statistics about routing
   */
  getStats(): {
    totalRouted: number;
    totalUnknown: number;
    averageSkillsPerTrace: number;
    topSkills: { skillId: string; count: number }[];
  } {
    const history = this.getAllRouteHistory();
    const routed = history.filter((h) => h.routed);
    const unknown = history.filter((h) => !h.routed);

    // Count skill occurrences
    const skillCounts = new Map<string, number>();
    for (const result of routed) {
      for (const skillRef of result.skillRefs) {
        const skillId = skillRef.split('@')[0];
        skillCounts.set(skillId, (skillCounts.get(skillId) || 0) + 1);
      }
    }

    // Sort by count
    const topSkills = Array.from(skillCounts.entries())
      .map(([skillId, count]) => ({ skillId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const totalSkills = routed.reduce((sum, r) => sum + r.skillRefs.length, 0);

    return {
      totalRouted: routed.length,
      totalUnknown: unknown.length,
      averageSkillsPerTrace: routed.length > 0 ? totalSkills / routed.length : 0,
      topSkills,
    };
  }
}

/**
 * Create a TraceRouter instance
 */
export function createTraceRouter(options: RouterOptions): TraceRouter {
  return new TraceRouter(options);
}
