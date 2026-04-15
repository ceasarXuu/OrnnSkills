import { describe, expect, it } from 'vitest';
import {
  buildActivityEventContext,
  buildAnalysisFailedEvent,
  buildEvaluationResultEvent,
  buildSkillFeedbackEvent,
} from '../../src/core/activity-event-builder/index.js';
import type { DecisionExplanationResult } from '../../src/core/decision-explainer/index.js';
import type { EvaluationResult, Trace } from '../../src/types/index.js';

function makeTrace(overrides: Partial<Trace> = {}): Trace {
  return {
    trace_id: 'trace-10',
    session_id: 'sess-1',
    turn_id: 'turn-10',
    runtime: 'codex',
    event_type: 'tool_call',
    tool_name: 'exec_command',
    tool_args: { cmd: 'echo test' },
    status: 'success',
    timestamp: '2026-04-13T09:00:00.000Z',
    metadata: { skill_id: 'test-skill' },
    ...overrides,
  };
}

const evaluation: EvaluationResult = {
  should_patch: false,
  reason: '当前证据不足，不应修改 skill。',
  source_sessions: ['sess-1'],
  confidence: 0.62,
  rule_name: 'llm_window_analysis',
};

const explanation: DecisionExplanationResult = {
  summary: '当前不建议修改 skill。',
  evidenceReadout: ['窗口内没有稳定失败模式'],
  causalChain: ['当前行为与技能说明一致'],
  decisionRationale: '没有观察到持续性设计问题。',
  recommendedAction: '继续观察后续窗口。',
  uncertainties: [],
  contradictions: [],
};

describe('activity-event-builder', () => {
  it('builds a stable activity event context from shadow id and traces', () => {
    const context = buildActivityEventContext({
      shadowId: 'codex::test-skill@/tmp/project',
      trace: makeTrace(),
      traces: [
        makeTrace({ trace_id: 'trace-1', turn_id: 'turn-1', timestamp: '2026-04-13T08:59:00.000Z' }),
        makeTrace(),
      ],
    });

    expect(context).toEqual({
      episodeId: null,
      skillId: 'test-skill',
      runtime: 'codex',
      windowId: 'sess-1::test-skill',
      traceId: 'trace-10',
      sessionId: 'sess-1',
      traceCount: 2,
      sessionCount: 1,
    });
  });

  it('maps continue_collecting to the core waiting-more-context business event', () => {
    const context = buildActivityEventContext({
      shadowId: 'codex::test-skill@/tmp/project',
      trace: makeTrace(),
      traces: [makeTrace()],
    });

    const event = buildEvaluationResultEvent({
      shadowId: 'codex::test-skill@/tmp/project',
      context,
      status: 'continue_collecting',
      detail: '当前窗口证据不足，继续扩展上下文。',
      evaluation,
    });

    expect(event).toMatchObject({
      tag: 'evaluation_result',
      businessCategory: 'core_flow',
      businessTag: 'analysis_waiting_more_context',
      nextAction: '当前不会直接修改技能，系统会继续扩大窗口并等待更多上下文后再次分析。',
      windowId: 'sess-1::test-skill',
    });
  });

  it('builds supporting skill feedback events from explanation output', () => {
    const context = buildActivityEventContext({
      shadowId: 'codex::test-skill@/tmp/project',
      trace: makeTrace(),
      traces: [makeTrace()],
    });

    const event = buildSkillFeedbackEvent({
      context,
      evaluation,
      explanation,
    });

    expect(event).toMatchObject({
      tag: 'skill_feedback',
      businessCategory: 'supporting_detail',
      businessTag: 'analysis_support',
      judgment: '当前不建议修改 skill。',
      nextAction: '继续观察后续窗口。',
      status: 'no_patch_needed',
    });
  });

  it('builds analysis failure events as stability feedback', () => {
    const context = buildActivityEventContext({
      shadowId: 'codex::test-skill@/tmp/project',
      trace: makeTrace(),
      traces: [makeTrace()],
    });

    const event = buildAnalysisFailedEvent({
      context,
      detail: '模型返回了内容，但格式不符合系统要求。',
      evaluation,
      reason: 'invalid_analysis_json',
      evidence: {
        rawEvidence: 'invalid_analysis_json',
      },
    });

    expect(event).toMatchObject({
      tag: 'analysis_failed',
      businessCategory: 'stability_feedback',
      businessTag: 'analysis_failed',
      nextAction: '优先排查分析链路、模型服务或协议问题，而不是直接修改技能内容。',
      reason: 'invalid_analysis_json',
    });
  });
});
