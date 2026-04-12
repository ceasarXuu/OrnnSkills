import { describe, expect, it } from 'vitest';
import { RepeatedDriftRule } from '../../src/core/evaluator/rules/repeated-drift.js';
import type { Trace } from '../../src/types/index.js';

function makeToolCall(index: number): Trace {
  return {
    trace_id: `trace-${index}`,
    session_id: `session-${index}`,
    turn_id: `turn-${index}`,
    runtime: 'codex',
    event_type: 'tool_call',
    tool_name: 'exec_command',
    tool_args: { cmd: 'npm test' },
    status: 'success',
    timestamp: new Date(Date.UTC(2026, 3, 12, 12, 30, index)).toISOString(),
  };
}

describe('RepeatedDriftRule', () => {
  it('does not recommend prune-noise when it cannot localize a skill section', () => {
    const rule = new RepeatedDriftRule();
    const traces = [makeToolCall(1), makeToolCall(2), makeToolCall(3)];

    const result = rule.evaluate(traces);

    expect(result).toBeNull();
  });
});
