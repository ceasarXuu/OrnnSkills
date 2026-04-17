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

function createEmptySnapshot(): TaskEpisodeSnapshot {
  return {
    updatedAt: new Date().toISOString(),
    episodes: [],
  };
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
        episodes: Array.isArray(parsed.episodes) ? parsed.episodes : [],
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
