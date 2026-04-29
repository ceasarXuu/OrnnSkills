/**
 * Task episode types & default-snapshot factory
 *
 * Extracted from src/core/task-episode/index.ts.
 */
import type { RuntimeType } from '../../types/index.js';

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

