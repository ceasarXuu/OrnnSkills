import { describe, expect, it } from 'vitest';
import {
  createEvolutionRun,
  type EvolutionRunStatus,
} from '../../src/core/evolution/domain.js';
import {
  assertEvolutionRunTransition,
  canTransitionEvolutionRun,
  transitionEvolutionRun,
} from '../../src/core/evolution/state-machine.js';
import { projectEvolutionRunFromEpisode } from '../../src/core/evolution/projection.js';
import type { DecisionEventRecord } from '../../src/core/decision-events/index.js';
import type { TaskEpisode } from '../../src/core/task-episode/index.js';
import type { VersionMetadata } from '../../src/core/skill-version/index.js';

function makeEpisode(overrides: Partial<TaskEpisode> = {}): TaskEpisode {
  return {
    episodeId: 'episode-1',
    projectPath: '/projects/alpha',
    runtime: 'codex',
    sessionIds: ['session-1'],
    startedAt: '2026-05-13T00:00:00.000Z',
    lastActivityAt: '2026-05-13T00:01:00.000Z',
    state: 'open',
    traceRefs: ['trace-1', 'trace-2'],
    turnIds: ['turn-1'],
    skillSegments: [
      {
        segmentId: 'segment-1',
        skillId: 'skill-a',
        shadowId: 'codex:skill-a',
        runtime: 'codex',
        firstMappedTraceId: 'trace-1',
        lastRelatedTraceId: 'trace-2',
        mappedTraceIds: ['trace-1'],
        relatedTraceIds: ['trace-2'],
        startedAt: '2026-05-13T00:00:10.000Z',
        lastActivityAt: '2026-05-13T00:01:00.000Z',
        status: 'active',
      },
    ],
    stats: {
      totalTraceCount: 2,
      totalTurnCount: 1,
      mappedTraceCount: 1,
      tracesSinceLastProbe: 2,
      turnsSinceLastProbe: 1,
    },
    probeState: {
      probeCount: 1,
      lastProbeTraceIndex: 0,
      lastProbeTurnIndex: 0,
      nextProbeTraceDelta: 3,
      nextProbeTurnDelta: 2,
      waitForEventTypes: [],
      mode: 'count_driven',
      consecutiveNeedMoreCount: 0,
      consecutiveReadyCount: 1,
    },
    analysisStatus: 'ready_for_analysis',
    ...overrides,
  };
}

function makeDecisionEvent(overrides: Partial<DecisionEventRecord> = {}): DecisionEventRecord {
  return {
    id: 'event-1',
    timestamp: '2026-05-13T00:02:00.000Z',
    tag: 'optimization_completed',
    episodeId: 'episode-1',
    skillId: 'skill-a',
    runtime: 'codex',
    status: 'apply_optimization',
    confidence: 0.82,
    changeType: 'tighten_trigger',
    reason: 'The skill fired for a non-matching task.',
    traceCount: 2,
    sessionCount: 1,
    evidence: {
      directEvidence: ['trace-1', 'trace-2'],
      causalJudgment: ['session-1'],
    },
    ...overrides,
  };
}

function makeVersion(overrides: Partial<VersionMetadata> = {}): VersionMetadata {
  return {
    version: 2,
    createdAt: '2026-05-13T00:03:00.000Z',
    reason: 'Tighten trigger',
    traceIds: ['trace-1', 'trace-2'],
    previousVersion: 1,
    isDisabled: false,
    disabledAt: null,
    activityScopeId: 'episode-1',
    analyzerModel: 'test-model',
    ...overrides,
  };
}

describe('evolution domain contracts', () => {
  it('allows the intended run lifecycle transitions', () => {
    let run = createEvolutionRun({
      runId: 'run-1',
      episodeId: 'episode-1',
      skillId: 'skill-a',
      runtime: 'codex',
      status: 'collecting',
      createdAt: '2026-05-13T00:00:00.000Z',
      updatedAt: '2026-05-13T00:00:00.000Z',
    });

    for (const nextStatus of [
      'analyzing',
      'proposed',
      'applying',
      'applied',
      'deploying',
      'deployed',
      'verifying',
      'verified',
    ] satisfies EvolutionRunStatus[]) {
      run = transitionEvolutionRun(run, nextStatus, '2026-05-13T00:01:00.000Z');
    }

    expect(run.status).toBe('verified');
    expect(run.updatedAt).toBe('2026-05-13T00:01:00.000Z');
  });

  it('rejects invalid lifecycle jumps', () => {
    expect(canTransitionEvolutionRun('collecting', 'applied')).toBe(false);
    expect(() => assertEvolutionRunTransition('collecting', 'applied')).toThrow(
      'Invalid evolution run transition: collecting -> applied'
    );
  });

  it('projects existing episode, decision event, and version metadata into a run summary', () => {
    const run = projectEvolutionRunFromEpisode({
      episode: makeEpisode(),
      decisionEvents: [makeDecisionEvent()],
      versions: [makeVersion()],
    });

    expect(run).toMatchObject({
      runId: 'episode-1:skill-a',
      episodeId: 'episode-1',
      skillId: 'skill-a',
      runtime: 'codex',
      status: 'applied',
      proposal: {
        changeType: 'tighten_trigger',
        confidence: 0.82,
        evidence: ['trace-1', 'trace-2', 'session-1'],
      },
      application: {
        revision: 2,
        previousRevision: 1,
      },
    });
  });
});
