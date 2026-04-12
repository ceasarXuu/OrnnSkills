import { describe, expect, it, vi } from 'vitest';
import type { Trace } from '../../src/types/index.js';
import { collectSessionWindowCandidates } from '../../src/core/session-window-candidates/index.js';

function makeTrace(traceId: string, sessionId = 'sess-1', overrides: Partial<Trace> = {}): Trace {
  return {
    trace_id: traceId,
    session_id: sessionId,
    turn_id: `${traceId}-turn`,
    runtime: 'codex',
    event_type: 'tool_call',
    tool_name: 'exec_command',
    tool_args: { cmd: 'echo test' },
    status: 'success',
    timestamp: new Date(Date.UTC(2026, 3, 12, 0, 0, Number(traceId.split('-').pop() || 0))).toISOString(),
    metadata: { skill_id: 'test-skill' },
    ...overrides,
  };
}

describe('collectSessionWindowCandidates', () => {
  it('rebuilds candidates from full session timelines instead of recent mapped subsets', async () => {
    const recentTraces = [makeTrace('trace-1'), makeTrace('trace-2')];
    const fullTimeline = [
      recentTraces[0],
      makeTrace('trace-context-1', 'sess-1', {
        event_type: 'assistant_output',
        tool_name: undefined,
        tool_args: undefined,
        assistant_output: 'surrounding context',
        metadata: undefined,
      }),
      recentTraces[1],
    ];

    const loadSessionTraces = vi.fn().mockResolvedValue(fullTimeline);
    const mapTrace = vi.fn((trace: Trace) => {
      if (trace.trace_id === 'trace-1' || trace.trace_id === 'trace-2') {
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

    const candidates = await collectSessionWindowCandidates({
      recentTraces,
      loadSessionTraces,
      mapTrace,
    });

    expect(loadSessionTraces).toHaveBeenCalledWith('sess-1');
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      sessionId: 'sess-1',
      skill_id: 'test-skill',
      shadow_id: 'test-skill@/tmp/project#codex',
      confidence: 0.9,
    });
    expect(candidates[0]?.mappedTraces.map((trace) => trace.trace_id)).toEqual(['trace-1', 'trace-2']);
    expect(candidates[0]?.sessionTraces.map((trace) => trace.trace_id)).toEqual([
      'trace-1',
      'trace-context-1',
      'trace-2',
    ]);
  });

  it('skips sessions when the full timeline cannot be loaded', async () => {
    const recentTraces = [makeTrace('trace-1')];
    const loadSessionTraces = vi.fn().mockResolvedValue([]);
    const mapTrace = vi.fn();

    const candidates = await collectSessionWindowCandidates({
      recentTraces,
      loadSessionTraces,
      mapTrace,
    });

    expect(candidates).toEqual([]);
    expect(mapTrace).not.toHaveBeenCalled();
  });
});
