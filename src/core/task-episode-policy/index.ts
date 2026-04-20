import { randomUUID } from 'node:crypto';
import type { RuntimeType, Trace, WindowAnalysisHint } from '../../types/index.js';
import type {
  ProbeTriggerDecision,
  ReadinessProbeResult,
  TaskEpisode,
  TaskEpisodeTraceContext,
} from '../task-episode/index.js';

function pushUnique(items: string[], value: string | undefined): void {
  if (!value) return;
  if (!items.includes(value)) {
    items.push(value);
  }
}

export function isEpisodeOpen(episode: TaskEpisode): boolean {
  return !['closed', 'split'].includes(episode.state) &&
    !['completed', 'failed', 'closed', 'split'].includes(episode.analysisStatus);
}

export function isTraceWithinEpisodeWindow(episode: TaskEpisode, trace: Trace): boolean {
  return trace.timestamp >= episode.startedAt;
}

function mapDecisionToEpisodeState(
  decision: ReadinessProbeResult['decision']
): { state: string; analysisStatus: string } {
  switch (decision) {
    case 'ready_for_analysis':
      return { state: 'ready', analysisStatus: 'ready' };
    case 'pause_waiting':
      return { state: 'waiting', analysisStatus: 'paused' };
    case 'close_no_action':
      return { state: 'closed', analysisStatus: 'closed' };
    case 'split_episode':
      return { state: 'closed', analysisStatus: 'split' };
    default:
      return { state: 'collecting', analysisStatus: 'collecting' };
  }
}

export function findActiveEpisode(
  episodes: TaskEpisode[],
  sessionId: string,
  skillId: string,
  runtime: RuntimeType
): TaskEpisode | undefined {
  const candidates = episodes.filter((episode) =>
    episode.runtime === runtime &&
    episode.sessionIds.includes(sessionId) &&
    episode.skillSegments.some((segment) => segment.skillId === skillId) &&
    isEpisodeOpen(episode)
  );

  return candidates.sort((a, b) => String(b.lastActivityAt).localeCompare(String(a.lastActivityAt)))[0];
}

export function recalculateEpisodeStats(episode: TaskEpisode): void {
  const archivedTraceCount = episode.retention?.archivedTraceCount ?? 0;
  const archivedTurnCount = episode.retention?.archivedTurnCount ?? 0;
  const mappedTraceCount = episode.skillSegments.reduce((count, segment) => {
    return count + segment.mappedTraceIds.length + (segment.retention?.archivedMappedTraceCount ?? 0);
  }, 0);

  episode.stats.totalTraceCount = episode.traceRefs.length + archivedTraceCount;
  episode.stats.totalTurnCount = episode.turnIds.length + archivedTurnCount;
  episode.stats.mappedTraceCount = mappedTraceCount;
  episode.stats.tracesSinceLastProbe = Math.max(
    0,
    episode.stats.totalTraceCount - episode.probeState.lastProbeTraceIndex
  );
  episode.stats.turnsSinceLastProbe = Math.max(
    0,
    episode.stats.totalTurnCount - episode.probeState.lastProbeTurnIndex
  );
}

export function selectContextOwner(episodes: TaskEpisode[]): TaskEpisode | null {
  if (episodes.length === 0) return null;
  return [...episodes].sort((a, b) => String(b.lastActivityAt).localeCompare(String(a.lastActivityAt)))[0] ?? null;
}

export function createTaskEpisode(
  projectRoot: string,
  trace: Trace,
  context: TaskEpisodeTraceContext
): TaskEpisode {
  return {
    episodeId: randomUUID(),
    projectPath: projectRoot,
    runtime: context.runtime,
    sessionIds: [trace.session_id],
    startedAt: trace.timestamp,
    lastActivityAt: trace.timestamp,
    state: 'collecting',
    traceRefs: [],
    turnIds: [],
    skillSegments: [
      {
        segmentId: randomUUID(),
        skillId: context.skillId,
        shadowId: context.shadowId,
        runtime: context.runtime,
        firstMappedTraceId: trace.trace_id,
        lastRelatedTraceId: trace.trace_id,
        mappedTraceIds: [],
        relatedTraceIds: [],
        startedAt: trace.timestamp,
        lastActivityAt: trace.timestamp,
        status: 'active',
      },
    ],
    stats: {
      totalTraceCount: 0,
      totalTurnCount: 0,
      mappedTraceCount: 0,
      tracesSinceLastProbe: 0,
      turnsSinceLastProbe: 0,
    },
    probeState: {
      probeCount: 0,
      lastProbeTraceIndex: 0,
      lastProbeTurnIndex: 0,
      nextProbeTraceDelta: 20,
      nextProbeTurnDelta: 3,
      waitForEventTypes: [],
      mode: 'count_driven',
      consecutiveNeedMoreCount: 0,
      consecutiveReadyCount: 0,
    },
    analysisStatus: 'collecting',
  };
}

export function synchronizeEpisodeWithTrace(
  episode: TaskEpisode,
  trace: Trace,
  context: TaskEpisodeTraceContext,
  sessionTraces: Trace[]
): void {
  const normalizedTrace = sessionTraces.find((sessionTrace) => sessionTrace.trace_id === trace.trace_id) ?? trace;
  pushUnique(episode.sessionIds, normalizedTrace.session_id);
  pushUnique(episode.traceRefs, normalizedTrace.trace_id);
  pushUnique(episode.turnIds, normalizedTrace.turn_id);
  episode.lastActivityAt = trace.timestamp;

  const segment = episode.skillSegments.find((item) => item.skillId === context.skillId) ?? episode.skillSegments[0];
  pushUnique(segment.mappedTraceIds, trace.trace_id);
  pushUnique(segment.relatedTraceIds, normalizedTrace.trace_id);
  segment.lastRelatedTraceId = normalizedTrace.trace_id;
  segment.lastActivityAt = trace.timestamp;
  segment.status = episode.analysisStatus === 'running' ? 'analyzing' : 'active';

  if (episode.analysisStatus !== 'running') {
    episode.state = 'collecting';
    episode.analysisStatus = 'collecting';
  }

  recalculateEpisodeStats(episode);
}

export function attachContextTraceToEpisode(episode: TaskEpisode, trace: Trace): void {
  pushUnique(episode.traceRefs, trace.trace_id);
  pushUnique(episode.turnIds, trace.turn_id);
  episode.lastActivityAt = trace.timestamp;

  for (const segment of episode.skillSegments) {
    pushUnique(segment.relatedTraceIds, trace.trace_id);
    segment.lastRelatedTraceId = trace.trace_id;
    segment.lastActivityAt = trace.timestamp;
  }

  recalculateEpisodeStats(episode);
}

export function shouldTriggerEpisodeProbe(
  episode: TaskEpisode,
  trace: Trace
): ProbeTriggerDecision {
  if (episode.analysisStatus === 'running' || episode.state === 'analyzing') {
    return { shouldProbe: false, reason: null, mode: episode.probeState.mode };
  }

  if (
    episode.probeState.mode === 'event_driven' &&
    episode.probeState.waitForEventTypes.includes(trace.event_type) &&
    episode.stats.tracesSinceLastProbe > 0
  ) {
    return { shouldProbe: true, reason: 'event_driven_signal', mode: 'event_driven' };
  }

  if (episode.probeState.probeCount === 0 && episode.stats.totalTraceCount >= 10) {
    return { shouldProbe: true, reason: 'initial_window_ready', mode: 'count_driven' };
  }

  if (episode.stats.tracesSinceLastProbe >= episode.probeState.nextProbeTraceDelta) {
    return { shouldProbe: true, reason: 'trace_delta_reached', mode: 'count_driven' };
  }

  const turnDrivenTraceFloor = Math.max(5, Math.ceil(episode.probeState.nextProbeTraceDelta / 2));
  if (
    episode.stats.turnsSinceLastProbe >= episode.probeState.nextProbeTurnDelta &&
    episode.stats.tracesSinceLastProbe >= turnDrivenTraceFloor
  ) {
    return { shouldProbe: true, reason: 'turn_delta_reached', mode: 'count_driven' };
  }

  return { shouldProbe: false, reason: null, mode: episode.probeState.mode };
}

export function applyProbeResultToEpisode(
  episode: TaskEpisode,
  result: ReadinessProbeResult,
  updatedAt: string = new Date().toISOString()
): void {
  episode.probeState.probeCount += 1;
  episode.probeState.lastProbeTraceIndex = episode.traceRefs.length;
  episode.probeState.lastProbeTurnIndex = episode.turnIds.length;
  episode.probeState.nextProbeTraceDelta = Math.max(1, result.nextProbeHint.suggestedTraceDelta);
  episode.probeState.nextProbeTurnDelta = Math.max(1, result.nextProbeHint.suggestedTurnDelta);
  episode.probeState.waitForEventTypes = [...result.nextProbeHint.waitForEventTypes];
  episode.probeState.mode = result.nextProbeHint.mode;

  if (result.decision === 'ready_for_analysis') {
    episode.probeState.consecutiveReadyCount += 1;
    episode.probeState.consecutiveNeedMoreCount = 0;
  } else if (result.decision === 'continue_collecting' || result.decision === 'pause_waiting') {
    episode.probeState.consecutiveNeedMoreCount += 1;
    episode.probeState.consecutiveReadyCount = 0;
  } else {
    episode.probeState.consecutiveNeedMoreCount = 0;
    episode.probeState.consecutiveReadyCount = 0;
  }

  const mapped = mapDecisionToEpisodeState(result.decision);
  episode.state = result.episodeAction.closeCurrent ? 'closed' : mapped.state;
  episode.analysisStatus = result.episodeAction.closeCurrent ? 'closed' : mapped.analysisStatus;
  episode.lastActivityAt = updatedAt;

  if (episode.state === 'closed') {
    for (const segment of episode.skillSegments) {
      segment.status = 'closed';
    }
  }

  recalculateEpisodeStats(episode);
}

export function buildNeedMoreContextProbeResult(hint: WindowAnalysisHint): ReadinessProbeResult {
  return {
    decision: 'continue_collecting',
    reason: 'Need more context before optimization.',
    observedOutcomes: [],
    missingEvidence: [],
    nextProbeHint: {
      suggestedTraceDelta: hint.suggestedTraceDelta,
      suggestedTurnDelta: hint.suggestedTurnDelta,
      waitForEventTypes: hint.waitForEventTypes,
      mode: hint.mode,
    },
    episodeAction: {
      closeCurrent: false,
      openNew: false,
    },
    skillFocus: [],
  };
}

export function markEpisodeAnalysisState(
  episode: TaskEpisode,
  status: 'running' | 'completed' | 'failed',
  updatedAt: string = new Date().toISOString()
): void {
  episode.lastActivityAt = updatedAt;

  if (status === 'running') {
    episode.state = 'analyzing';
    episode.analysisStatus = 'running';
    for (const segment of episode.skillSegments) {
      segment.status = 'analyzing';
    }
  } else {
    episode.state = 'closed';
    episode.analysisStatus = status;
    for (const segment of episode.skillSegments) {
      segment.status = 'closed';
    }
  }

  recalculateEpisodeStats(episode);
}
