import type { EvolutionRun, EvolutionRunStatus } from './domain.js';

const ALLOWED_TRANSITIONS: Readonly<Record<EvolutionRunStatus, readonly EvolutionRunStatus[]>> = {
  collecting: ['analyzing', 'skipped', 'failed'],
  analyzing: ['proposed', 'skipped', 'failed'],
  proposed: ['applying', 'skipped', 'failed'],
  skipped: [],
  applying: ['applied', 'failed'],
  applied: ['deploying', 'verifying', 'rolled_back', 'failed'],
  deploying: ['deployed', 'failed'],
  deployed: ['verifying', 'rolled_back', 'failed'],
  verifying: ['verified', 'regressed', 'failed'],
  verified: ['rolled_back'],
  regressed: ['rolled_back'],
  failed: ['rolled_back'],
  rolled_back: [],
};

export function canTransitionEvolutionRun(
  from: EvolutionRunStatus,
  to: EvolutionRunStatus
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertEvolutionRunTransition(
  from: EvolutionRunStatus,
  to: EvolutionRunStatus
): void {
  if (!canTransitionEvolutionRun(from, to)) {
    throw new Error(`Invalid evolution run transition: ${from} -> ${to}`);
  }
}

export function transitionEvolutionRun(
  run: EvolutionRun,
  status: EvolutionRunStatus,
  updatedAt: string = new Date().toISOString()
): EvolutionRun {
  assertEvolutionRunTransition(run.status, status);
  return {
    ...run,
    status,
    updatedAt,
  };
}

export function getAllowedEvolutionRunTransitions(
  status: EvolutionRunStatus
): readonly EvolutionRunStatus[] {
  return ALLOWED_TRANSITIONS[status];
}
