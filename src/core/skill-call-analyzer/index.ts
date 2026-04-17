import { createChildLogger } from '../../utils/logger.js';
import { createLiteLLMClient } from '../../llm/litellm-client.js';
import { readDashboardConfig } from '../../config/manager.js';
import { buildAgentUsageModelId, recordAgentUsage } from '../agent-usage/index.js';
import { readProjectLanguage } from '../../dashboard/language-state.js';
import type { Language } from '../../dashboard/i18n.js';
import {
  needsNarrativeFallback,
  normalizeNarrativeArray,
  normalizeNarrativeString,
} from '../llm-localization/index.js';
import { appendProjectPromptOverride } from '../prompt-overrides.js';
import { buildTraceTimelineText } from '../trace-summary/index.js';
import { extractJsonObject } from '../../utils/json-response.js';
import type {
  ChangeType,
  EvaluationResult,
  WindowAnalysisDecision,
  WindowAnalysisHint,
} from '../../types/index.js';
import type { SkillCallWindow } from '../skill-call-window/index.js';

const logger = createChildLogger('skill-call-analyzer');
const SKILL_CALL_ANALYZER_PROMPT_VERSION = 'window-triage-v2';

interface AnalyzerResponsePayload {
  decision?: unknown;
  reason?: unknown;
  confidence?: unknown;
  next_window_hint?: unknown;
  change_type?: unknown;
  target_section?: unknown;
  pattern?: unknown;
  evidence?: unknown;
}

export interface SkillCallAnalysisResult {
  success: boolean;
  decision?: WindowAnalysisDecision;
  evaluation?: EvaluationResult;
  model: string;
  error?: string;
  errorCode?: string;
  userMessage?: string;
  technicalDetail?: string;
  nextWindowHint?: WindowAnalysisHint;
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

const ALLOWED_CHANGE_TYPES: ChangeType[] = [
  'append_context',
  'tighten_trigger',
  'add_fallback',
  'prune_noise',
  'rewrite_section',
];

function describeChangeType(changeType: ChangeType, lang: Language): string {
  if (lang !== 'zh') return changeType;
  switch (changeType) {
    case 'append_context':
      return '补充上下文';
    case 'tighten_trigger':
      return '收紧触发条件';
    case 'add_fallback':
      return '增加兜底策略';
    case 'prune_noise':
      return '裁剪噪声';
    case 'rewrite_section':
      return '重写段落';
    default:
      return changeType;
  }
}

function buildRawResponseExcerpt(raw: string): string {
  const normalized = String(raw || '').trim();
  if (!normalized) return '';
  return normalized.length <= 1200 ? normalized : `${normalized.slice(0, 1200)}...`;
}

function buildFallbackHint(window: SkillCallWindow): WindowAnalysisHint {
  const traceCount = Math.max(window.traces.length, 1);
  return {
    suggestedTraceDelta: Math.max(6, Math.ceil(traceCount * 0.4)),
    suggestedTurnDelta: 2,
    waitForEventTypes: [],
    mode: 'count_driven',
  };
}

function countExplicitSkillMentions(window: SkillCallWindow): number {
  const normalizedSkillId = window.skillId.toLowerCase();

  return window.traces.reduce((count, trace) => {
    const mentionedInRefs = trace.skill_refs?.some((ref) => {
      const normalizedRef = String(ref || '').toLowerCase();
      return normalizedRef === normalizedSkillId || normalizedRef.startsWith(`${normalizedSkillId}@`);
    }) ?? false;
    const mentionedInUser = trace.user_input?.toLowerCase().includes(normalizedSkillId) ?? false;
    const mentionedInAssistant = trace.assistant_output?.toLowerCase().includes(normalizedSkillId) ?? false;
    return count + (mentionedInRefs || mentionedInUser || mentionedInAssistant ? 1 : 0);
  }, 0);
}

function buildWindowSnapshot(window: SkillCallWindow, lang: Language): string[] {
  const failureCount = window.traces.filter((trace) => trace.status === 'failure').length;
  const toolFailureCount = window.traces.filter((trace) =>
    trace.event_type === 'tool_result' && trace.status === 'failure'
  ).length;
  const retryCount = window.traces.filter((trace) =>
    trace.event_type === 'retry' || trace.status === 'retry'
  ).length;
  const assistantOutputCount = window.traces.filter((trace) =>
    typeof trace.assistant_output === 'string' && trace.assistant_output.trim().length > 0
  ).length;
  const fileChangeCount = window.traces.filter((trace) =>
    trace.event_type === 'file_change' || (trace.files_changed?.length ?? 0) > 0
  ).length;
  const explicitSkillMentions = countExplicitSkillMentions(window);

  if (lang === 'zh') {
    return [
      `- 显式 skill 提及次数: ${explicitSkillMentions}`,
      `- 失败事件数: ${failureCount}`,
      `- 工具失败数: ${toolFailureCount}`,
      `- 重试事件数: ${retryCount}`,
      `- 助手输出事件数: ${assistantOutputCount}`,
      `- 文件变更事件数: ${fileChangeCount}`,
    ];
  }

  return [
    `- Explicit skill mentions: ${explicitSkillMentions}`,
    `- Failure events: ${failureCount}`,
    `- Tool failures: ${toolFailureCount}`,
    `- Retry events: ${retryCount}`,
    `- Assistant output events: ${assistantOutputCount}`,
    `- File change events: ${fileChangeCount}`,
  ];
}

function buildPrompt(
  window: SkillCallWindow,
  skillContent: string,
  lang: Language,
  promptOverride: string
): { systemPrompt: string; userPrompt: string } {
  const isZh = lang === 'zh';
  const baseSystemPrompt = isZh
    ? [
        '你是 Ornn 的技能调用窗口分析器。',
        '你的任务是基于当前窗口的完整上下文，返回唯一一个三元决策。',
        '允许的 decision 只有: no_optimization, apply_optimization, need_more_context。',
        '先按下面顺序做判断。',
        '第一步：确认当前窗口里是否真的存在 skill 相关信号。skill 相关信号包括：用户显式提到该 skill、assistant 明确按该 skill 的方法推进、失败模式与该 skill 的指令直接相关。',
        '第二步：判断观察到的问题是否真的由 skill 设计造成，而不是宿主故障、工具故障、权限限制、网络/环境异常、外部服务波动、信息缺失、用户中途改目标或单次偶发失误。',
        '第三步：如果怀疑需要优化，再判断证据是否已经稳定到足以支持可执行修改，并且能落到允许的 change_type / target_section。',
        '决策规则：',
        '- 返回 no_optimization：当窗口足以说明 skill 被正确调用并按预期执行；或观察到的问题不属于 skill 设计；或只有宿主/工具/环境问题，没有证据表明 skill 本身需要修改。',
        '- 返回 need_more_context：当你怀疑 skill 可能有问题，但证据、归因或定位还不稳定；或只看到一次孤立失败；或缺少失败前后的关键上下文；或虽然看到了问题，但还不能可靠给出 change_type / target_section。',
        '- 只有同时满足以下条件，才允许返回 apply_optimization：',
        '  1. 已观察到至少一个清晰且可归因于 skill 的缺口、歧义或遗漏；',
        '  2. 这个问题不是主要由宿主故障、工具故障、权限限制、网络/环境异常造成；',
        '  3. 当前窗口已经能稳定说明“改 skill 会改善结果”；',
        `  4. 你能给出允许的 change_type，并在需要时定位到 target_section；`,
        '  5. evidence 能提供至少 2 条来自时间线的事实。',
        '如果问题主要来自宿主故障、工具故障、权限限制、网络/环境异常，默认不能返回 apply_optimization。',
        'need_more_context 适用于“怀疑 skill 有问题，但证据、归因或定位还不稳定”。',
        '不要用基于关键词的机械判断，必须结合完整时间线语义和前后因果。',
        '不要把“用户尚未执行建议”“只尝试了一次”“窗口在中途结束”直接当成 skill 失败。',
        '只返回 JSON，字段固定为 decision, reason, confidence, next_window_hint, change_type, target_section, pattern, evidence。',
        `当 decision=apply_optimization 时，change_type 只能是: ${ALLOWED_CHANGE_TYPES.join(', ')}。`,
        '当 decision!=apply_optimization 时，change_type 和 target_section 必须为 null。',
        '当 decision=need_more_context 时，必须提供 next_window_hint，并说明建议继续积累 trace 还是等待特定事件。',
        'confidence 必须是 0 到 1 之间的数字。',
        '当 decision=apply_optimization 时，evidence 至少提供 2 条；其他 decision 也应尽量提供简短事实要点。',
        'evidence 必须是从时间线摘出的简短事实要点，自然语言内容必须使用简体中文。',
        '如果任何自然语言字段出现英文句子，这份输出就是无效的，必须改写成简体中文后再返回。',
      ].join('\n')
    : [
        'You are Ornn\'s skill-call window analyzer.',
        'Your task is to inspect the full call window and return exactly one triage decision.',
        'Allowed decision values are: no_optimization, apply_optimization, need_more_context.',
        'Evaluate the window in order.',
        'Step 1: confirm that the window contains real skill-related signals. Skill-related signals include an explicit user mention of the skill, assistant behavior that clearly follows the skill, or a failure mode that directly conflicts with the skill instructions.',
        'Step 2: decide whether the observed problem is actually caused by skill design, rather than host failures, tool failures, permission limits, network/environment issues, external service instability, missing information, the user changing goals, or a one-off mistake.',
        'Step 3: if optimization still looks plausible, decide whether the evidence is stable enough to support an executable change and whether the fix can be mapped to an allowed change_type / target_section.',
        'Decision rules:',
        '- Return no_optimization when the window is sufficient to show that the skill was invoked correctly and behaved as expected, or when the observed issue is outside the skill, or when the evidence only shows host/tool/environment problems.',
        '- Return need_more_context when the skill may be at fault but the evidence, attribution, or edit location is still unstable; when you only saw one isolated failure; when critical before/after context is missing; or when you still cannot reliably name change_type / target_section.',
        '- Only return apply_optimization when all of the following are true:',
        '  1. You observed at least one clear gap, ambiguity, or omission attributable to the skill.',
        '  2. The issue is not primarily caused by host failures, tool failures, permission limits, or network/environment issues.',
        '  3. The current window is stable enough to support the claim that editing the skill would improve the outcome.',
        '  4. You can name an allowed change_type and, when needed, a target_section.',
        '  5. evidence can cite at least 2 factual bullets from the timeline.',
        'If the problem mainly comes from host/tool/permission/network/environment issues, you should not return apply_optimization by default.',
        'need_more_context is specifically for “the skill might be wrong, but the evidence, attribution, or patch location is not stable yet.”',
        'Do not rely on shallow keyword matching; reason over full timeline semantics and causal flow.',
        'Do not treat “the user has not tried the advice yet”, “only one attempt exists”, or “the window ended mid-investigation” as proof that the skill failed.',
        'Return only JSON with keys: decision, reason, confidence, next_window_hint, change_type, target_section, pattern, evidence.',
        `When decision=apply_optimization, change_type must be one of: ${ALLOWED_CHANGE_TYPES.join(', ')}.`,
        'When decision!=apply_optimization, change_type and target_section must be null.',
        'When decision=need_more_context, next_window_hint is required and must say whether Ornn should wait for more traces or for a specific event.',
        'confidence must be a number between 0 and 1.',
        'When decision=apply_optimization, evidence must contain at least 2 short factual bullets grounded in the timeline.',
      ].join('\n');
  const systemPrompt = appendProjectPromptOverride(baseSystemPrompt, promptOverride, lang);

  const timeline = buildTraceTimelineText(window.traces.slice(-60), lang).split('\n');
  const snapshot = buildWindowSnapshot(window, lang);

  const userPrompt = isZh
    ? [
        `Skill ID: ${window.skillId}`,
        `宿主: ${window.runtime}`,
        `窗口 ID: ${window.windowId}`,
        `开始时间: ${window.startedAt}`,
        `最后一条 Trace 时间: ${window.lastTraceAt}`,
        `Trace 数量: ${window.traces.length}`,
        '',
        '窗口摘要:',
        ...snapshot,
        '',
        '当前 Skill 内容:',
        '```markdown',
        skillContent,
        '```',
        '',
        '窗口时间线:',
        ...timeline,
        '',
        '请严格按“skill 相关性 -> 归因 -> 可执行性”的顺序判断，不要因为单次失败就直接给出 apply_optimization。',
        '请输出唯一一个三元决策：无需优化、执行优化、或等待更多上下文。',
      ].join('\n')
    : [
        `Skill ID: ${window.skillId}`,
        `Host: ${window.runtime}`,
        `Window ID: ${window.windowId}`,
        `Started At: ${window.startedAt}`,
        `Last Trace At: ${window.lastTraceAt}`,
        `Trace Count: ${window.traces.length}`,
        '',
        'Window Snapshot:',
        ...snapshot,
        '',
        'Current Skill Content:',
        '```markdown',
        skillContent,
        '```',
        '',
        'Window Timeline:',
        ...timeline,
        '',
        'Follow the sequence skill relevance -> attribution -> executability, and do not jump to apply_optimization from a single failure.',
        'Return exactly one triage decision: no optimization, apply optimization, or wait for more context.',
      ].join('\n');

  return { systemPrompt, userPrompt };
}

function normalizeDecision(value: unknown): WindowAnalysisDecision {
  switch (value) {
    case 'no_optimization':
    case 'apply_optimization':
      return value;
    default:
      return 'need_more_context';
  }
}

function normalizeChangeType(value: unknown): ChangeType | undefined {
  if (typeof value !== 'string') return undefined;
  return ALLOWED_CHANGE_TYPES.includes(value as ChangeType) ? (value as ChangeType) : undefined;
}

function normalizeConfidence(value: unknown): number {
  return typeof value === 'number' && value >= 0 && value <= 1 ? value : 0;
}

function normalizeEvidence(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

function buildReasonFallback(
  decision: WindowAnalysisDecision,
  payload: AnalyzerResponsePayload,
  lang: Language,
): string {
  if (lang === 'zh') {
    if (decision === 'apply_optimization') {
      const changeType = normalizeChangeType(payload.change_type);
      const targetSection = typeof payload.target_section === 'string' && payload.target_section.trim()
        ? payload.target_section.trim()
        : '相关段落';
      if (changeType) {
        return `当前窗口已发现稳定改进信号，建议执行优化，并按“${describeChangeType(changeType, lang)}”方式修改“${targetSection}”。`;
      }
      return '当前窗口已发现稳定改进信号，建议执行优化。';
    }
    if (decision === 'need_more_context') {
      return '当前窗口证据仍不足，暂时无法下结论，需要继续观察更多上下文。';
    }
    return '当前窗口显示该技能被正确调用并按预期执行，未发现需要优化的设计问题。';
  }

  if (decision === 'apply_optimization') {
    const changeType = normalizeChangeType(payload.change_type);
    const targetSection = typeof payload.target_section === 'string' && payload.target_section.trim()
      ? payload.target_section.trim()
      : 'the relevant section';
    if (changeType) {
      return `The current window shows a stable optimization signal; apply ${changeType} to ${targetSection}.`;
    }
    return 'The current window shows a stable optimization signal and recommends applying an optimization.';
  }
  if (decision === 'need_more_context') {
    return 'The current window is still inconclusive and needs more context.';
  }
  return 'The current window indicates the skill was invoked correctly and does not need optimization.';
}

function normalizeHint(value: unknown, fallback: WindowAnalysisHint): WindowAnalysisHint {
  const source = (value && typeof value === 'object') ? value as Record<string, unknown> : {};
  return {
    suggestedTraceDelta:
      typeof source.suggested_trace_delta === 'number'
        ? Math.max(1, Math.floor(source.suggested_trace_delta))
        : fallback.suggestedTraceDelta,
    suggestedTurnDelta:
      typeof source.suggested_turn_delta === 'number'
        ? Math.max(1, Math.floor(source.suggested_turn_delta))
        : fallback.suggestedTurnDelta,
    waitForEventTypes: Array.isArray(source.wait_for_event_types)
      ? source.wait_for_event_types.map((item) => String(item))
      : fallback.waitForEventTypes,
    mode: source.mode === 'event_driven' || source.mode === 'count_driven'
      ? source.mode
      : fallback.mode,
  };
}

function buildEvaluation(
  payload: AnalyzerResponsePayload,
  window: SkillCallWindow,
  reason: string,
  evidence: string[],
): EvaluationResult {
  const targetSection = typeof payload.target_section === 'string' && payload.target_section.trim()
    ? payload.target_section.trim()
    : undefined;
  const pattern = typeof payload.pattern === 'string' && payload.pattern.trim()
    ? payload.pattern.trim()
    : undefined;

  return {
    should_patch: true,
    change_type: normalizeChangeType(payload.change_type),
    reason,
    source_sessions: [window.sessionId],
    confidence: normalizeConfidence(payload.confidence),
    target_section: targetSection,
    rule_name: 'llm_window_analysis',
    patch_context: {
      pattern,
      reason: evidence.length > 0 ? evidence.join(' | ') : reason,
      section: targetSection,
    },
  };
}

function describeAnalysisFailure(
  rawError: string,
  lang: Language,
  options?: {
    rawResponse?: string | null;
  },
): { errorCode: string; userMessage: string; technicalDetail: string } {
  const isZh = lang === 'zh';
  const normalized = String(rawError || '').trim();
  const rawResponseExcerpt = buildRawResponseExcerpt(options?.rawResponse || '');

  if (normalized === 'provider_not_configured') {
    return {
      errorCode: 'provider_not_configured',
      userMessage: isZh
        ? '当前项目没有可用的模型服务配置，所以这轮分析没有开始。'
        : 'This analysis did not start because no model provider is configured for the project.',
      technicalDetail: normalized,
    };
  }

  if (normalized === 'invalid_analysis_json') {
    const technicalDetail = rawResponseExcerpt
      ? [normalized, 'Raw model response excerpt:', rawResponseExcerpt].join('\n')
      : normalized;
    return {
      errorCode: 'invalid_analysis_json',
      userMessage: isZh
        ? '模型返回了内容，但格式不符合系统要求，所以这轮分析结果无法解析。'
        : 'The model replied, but the response did not match the required JSON format, so the analysis could not be parsed.',
      technicalDetail,
    };
  }

  if (normalized.includes('Empty content in LLM response')) {
    return {
      errorCode: 'empty_llm_response',
      userMessage: isZh
        ? '模型接口返回了空内容，所以这轮分析没有拿到可用结果。'
        : 'The model API returned an empty response, so this analysis produced no usable result.',
      technicalDetail: normalized,
    };
  }

  if (normalized.toLowerCase().includes('timeout')) {
    return {
      errorCode: 'analysis_timeout',
      userMessage: isZh
        ? '分析请求超时了，所以这轮分析没有完成。'
        : 'The analysis request timed out before a usable result was returned.',
      technicalDetail: normalized,
    };
  }

  if (normalized.startsWith('LLM API error:')) {
    return {
      errorCode: 'provider_request_failed',
      userMessage: isZh
        ? '模型服务调用失败，所以这轮分析没有完成。'
        : 'The model provider request failed, so this analysis did not complete.',
      technicalDetail: normalized,
    };
  }

  return {
    errorCode: 'analysis_runtime_error',
    userMessage: isZh
      ? '分析链路执行时发生异常，所以这轮分析没有产生可用结果。'
      : 'The analysis pipeline hit an unexpected error before it could produce a usable result.',
    technicalDetail: normalized || (isZh ? '未知错误' : 'unknown error'),
  };
}

export class SkillCallAnalyzer {
  async analyzeWindow(
    projectPath: string,
    window: SkillCallWindow,
    skillContent: string
  ): Promise<SkillCallAnalysisResult> {
    const lang = await readProjectLanguage(projectPath, 'en');
    const config = await readDashboardConfig(projectPath);
    const activeProvider = config.providers[0];
    const promptOverride = config.promptOverrides?.skillCallAnalyzer || '';
    const fallbackHint = buildFallbackHint(window);

    if (!activeProvider || !activeProvider.apiKey) {
      const failure = describeAnalysisFailure('provider_not_configured', lang);
      logger.warn('Skill call analysis blocked: provider not configured', {
        projectPath,
        windowId: window.windowId,
        skillId: window.skillId,
      });
      return {
        success: false,
        model: 'none',
        error: failure.errorCode,
        errorCode: failure.errorCode,
        userMessage: failure.userMessage,
        technicalDetail: failure.technicalDetail,
        tokenUsage: {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
        },
      };
    }

    if (promptOverride.trim()) {
      logger.info('Applying skill call analyzer prompt override', {
        projectPath,
        windowId: window.windowId,
        skillId: window.skillId,
        overrideLength: promptOverride.trim().length,
      });
    }

    const client = createLiteLLMClient({
      provider: activeProvider.provider,
      modelName: activeProvider.modelName,
      apiKey: activeProvider.apiKey,
      maxTokens: 1600,
    });
    const prompt = buildPrompt(window, skillContent, lang, promptOverride);
    const model = buildAgentUsageModelId(activeProvider.provider, activeProvider.modelName);
    const started = Date.now();

    try {
      logger.debug('Prepared skill call analysis prompt', {
        projectPath,
        windowId: window.windowId,
        skillId: window.skillId,
        promptVersion: SKILL_CALL_ANALYZER_PROMPT_VERSION,
        lang,
        traceCount: window.traces.length,
        systemPromptChars: prompt.systemPrompt.length,
        userPromptChars: prompt.userPrompt.length,
      });
      const raw = await client.completion({
        prompt: prompt.userPrompt,
        systemPrompt: prompt.systemPrompt,
        temperature: 0.1,
        maxTokens: 1600,
        timeout: 45000,
        responseFormat: 'json_object',
      });
      const usage = client.getTokenUsage();
      recordAgentUsage(projectPath, {
        scope: 'skill_call_analyzer',
        eventId: window.windowId,
        skillId: window.skillId,
        episodeId: window.episodeId ?? null,
        triggerTraceId: window.triggerTraceId ?? null,
        windowId: window.windowId,
        model,
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        totalTokens: usage.totalTokens,
        durationMs: Date.now() - started,
      });
      const jsonText = extractJsonObject(raw);
      if (!jsonText) {
        const failure = describeAnalysisFailure('invalid_analysis_json', lang, { rawResponse: raw });
        logger.warn('Skill call analysis failed to return JSON', {
          projectPath,
          windowId: window.windowId,
          skillId: window.skillId,
          model,
          rawResponseExcerpt: buildRawResponseExcerpt(raw),
        });
        return {
          success: false,
          model,
          error: failure.errorCode,
          errorCode: failure.errorCode,
          userMessage: failure.userMessage,
          technicalDetail: failure.technicalDetail,
          tokenUsage: usage,
        };
      }

      const payload = JSON.parse(jsonText) as AnalyzerResponsePayload;
      const decision = normalizeDecision(payload.decision);
      const hint = normalizeHint(payload.next_window_hint, fallbackHint);
      const fallbackReason = buildReasonFallback(decision, payload, lang);
      const rawReason = typeof payload.reason === 'string' && payload.reason.trim()
        ? payload.reason.trim()
        : fallbackReason;
      const reason = normalizeNarrativeString(rawReason, fallbackReason, lang);
      const evidence = normalizeNarrativeArray(normalizeEvidence(payload.evidence), [], lang);

      if (needsNarrativeFallback(rawReason, lang)) {
        logger.warn('Skill call analyzer returned narrative in the wrong language; using localized fallback', {
          projectPath,
          windowId: window.windowId,
          skillId: window.skillId,
          lang,
          decision,
          rawReason,
        });
      }

      const evaluation = decision === 'apply_optimization'
        ? buildEvaluation(payload, window, reason, evidence)
        : {
            should_patch: false,
            reason,
            source_sessions: [window.sessionId],
            confidence: normalizeConfidence(payload.confidence),
            rule_name: 'llm_window_analysis',
          };

      logger.info('Skill call window analysis completed', {
        projectPath,
        windowId: window.windowId,
        skillId: window.skillId,
        model,
        decision,
        changeType: evaluation.change_type ?? null,
        confidence: evaluation.confidence,
        totalTokens: usage.totalTokens,
      });

      return {
        success: true,
        decision,
        evaluation,
        model,
        userMessage: reason,
        nextWindowHint: hint,
        tokenUsage: usage,
      };
    } catch (error) {
      const usage = client.getTokenUsage();
      const rawMessage = error instanceof Error ? error.message : String(error);
      const failure = describeAnalysisFailure(rawMessage, lang);
      logger.error('Skill call analysis failed', {
        projectPath,
        windowId: window.windowId,
        skillId: window.skillId,
        model,
        error: rawMessage,
      });
      return {
        success: false,
        model,
        error: failure.errorCode,
        errorCode: failure.errorCode,
        userMessage: failure.userMessage,
        technicalDetail: failure.technicalDetail,
        tokenUsage: usage,
      };
    }
  }
}

export function createSkillCallAnalyzer(): SkillCallAnalyzer {
  return new SkillCallAnalyzer();
}
