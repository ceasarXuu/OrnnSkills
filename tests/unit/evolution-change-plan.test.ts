import { describe, expect, it } from 'vitest';
import {
  createEvolutionChangePlan,
  validateEvolutionChangePlan,
} from '../../src/core/evolution/change-plan.js';
import type { EvolutionProposal } from '../../src/core/evolution/domain.js';

function makeProposal(overrides: Partial<EvolutionProposal> = {}): EvolutionProposal {
  return {
    proposalId: 'proposal-1',
    episodeId: 'episode-1',
    skillId: 'skill-a',
    runtime: 'codex',
    changeType: 'tighten_trigger',
    reason: 'Avoid using this skill for deployment tasks.',
    evidence: ['trace-1', 'trace-2'],
    confidence: 0.84,
    riskLevel: 'low',
    status: 'ready',
    ...overrides,
  };
}

describe('evolution change plan', () => {
  it('creates a stable idempotency key from proposal and operations', () => {
    const plan = createEvolutionChangePlan({
      proposal: makeProposal(),
      operations: [
        {
          type: 'tighten_trigger',
          section: 'When to use',
          exclusions: ['Do not use for deployment-only tasks.'],
        },
      ],
    });

    expect(plan).toMatchObject({
      planId: 'proposal-1:change-plan',
      proposalId: 'proposal-1',
      skillId: 'skill-a',
      runtime: 'codex',
      idempotencyKey:
        'proposal-1:tighten_trigger:When to use:Do not use for deployment-only tasks.',
    });
  });

  it('requires section names for section-targeted operations', () => {
    expect(() =>
      validateEvolutionChangePlan({
        proposal: makeProposal({ changeType: 'rewrite_section' }),
        operations: [{ type: 'replace_section', section: '', content: 'New content' }],
      })
    ).toThrow('Change plan operation replace_section requires a section');
  });

  it('requires at least one operation before apply', () => {
    expect(() =>
      validateEvolutionChangePlan({
        proposal: makeProposal(),
        operations: [],
      })
    ).toThrow('Change plan requires at least one operation');
  });
});
