import type { EvolutionVerification } from './domain.js';

export interface EvolutionVerificationSignals {
  failureCount: number;
  needMoreContextCount: number;
  manualCorrectionCount: number;
  sampleSize: number;
}

export interface EvolutionVerificationInput {
  revision: number;
  verifiedAt: string;
  before: EvolutionVerificationSignals;
  after: EvolutionVerificationSignals;
  minSampleSize?: number;
}

function negativeSignalScore(signals: EvolutionVerificationSignals): number {
  return signals.failureCount + signals.needMoreContextCount + signals.manualCorrectionCount;
}

function buildEvidence(prefix: string, signals: EvolutionVerificationSignals): string[] {
  return [
    `${prefix}.failure=${signals.failureCount}`,
    `${prefix}.need_more_context=${signals.needMoreContextCount}`,
    `${prefix}.manual_correction=${signals.manualCorrectionCount}`,
    `${prefix}.sample_size=${signals.sampleSize}`,
  ];
}

export function evaluateEvolutionVerification(
  input: EvolutionVerificationInput
): EvolutionVerification {
  const minSampleSize = input.minSampleSize ?? 3;
  const evidence = [
    ...buildEvidence('before', input.before),
    ...buildEvidence('after', input.after),
  ];

  if (input.before.sampleSize < minSampleSize || input.after.sampleSize < minSampleSize) {
    return {
      verifiedAt: input.verifiedAt,
      revision: input.revision,
      outcome: 'inconclusive',
      evidence,
      reason: `verification sample is below required ${minSampleSize}`,
    };
  }

  const delta = negativeSignalScore(input.after) - negativeSignalScore(input.before);
  if (delta < 0) {
    return {
      verifiedAt: input.verifiedAt,
      revision: input.revision,
      outcome: 'improved',
      evidence,
      reason: `negative signals decreased by ${Math.abs(delta)}`,
    };
  }
  if (delta > 0) {
    return {
      verifiedAt: input.verifiedAt,
      revision: input.revision,
      outcome: 'regressed',
      evidence,
      reason: `negative signals increased by ${delta}`,
    };
  }

  return {
    verifiedAt: input.verifiedAt,
    revision: input.revision,
    outcome: 'neutral',
    evidence,
    reason: 'negative signals stayed flat',
  };
}
