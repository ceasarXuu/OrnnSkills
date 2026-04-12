import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { RuntimeType, Trace, WindowAnalysisHint } from '../../types/index.js';
import { createChildLogger } from '../../utils/logger.js';

const logger = createChildLogger('task-episode');

export interface TaskEpisodeSkillSegment {
  segmentId: string;
  skillId: string;
  shadowId: string;
  runtime: RuntimeType;
  firstMappedTraceId: string;
  lastRelatedTraceId: string;
  mappedTraceIds: string[];
  relatedTraceIds: string[];
  startedAt: string;
  lastActivityAt: string;
  status: string;
}

export interface TaskEpisode {
  episodeId: string;
  projectPath: string;
  runtime: RuntimeType;
  sessionIds: string[];
  startedAt: string;
  lastActivityAt: string;
  state: string;
  traceRefs: string[];
  turnIds: string[];
  skillSegments: TaskEpisodeSkillSegment[];
  stats: {
    totalTraceCount: number;
    totalTurnCount: number;
    mappedTraceCount: number;
    tracesSinceLastProbe: number;
    turnsSinceLastProbe: number;
  };
  probeState: {
    probeCount: number;
    lastProbeTraceIndex: number;
    lastProbeTurnIndex: number;
    nextProbeTraceDelta: number;
    nextProbeTurnDelta: number;
    waitForEventTypes: string[];
    mode: 'count_driven' | 'event_driven';
    consecutiveNeedMoreCount: number;
    consecutiveReadyCount: number;
  };
  analysisStatus: string;
}

export interface ReadinessProbeResult {
  decision: 'continue_collecting' | 'ready_for_analysis' | 'pause_waiting' | 'close_no_action' | 'split_episode';
  reason: string;
  observedOutcomes: string[];
  missingEvidence: string[];
  nextProbeHint: {
    suggestedTraceDelta: number;
    suggestedTurnDelta: number;
    waitForEventTypes: string[];
    mode: 'count_driven' | 'event_driven';
  };
  episodeAction: {
    closeCurrent: boolean;
    openNew: boolean;
  };
  skillFocus: string[];
}

export interface TaskEpisodeSnapshot {
  updatedAt: string;
  episodes: TaskEpisode[];
}

export interface TaskEpisodeTraceContext {
  skillId: string;
  shadowId: string;
  runtime: RuntimeType;
}

export interface ProbeTriggerDecision {
  shouldProbe: boolean;
  reason: 'initial_window_ready' | 'trace_delta_reached' | 'turn_delta_reached' | 'event_driven_signal' | null;
  mode: 'count_driven' | 'event_driven';
}

function pushUnique(items: string[], value: string | undefined): void {
  if (!value) return;
  if (!items.includes(value)) {
    items.push(value);
  }
}

function isEpisodeOpen(episode: TaskEpisode): boolean {
  return !['closed', 'split'].includes(episode.state) && !['completed', 'failed', 'closed', 'split'].includes(episode.analysisStatus);
}

function isTraceWithinEpisodeWindow(episode: TaskEpisode, trace: Trace): boolean {
  return trace.timestamp >= episode.startedAt;
}

function createEmptySnapshot(): TaskEpisodeSnapshot {
  return {
    updatedAt: new Date().toISOString(),
    episodes: [],
  };
}

function mapDecisionToEpisodeState(decision: ReadinessProbeResult['decision']): { state: string; analysisStatus: string } {
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

export class TaskEpisodeStore {
  private projectRoot: string;
  private snapshotPath: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.snapshotPath = join(projectRoot, '.ornn', 'state', 'task-episodes.json');
  }

  private readSnapshot(): TaskEpisodeSnapshot {
    if (!existsSync(this.snapshotPath)) {
      return createEmptySnapshot();
    }

    try {
      const parsed = JSON.parse(readFileSync(this.snapshotPath, 'utf-8')) as Partial<TaskEpisodeSnapshot>;
      return {
        updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
        episodes: Array.isArray(parsed.episodes) ? parsed.episodes as TaskEpisode[] : [],
      };
    } catch {
      return createEmptySnapshot();
    }
  }

  private writeSnapshot(snapshot: TaskEpisodeSnapshot): void {
    mkdirSync(join(this.projectRoot, '.ornn', 'state'), { recursive: true });
    snapshot.updatedAt = new Date().toISOString();
    writeFileSync(this.snapshotPath, JSON.stringify(snapshot, null, 2), 'utf-8');
  }

  private findActiveEpisode(
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

  private recalculateStats(episode: TaskEpisode): void {
    const mappedTraceIds = episode.skillSegments.flatMap((segment) => segment.mappedTraceIds);
    episode.stats.totalTraceCount = episode.traceRefs.length;
    episode.stats.totalTurnCount = episode.turnIds.length;
    episode.stats.mappedTraceCount = new Set(mappedTraceIds).size;
    episode.stats.tracesSinceLastProbe = Math.max(0, episode.traceRefs.length - episode.probeState.lastProbeTraceIndex);
    episode.stats.turnsSinceLastProbe = Math.max(0, episode.turnIds.length - episode.probeState.lastProbeTurnIndex);
  }

  private selectContextOwner(episodes: TaskEpisode[]): TaskEpisode | null {
    if (episodes.length === 0) return null;
    return [...episodes].sort((a, b) => String(b.lastActivityAt).localeCompare(String(a.lastActivityAt)))[0] ?? null;
  }

  recordTrace(trace: Trace, context: TaskEpisodeTraceContext, sessionTraces: Trace[] = [trace]): TaskEpisode {
    const snapshot = this.readSnapshot();
    const existing = this.findActiveEpisode(snapshot.episodes, trace.session_id, context.skillId, context.runtime);

    const episode = existing ?? {
      episodeId: randomUUID(),
      projectPath: this.projectRoot,
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

    if (!existing) {
      snapshot.episodes.push(episode);
    }

    const normalizedSessionTraces = sessionTraces.length > 0 ? sessionTraces : [trace];
    const relevantSessionTraces = normalizedSessionTraces.filter((sessionTrace) =>
      isTraceWithinEpisodeWindow(episode, sessionTrace)
    );

    for (const sessionTrace of relevantSessionTraces) {
      pushUnique(episode.sessionIds, sessionTrace.session_id);
      pushUnique(episode.traceRefs, sessionTrace.trace_id);
      pushUnique(episode.turnIds, sessionTrace.turn_id);
    }
    episode.lastActivityAt = trace.timestamp;

    const segment = episode.skillSegments.find((item) => item.skillId === context.skillId) ?? episode.skillSegments[0];
    pushUnique(segment.mappedTraceIds, trace.trace_id);
    for (const sessionTrace of relevantSessionTraces) {
      pushUnique(segment.relatedTraceIds, sessionTrace.trace_id);
    }
    segment.lastRelatedTraceId = relevantSessionTraces[relevantSessionTraces.length - 1]?.trace_id ?? trace.trace_id;
    segment.lastActivityAt = trace.timestamp;
    segment.status = episode.analysisStatus === 'running' ? 'analyzing' : 'active';

    if (episode.analysisStatus !== 'running') {
      episode.state = 'collecting';
      episode.analysisStatus = 'collecting';
    }

    this.recalculateStats(episode);
    logger.debug('Task episode window synchronized', {
      projectPath: this.projectRoot,
      episodeId: episode.episodeId,
      sessionId: trace.session_id,
      skillId: context.skillId,
      totalTraceCount: episode.stats.totalTraceCount,
      mappedTraceCount: episode.stats.mappedTraceCount,
      tracesSinceLastProbe: episode.stats.tracesSinceLastProbe,
      probeCount: episode.probeState.probeCount,
    });
    this.writeSnapshot(snapshot);
    return episode;
  }

  recordContextTrace(trace: Trace): TaskEpisode[] {
    const snapshot = this.readSnapshot();
    const candidates = snapshot.episodes.filter((episode) =>
      episode.runtime === trace.runtime &&
      episode.sessionIds.includes(trace.session_id) &&
      isTraceWithinEpisodeWindow(episode, trace) &&
      isEpisodeOpen(episode)
    );

    const owner = this.selectContextOwner(candidates);
    if (!owner) {
      return [];
    }

    pushUnique(owner.traceRefs, trace.trace_id);
    pushUnique(owner.turnIds, trace.turn_id);
    owner.lastActivityAt = trace.timestamp;

    for (const segment of owner.skillSegments) {
      pushUnique(segment.relatedTraceIds, trace.trace_id);
      segment.lastRelatedTraceId = trace.trace_id;
      segment.lastActivityAt = trace.timestamp;
    }

    this.recalculateStats(owner);

    logger.debug('Task episode context trace attached', {
      projectPath: this.projectRoot,
      sessionId: trace.session_id,
      traceId: trace.trace_id,
      affectedEpisodeCount: 1,
      ownerEpisodeId: owner.episodeId,
    });
    this.writeSnapshot(snapshot);
    return [owner];
  }

  shouldTriggerProbe(episode: TaskEpisode, trace: Trace): ProbeTriggerDecision {
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

  applyProbeResult(episodeId: string, result: ReadinessProbeResult): TaskEpisode | null {
    const snapshot = this.readSnapshot();
    const episode = snapshot.episodes.find((item) => item.episodeId === episodeId);
    if (!episode) return null;

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
    episode.lastActivityAt = new Date().toISOString();

    if (episode.state === 'closed') {
      for (const segment of episode.skillSegments) {
        segment.status = 'closed';
      }
    }

    this.recalculateStats(episode);
    this.writeSnapshot(snapshot);
    return episode;
  }

  applyNeedMoreContextHint(episodeId: string, hint: WindowAnalysisHint): TaskEpisode | null {
    return this.applyProbeResult(episodeId, {
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
    });
  }

  markAnalysisState(
    sessionId: string,
    skillId: string,
    runtime: RuntimeType,
    status: 'running' | 'completed' | 'failed'
  ): TaskEpisode | null {
    const snapshot = this.readSnapshot();
    const episode = this.findActiveEpisode(snapshot.episodes, sessionId, skillId, runtime)
      ?? snapshot.episodes
        .filter((item) =>
          item.runtime === runtime &&
          item.sessionIds.includes(sessionId) &&
          item.skillSegments.some((segment) => segment.skillId === skillId)
        )
        .sort((a, b) => String(b.lastActivityAt).localeCompare(String(a.lastActivityAt)))[0];

    if (!episode) return null;

    episode.lastActivityAt = new Date().toISOString();

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

    this.recalculateStats(episode);
    this.writeSnapshot(snapshot);
    return episode;
  }

  listEpisodes(): TaskEpisode[] {
    return this.readSnapshot().episodes;
  }
}

export function createTaskEpisodeStore(projectRoot: string): TaskEpisodeStore {
  return new TaskEpisodeStore(projectRoot);
}
