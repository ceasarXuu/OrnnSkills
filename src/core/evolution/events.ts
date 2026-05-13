import type {
  EvolutionApplication,
  EvolutionProposal,
  EvolutionRunStatus,
  EvolutionVerification,
} from './domain.js';

interface BaseEvolutionEvent {
  eventId: string;
  occurredAt: string;
  runId: string;
  episodeId: string;
  skillId: string;
}

export interface EvolutionRunStatusChangedEvent extends BaseEvolutionEvent {
  type: 'evolution.run_status_changed';
  from: EvolutionRunStatus;
  to: EvolutionRunStatus;
  reason?: string | null;
}

export interface EvolutionProposalCreatedEvent extends BaseEvolutionEvent {
  type: 'evolution.proposal_created';
  proposal: EvolutionProposal;
}

export interface EvolutionApplicationRecordedEvent extends BaseEvolutionEvent {
  type: 'evolution.application_recorded';
  application: EvolutionApplication;
}

export interface EvolutionVerificationRecordedEvent extends BaseEvolutionEvent {
  type: 'evolution.verification_recorded';
  verification: EvolutionVerification;
}

export type EvolutionDomainEvent =
  | EvolutionRunStatusChangedEvent
  | EvolutionProposalCreatedEvent
  | EvolutionApplicationRecordedEvent
  | EvolutionVerificationRecordedEvent;
