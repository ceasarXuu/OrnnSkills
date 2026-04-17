import type { DecisionEventRecord } from '../decision-events/index.js';
import type { DecisionExplanationResult } from '../decision-explainer/index.js';
import type { EvaluationResult, RuntimeType, Trace } from '../../types/index.js';
import { runtimeFromShadowId, skillIdFromShadowId } from '../../utils/parse.js';
import type { PatchContextIssueCode } from '../window-analysis-outcome/index.js';

export interface ActivityEventContext {
  episodeId?: string | null;
  skillId: string;
  runtime: RuntimeType;
  windowId: string;
  traceId: string;
  sessionId: string;
  traceCount: number;
  sessionCount: number;
}

function buildWindowInputSummary(context: ActivityEventContext): string {
  return `本次观察窗口覆盖 ${context.traceCount} 条 trace，涉及 ${context.sessionCount} 个 session。`;
}

function buildEvaluationBusinessMeta(status: string): {
  businessCategory: string;
  businessTag: string;
  nextAction: string;
} {
  if (status === 'continue_collecting') {
    return {
      businessCategory: 'core_flow',
      businessTag: 'analysis_waiting_more_context',
      nextAction: '当前不会直接修改技能，系统会继续扩大窗口并等待更多上下文后再次分析。',
    };
  }

  if (
    status === 'cooldown' ||
    status === 'daily_limit_reached' ||
    status === 'frozen' ||
    status === 'confidence_too_low'
  ) {
    return {
      businessCategory: 'core_flow',
      businessTag: 'optimization_skipped',
      nextAction: '当前保持技能不变，只有出现新的强信号时才会重新进入下一轮分析。',
    };
  }

  return {
    businessCategory: 'core_flow',
    businessTag: 'analysis_concluded',
    nextAction: '当前保持技能不变，并继续观察后续调用窗口。',
  };
}

export function describePatchContextIssue(issue: PatchContextIssueCode): string {
  switch (issue) {
    case 'missing_target_section':
      return '缺少 target_section，无法定位需要修改的技能段落。';
    default:
      return '缺少可执行的 patch 上下文。';
  }
}

export function buildActivityEventContext(input: {
  episodeId?: string | null;
  shadowId: string;
  trace: Trace;
  traces: Trace[];
}): ActivityEventContext {
  const { shadowId, trace, traces, episodeId = null } = input;
  const skillId = skillIdFromShadowId(shadowId) ?? trace.metadata?.skill_id?.toString() ?? shadowId.split('@')[0];
  const runtime = runtimeFromShadowId(shadowId) ?? trace.runtime ?? 'codex';
  const sessionIds = [...new Set(traces.map((item) => item.session_id).filter(Boolean))];
  const sessionId = trace.session_id || sessionIds[0] || 'unknown-session';

  return {
    episodeId,
    skillId,
    runtime,
    windowId: `${sessionId}::${skillId}`,
    traceId: trace.trace_id,
    sessionId,
    traceCount: traces.length,
    sessionCount: sessionIds.length || 1,
  };
}

export function buildEvaluationResultEvent(input: {
  shadowId: string;
  context: ActivityEventContext;
  status: string;
  detail: string;
  evaluation: EvaluationResult | null;
}): Omit<DecisionEventRecord, 'id' | 'timestamp'> {
  const { shadowId, context, status, detail, evaluation } = input;
  const businessMeta = buildEvaluationBusinessMeta(status);
  return {
    tag: 'evaluation_result',
    businessCategory: businessMeta.businessCategory,
    businessTag: businessMeta.businessTag,
    episodeId: context.episodeId ?? null,
    inputSummary: buildWindowInputSummary(context),
    judgment: detail,
    nextAction: businessMeta.nextAction,
    skillId: context.skillId,
    runtime: context.runtime,
    windowId: context.windowId,
    traceId: context.traceId,
    sessionId: context.sessionId,
    status,
    detail,
    confidence: evaluation?.confidence ?? null,
    changeType: evaluation?.change_type ?? null,
    reason: evaluation?.reason ?? null,
    traceCount: context.traceCount,
    sessionCount: context.sessionCount,
    ruleName: evaluation?.rule_name ?? null,
    evidence: {
      directEvidence: [`shadow=${shadowId}`],
    },
  };
}

export function buildAnalysisRequestedEvent(input: {
  context: ActivityEventContext;
  evaluation: EvaluationResult | null;
  detail?: string;
  status?: string;
}): Omit<DecisionEventRecord, 'id' | 'timestamp'> {
  const { context, evaluation, detail = '已满足优化条件，开始生成改进方案。', status = 'ready' } = input;
  return {
    tag: 'analysis_requested',
    businessCategory: 'core_flow',
    businessTag: 'analysis_started',
    episodeId: context.episodeId ?? null,
    inputSummary: buildWindowInputSummary(context),
    judgment: detail,
    nextAction: '等待本轮分析返回结果，再决定是继续观察、保持现状还是执行优化。',
    skillId: context.skillId,
    runtime: context.runtime,
    windowId: context.windowId,
    traceId: context.traceId,
    sessionId: context.sessionId,
    status,
    detail,
    confidence: evaluation?.confidence ?? null,
    changeType: evaluation?.change_type ?? null,
    reason: evaluation?.reason ?? null,
    traceCount: context.traceCount,
    sessionCount: context.sessionCount,
    ruleName: evaluation?.rule_name ?? null,
  };
}

export function buildAnalysisFailedEvent(input: {
  context: ActivityEventContext;
  detail: string;
  evaluation?: EvaluationResult | null;
  reason?: string | null;
  evidence?: Record<string, unknown> | null;
}): Omit<DecisionEventRecord, 'id' | 'timestamp'> {
  const { context, detail, evaluation = null, reason = null, evidence = null } = input;
  return {
    tag: 'analysis_failed',
    businessCategory: 'stability_feedback',
    businessTag: 'analysis_failed',
    episodeId: context.episodeId ?? null,
    inputSummary: buildWindowInputSummary(context),
    judgment: detail,
    nextAction: '优先排查分析链路、模型服务或协议问题，而不是直接修改技能内容。',
    skillId: context.skillId,
    runtime: context.runtime,
    windowId: context.windowId,
    traceId: context.traceId,
    sessionId: context.sessionId,
    status: 'failed',
    detail,
    confidence: evaluation?.confidence ?? null,
    changeType: evaluation?.change_type ?? null,
    reason: reason ?? evaluation?.reason ?? null,
    traceCount: context.traceCount,
    sessionCount: context.sessionCount,
    ruleName: evaluation?.rule_name ?? null,
    evidence: evidence as DecisionEventRecord['evidence'],
  };
}

export function buildSkillFeedbackEvent(input: {
  context: ActivityEventContext;
  evaluation: EvaluationResult;
  explanation: DecisionExplanationResult;
}): Omit<DecisionEventRecord, 'id' | 'timestamp'> {
  const { context, evaluation, explanation } = input;
  const rawEvidenceParts = [
    explanation.decisionRationale,
    ...explanation.uncertainties.map((item) => `uncertainty: ${item}`),
    ...explanation.contradictions.map((item) => `contradiction: ${item}`),
  ].filter(Boolean);

  return {
    tag: 'skill_feedback',
    businessCategory: 'supporting_detail',
    businessTag: 'analysis_support',
    episodeId: context.episodeId ?? null,
    inputSummary: buildWindowInputSummary(context),
    judgment: explanation.summary,
    nextAction: explanation.recommendedAction,
    skillId: context.skillId,
    runtime: context.runtime,
    windowId: context.windowId,
    traceId: context.traceId,
    sessionId: context.sessionId,
    status: evaluation.should_patch ? 'patch_recommended' : 'no_patch_needed',
    detail: explanation.summary,
    confidence: evaluation.confidence,
    changeType: evaluation.change_type ?? null,
    reason: evaluation.reason ?? null,
    traceCount: context.traceCount,
    sessionCount: context.sessionCount,
    ruleName: evaluation.rule_name ?? null,
    evidence: {
      directEvidence: explanation.evidenceReadout,
      causalJudgment: explanation.causalChain,
      action: explanation.recommendedAction,
      rawEvidence: rawEvidenceParts.join('\n'),
    },
  };
}

export function buildPatchAppliedEvent(input: {
  context: ActivityEventContext;
  evaluation: EvaluationResult;
  revision: number;
  linesAdded?: number | null;
  linesRemoved?: number | null;
}): Omit<DecisionEventRecord, 'id' | 'timestamp'> {
  const { context, evaluation, revision, linesAdded = null, linesRemoved = null } = input;
  const detail = `已完成本轮优化并写回 shadow skill。revision=${revision}`;
  return {
    tag: 'patch_applied',
    businessCategory: 'core_flow',
    businessTag: 'optimization_applied',
    episodeId: context.episodeId ?? null,
    inputSummary: buildWindowInputSummary(context),
    judgment: detail,
    nextAction: '后续调用会继续验证这次优化是否有效，并在必要时开启下一轮观察。',
    skillId: context.skillId,
    runtime: context.runtime,
    windowId: context.windowId,
    traceId: context.traceId,
    sessionId: context.sessionId,
    status: 'success',
    detail,
    confidence: evaluation.confidence,
    changeType: evaluation.change_type ?? null,
    reason: evaluation.reason ?? null,
    traceCount: context.traceCount,
    sessionCount: context.sessionCount,
    ruleName: evaluation.rule_name ?? null,
    linesAdded,
    linesRemoved,
  };
}
