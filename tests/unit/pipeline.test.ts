import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createOptimizationPipeline } from '../../src/core/pipeline/index.js';
import type { Trace } from '../../src/types/index.js';

const {
  getRecentTracesMock,
  getSessionTracesMock,
  mapTraceMock,
  shadowGetMock,
  shadowReadContentMock,
  analyzeWindowMock,
} = vi.hoisted(() => ({
  getRecentTracesMock: vi.fn(),
  getSessionTracesMock: vi.fn(),
  mapTraceMock: vi.fn(),
  shadowGetMock: vi.fn(),
  shadowReadContentMock: vi.fn(),
  analyzeWindowMock: vi.fn(),
}));

vi.mock('../../src/core/observer/trace-manager.js', () => ({
  createTraceManager: () => ({
    init: vi.fn().mockResolvedValue(undefined),
    getRecentTraces: getRecentTracesMock,
    getSessionTraces: getSessionTracesMock,
  }),
}));

vi.mock('../../src/core/trace-skill-mapper/index.js', () => ({
  createTraceSkillMapper: () => ({
    init: vi.fn().mockResolvedValue(undefined),
    mapTrace: mapTraceMock,
    getMappingStats: vi.fn().mockReturnValue({
      total_mappings: 0,
      by_skill: {},
      avg_confidence: 0,
    }),
    cleanupOldMappings: vi.fn(),
    close: vi.fn(),
  }),
}));

vi.mock('../../src/core/shadow-registry/index.js', () => ({
  createShadowRegistry: () => ({
    init: vi.fn(),
    get: shadowGetMock,
    readContent: shadowReadContentMock,
  }),
}));

vi.mock('../../src/core/skill-call-analyzer/index.js', () => ({
  createSkillCallAnalyzer: () => ({
    analyzeWindow: analyzeWindowMock,
  }),
}));

function makeTrace(traceId: string, sessionId = 'sess-1'): Trace {
  return {
    trace_id: traceId,
    session_id: sessionId,
    turn_id: `${traceId}-turn`,
    runtime: 'codex',
    event_type: 'tool_call',
    tool_name: 'exec_command',
    tool_args: { cmd: 'echo test' },
    status: 'success',
    timestamp: new Date(Date.UTC(2026, 3, 12, 0, 0, 0)).toISOString(),
    metadata: { skill_id: 'test-skill' },
  };
}

describe('OptimizationPipeline', () => {
  beforeEach(() => {
    getRecentTracesMock.mockReset();
    getSessionTracesMock.mockReset();
    mapTraceMock.mockReset();
    shadowGetMock.mockReset();
    shadowReadContentMock.mockReset();
    analyzeWindowMock.mockReset();
  });

  it('builds optimization tasks from full session timelines instead of mapped-only batches', async () => {
    const traces = [makeTrace('trace-1'), makeTrace('trace-2')];
    const sessionWindow = [
      traces[0],
      {
        ...makeTrace('trace-context-1'),
        event_type: 'assistant_output',
        tool_name: undefined,
        tool_args: undefined,
        assistant_output: 'additional assistant context',
        metadata: undefined,
      },
    ];
    getRecentTracesMock.mockResolvedValue(traces);
    getSessionTracesMock.mockResolvedValue(sessionWindow);
    mapTraceMock.mockImplementation((trace: Trace) => {
      if (trace.trace_id === 'trace-1') {
        return {
          trace_id: trace.trace_id,
          skill_id: 'test-skill',
          shadow_id: 'test-skill@/tmp/project#codex',
          confidence: 0.9,
          reason: 'metadata',
        };
      }
      return {
        trace_id: trace.trace_id,
        skill_id: null,
        shadow_id: null,
        confidence: 0,
        reason: 'no skill mapping found',
      };
    });
    shadowGetMock.mockReturnValue({ status: 'active' });
    shadowReadContentMock.mockReturnValue('# Test Skill');
    analyzeWindowMock.mockResolvedValue({
      success: true,
      decision: 'apply_optimization',
      userMessage: 'Repeated noise should be pruned.',
      evaluation: {
        should_patch: true,
        change_type: 'prune_noise',
        target_section: 'TODO',
        reason: 'Repeated noise should be pruned.',
        source_sessions: ['sess-1'],
        confidence: 0.92,
        rule_name: 'llm_window_analysis',
      },
    });

    const pipeline = createOptimizationPipeline({
      projectRoot: '/tmp/project',
      autoOptimize: true,
      minConfidence: 0.5,
    });
    await pipeline.init();

    const tasks = await pipeline.runOnce();

    expect(analyzeWindowMock).toHaveBeenCalledTimes(1);
    expect(analyzeWindowMock.mock.calls[0]?.[1]).toMatchObject({
      sessionId: 'sess-1',
      traces: sessionWindow,
    });
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({
      skill_id: 'test-skill',
      shadow_id: 'test-skill@/tmp/project#codex',
      traces: sessionWindow,
      evaluation: {
        should_patch: true,
        change_type: 'prune_noise',
        rule_name: 'llm_window_analysis',
      },
    });
  });

  it('builds a canonical skill window id for session-backed pipeline analysis', async () => {
    const traces = [makeTrace('trace-1')];
    getRecentTracesMock.mockResolvedValue(traces);
    getSessionTracesMock.mockResolvedValue(traces);
    mapTraceMock.mockReturnValue({
      trace_id: 'trace-1',
      skill_id: 'test-skill',
      shadow_id: 'test-skill@/tmp/project#codex',
      confidence: 0.9,
      reason: 'metadata',
    });
    shadowGetMock.mockReturnValue({ status: 'active' });
    shadowReadContentMock.mockReturnValue('# Test Skill');
    analyzeWindowMock.mockResolvedValue({
      success: true,
      decision: 'need_more_context',
      userMessage: 'Need a larger context window before deciding.',
      evaluation: {
        should_patch: false,
        reason: 'Need a larger context window before deciding.',
        source_sessions: ['sess-1'],
        confidence: 0.4,
        rule_name: 'llm_window_analysis',
      },
    });

    const pipeline = createOptimizationPipeline({
      projectRoot: '/tmp/project',
      autoOptimize: true,
      minConfidence: 0.5,
    });
    await pipeline.init();

    await pipeline.runOnce();

    expect(analyzeWindowMock.mock.calls[0]?.[1]).toMatchObject({
      windowId: 'pipeline::session::codex::test-skill::sess-1',
      closeReason: 'session_timeline_replay',
      traces,
    });
  });

  it('never falls back to mapped-only traces when the real session timeline is unavailable', async () => {
    const traces = [makeTrace('trace-1'), makeTrace('trace-2')];
    getRecentTracesMock.mockResolvedValue(traces);
    getSessionTracesMock.mockResolvedValue([]);
    mapTraceMock.mockReturnValue({
      trace_id: 'trace-1',
      skill_id: 'test-skill',
      shadow_id: 'test-skill@/tmp/project#codex',
      confidence: 0.9,
      reason: 'metadata',
    });
    shadowGetMock.mockReturnValue({ status: 'active' });
    shadowReadContentMock.mockReturnValue('# Test Skill');

    const pipeline = createOptimizationPipeline({
      projectRoot: '/tmp/project',
      autoOptimize: true,
      minConfidence: 0.5,
    });
    await pipeline.init();

    const tasks = await pipeline.runOnce();

    expect(analyzeWindowMock).not.toHaveBeenCalled();
    expect(tasks).toEqual([]);
  });

  it('does not analyze stale skills that only appear in the older session timeline', async () => {
    const recentTraces = [makeTrace('trace-recent')];
    const staleTrace = {
      ...makeTrace('trace-stale'),
      metadata: { skill_id: 'stale-skill' },
    };
    getRecentTracesMock.mockResolvedValue(recentTraces);
    getSessionTracesMock.mockResolvedValue([staleTrace, recentTraces[0]]);
    mapTraceMock.mockImplementation((trace: Trace) => {
      if (trace.trace_id === 'trace-recent') {
        return {
          trace_id: trace.trace_id,
          skill_id: 'test-skill',
          shadow_id: 'test-skill@/tmp/project#codex',
          confidence: 0.9,
          reason: 'metadata',
        };
      }

      if (trace.trace_id === 'trace-stale') {
        return {
          trace_id: trace.trace_id,
          skill_id: 'stale-skill',
          shadow_id: 'stale-skill@/tmp/project#codex',
          confidence: 0.92,
          reason: 'metadata',
        };
      }

      return {
        trace_id: trace.trace_id,
        skill_id: null,
        shadow_id: null,
        confidence: 0,
        reason: 'no skill mapping found',
      };
    });
    shadowGetMock.mockImplementation((skillId: string) => ({
      status: 'active',
      skillId,
    }));
    shadowReadContentMock.mockReturnValue('# Test Skill');
    analyzeWindowMock.mockResolvedValue({
      success: true,
      decision: 'no_optimization',
      userMessage: 'No optimization needed.',
      evaluation: {
        should_patch: false,
        reason: 'No optimization needed.',
        source_sessions: ['sess-1'],
        confidence: 0.2,
        rule_name: 'llm_window_analysis',
      },
    });

    const pipeline = createOptimizationPipeline({
      projectRoot: '/tmp/project',
      autoOptimize: true,
      minConfidence: 0.5,
    });
    await pipeline.init();

    await pipeline.runOnce();

    expect(analyzeWindowMock).toHaveBeenCalledTimes(1);
    expect(analyzeWindowMock.mock.calls[0]?.[1]).toMatchObject({
      skillId: 'test-skill',
    });
  });

  it('skips task generation when the real session window asks for more context', async () => {
    const traces = [makeTrace('trace-1'), makeTrace('trace-2', 'sess-2')];
    getRecentTracesMock.mockResolvedValue(traces);
    getSessionTracesMock.mockImplementation(async (sessionId: string) =>
      traces.filter((trace) => trace.session_id === sessionId)
    );
    mapTraceMock.mockImplementation((trace: Trace) => ({
      trace_id: trace.trace_id,
      skill_id: 'test-skill',
      shadow_id: 'test-skill@/tmp/project#codex',
      confidence: 0.9,
      reason: 'metadata',
    }));
    shadowGetMock.mockReturnValue({ status: 'active' });
    shadowReadContentMock.mockReturnValue('# Test Skill');
    analyzeWindowMock.mockResolvedValue({
      success: true,
      decision: 'need_more_context',
      userMessage: 'Need a larger context window before deciding.',
      evaluation: {
        should_patch: false,
        reason: 'Need a larger context window before deciding.',
        source_sessions: ['sess-1', 'sess-2'],
        confidence: 0.4,
        rule_name: 'llm_window_analysis',
      },
    });

    const pipeline = createOptimizationPipeline({
      projectRoot: '/tmp/project',
      autoOptimize: true,
      minConfidence: 0.5,
    });
    await pipeline.init();

    const tasks = await pipeline.runOnce();

    expect(analyzeWindowMock).toHaveBeenCalledTimes(2);
    expect(tasks).toEqual([]);
  });

  it('skips task generation when optimization lacks executable patch context', async () => {
    const traces = [makeTrace('trace-1')];
    getRecentTracesMock.mockResolvedValue(traces);
    getSessionTracesMock.mockResolvedValue(traces);
    mapTraceMock.mockReturnValue({
      trace_id: 'trace-1',
      skill_id: 'test-skill',
      shadow_id: 'test-skill@/tmp/project#codex',
      confidence: 0.9,
      reason: 'metadata',
    });
    shadowGetMock.mockReturnValue({ status: 'active' });
    shadowReadContentMock.mockReturnValue('# Test Skill');
    analyzeWindowMock.mockResolvedValue({
      success: true,
      decision: 'apply_optimization',
      userMessage: 'Repeated noise should be pruned.',
      evaluation: {
        should_patch: true,
        change_type: 'prune_noise',
        reason: 'Repeated noise should be pruned.',
        source_sessions: ['sess-1'],
        confidence: 0.92,
        rule_name: 'llm_window_analysis',
      },
      nextWindowHint: {
        suggestedTraceDelta: 6,
        suggestedTurnDelta: 2,
        waitForEventTypes: ['tool_result'],
        mode: 'event_driven',
      },
    });

    const pipeline = createOptimizationPipeline({
      projectRoot: '/tmp/project',
      autoOptimize: true,
      minConfidence: 0.5,
    });
    await pipeline.init();

    const tasks = await pipeline.runOnce();

    expect(tasks).toEqual([]);
  });
});
