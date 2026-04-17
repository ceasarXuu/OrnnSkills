import { describe, it, expect, vi } from 'vitest';
import type { Trace, EvaluationResult } from '../../src/types/index.js';
import type { ActivityEventContext } from '../../src/core/activity-event-builder/index.js';
import type { TaskEpisode } from '../../src/core/task-episode/index.js';
import { buildShadowId } from '../../src/utils/parse.js';
import { ShadowTraceIngestService } from '../../src/core/shadow-manager/trace-ingest-service.js';
import { ShadowEpisodeProbeService } from '../../src/core/shadow-manager/episode-probe-service.js';
import { ShadowOptimizationRunner } from '../../src/core/shadow-manager/optimization-runner.js';
import { ShadowManualOptimizeService } from '../../src/core/shadow-manager/manual-optimize-service.js';

function makeTrace(input: Partial<Trace> & Pick<Trace, 'trace_id' | 'session_id' | 'turn_id'>): Trace {
  return {
    runtime: 'codex',
    event_type: 'tool_call',
    tool_name: 'exec_command',
    tool_args: { cmd: 'echo test-skill' },
    status: 'success',
    timestamp: '2026-04-18T00:00:00.000Z',
    metadata: { skill_id: 'test-skill' },
    ...input,
  };
}

function makeEpisode(overrides: Partial<TaskEpisode> = {}): TaskEpisode {
  return {
    episodeId: 'episode-1',
    projectPath: '/project',
    runtime: 'codex',
    sessionIds: ['sess-1'],
    startedAt: '2026-04-18T00:00:00.000Z',
    lastActivityAt: '2026-04-18T00:00:10.000Z',
    state: 'collecting',
    traceRefs: ['trace-1'],
    turnIds: ['turn-1'],
    skillSegments: [
      {
        segmentId: 'segment-1',
        skillId: 'test-skill',
        shadowId: buildShadowId('test-skill', '/project'),
        runtime: 'codex',
        firstMappedTraceId: 'trace-1',
        lastRelatedTraceId: 'trace-1',
        mappedTraceIds: ['trace-1'],
        relatedTraceIds: ['trace-1'],
        startedAt: '2026-04-18T00:00:00.000Z',
        lastActivityAt: '2026-04-18T00:00:10.000Z',
        status: 'open',
      },
    ],
    stats: {
      totalTraceCount: 1,
      totalTurnCount: 1,
      mappedTraceCount: 1,
      tracesSinceLastProbe: 1,
      turnsSinceLastProbe: 1,
    },
    probeState: {
      probeCount: 0,
      lastProbeTraceIndex: 0,
      lastProbeTurnIndex: 0,
      nextProbeTraceDelta: 10,
      nextProbeTurnDelta: 10,
      waitForEventTypes: [],
      mode: 'count_driven',
      consecutiveNeedMoreCount: 0,
      consecutiveReadyCount: 0,
    },
    analysisStatus: 'collecting',
    ...overrides,
  };
}

function makeContext(overrides: Partial<ActivityEventContext> = {}): ActivityEventContext {
  return {
    episodeId: 'episode-1',
    skillId: 'test-skill',
    runtime: 'codex',
    windowId: 'sess-1::test-skill',
    traceId: 'trace-1',
    sessionId: 'sess-1',
    traceCount: 1,
    sessionCount: 1,
    ...overrides,
  };
}

describe('shadow manager components', () => {
  it('trace ingest routes mapped and context traces into episode probe orchestration', async () => {
    const mappedTrace = makeTrace({
      trace_id: 'trace-1',
      session_id: 'sess-1',
      turn_id: 'turn-1',
    });
    const contextTrace = makeTrace({
      trace_id: 'trace-2',
      session_id: 'sess-1',
      turn_id: 'turn-2',
      event_type: 'assistant_output',
      assistant_output: 'context only',
      metadata: undefined,
    });
    const episode = makeEpisode({ traceRefs: ['trace-1', 'trace-2'] });
    const maybeRunEpisodeProbe = vi.fn(async () => {});
    const traceManager = {
      recordTrace: vi.fn(),
      getSessionTraces: vi.fn(async () => [mappedTrace, contextTrace]),
    };
    const traceSkillMapper = {
      mapTrace: vi
        .fn()
        .mockReturnValueOnce({
          trace_id: mappedTrace.trace_id,
          skill_id: 'test-skill',
          shadow_id: buildShadowId('test-skill', '/project'),
          confidence: 0.98,
          reason: 'metadata',
        })
        .mockReturnValueOnce({
          trace_id: contextTrace.trace_id,
          skill_id: null,
          shadow_id: null,
          confidence: 0,
          reason: 'context',
        }),
    };
    const shadowRegistry = {
      incrementTraceCount: vi.fn(),
    };
    const taskEpisodes = {
      recordTrace: vi.fn(() => episode),
      recordContextTrace: vi.fn(() => [episode]),
    };

    const service = new ShadowTraceIngestService({
      projectRoot: '/project',
      traceManager,
      traceSkillMapper,
      shadowRegistry,
      taskEpisodes,
      episodeProbeService: {
        maybeRunEpisodeProbe,
      },
    });

    await service.processTrace(mappedTrace);
    await service.processTrace(contextTrace);

    expect(traceManager.recordTrace).toHaveBeenCalledTimes(2);
    expect(shadowRegistry.incrementTraceCount).toHaveBeenCalledWith('test-skill', 'codex');
    expect(taskEpisodes.recordTrace).toHaveBeenCalledTimes(1);
    expect(taskEpisodes.recordContextTrace).toHaveBeenCalledWith(contextTrace);
    expect(maybeRunEpisodeProbe).toHaveBeenCalledTimes(2);
    expect(maybeRunEpisodeProbe.mock.calls[0]?.[1]).toBe(buildShadowId('test-skill', '/project'));
    expect(maybeRunEpisodeProbe.mock.calls[0]?.[4]).toMatchObject({
      skillId: 'test-skill',
      traceId: 'trace-1',
      sessionId: 'sess-1',
    });
    expect(maybeRunEpisodeProbe.mock.calls[1]?.[1]).toBe(buildShadowId('test-skill', '/project'));
  });

  it('episode probe persists need-more-context results without calling optimization runner', async () => {
    const trace = makeTrace({
      trace_id: 'trace-10',
      session_id: 'sess-1',
      turn_id: 'turn-10',
      timestamp: '2026-04-18T00:00:10.000Z',
    });
    const episode = makeEpisode({
      traceRefs: ['trace-1', 'trace-10'],
      turnIds: ['turn-1', 'turn-10'],
      stats: {
        totalTraceCount: 10,
        totalTurnCount: 10,
        mappedTraceCount: 10,
        tracesSinceLastProbe: 10,
        turnsSinceLastProbe: 10,
      },
    });
    const context = makeContext({
      traceId: 'trace-10',
      traceCount: 10,
    });
    const decisionEvents = { record: vi.fn() };
    const optimizationRunner = { handleEvaluation: vi.fn(async () => ({ kind: 'patch_applied', evaluation: null, detail: 'done' })) };
    const taskEpisodes = {
      shouldTriggerProbe: vi.fn(() => ({
        shouldProbe: true,
        reason: 'initial_window_ready',
        mode: 'count_driven',
      })),
      applyNeedMoreContextHint: vi.fn(),
      markAnalysisState: vi.fn(),
    };
    const daemonStatus = {
      setAnalyzing: vi.fn(),
      setIdle: vi.fn(),
      setError: vi.fn(),
    };

    const service = new ShadowEpisodeProbeService({
      projectRoot: '/project',
      shadowRegistry: {
        readContent: vi.fn(() => '# skill'),
      },
      taskEpisodes,
      decisionEvents,
      daemonStatus,
      analyzeSkillWindow: vi.fn(async () => ({
        kind: 'need_more_context',
        cause: 'analysis',
        detail: '继续观察',
        evaluation: {
          should_patch: false,
          reason: '证据不足',
          source_sessions: ['sess-1'],
          confidence: 0.41,
          rule_name: 'agent_call_window_analysis',
        },
        nextWindowHint: {
          suggestedTraceDelta: 12,
          suggestedTurnDelta: 2,
          waitForEventTypes: ['tool_result'],
          mode: 'event_driven',
        },
      })),
      optimizationRunner,
    });

    await service.maybeRunEpisodeProbe(episode, buildShadowId('test-skill', '/project'), trace, [trace], context);

    expect(taskEpisodes.markAnalysisState).toHaveBeenCalledWith('sess-1', 'test-skill', 'codex', 'running');
    expect(taskEpisodes.applyNeedMoreContextHint).toHaveBeenCalledWith('episode-1', {
      suggestedTraceDelta: 12,
      suggestedTurnDelta: 2,
      waitForEventTypes: ['tool_result'],
      mode: 'event_driven',
    });
    expect(decisionEvents.record).toHaveBeenCalledTimes(2);
    expect(decisionEvents.record.mock.calls[0]?.[0]).toMatchObject({ tag: 'analysis_requested' });
    expect(decisionEvents.record.mock.calls[1]?.[0]).toMatchObject({
      tag: 'evaluation_result',
      status: 'continue_collecting',
    });
    expect(daemonStatus.setIdle).toHaveBeenCalledTimes(1);
    expect(optimizationRunner.handleEvaluation).not.toHaveBeenCalled();
  });

  it('optimization runner applies successful patches and tracks patch timestamps', async () => {
    const evaluation: EvaluationResult = {
      should_patch: true,
      change_type: 'prune_noise',
      target_section: 'TODO',
      reason: 'remove noise',
      source_sessions: ['sess-1'],
      confidence: 0.93,
      rule_name: 'agent_call_window_analysis',
    };
    const context = makeContext();
    const createVersion = vi.fn();
    const daemonStatus = {
      setOptimizing: vi.fn(),
      setIdle: vi.fn(),
      setError: vi.fn(),
    };
    const taskEpisodes = {
      markAnalysisState: vi.fn(),
    };
    const runner = new ShadowOptimizationRunner({
      projectRoot: '/project',
      policy: {
        min_signal_count: 1,
        min_source_sessions: 1,
        min_confidence: 0.5,
        cooldown_hours: 24,
        max_patches_per_day: 3,
        pause_after_rollback_hours: 48,
      },
      shadowRegistry: {
        get: vi.fn(() => ({ status: 'active' })),
        readContent: vi.fn(() => '# updated skill'),
        writeContent: vi.fn(),
      },
      journalManager: {
        getLatestRevision: vi.fn(() => 0),
        createSnapshot: vi.fn(),
        record: vi.fn(),
      },
      decisionEvents: {
        record: vi.fn(),
      },
      daemonStatus,
      taskEpisodes,
      createSkillVersionManager: vi.fn(() => ({
        createVersion,
      })),
      executeOptimizationPatch: vi.fn(async (input) => {
        await input.onPatchApplied?.(input.shadowId);
        return {
          ok: true,
          revision: 1,
          linesAdded: 2,
          linesRemoved: 1,
        };
      }),
    });

    const result = await runner.handleEvaluation(
      buildShadowId('test-skill', '/project'),
      evaluation,
      [makeTrace({ trace_id: 'trace-1', session_id: 'sess-1', turn_id: 'turn-1' })],
      context,
      { closeOnSkip: true }
    );

    expect(result).toMatchObject({
      kind: 'patch_applied',
      detail: '已完成本轮优化并写回 shadow skill。',
    });
    expect(daemonStatus.setOptimizing).toHaveBeenCalledWith('test-skill');
    expect(taskEpisodes.markAnalysisState).toHaveBeenCalledWith('sess-1', 'test-skill', 'codex', 'completed');
    expect(daemonStatus.setIdle).toHaveBeenCalledTimes(1);
    expect(createVersion).toHaveBeenCalledWith(
      '# updated skill',
      'remove noise',
      ['trace-1'],
      undefined,
      undefined,
      { activityScopeId: 'episode-1' }
    );
    expect(runner.getLastPatchTime(buildShadowId('test-skill', '/project'))).toBeTypeOf('number');
  });

  it('manual optimize resolves latest episode scope and delegates manual analysis', async () => {
    const shadowId = buildShadowId('test-skill', '/project');
    const traceA = makeTrace({
      trace_id: 'trace-a',
      session_id: 'sess-1',
      turn_id: 'turn-a',
      timestamp: '2026-04-18T00:00:00.000Z',
    });
    const traceB = makeTrace({
      trace_id: 'trace-b',
      session_id: 'sess-1',
      turn_id: 'turn-b',
      timestamp: '2026-04-18T00:00:10.000Z',
    });
    const analyzeManualScope = vi.fn(async () => ({
      kind: 'no_optimization',
      evaluation: null,
      detail: 'manual-done',
    }));

    const service = new ShadowManualOptimizeService({
      projectRoot: '/project',
      traceManager: {
        getSessionTraces: vi.fn(async () => [traceA, traceB]),
        getRecentTraces: vi.fn(async () => []),
      },
      traceSkillMapper: {
        mapTrace: vi.fn(() => ({
          trace_id: 'trace-a',
          skill_id: 'test-skill',
          shadow_id: shadowId,
          confidence: 0.95,
          reason: 'metadata',
        })),
      },
      taskEpisodes: {
        listEpisodes: vi.fn(() => [
          makeEpisode({
            traceRefs: ['trace-a', 'trace-b'],
            sessionIds: ['sess-1'],
            lastActivityAt: '2026-04-18T00:00:10.000Z',
          }),
        ]),
      },
      decisionEvents: {
        record: vi.fn(),
      },
      daemonStatus: {
        setError: vi.fn(),
      },
      episodeProbeService: {
        analyzeManualScope,
      },
    });

    const result = await service.triggerOptimize(shadowId);

    expect(result).toMatchObject({
      kind: 'no_optimization',
      detail: 'manual-done',
    });
    expect(analyzeManualScope).toHaveBeenCalledWith({
      shadowId,
      traces: [traceA, traceB],
      context: expect.objectContaining({
        episodeId: 'episode-1',
        traceId: 'trace-b',
        sessionId: 'sess-1',
        traceCount: 2,
      }),
      episodeId: 'episode-1',
    });
  });
});
