import { createChildLogger } from '../../utils/logger.js';
import { configManager } from '../../config/index.js';
import { BaseRule } from './base-rule.js';
import { RepeatedManualFixRule } from './rules/repeated-manual-fix.js';
import { RepeatedDriftRule } from './rules/repeated-drift.js';
import type { Trace, EvaluationResult } from '../../types/index.js';

const logger = createChildLogger('evaluator');

/**
 * Evaluator
 * 负责评估 traces 并判断是否需要优化
 */
export class Evaluator {
  private rules: BaseRule[] = [];
  private minConfidence: number;

  constructor() {
    this.minConfidence = configManager.getEvaluatorConfig().min_confidence;
    this.registerDefaultRules();
  }

  /**
   * 注册默认规则
   */
  private registerDefaultRules(): void {
    this.rules.push(new RepeatedManualFixRule());
    this.rules.push(new RepeatedDriftRule());
    logger.info('Default evaluation rules registered');
  }

  /**
   * 注册自定义规则
   */
  registerRule(rule: BaseRule): void {
    this.rules.push(rule);
    logger.info(`Rule registered: ${rule.getName()}`);
  }

  /**
   * 评估 traces
   */
  evaluate(traces: Trace[]): EvaluationResult | null {
    if (traces.length === 0) {
      return null;
    }

    logger.debug(`Evaluating ${traces.length} traces with ${this.rules.length} rules`);

    // 运行所有规则
    for (const rule of this.rules) {
      try {
        const result = rule.evaluate(traces);

        if (result && result.confidence >= this.minConfidence) {
          logger.info(`Rule "${rule.getName()}" triggered`, {
            change_type: result.change_type,
            confidence: result.confidence,
          });
          return result;
        }
      } catch (error) {
        logger.warn(`Rule "${rule.getName()}" evaluation failed`, { error });
      }
    }

    return null;
  }

  /**
   * 获取所有规则
   */
  getRules(): BaseRule[] {
    return [...this.rules];
  }

  /**
   * 设置最小置信度
   */
  setMinConfidence(confidence: number): void {
    this.minConfidence = confidence;
  }
}

// 导出单例实例
export const evaluator = new Evaluator();