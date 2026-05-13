import type { DecisionEventRecord } from '../decision-events/index.js';
import type { VersionMetadata } from '../skill-version/index.js';
import type { TaskEpisode, TaskEpisodeSkillSegment } from '../task-episode/index.js';
import type {
  EvolutionApplication,
  EvolutionEvidenceRef,
  EvolutionProposal,
  EvolutionRun,
  EvolutionRunStatus,
} from './domain.js';
import { createEvolutionRun } from './domain.js';

export interface EvolutionRunProjectionInput {
  episode: TaskEpisode;
  decisionEvents?: DecisionEventRecord[];
  versions?: VersionMetadata[];
}

function dedupe(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => !!value)));
}

function selectPrimarySegment(episode: TaskEpisode): TaskEpisodeSkillSegment | null {
  return episode.skillSegments[0] ?? null;
}

function selectDecisionEvent(
  events: DecisionEventRecord[],
  episode: TaskEpisode,
  segment: TaskEpisodeSkillSegment
): DecisionEventRecord | null {
  return (
    events.find((event) => {
      return event.episodeId === episode.episodeId && event.skillId === segment.skillId;
    }) ?? null
  );
}

function selectApplicationVersion(
  versions: VersionMetadata[],
  episode: TaskEpisode
): VersionMetadata | null {
  return (
    versions.find((version) => {
      return version.activityScopeId === episode.episodeId || version.traceIds.some((traceId) =>
        episode.traceRefs.includes(traceId)
      );
    }) ?? null
  );
}

function inferStatus(
  episode: TaskEpisode,
  decisionEvent: DecisionEventRecord | null,
  version: VersionMetadata | null
): EvolutionRunStatus {
  if (version) {
    return 'applied';
  }
  if (decisionEvent?.status === 'no_optimization') {
    return 'skipped';
  }
  if (decisionEvent?.status === 'apply_optimization') {
    return 'proposed';
  }
  if (episode.analysisStatus === 'ready_for_analysis') {
    return 'analyzing';
  }
  if (['completed', 'closed'].includes(episode.analysisStatus)) {
    return 'skipped';
  }
  return 'collecting';
}

function buildProposal(
  episode: TaskEpisode,
  segment: TaskEpisodeSkillSegment,
  decisionEvent: DecisionEventRecord | null
): EvolutionProposal | null {
  if (!decisionEvent || decisionEvent.status !== 'apply_optimization') {
    return null;
  }

  return {
    proposalId: decisionEvent.id,
    episodeId: episode.episodeId,
    skillId: segment.skillId,
    runtime: segment.runtime,
    changeType: decisionEvent.changeType ?? 'unknown',
    reason: decisionEvent.reason ?? decisionEvent.detail ?? '',
    evidence: dedupe([
      ...episode.traceRefs,
      ...episode.sessionIds,
      ...(decisionEvent.evidence?.directEvidence ?? []),
      ...(decisionEvent.evidence?.causalJudgment ?? []),
    ]),
    confidence: decisionEvent.confidence ?? 0,
    riskLevel: 'medium',
    status: 'ready',
  };
}

function buildApplication(
  decisionEvent: DecisionEventRecord | null,
  version: VersionMetadata | null
): EvolutionApplication | null {
  if (!decisionEvent || !version) {
    return null;
  }

  return {
    proposalId: decisionEvent.id,
    appliedAt: version.createdAt,
    revision: version.version,
    previousRevision: version.previousVersion,
    linesAdded: decisionEvent.linesAdded ?? null,
    linesRemoved: decisionEvent.linesRemoved ?? null,
  };
}

function buildEvidence(
  episode: TaskEpisode,
  decisionEvent: DecisionEventRecord | null,
  version: VersionMetadata | null
): EvolutionEvidenceRef[] {
  return [
    { kind: 'episode', id: episode.episodeId },
    ...episode.traceRefs.map((traceId) => ({ kind: 'trace' as const, id: traceId })),
    ...episode.sessionIds.map((sessionId) => ({ kind: 'session' as const, id: sessionId })),
    ...(decisionEvent ? [{ kind: 'decision_event' as const, id: decisionEvent.id }] : []),
    ...(version ? [{ kind: 'version' as const, id: String(version.version) }] : []),
  ];
}

export function projectEvolutionRunFromEpisode(
  input: EvolutionRunProjectionInput
): EvolutionRun {
  const { episode, decisionEvents = [], versions = [] } = input;
  const segment = selectPrimarySegment(episode);
  if (!segment) {
    throw new Error(`Cannot project evolution run without skill segment: ${episode.episodeId}`);
  }

  const decisionEvent = selectDecisionEvent(decisionEvents, episode, segment);
  const version = selectApplicationVersion(versions, episode);

  return createEvolutionRun({
    runId: `${episode.episodeId}:${segment.skillId}`,
    episodeId: episode.episodeId,
    skillId: segment.skillId,
    runtime: segment.runtime,
    status: inferStatus(episode, decisionEvent, version),
    createdAt: episode.startedAt,
    updatedAt: version?.createdAt ?? decisionEvent?.timestamp ?? episode.lastActivityAt,
    proposal: buildProposal(episode, segment, decisionEvent),
    application: buildApplication(decisionEvent, version),
    evidence: buildEvidence(episode, decisionEvent, version),
  });
}
