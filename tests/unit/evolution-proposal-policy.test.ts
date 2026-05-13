import { describe, expect, it } from 'vitest';
import {
  evaluateEvolutionProposalPolicy,
  type EvolutionProposalPolicy,
} from '../../src/core/evolution/proposal-policy.js';
import type { EvolutionProposal } from '../../src/core/evolution/domain.js';

const basePolicy: EvolutionProposalPolicy = {
  autoOptimize: true,
  userConfirm: false,
  minConfidence: 0.7,
  minSignalCount: 2,
  minSourceSessions: 1,
  autoApplyRiskLevels: ['low'],
};

function makeProposal(overrides: Partial<EvolutionProposal> = {}): EvolutionProposal {
  return {
    proposalId: 'proposal-1',
    episodeId: 'episode-1',
    skillId: 'skill-a',
    runtime: 'codex',
    changeType: 'tighten_trigger',
    reason: 'The skill fired for a non-matching task.',
    evidence: ['trace-1', 'trace-2', 'session-1'],
    confidence: 0.82,
    riskLevel: 'low',
    status: 'ready',
    ...overrides,
  };
}

describe('evolution proposal policy', () => {
  it('requires manual review when user confirmation is enabled', () => {
    const result = evaluateEvolutionProposalPolicy({
      proposal: makeProposal(),
      policy: { ...basePolicy, userConfirm: true },
      signalCount: 2,
      sourceSessionCount: 1,
    });

    expect(result).toEqual({
      action: 'needs_review',
      proposalStatus: 'needs_review',
      reasons: ['user confirmation is required'],
    });
  });

  it('auto applies only low-risk proposals that pass gates', () => {
    const result = evaluateEvolutionProposalPolicy({
      proposal: makeProposal(),
      policy: basePolicy,
      signalCount: 2,
      sourceSessionCount: 1,
    });

    expect(result).toEqual({
      action: 'auto_apply',
      proposalStatus: 'ready',
      reasons: [],
    });
  });

  it('keeps high-risk proposals in review even when auto optimize is enabled', () => {
    const result = evaluateEvolutionProposalPolicy({
      proposal: makeProposal({ riskLevel: 'high' }),
      policy: basePolicy,
      signalCount: 2,
      sourceSessionCount: 1,
    });

    expect(result).toEqual({
      action: 'needs_review',
      proposalStatus: 'needs_review',
      reasons: ['risk level high requires review'],
    });
  });

  it('marks insufficient evidence as needs_more_context', () => {
    const result = evaluateEvolutionProposalPolicy({
      proposal: makeProposal({ confidence: 0.5 }),
      policy: basePolicy,
      signalCount: 1,
      sourceSessionCount: 0,
    });

    expect(result).toEqual({
      action: 'needs_more_context',
      proposalStatus: 'needs_more_context',
      reasons: [
        'signal count 1 is below required 2',
        'source sessions 0 is below required 1',
        'confidence 0.5 is below required 0.7',
      ],
    });
  });

  it('skips apply when auto optimize is disabled', () => {
    const result = evaluateEvolutionProposalPolicy({
      proposal: makeProposal(),
      policy: { ...basePolicy, autoOptimize: false },
      signalCount: 2,
      sourceSessionCount: 1,
    });

    expect(result).toEqual({
      action: 'skip',
      proposalStatus: 'skipped',
      reasons: ['auto optimize is disabled'],
    });
  });
});
