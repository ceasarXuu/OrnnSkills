import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { RuntimeType, Trace, WindowAnalysisHint } from '../../types/index.js';
import { createChildLogger } from '../../utils/logger.js';
import {
  applyProbeResultToEpisode,
  attachContextTraceToEpisode,
  buildNeedMoreContextProbeResult,
  createTaskEpisode,
  findActiveEpisode,
  isEpisodeOpen,
  isTraceWithinEpisodeWindow,
  markEpisodeAnalysisState,
  selectContextOwner,
  shouldTriggerEpisodeProbe,
  synchronizeEpisodeWithTrace,
} from '../task-episode-policy/index.js';

const logger = createChildLogger('task-episode');
const ACTIVE_TRACE_REF_LIMIT = 240;
const CLOSED_TRACE_REF_LIMIT = 120;
const ACTIVE_TURN_ID_LIMIT = 240;
const CLOSED_TURN_ID_LIMIT = 120;
const ACTIVE_MAPPED_TRACE_LIMIT = 160;
const CLOSED_MAPPED_TRACE_LIMIT = 80;
const ACTIVE_RELATED_TRACE_LIMIT = 240;
const CLOSED_RELATED_TRACE_LIMIT = 120;

export interface TaskEpisodeSkillSegmentRetention {
  archivedMappedTraceCount: number;
  archivedRelatedTraceCount: number;
}

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
  retention?: TaskEpisodeSkillSegmentRetention;
}

export interface TaskEpisodeRetention {
  archivedTraceCount: number;
  archivedTurnCount: number;
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
  retention?: TaskEpisodeRetention;
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

export function createEmptyTaskEpisodeSnapshot(): TaskEpisodeSnapshot {
  return {
    updatedAt: new Date().toISOString(),
    episodes: [],
  };
}

function createDefaultEpisodeRetention(): TaskEpisodeRetention {
  return {
    archivedTraceCount: 0,
    archivedTurnCount: 0,
  };
}

function createDefaultSegmentRetention(): TaskEpisodeSkillSegmentRetention {
  return {
    archivedMappedTraceCount: 0,
    archivedRelatedTraceCount: 0,
  };
}

function isTaskEpisodeClosed(episode: TaskEpisode): boolean {
  return ['closed', 'split'].includes(episode.state) ||
    ['completed', 'failed', 'closed', 'split'].includes(episode.analysisStatus);
}

function ensureEpisodeRetention(episode: TaskEpisode): TaskEpisodeRetention {
  if (!episode.retention) {
    episode.retention = createDefaultEpisodeRetention();
  }
  return episode.retention;
}

function ensureSegmentRetention(segment: TaskEpisodeSkillSegment): TaskEpisodeSkillSegmentRetention {
  if (!segment.retention) {
    segment.retention = createDefaultSegmentRetention();
  }
  return segment.retention;
}

function retainAnchoredTail(
  values: string[],
  limit: number,
  anchors: string[] = []
): { retained: string[]; removedCount: number } {
  if (values.length <= limit) {
    return { retained: values, removedCount: 0 };
  }

  const retainedSet = new Set<string>();
  const anchorSet = new Set(anchors.filter(Boolean));

  for (const value of values) {
    if (anchorSet.has(value)) {
      retainedSet.add(value);
    }
  }

  for (let index = values.length - 1; index >= 0 && retainedSet.size < limit; index -= 1) {
    retainedSet.add(values[index]);
  }

  const retained = values.filter((value) => retainedSet.has(value));
  return {
    retained,
    removedCount: Math.max(0, values.length - retained.length),
  };
}

function reconcileEpisodeStats(episode: TaskEpisode): void {
  const retention = ensureEpisodeRetention(episode);
  const mappedTraceCount = episode.skillSegments.reduce((count, segment) => {
    return count + segment.mappedTraceIds.length + (segment.retention?.archivedMappedTraceCount ?? 0);
  }, 0);
  const totalTraceCount = episode.traceRefs.length + retention.archivedTraceCount;
  const totalTurnCount = episode.turnIds.length + retention.archivedTurnCount;

  episode.stats.totalTraceCount = Math.max(episode.stats.totalTraceCount, totalTraceCount);
  episode.stats.totalTurnCount = Math.max(episode.stats.totalTurnCount, totalTurnCount);
  episode.stats.mappedTraceCount = Math.max(episode.stats.mappedTraceCount, mappedTraceCount);
  episode.stats.tracesSinceLastProbe = Math.max(
    0,
    episode.stats.totalTraceCount - episode.probeState.lastProbeTraceIndex
  );
  episode.stats.turnsSinceLastProbe = Math.max(
    0,
    episode.stats.totalTurnCount - episode.probeState.lastProbeTurnIndex
  );
}

function compactEpisode(episode: TaskEpisode): boolean {
  const closed = isTaskEpisodeClosed(episode);
  const traceLimit = closed ? CLOSED_TRACE_REF_LIMIT : ACTIVE_TRACE_REF_LIMIT;
  const turnLimit = closed ? CLOSED_TURN_ID_LIMIT : ACTIVE_TURN_ID_LIMIT;
  const mappedLimit = closed ? CLOSED_MAPPED_TRACE_LIMIT : ACTIVE_MAPPED_TRACE_LIMIT;
  const relatedLimit = closed ? CLOSED_RELATED_TRACE_LIMIT : ACTIVE_RELATED_TRACE_LIMIT;
  let changed = false;

  const episodeRetention = ensureEpisodeRetention(episode);
  const traceCompaction = retainAnchoredTail(
    episode.traceRefs,
    traceLimit,
    episode.skillSegments.map((segment) => segment.firstMappedTraceId)
  );
  if (traceCompaction.removedCount > 0) {
    episode.traceRefs = traceCompaction.retained;
    episodeRetention.archivedTraceCount += traceCompaction.removedCount;
    changed = true;
  }

  const turnCompaction = retainAnchoredTail(episode.turnIds, turnLimit);
  if (turnCompaction.removedCount > 0) {
    episode.turnIds = turnCompaction.retained;
    episodeRetention.archivedTurnCount += turnCompaction.removedCount;
    changed = true;
  }

  for (const segment of episode.skillSegments) {
    const segmentRetention = ensureSegmentRetention(segment);
    const mappedCompaction = retainAnchoredTail(
      segment.mappedTraceIds,
      mappedLimit,
      [segment.firstMappedTraceId]
    );
    if (mappedCompaction.removedCount > 0) {
      segment.mappedTraceIds = mappedCompaction.retained;
      segmentRetention.archivedMappedTraceCount += mappedCompaction.removedCount;
      changed = true;
    }

    const relatedCompaction = retainAnchoredTail(
      segment.relatedTraceIds,
      relatedLimit,
      [segment.firstMappedTraceId, segment.lastRelatedTraceId]
    );
    if (relatedCompaction.removedCount > 0) {
      segment.relatedTraceIds = relatedCompaction.retained;
      segmentRetention.archivedRelatedTraceCount += relatedCompaction.removedCount;
      changed = true;
    }
  }

  reconcileEpisodeStats(episode);
  return changed;
}

function compactSnapshot(snapshot: TaskEpisodeSnapshot): { compacted: boolean; snapshot: TaskEpisodeSnapshot } {
  let compacted = false;
  for (const episode of snapshot.episodes) {
    if (compactEpisode(episode)) {
      compacted = true;
    }
  }

  return { compacted, snapshot };
}

export function normalizeTaskEpisodeSnapshot(
  snapshot: Partial<TaskEpisodeSnapshot> | null | undefined
): TaskEpisodeSnapshot {
  if (!snapshot) {
    return createEmptyTaskEpisodeSnapshot();
  }

  return {
    updatedAt: typeof snapshot.updatedAt === 'string' ? snapshot.updatedAt : new Date().toISOString(),
    episodes: Array.isArray(snapshot.episodes)
      ? snapshot.episodes.map((episode) => ({
          ...episode,
          sessionIds: Array.isArray(episode.sessionIds) ? episode.sessionIds : [],
          traceRefs: Array.isArray(episode.traceRefs) ? episode.traceRefs : [],
          turnIds: Array.isArray(episode.turnIds) ? episode.turnIds : [],
          skillSegments: Array.isArray(episode.skillSegments)
            ? episode.skillSegments.map((segment) => ({
                ...segment,
                mappedTraceIds: Array.isArray(segment.mappedTraceIds) ? segment.mappedTraceIds : [],
                relatedTraceIds: Array.isArray(segment.relatedTraceIds) ? segment.relatedTraceIds : [],
                retention: {
                  archivedMappedTraceCount: Math.max(
                    0,
                    Number(segment.retention?.archivedMappedTraceCount ?? 0)
                  ),
                  archivedRelatedTraceCount: Math.max(
                    0,
                    Number(segment.retention?.archivedRelatedTraceCount ?? 0)
                  ),
                },
              }))
            : [],
          retention: {
            archivedTraceCount: Math.max(0, Number(episode.retention?.archivedTraceCount ?? 0)),
            archivedTurnCount: Math.max(0, Number(episode.retention?.archivedTurnCount ?? 0)),
          },
        })) as TaskEpisode[]
      : [],
  };
}

export function filterEpisodeWindowTraces(episode: TaskEpisode, traces: Trace[]): Trace[] {
  const sessionIds = new Set(episode.sessionIds);
  const byWindow = traces.filter((trace) =>
    sessionIds.has(trace.session_id) &&
    trace.timestamp >= episode.startedAt &&
    trace.timestamp <= episode.lastActivityAt
  );
  if (byWindow.length > 0) {
    return byWindow.sort((left, right) => left.timestamp.localeCompare(right.timestamp));
  }

  const retainedTraceIds = new Set(episode.traceRefs);
  return traces
    .filter((trace) => retainedTraceIds.has(trace.trace_id))
    .sort((left, right) => left.timestamp.localeCompare(right.timestamp));
}

export class TaskEpisodeStore {
  private projectRoot: string;
  private snapshotPath: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.snapshotPath = join(projectRoot, '.ornn', 'state', 'task-episodes.json');
    this.compactSnapshotFile();
  }

  private compactSnapshotFile(): void {
    if (!existsSync(this.snapshotPath)) {
      return;
    }

    const snapshot = this.readSnapshot();
    const { compacted, snapshot: normalizedSnapshot } = compactSnapshot(snapshot);
    if (!compacted) {
      return;
    }

    mkdirSync(join(this.projectRoot, '.ornn', 'state'), { recursive: true });
    normalizedSnapshot.updatedAt = new Date().toISOString();
    writeFileSync(this.snapshotPath, JSON.stringify(normalizedSnapshot, null, 2), 'utf-8');
    logger.info('Compacted task episode snapshot on load', {
      projectPath: this.projectRoot,
      episodeCount: normalizedSnapshot.episodes.length,
    });
  }

  private readSnapshot(): TaskEpisodeSnapshot {
    if (!existsSync(this.snapshotPath)) {
      return createEmptyTaskEpisodeSnapshot();
    }

    try {
      const parsed = JSON.parse(readFileSync(this.snapshotPath, 'utf-8')) as Partial<TaskEpisodeSnapshot>;
      return normalizeTaskEpisodeSnapshot(parsed);
    } catch {
      return createEmptyTaskEpisodeSnapshot();
    }
  }

  private writeSnapshot(snapshot: TaskEpisodeSnapshot): void {
    mkdirSync(join(this.projectRoot, '.ornn', 'state'), { recursive: true });
    const compacted = compactSnapshot(normalizeTaskEpisodeSnapshot(snapshot));
    compacted.snapshot.updatedAt = new Date().toISOString();
    writeFileSync(this.snapshotPath, JSON.stringify(compacted.snapshot, null, 2), 'utf-8');
    if (compacted.compacted) {
      logger.debug('Compacted task episode snapshot after update', {
        projectPath: this.projectRoot,
        episodeCount: compacted.snapshot.episodes.length,
      });
    }
  }

  recordTrace(trace: Trace, context: TaskEpisodeTraceContext, sessionTraces: Trace[] = [trace]): TaskEpisode {
    const snapshot = this.readSnapshot();
    const existing = findActiveEpisode(snapshot.episodes, trace.session_id, context.skillId, context.runtime);
    const episode = existing ?? createTaskEpisode(this.projectRoot, trace, context);

    if (!existing) {
      snapshot.episodes.push(episode);
    }

    synchronizeEpisodeWithTrace(episode, trace, context, sessionTraces);
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

    const owner = selectContextOwner(candidates);
    if (!owner) {
      return [];
    }

    attachContextTraceToEpisode(owner, trace);

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
    return shouldTriggerEpisodeProbe(episode, trace);
  }

  applyProbeResult(episodeId: string, result: ReadinessProbeResult): TaskEpisode | null {
    const snapshot = this.readSnapshot();
    const episode = snapshot.episodes.find((item) => item.episodeId === episodeId);
    if (!episode) return null;

    applyProbeResultToEpisode(episode, result);
    this.writeSnapshot(snapshot);
    return episode;
  }

  applyNeedMoreContextHint(episodeId: string, hint: WindowAnalysisHint): TaskEpisode | null {
    return this.applyProbeResult(episodeId, buildNeedMoreContextProbeResult(hint));
  }

  markAnalysisState(
    sessionId: string,
    skillId: string,
    runtime: RuntimeType,
    status: 'running' | 'completed' | 'failed'
  ): TaskEpisode | null {
    const snapshot = this.readSnapshot();
    const episode = findActiveEpisode(snapshot.episodes, sessionId, skillId, runtime)
      ?? snapshot.episodes
        .filter((item) =>
          item.runtime === runtime &&
          item.sessionIds.includes(sessionId) &&
          item.skillSegments.some((segment) => segment.skillId === skillId)
        )
        .sort((a, b) => String(b.lastActivityAt).localeCompare(String(a.lastActivityAt)))[0];

    if (!episode) return null;

    markEpisodeAnalysisState(episode, status);
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
