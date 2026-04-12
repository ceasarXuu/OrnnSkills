import { describe, expect, it } from 'vitest';
import type { Trace } from '../../src/types/index.js';
import { createSkillCallWindow } from '../../src/core/skill-call-window/index.js';

function makeTrace(traceId: string, timestamp: string): Trace {
  return {
    trace_id: traceId,
    session_id: 'sess-1',
    turn_id: `${traceId}-turn`,
    runtime: 'codex',
    event_type: 'tool_call',
    tool_name: 'exec_command',
    tool_args: { cmd: 'echo test' },
    status: 'success',
    timestamp,
    metadata: { skill_id: 'test-skill' },
  };
}

describe('createSkillCallWindow', () => {
  it('normalizes trace order while preserving explicit window boundaries', () => {
    const window = createSkillCallWindow({
      windowId: 'window-1',
      skillId: 'test-skill',
      runtime: 'codex',
      sessionId: 'sess-1',
      closeReason: 'session_timeline_replay',
      startedAt: '2026-04-12T00:00:00.000Z',
      lastTraceAt: '2026-04-12T00:00:10.000Z',
      traces: [
        makeTrace('trace-2', '2026-04-12T00:00:02.000Z'),
        makeTrace('trace-1', '2026-04-12T00:00:01.000Z'),
      ],
    });

    expect(window.startedAt).toBe('2026-04-12T00:00:00.000Z');
    expect(window.lastTraceAt).toBe('2026-04-12T00:00:10.000Z');
    expect(window.traces.map((trace) => trace.trace_id)).toEqual(['trace-1', 'trace-2']);
  });
});
