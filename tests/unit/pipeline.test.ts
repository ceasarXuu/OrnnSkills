import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createOptimizationPipeline } from '../../src/core/pipeline/index.js';
import type { Trace } from '../../src/types/index.js';

const {
  getRecentTracesMock,
  getSessionTracesMock,
  mapAndGroupTracesMock,
  shadowGetMock,
  shadowReadContentMock,
  analyzeWindowMock,
} = vi.hoisted(() => ({
  getRecentTracesMock: vi.fn(),
  getSessionTracesMock: vi.fn(),
  mapAndGroupTracesMock: vi.fn(),
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
    mapAndGroupTraces: mapAndGroupTracesMock,
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
    mapAndGroupTracesMock.mockReset();
    shadowGetMock.mockReset();
    shadowReadContentMock.mockReset();
    analyzeWindowMock.mockReset();
  });

  it('uses unified window analysis to generate optimization tasks', async () => {
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
    mapAndGroupTracesMock.mockReturnValue([
      {
        skill_id: 'test-skill',
        shadow_id: 'test-skill@/tmp/project#codex',
        traces: [traces[0]],
        confidence: 0.9,
      },
    ]);
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

  it('skips task generation when the analysis asks for more context', async () => {
    const traces = [makeTrace('trace-1'), makeTrace('trace-2', 'sess-2')];
    getRecentTracesMock.mockResolvedValue(traces);
    getSessionTracesMock.mockImplementation(async (sessionId: string) =>
      traces.filter((trace) => trace.session_id === sessionId)
    );
    mapAndGroupTracesMock.mockReturnValue([
      {
        skill_id: 'test-skill',
        shadow_id: 'test-skill@/tmp/project#codex',
        traces,
        confidence: 0.9,
      },
    ]);
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
});
