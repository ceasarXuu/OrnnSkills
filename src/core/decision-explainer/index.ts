import { createLiteLLMClient } from '../../llm/litellm-client.js';
import { readDashboardConfig } from '../../config/manager.js';
import { createChildLogger } from '../../utils/logger.js';
import { buildAgentUsageModelId, recordAgentUsage } from '../agent-usage/index.js';
import { readProjectLanguage } from '../../dashboard/language-state.js';
import type { Language } from '../../dashboard/i18n.js';
import { normalizeNarrativeArray, normalizeNarrativeString } from '../llm-localization/index.js';
import { getDecisionExplainerBaseSystemPrompt } from '../prompt-defaults.js';
import { appendProjectPromptOverride } from '../prompt-overrides.js';
import { buildTraceTimelineText } from '../trace-summary/index.js';
import { extractJsonObject } from '../../utils/json-response.js';
import type { DecisionEventEvidence, EvaluationResult, Trace } from '../../types/index.js';

const logger = createChildLogger('decision-explainer');
const MAX_DECISION_EXPLAINER_ATTEMPTS = 2;

export interface DecisionExplanationResult {
  summary: string;
  evidenceReadout: string[];
  causalChain: string[];
  decisionRationale: string;
  recommendedAction: string;
  uncertainties: string[];
  contradictions: string[];
}

function truncate(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength)}...`;
}

function formatEvidenceBlock(evidence: DecisionEventEvidence | null | undefined): string {
  if (!evidence) return 'none';
  const lines: string[] = [];
  if (Array.isArray(evidence.directEvidence) && evidence.directEvidence.length > 0) {
    lines.push(`Direct Evidence: ${evidence.directEvidence.join(' | ')}`);
  }
  if (Array.isArray(evidence.causalJudgment) && evidence.causalJudgment.length > 0) {
    lines.push(`Causal Judgment: ${evidence.causalJudgment.join(' | ')}`);
  }
  if (typeof evidence.action === 'string' && evidence.action.trim()) {
    lines.push(`Action: ${evidence.action.trim()}`);
  }
  if (typeof evidence.rawEvidence === 'string' && evidence.rawEvidence.trim()) {
    lines.push(`Raw Evidence: ${truncate(evidence.rawEvidence.trim(), 600)}`);
  }
  return lines.length > 0 ? lines.join('\n') : 'none';
}

function buildPrompt(
  skillId: string,
  evaluation: EvaluationResult,
  traces: Trace[],
  evidence: DecisionEventEvidence | null | undefined,
  lang: Language,
  promptOverride: string
): { systemPrompt: string; userPrompt: string } {
  const isZh = lang === 'zh';
  const baseSystemPrompt = getDecisionExplainerBaseSystemPrompt(lang);
  const systemPrompt = appendProjectPromptOverride(baseSystemPrompt, promptOverride, lang);

  const userPrompt = isZh
    ? [
        `技能 ID: ${skillId}`,
        `是否建议修改: ${evaluation.should_patch}`,
        `修改类型: ${evaluation.change_type ?? 'none'}`,
        `置信度: ${evaluation.confidence}`,
        `目标段落: ${evaluation.target_section ?? 'none'}`,
        `原因: ${evaluation.reason ?? 'none'}`,
        '',
        '已记录证据:',
        formatEvidenceBlock(evidence),
        '',
        '观察到的 Trace 时间线:',
        ...buildTraceTimelineText(traces.slice(-40), lang).split('\n'),
        '',
        '请生成一段面向 dashboard 用户的简洁解释。',
      ].join('\n')
    : [
        `Skill ID: ${skillId}`,
        `Should Patch: ${evaluation.should_patch}`,
        `Change Type: ${evaluation.change_type ?? 'none'}`,
        `Confidence: ${evaluation.confidence}`,
        `Target Section: ${evaluation.target_section ?? 'none'}`,
        `Reason: ${evaluation.reason ?? 'none'}`,
        '',
        'Recorded Evidence:',
        formatEvidenceBlock(evidence),
        '',
        'Observed Trace Timeline:',
        ...buildTraceTimelineText(traces.slice(-40), lang).split('\n'),
        '',
        'Produce a concise explanation for dashboard users.',
      ].join('\n');

  return { systemPrompt, userPrompt };
}

function parseResponse(
  payload: Record<string, unknown>,
  fallback: DecisionExplanationResult,
  lang: Language
): DecisionExplanationResult {
  return {
    summary: normalizeNarrativeString(payload.summary, fallback.summary, lang),
    evidenceReadout: normalizeNarrativeArray(
      payload.evidence_readout,
      fallback.evidenceReadout,
      lang
    ),
    causalChain: normalizeNarrativeArray(payload.causal_chain, fallback.causalChain, lang),
    decisionRationale: normalizeNarrativeString(
      payload.decision_rationale,
      fallback.decisionRationale,
      lang
    ),
    recommendedAction: normalizeNarrativeString(
      payload.recommended_action,
      fallback.recommendedAction,
      lang
    ),
    uncertainties: normalizeNarrativeArray(payload.uncertainties, fallback.uncertainties, lang),
    contradictions: normalizeNarrativeArray(payload.contradictions, fallback.contradictions, lang),
  };
}

function buildRetrySystemPrompt(basePrompt: string, lang: Language): string {
  return [
    basePrompt,
    lang === 'zh'
      ? '上一轮输出未返回有效 JSON。这一轮必须只返回单个 JSON 对象，不要附加 Markdown、解释文字或代码块围栏。'
      : 'The previous reply was not valid JSON. Retry and return only one JSON object with no markdown, prose, or code fences.',
  ].join('\n');
}

function buildFallbackExplanation(
  skillId: string,
  evaluation: EvaluationResult
): DecisionExplanationResult {
  return {
    summary: evaluation.reason || `Decision recorded for ${skillId}.`,
    evidenceReadout: [],
    causalChain: [],
    decisionRationale: evaluation.reason || 'No explicit rationale was captured.',
    recommendedAction: evaluation.should_patch
      ? `Proceed with ${evaluation.change_type ?? 'the suggested patch'}.`
      : 'Continue monitoring before making changes.',
    uncertainties: [],
    contradictions: [],
  };
}

export async function generateDecisionExplanation(
  projectPath: string,
  skillId: string,
  evaluation: EvaluationResult,
  traces: Trace[],
  evidence?: DecisionEventEvidence | null
): Promise<DecisionExplanationResult> {
  const lang = await readProjectLanguage(projectPath, 'en');
  const localizedReason = normalizeNarrativeString(
    evaluation.reason,
    lang === 'zh' ? `已记录 ${skillId} 的决策结果。` : `Decision recorded for ${skillId}.`,
    lang
  );
  const fallback =
    lang === 'zh'
      ? {
          summary: localizedReason,
          evidenceReadout: [],
          causalChain: [],
          decisionRationale: localizedReason || '当前没有记录到更具体的决策原因。',
          recommendedAction: evaluation.should_patch
            ? `继续执行 ${evaluation.change_type ?? '建议中的修改'}。`
            : '继续观察，暂不修改技能。',
          uncertainties: [],
          contradictions: [],
        }
      : buildFallbackExplanation(skillId, evaluation);
  const config = await readDashboardConfig(projectPath);
  const activeProvider = config.providers[0];
  const promptOverride = config.promptOverrides?.decisionExplainer || '';

  if (!activeProvider || !activeProvider.apiKey) {
    return fallback;
  }

  if (promptOverride.trim()) {
    logger.info('Applying decision explainer prompt override', {
      projectPath,
      skillId,
      overrideLength: promptOverride.trim().length,
    });
  }

  const client = createLiteLLMClient({
    provider: activeProvider.provider,
    modelName: activeProvider.modelName,
    apiKey: activeProvider.apiKey,
    maxTokens: 1200,
  });
  const prompt = buildPrompt(skillId, evaluation, traces, evidence, lang, promptOverride);
  const model = buildAgentUsageModelId(activeProvider.provider, activeProvider.modelName);
  const started = Date.now();

  try {
    for (let attempt = 1; attempt <= MAX_DECISION_EXPLAINER_ATTEMPTS; attempt += 1) {
      const raw = await client.completion({
        prompt: prompt.userPrompt,
        systemPrompt:
          attempt === 1 ? prompt.systemPrompt : buildRetrySystemPrompt(prompt.systemPrompt, lang),
        temperature: attempt === 1 ? 0.1 : 0,
        maxTokens: 1200,
        timeout: 30000,
        responseFormat: 'json_object',
      });
      const usage = client.getTokenUsage();
      recordAgentUsage(projectPath, {
        scope: 'decision_explainer',
        eventId: skillId,
        skillId,
        model,
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        totalTokens: usage.totalTokens,
        durationMs: Date.now() - started,
      });

      const jsonText = extractJsonObject(raw);
      if (jsonText) {
        const payload = JSON.parse(jsonText) as Record<string, unknown>;
        return parseResponse(payload, fallback, lang);
      }

      const rawExcerpt = truncate(
        String(raw || '')
          .replace(/\s+/g, ' ')
          .trim(),
        240
      );
      if (attempt < MAX_DECISION_EXPLAINER_ATTEMPTS) {
        logger.debug('Decision explanation returned non-json response, retrying', {
          projectPath,
          skillId,
          model,
          attempt,
          rawExcerpt,
        });
        continue;
      }

      logger.warn('Decision explanation failed to return JSON', {
        projectPath,
        skillId,
        model,
        attempts: MAX_DECISION_EXPLAINER_ATTEMPTS,
        rawExcerpt,
      });
      return fallback;
    }
    return fallback;
  } catch (error) {
    logger.warn('Decision explanation failed, using fallback', {
      projectPath,
      skillId,
      model,
      error: error instanceof Error ? error.message : String(error),
    });
    return fallback;
  }
}
