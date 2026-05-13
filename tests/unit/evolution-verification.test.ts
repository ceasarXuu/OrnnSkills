import { describe, expect, it } from 'vitest';
import { evaluateEvolutionVerification } from '../../src/core/evolution/verification.js';

describe('evolution verification', () => {
  it('marks revisions improved when post-apply negative signals drop', () => {
    expect(
      evaluateEvolutionVerification({
        revision: 2,
        verifiedAt: '2026-05-13T00:10:00.000Z',
        before: {
          failureCount: 4,
          needMoreContextCount: 3,
          manualCorrectionCount: 2,
          sampleSize: 6,
        },
        after: {
          failureCount: 1,
          needMoreContextCount: 1,
          manualCorrectionCount: 0,
          sampleSize: 6,
        },
      })
    ).toMatchObject({
      revision: 2,
      outcome: 'improved',
      reason: 'negative signals decreased by 7',
    });
  });

  it('marks revisions regressed when post-apply negative signals increase', () => {
    expect(
      evaluateEvolutionVerification({
        revision: 2,
        verifiedAt: '2026-05-13T00:10:00.000Z',
        before: {
          failureCount: 1,
          needMoreContextCount: 0,
          manualCorrectionCount: 0,
          sampleSize: 5,
        },
        after: {
          failureCount: 3,
          needMoreContextCount: 1,
          manualCorrectionCount: 1,
          sampleSize: 5,
        },
      })
    ).toMatchObject({
      outcome: 'regressed',
      reason: 'negative signals increased by 4',
    });
  });

  it('marks small samples inconclusive', () => {
    expect(
      evaluateEvolutionVerification({
        revision: 2,
        verifiedAt: '2026-05-13T00:10:00.000Z',
        minSampleSize: 3,
        before: {
          failureCount: 1,
          needMoreContextCount: 1,
          manualCorrectionCount: 0,
          sampleSize: 2,
        },
        after: {
          failureCount: 0,
          needMoreContextCount: 0,
          manualCorrectionCount: 0,
          sampleSize: 2,
        },
      })
    ).toMatchObject({
      outcome: 'inconclusive',
      reason: 'verification sample is below required 3',
    });
  });
});
