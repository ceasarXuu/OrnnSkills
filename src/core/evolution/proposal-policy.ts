import type {
  EvolutionProposal,
  EvolutionProposalStatus,
  EvolutionRiskLevel,
} from './domain.js';

export type EvolutionProposalPolicyAction =
  | 'auto_apply'
  | 'needs_review'
  | 'needs_more_context'
  | 'skip';

export interface EvolutionProposalPolicy {
  autoOptimize: boolean;
  userConfirm: boolean;
  minConfidence: number;
  minSignalCount: number;
  minSourceSessions: number;
  autoApplyRiskLevels: EvolutionRiskLevel[];
}

export interface EvolutionProposalPolicyInput {
  proposal: EvolutionProposal;
  policy: EvolutionProposalPolicy;
  signalCount: number;
  sourceSessionCount: number;
}

export interface EvolutionProposalPolicyResult {
  action: EvolutionProposalPolicyAction;
  proposalStatus: EvolutionProposalStatus;
  reasons: string[];
}

function collectGateFailures(input: EvolutionProposalPolicyInput): string[] {
  const { proposal, policy, signalCount, sourceSessionCount } = input;
  const failures: string[] = [];

  if (signalCount < policy.minSignalCount) {
    failures.push(`signal count ${signalCount} is below required ${policy.minSignalCount}`);
  }
  if (sourceSessionCount < policy.minSourceSessions) {
    failures.push(
      `source sessions ${sourceSessionCount} is below required ${policy.minSourceSessions}`
    );
  }
  if (proposal.confidence < policy.minConfidence) {
    failures.push(`confidence ${proposal.confidence} is below required ${policy.minConfidence}`);
  }

  return failures;
}

export function evaluateEvolutionProposalPolicy(
  input: EvolutionProposalPolicyInput
): EvolutionProposalPolicyResult {
  const { proposal, policy } = input;
  const gateFailures = collectGateFailures(input);

  if (gateFailures.length > 0) {
    return {
      action: 'needs_more_context',
      proposalStatus: 'needs_more_context',
      reasons: gateFailures,
    };
  }

  if (!policy.autoOptimize) {
    return {
      action: 'skip',
      proposalStatus: 'skipped',
      reasons: ['auto optimize is disabled'],
    };
  }

  if (policy.userConfirm) {
    return {
      action: 'needs_review',
      proposalStatus: 'needs_review',
      reasons: ['user confirmation is required'],
    };
  }

  if (!policy.autoApplyRiskLevels.includes(proposal.riskLevel)) {
    return {
      action: 'needs_review',
      proposalStatus: 'needs_review',
      reasons: [`risk level ${proposal.riskLevel} requires review`],
    };
  }

  return {
    action: 'auto_apply',
    proposalStatus: 'ready',
    reasons: [],
  };
}
