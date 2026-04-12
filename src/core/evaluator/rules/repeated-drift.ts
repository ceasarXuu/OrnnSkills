import { createChildLogger } from '../../../utils/logger.js';
import { BaseRule } from '../base-rule.js';
import type { Trace, EvaluationResult } from '../../../types/index.js';

const logger = createChildLogger('repeated-drift-rule');

/**
 * Repeated Drift 规则
 * 检测 skill 被命中但执行反复绕过某一段
 */
export class RepeatedDriftRule extends BaseRule {
  private toolTimeoutMs: number;

  constructor(toolTimeoutMs: number = 5000) {
    super(
      'repeated-drift',
      'Detects when skill is hit but execution repeatedly bypasses certain sections'
    );
    this.toolTimeoutMs = toolTimeoutMs;
  }

  evaluate(traces: Trace[]): EvaluationResult | null {
    // 查找工具调用
    const toolCalls = this.filterByEventType(traces, 'tool_call');

    if (toolCalls.length === 0) {
      return null;
    }

    // 找出被跳过的工具或步骤
    const skippedTools = this.findSkippedTools(traces);

    if (skippedTools.length === 0) {
      return null;
    }

    // 统计跳过次数
    const skipCount = this.countSkips(traces, skippedTools);

    if (skipCount < 3) {
      return null;
    }

    const sessionIds = this.extractSessionIds(traces);
    const confidence = this.calculateConfidence(skipCount, sessionIds.length);

    if (confidence < 0.7) {
      return null;
    }

    // Current traces only tell us which tool path was skipped, not which markdown
    // section in the skill should actually be pruned or rewritten.
    logger.info('Repeated drift detected but no concrete skill section could be localized', {
      skippedTool: skippedTools[0],
      skipCount,
      sessionCount: sessionIds.length,
    });

    return null;
  }

  /**
   * 找出被跳过的工具
   */
  private findSkippedTools(traces: Trace[]): string[] {
    const skipped: string[] = [];

    // 查找在工具调用后没有结果的情况
    for (const trace of traces) {
      if (trace.event_type === 'tool_call' && trace.tool_name) {
        // 查找后续的工具结果
        const subsequentResults = traces.filter(
          (t) =>
            t.event_type === 'tool_result' &&
            t.tool_name === trace.tool_name &&
            new Date(t.timestamp) > new Date(trace.timestamp) &&
            new Date(t.timestamp).getTime() - new Date(trace.timestamp).getTime() < this.toolTimeoutMs
        );

        if (subsequentResults.length === 0) {
          // 没有找到对应的结果，可能是被跳过了
          if (!skipped.includes(trace.tool_name)) {
            skipped.push(trace.tool_name);
          }
        }
      }
    }

    return skipped;
  }

  /**
   * 统计跳过次数
   */
  private countSkips(traces: Trace[], skippedTools: string[]): number {
    let count = 0;

    for (const trace of traces) {
      if (trace.event_type === 'tool_call' && skippedTools.includes(trace.tool_name ?? '')) {
        // 检查是否有对应的工具结果
        const hasResult = traces.some(
          (t) =>
            t.event_type === 'tool_result' &&
            t.tool_name === trace.tool_name &&
            new Date(t.timestamp) > new Date(trace.timestamp) &&
            new Date(t.timestamp).getTime() - new Date(trace.timestamp).getTime() < this.toolTimeoutMs
        );

        if (!hasResult) {
          count++;
        }
      }
    }

    return count;
  }
}
