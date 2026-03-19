import { BaseRule } from '../base-rule.js';
import type { Trace, EvaluationResult } from '../../../types/index.js';

/**
 * Repeated Manual Fix 规则
 * 检测用户是否在同类任务中反复手动补充相同步骤
 */
export class RepeatedManualFixRule extends BaseRule {
  constructor() {
    super(
      'repeated-manual-fix',
      'Detects when users repeatedly manually supplement the same steps after agent output'
    );
  }

  evaluate(traces: Trace[]): EvaluationResult | null {
    // 查找用户在助手输出后的输入
    const assistantOutputs = this.filterByEventType(traces, 'assistant_output');
    const userInputs = this.filterByEventType(traces, 'user_input');

    if (assistantOutputs.length === 0 || userInputs.length === 0) {
      return null;
    }

    // 分析用户输入中是否有重复的模式
    const patterns = this.extractPatterns(userInputs);

    // 找出出现频率最高的模式
    const frequentPatterns = this.findFrequentPatterns(patterns, 3);

    if (frequentPatterns.length === 0) {
      return null;
    }

    // 检查这些模式是否出现在助手输出之后
    const signals = this.countPostAssistantSignals(assistantOutputs, userInputs, frequentPatterns);

    if (signals.count < 3) {
      return null;
    }

    const sessionIds = this.extractSessionIds(traces);
    const confidence = this.calculateConfidence(signals.count, sessionIds.length);

    if (confidence < 0.7) {
      return null;
    }

    return {
      should_patch: true,
      change_type: 'add_fallback',
      reason: `User manually supplemented "${signals.pattern}" in ${signals.count} sessions after agent output`,
      source_sessions: sessionIds,
      confidence,
    };
  }

  /**
   * 提取用户输入的模式
   */
  private extractPatterns(userInputs: Trace[]): Map<string, number> {
    const patterns = new Map<string, number>();

    for (const input of userInputs) {
      if (!input.user_input) continue;

      // 简单的模式提取：取前 50 个字符作为模式
      const pattern = input.user_input.substring(0, 50).toLowerCase().trim();
      if (pattern.length > 10) {
        patterns.set(pattern, (patterns.get(pattern) ?? 0) + 1);
      }
    }

    return patterns;
  }

  /**
   * 找出频繁出现的模式
   */
  private findFrequentPatterns(patterns: Map<string, number>, minCount: number): string[] {
    const result: string[] = [];

    for (const [pattern, count] of patterns.entries()) {
      if (count >= minCount) {
        result.push(pattern);
      }
    }

    return result;
  }

  /**
   * 统计助手输出后出现的信号
   */
  private countPostAssistantSignals(
    assistantOutputs: Trace[],
    userInputs: Trace[],
    patterns: string[]
  ): { count: number; pattern: string } {
    let maxCount = 0;
    let bestPattern = '';

    for (const pattern of patterns) {
      let count = 0;

      for (const output of assistantOutputs) {
        // 查找在助手输出后的用户输入
        const subsequentInputs = userInputs.filter(
          (input) =>
            new Date(input.timestamp) > new Date(output.timestamp) &&
            new Date(input.timestamp).getTime() - new Date(output.timestamp).getTime() < 60000 // 1 分钟内
        );

        for (const input of subsequentInputs) {
          if (input.user_input?.toLowerCase().includes(pattern)) {
            count++;
          }
        }
      }

      if (count > maxCount) {
        maxCount = count;
        bestPattern = pattern;
      }
    }

    return { count: maxCount, pattern: bestPattern };
  }
}