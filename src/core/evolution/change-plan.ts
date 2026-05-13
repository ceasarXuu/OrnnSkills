import type { RuntimeType } from '../../types/index.js';
import type { EvolutionProposal } from './domain.js';

export type EvolutionChangePlanOperation =
  | { type: 'append_section'; heading: string; content: string }
  | { type: 'append_to_section'; section: string; content: string }
  | { type: 'replace_section'; section: string; content: string }
  | { type: 'remove_section'; section: string }
  | { type: 'tighten_trigger'; section: string; exclusions: string[] };

export interface EvolutionChangePlan {
  planId: string;
  proposalId: string;
  skillId: string;
  runtime: RuntimeType;
  operations: EvolutionChangePlanOperation[];
  idempotencyKey: string;
  previewDiff?: string | null;
}

export interface EvolutionChangePlanInput {
  proposal: EvolutionProposal;
  operations: EvolutionChangePlanOperation[];
  previewDiff?: string | null;
}

function requireText(value: string | undefined, message: string): void {
  if (!value || value.trim().length === 0) {
    throw new Error(message);
  }
}

function validateOperation(operation: EvolutionChangePlanOperation): void {
  switch (operation.type) {
    case 'append_section':
      requireText(operation.heading, 'Change plan operation append_section requires a heading');
      requireText(operation.content, 'Change plan operation append_section requires content');
      break;
    case 'append_to_section':
    case 'replace_section':
      requireText(operation.section, `Change plan operation ${operation.type} requires a section`);
      requireText(operation.content, `Change plan operation ${operation.type} requires content`);
      break;
    case 'remove_section':
      requireText(operation.section, 'Change plan operation remove_section requires a section');
      break;
    case 'tighten_trigger':
      requireText(operation.section, 'Change plan operation tighten_trigger requires a section');
      if (operation.exclusions.length === 0) {
        throw new Error('Change plan operation tighten_trigger requires exclusions');
      }
      break;
  }
}

function operationKey(operation: EvolutionChangePlanOperation): string {
  switch (operation.type) {
    case 'append_section':
      return `${operation.type}:${operation.heading}:${operation.content}`;
    case 'append_to_section':
    case 'replace_section':
      return `${operation.type}:${operation.section}:${operation.content}`;
    case 'remove_section':
      return `${operation.type}:${operation.section}`;
    case 'tighten_trigger':
      return `${operation.type}:${operation.section}:${operation.exclusions.join('|')}`;
  }
}

export function validateEvolutionChangePlan(input: EvolutionChangePlanInput): void {
  if (input.operations.length === 0) {
    throw new Error('Change plan requires at least one operation');
  }
  for (const operation of input.operations) {
    validateOperation(operation);
  }
}

export function createEvolutionChangePlan(input: EvolutionChangePlanInput): EvolutionChangePlan {
  validateEvolutionChangePlan(input);

  return {
    planId: `${input.proposal.proposalId}:change-plan`,
    proposalId: input.proposal.proposalId,
    skillId: input.proposal.skillId,
    runtime: input.proposal.runtime,
    operations: input.operations,
    idempotencyKey: [
      input.proposal.proposalId,
      ...input.operations.map((operation) => operationKey(operation)),
    ].join(':'),
    previewDiff: input.previewDiff ?? null,
  };
}
