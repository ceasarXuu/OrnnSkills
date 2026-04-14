import { describe, expect, it } from 'vitest';
import { resolveOptimizationEligibility } from '../../src/core/optimization-eligibility/index.js';
import type { EvaluationResult } from '../../src/types/index.js';

const evaluation: EvaluationResult = {
  should_patch: true,
  change_type: 'prune_noise',
  target_section: 'TODO',
  reason: 'Repeated noise should be pruned.',
  source_sessions: ['sess-1'],
  confidence: 0.91,
  rule_name: 'llm_window_analysis',
};

describe('resolveOptimizationEligibility', () => {
  it('skips optimization when the shadow is in cooldown', () => {
    const result = resolveOptimizationEligibility({
      evaluation,
      minConfidence: 0.5,
      inCooldown: true,
      exceedsDailyLimit: false,
      shadowStatus: 'active',
    });

    expect(result).toMatchObject({
      kind: 'skip',
      status: 'cooldown',
    });
  });

  it('skips optimization when confidence is below threshold', () => {
    const result = resolveOptimizationEligibility({
      evaluation: { ...evaluation, confidence: 0.2 },
      minConfidence: 0.5,
      inCooldown: false,
      exceedsDailyLimit: false,
      shadowStatus: 'active',
    });

    expect(result).toMatchObject({
      kind: 'skip',
      status: 'confidence_too_low',
    });
  });

  it('allows optimization when all policy gates pass', () => {
    const result = resolveOptimizationEligibility({
      evaluation,
      minConfidence: 0.5,
      inCooldown: false,
      exceedsDailyLimit: false,
      shadowStatus: 'active',
    });

    expect(result).toEqual({ kind: 'allowed' });
  });
});
