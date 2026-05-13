import { randomUUID } from 'node:crypto';
import type { EvolutionDomainEvent } from './events.js';
import type { EvolutionRun, EvolutionRunStatus } from './domain.js';
import { transitionEvolutionRun } from './state-machine.js';

export interface EvolutionWorkflowOptions {
  createEventId?: () => string;
  now?: () => string;
}

export interface EvolutionWorkflowAdvanceResult {
  run: EvolutionRun;
  events: EvolutionDomainEvent[];
}

export class EvolutionWorkflow {
  constructor(private readonly options: EvolutionWorkflowOptions = {}) {}

  advance(
    run: EvolutionRun,
    status: EvolutionRunStatus,
    reason?: string | null
  ): EvolutionWorkflowAdvanceResult {
    const occurredAt = (this.options.now ?? (() => new Date().toISOString()))();
    const nextRun = transitionEvolutionRun(run, status, occurredAt);

    return {
      run: nextRun,
      events: [
        {
          type: 'evolution.run_status_changed',
          eventId: (this.options.createEventId ?? randomUUID)(),
          occurredAt,
          runId: run.runId,
          episodeId: run.episodeId,
          skillId: run.skillId,
          from: run.status,
          to: status,
          reason: reason ?? null,
        },
      ],
    };
  }
}

export function createEvolutionWorkflow(options: EvolutionWorkflowOptions = {}): EvolutionWorkflow {
  return new EvolutionWorkflow(options);
}
