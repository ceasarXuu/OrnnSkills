import { describe, expect, it } from 'vitest';
import {
  applyProbeResultToEpisode,
  markEpisodeAnalysisState,
  shouldTriggerEpisodeProbe,
} from '../../src/core/task-episode-policy/index.js';
import type {
  ProbeTriggerDecision,
  ReadinessProbeResult,
  TaskEpisode,
} from '../../src/core/task-episode/index.js';
import type { Trace } from '../../src/types/index.js';

function makeEpisode(): TaskEpisode {
  return {
    episodeId: 'episode-1',
    projectPath: '/tmp/project',
    runtime: 'codex',
    sessionIds: ['sess-1'],
    startedAt: '2026-04-14T00:00:00.000Z',
    lastActivityAt: '2026-04-14T00:00:10.000Z',
    state: 'collecting',
    traceRefs: Array.from({ length: 10 }, (_, index) => `trace-${index + 1}`),
    turnIds: Array.from({ length: 5 }, (_, index) => `turn-${index + 1}`),
    skillSegments: [
      {
        segmentId: 'segment-1',
        skillId: 'test-skill',
        shadowId: 'codex::test-skill@/tmp/project',
        runtime: 'codex',
        firstMappedTraceId: 'trace-1',
        lastRelatedTraceId: 'trace-10',
        mappedTraceIds: Array.from({ length: 10 }, (_, index) => `trace-${index + 1}`),
        relatedTraceIds: Array.from({ length: 10 }, (_, index) => `trace-${index + 1}`),
        startedAt: '2026-04-14T00:00:00.000Z',
        lastActivityAt: '2026-04-14T00:00:10.000Z',
        status: 'active',
      },
    ],
    stats: {
      totalTraceCount: 10,
      totalTurnCount: 5,
      mappedTraceCount: 10,
      tracesSinceLastProbe: 4,
      turnsSinceLastProbe: 2,
    },
    probeState: {
      probeCount: 1,
      lastProbeTraceIndex: 6,
      lastProbeTurnIndex: 3,
      nextProbeTraceDelta: 8,
      nextProbeTurnDelta: 2,
      waitForEventTypes: ['tool_result'],
      mode: 'event_driven',
      consecutiveNeedMoreCount: 1,
      consecutiveReadyCount: 0,
    },
    analysisStatus: 'collecting',
  };
}

function makeTrace(eventType: Trace['event_type'] = 'tool_result'): Trace {
  return {
    trace_id: 'trace-11',
    session_id: 'sess-1',
    turn_id: 'turn-6',
    runtime: 'codex',
    event_type: eventType,
    status: 'success',
    timestamp: '2026-04-14T00:00:11.000Z',
  };
}

describe('task-episode-policy', () => {
  it('triggers an event-driven probe when the awaited event arrives', () => {
    const decision = shouldTriggerEpisodeProbe(makeEpisode(), makeTrace()) as ProbeTriggerDecision;

    expect(decision).toEqual({
      shouldProbe: true,
      reason: 'event_driven_signal',
      mode: 'event_driven',
    });
  });

  it('applies probe results and updates probe counters plus state', () => {
    const episode = makeEpisode();
    const result: ReadinessProbeResult = {
      decision: 'continue_collecting',
      reason: 'Need more context.',
      observedOutcomes: [],
      missingEvidence: [],
      nextProbeHint: {
        suggestedTraceDelta: 12,
        suggestedTurnDelta: 3,
        waitForEventTypes: ['assistant_output'],
        mode: 'count_driven',
      },
      episodeAction: {
        closeCurrent: false,
        openNew: false,
      },
      skillFocus: [],
    };

    applyProbeResultToEpisode(episode, result, '2026-04-14T00:01:00.000Z');

    expect(episode.state).toBe('collecting');
    expect(episode.analysisStatus).toBe('collecting');
    expect(episode.probeState).toMatchObject({
      probeCount: 2,
      lastProbeTraceIndex: 10,
      lastProbeTurnIndex: 5,
      nextProbeTraceDelta: 12,
      nextProbeTurnDelta: 3,
      waitForEventTypes: ['assistant_output'],
      mode: 'count_driven',
      consecutiveNeedMoreCount: 2,
      consecutiveReadyCount: 0,
    });
  });

  it('marks episodes as closed when analysis completes', () => {
    const episode = makeEpisode();

    markEpisodeAnalysisState(episode, 'completed', '2026-04-14T00:02:00.000Z');

    expect(episode.state).toBe('closed');
    expect(episode.analysisStatus).toBe('completed');
    expect(episode.skillSegments[0]?.status).toBe('closed');
  });
});
