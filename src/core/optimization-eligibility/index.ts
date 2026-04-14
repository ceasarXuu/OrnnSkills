import type { EvaluationResult, ShadowStatus } from '../../types/index.js';

export type OptimizationEligibilityResult =
  | {
      kind: 'allowed';
    }
  | {
      kind: 'skip';
      status: 'cooldown' | 'daily_limit_reached' | 'frozen' | 'confidence_too_low';
      detail: string;
    };

export interface ResolveOptimizationEligibilityInput {
  evaluation: EvaluationResult;
  minConfidence: number;
  inCooldown: boolean;
  exceedsDailyLimit: boolean;
  shadowStatus: ShadowStatus | null | undefined;
}

export function resolveOptimizationEligibility(
  input: ResolveOptimizationEligibilityInput
): OptimizationEligibilityResult {
  if (input.inCooldown) {
    return {
      kind: 'skip',
      status: 'cooldown',
      detail: '当前技能仍在冷却期，暂不重复优化。',
    };
  }

  if (input.exceedsDailyLimit) {
    return {
      kind: 'skip',
      status: 'daily_limit_reached',
      detail: '当前技能今天的自动优化次数已达上限。',
    };
  }

  if (input.shadowStatus === 'frozen') {
    return {
      kind: 'skip',
      status: 'frozen',
      detail: '当前技能已被冻结，暂不执行自动优化。',
    };
  }

  if (input.evaluation.confidence < input.minConfidence) {
    return {
      kind: 'skip',
      status: 'confidence_too_low',
      detail: '当前信号可信度不足，继续观察更多调用。',
    };
  }

  return {
    kind: 'allowed',
  };
}
