import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { projectEvolutionRunFromEpisode } from '../core/evolution/projection.js';
import type { EvolutionRun, EvolutionVerification } from '../core/evolution/domain.js';
import type { DecisionEventRecord } from '../core/decision-events/index.js';
import {
  createEmptyTaskEpisodeSnapshot,
  normalizeTaskEpisodeSnapshot,
  type TaskEpisodeSnapshot,
} from '../core/task-episode/index.js';
import type { VersionMetadata } from '../core/skill-version/index.js';
import { readRecentDecisionEvents } from './readers/decision-events-reader.js';

export interface DashboardEvolutionLifecycleSummary {
  activeEpisodes: number;
  pendingProposals: number;
  appliedRevisions: number;
  failedRuns: number;
  regressions: number;
  verifiedImprovements: number;
}

export type DashboardEvolutionRecommendedActionType =
  | 'preview'
  | 'backup'
  | 'rollback'
  | 'freeze';

export interface DashboardEvolutionRecommendedAction {
  type: DashboardEvolutionRecommendedActionType;
  label: string;
  requiresConfirmation: boolean;
  targetRevision?: number | null;
  reason: string;
}

export type DashboardEvolutionRun = EvolutionRun & {
  recommendedActions: DashboardEvolutionRecommendedAction[];
};

export interface DashboardEvolutionLifecycle {
  summary: DashboardEvolutionLifecycleSummary;
  runs: DashboardEvolutionRun[];
}

function readTaskEpisodes(projectRoot: string): TaskEpisodeSnapshot {
  const snapshotPath = join(projectRoot, '.ornn', 'state', 'task-episodes.json');
  if (!existsSync(snapshotPath)) {
    return createEmptyTaskEpisodeSnapshot();
  }

  try {
    return normalizeTaskEpisodeSnapshot(JSON.parse(readFileSync(snapshotPath, 'utf-8')));
  } catch {
    return createEmptyTaskEpisodeSnapshot();
  }
}

function readVersionMetadataFile(path: string): VersionMetadata | null {
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf-8')) as Partial<VersionMetadata>;
    if (typeof parsed.version !== 'number' || typeof parsed.createdAt !== 'string') {
      return null;
    }
    return {
      version: parsed.version,
      createdAt: parsed.createdAt,
      reason: String(parsed.reason ?? ''),
      traceIds: Array.isArray(parsed.traceIds) ? parsed.traceIds.map(String) : [],
      previousVersion:
        typeof parsed.previousVersion === 'number' ? parsed.previousVersion : null,
      isDisabled: !!parsed.isDisabled,
      disabledAt: parsed.disabledAt ?? null,
      activityScopeId: parsed.activityScopeId,
      analyzerModel: parsed.analyzerModel,
      tokenUsage: parsed.tokenUsage,
    };
  } catch {
    return null;
  }
}

function readVersionMetadata(projectRoot: string): VersionMetadata[] {
  const skillsDir = join(projectRoot, '.ornn', 'skills');
  if (!existsSync(skillsDir)) {
    return [];
  }

  const metadata: VersionMetadata[] = [];
  const stack = [skillsDir];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }

    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const childPath = join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(childPath);
      } else if (entry.isFile() && entry.name === 'metadata.json') {
        const item = readVersionMetadataFile(childPath);
        if (item) {
          metadata.push(item);
        }
      }
    }
  }

  return metadata;
}

function countActiveEpisodes(runs: DashboardEvolutionRun[]): number {
  return runs.filter((run) => !['skipped', 'failed', 'rolled_back'].includes(run.status)).length;
}

function summarizeRuns(runs: DashboardEvolutionRun[]): DashboardEvolutionLifecycleSummary {
  return {
    activeEpisodes: countActiveEpisodes(runs),
    pendingProposals: runs.filter((run) => run.status === 'proposed').length,
    appliedRevisions: runs.filter((run) => !!run.application).length,
    failedRuns: runs.filter((run) => run.status === 'failed').length,
    regressions: runs.filter((run) => run.verification?.outcome === 'regressed').length,
    verifiedImprovements: runs.filter((run) => run.verification?.outcome === 'improved').length,
  };
}

function getRunPriority(run: DashboardEvolutionRun): number {
  if (run.status === 'proposed') return 0;
  if (run.verification?.outcome === 'regressed') return 1;
  if (run.status === 'failed') return 2;
  if (run.application) return 3;
  return 4;
}

function isHighRiskProposal(run: EvolutionRun): boolean {
  return run.proposal?.riskLevel === 'high' ||
    ['rewrite_section', 'remove_section', 'prune_noise'].includes(run.proposal?.changeType ?? '');
}

function getRecommendedActions(run: EvolutionRun): DashboardEvolutionRecommendedAction[] {
  if (run.verification?.outcome === 'regressed') {
    return [
      {
        type: 'rollback',
        label: '回滚到上一修订',
        requiresConfirmation: true,
        targetRevision: run.application?.previousRevision ?? null,
        reason: run.verification.reason,
      },
      {
        type: 'freeze',
        label: '冻结当前 skill',
        requiresConfirmation: true,
        targetRevision: run.application?.revision ?? null,
        reason: 'regressed verification outcome requires attention',
      },
    ];
  }

  if (run.status === 'proposed' && isHighRiskProposal(run)) {
    return [
      {
        type: 'preview',
        label: '预览变更',
        requiresConfirmation: false,
        reason: 'high-risk proposal must be previewed before apply',
      },
      {
        type: 'backup',
        label: '创建备份',
        requiresConfirmation: true,
        reason: 'high-risk proposal requires backup before apply',
      },
    ];
  }

  return [];
}

function toVerificationOutcome(status: string | null | undefined): EvolutionVerification['outcome'] | null {
  if (status === 'improved' || status === 'neutral' || status === 'regressed' || status === 'inconclusive') {
    return status;
  }
  return null;
}

function findVerificationEvent(
  run: EvolutionRun,
  decisionEvents: DecisionEventRecord[]
): DecisionEventRecord | null {
  return (
    decisionEvents.find((event) => {
      return event.episodeId === run.episodeId &&
        event.skillId === run.skillId &&
        event.tag === 'evolution_verification' &&
        !!toVerificationOutcome(event.status);
    }) ?? null
  );
}

function applyVerificationSignals(
  run: EvolutionRun,
  decisionEvents: DecisionEventRecord[]
): EvolutionRun {
  const event = findVerificationEvent(run, decisionEvents);
  const outcome = toVerificationOutcome(event?.status);
  if (!event || !outcome) {
    return run;
  }

  return {
    ...run,
    status: outcome === 'regressed' ? 'regressed' : run.status,
    updatedAt: event.timestamp > run.updatedAt ? event.timestamp : run.updatedAt,
    verification: {
      verifiedAt: event.timestamp,
      revision: run.application?.revision ?? 0,
      outcome,
      evidence: [event.id],
      reason: event.reason ?? event.detail ?? event.status ?? '',
    },
  };
}

function toDashboardEvolutionRun(run: EvolutionRun): DashboardEvolutionRun {
  return {
    ...run,
    recommendedActions: getRecommendedActions(run),
  };
}

export function readProjectEvolutionLifecycle(projectRoot: string): DashboardEvolutionLifecycle {
  const snapshot = readTaskEpisodes(projectRoot);
  const decisionEvents = readRecentDecisionEvents(projectRoot, 800);
  const versions = readVersionMetadata(projectRoot);
  const runs = snapshot.episodes
    .map((episode) => {
      try {
        const run = projectEvolutionRunFromEpisode({ episode, decisionEvents, versions });
        return toDashboardEvolutionRun(applyVerificationSignals(run, decisionEvents));
      } catch {
        return null;
      }
    })
    .filter((run): run is DashboardEvolutionRun => !!run)
    .sort((left, right) => {
      const priorityDelta = getRunPriority(left) - getRunPriority(right);
      if (priorityDelta !== 0) return priorityDelta;
      return right.updatedAt.localeCompare(left.updatedAt);
    });

  return {
    summary: summarizeRuns(runs),
    runs,
  };
}
