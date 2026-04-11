import { createChildLogger } from '../../utils/logger.js';
import { createLiteLLMClient } from '../../llm/litellm-client.js';
import { readDashboardConfig } from '../../config/manager.js';
import { recordAgentUsage } from '../agent-usage/index.js';
import { readProjectLanguage } from '../../dashboard/language-state.js';
import type { Language } from '../../dashboard/i18n.js';
import type { ChangeType, EvaluationResult, Trace } from '../../types/index.js';
import type { SkillCallWindow } from '../skill-call-window/index.js';

const logger = createChildLogger('skill-call-analyzer');

interface AnalyzerResponsePayload {
  should_patch?: unknown;
  change_type?: unknown;
  target_section?: unknown;
  reason?: unknown;
  confidence?: unknown;
  pattern?: unknown;
  evidence?: unknown;
}

export interface SkillCallAnalysisResult {
  success: boolean;
  evaluation?: EvaluationResult;
  model: string;
  error?: string;
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

function truncate(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength)}...`;
}

function summarizeTrace(trace: Trace, lang: Language): string {
  const isZh = lang === 'zh';
  if (trace.event_type === 'user_input' && trace.user_input) {
    return isZh ? `用户输入: ${truncate(trace.user_input, 220)}` : `user_input: ${truncate(trace.user_input, 220)}`;
  }
  if (trace.event_type === 'assistant_output' && trace.assistant_output) {
    return isZh
      ? `助手输出: ${truncate(trace.assistant_output, 220)}`
      : `assistant_output: ${truncate(trace.assistant_output, 220)}`;
  }
  if (trace.event_type === 'tool_call') {
    return isZh
      ? `工具调用: ${trace.tool_name || 'unknown'} ${truncate(JSON.stringify(trace.tool_args || {}), 180)}`
      : `tool_call: ${trace.tool_name || 'unknown'} ${truncate(JSON.stringify(trace.tool_args || {}), 180)}`;
  }
  if (trace.event_type === 'tool_result') {
    return isZh
      ? `工具结果: ${trace.tool_name || 'unknown'} ${truncate(JSON.stringify(trace.tool_result || {}), 180)}`
      : `tool_result: ${trace.tool_name || 'unknown'} ${truncate(JSON.stringify(trace.tool_result || {}), 180)}`;
  }
  if (trace.event_type === 'file_change') {
    return isZh
      ? `文件变更: ${truncate(JSON.stringify(trace.files_changed || []), 180)}`
      : `file_change: ${truncate(JSON.stringify(trace.files_changed || []), 180)}`;
  }
  return isZh ? `${trace.event_type}: 状态=${trace.status}` : `${trace.event_type}: status=${trace.status}`;
}

function buildPrompt(
  window: SkillCallWindow,
  skillContent: string,
  lang: Language
): { systemPrompt: string; userPrompt: string } {
  const isZh = lang === 'zh';
  const systemPrompt = isZh
    ? [
        '你是 Ornn 的 skill 调用分析器。',
        '你的任务是分析一个已经结束的 skill 调用窗口，并判断 skill 本身是否需要被修改。',
        '你必须基于完整调用窗口推理，不能只看重复关键词。',
        '除非证据非常明确，否则不要把运行时故障、工具故障误判成 skill 设计问题。',
        '如果证据不足，返回 should_patch=false。',
        '只返回 JSON，字段固定为 should_patch, change_type, target_section, reason, confidence, pattern, evidence。',
        `允许的 change_type 只有: ${ALLOWED_CHANGE_TYPES.join(', ')}，或者 null。`,
        'confidence 必须是 0 到 1 之间的数字。',
        'pattern 应该是可供 patch 生成器锚定的短语；如果没有就返回 null。',
        'evidence 必须是从时间线摘出的简短事实要点，自然语言内容必须使用简体中文。',
      ].join('\n')
    : [
        'You are Ornn\'s skill-call analyzer.',
        'Your job is to analyze one finalized skill call window and decide whether the skill itself should be patched.',
        'You must reason over the whole call window, not just repeated keywords.',
        'Do not confuse runtime/tool failures with skill design issues unless the evidence clearly supports that conclusion.',
        'If evidence is insufficient, return should_patch=false.',
        'Return only JSON with keys: should_patch, change_type, target_section, reason, confidence, pattern, evidence.',
        `Allowed change_type values: ${ALLOWED_CHANGE_TYPES.join(', ')}, or null.`,
        'confidence must be a number between 0 and 1.',
        'pattern should be a short phrase that patch generation can anchor on when applicable; otherwise null.',
        'evidence must be an array of short factual bullets quoted from the window timeline.',
      ].join('\n');

  const userPrompt = isZh
    ? [
        `Skill ID: ${window.skillId}`,
        `运行时: ${window.runtime}`,
        `窗口 ID: ${window.windowId}`,
        `关闭原因: ${window.closeReason}`,
        `开始时间: ${window.startedAt}`,
        `最后一条 Trace 时间: ${window.lastTraceAt}`,
        `Trace 数量: ${window.traces.length}`,
        '',
        '当前 Skill 内容:',
        '```markdown',
        skillContent,
        '```',
        '',
        '时间线:',
        ...window.traces.map((trace: Trace, index: number) => `${index + 1}. [${trace.timestamp}] ${summarizeTrace(trace, lang)}`),
        '',
        '分析请求:',
        '- 判断这个 skill 调用窗口是否说明当前 skill 需要修改。',
        '- 如果需要修改，请在 reason 中说明具体缺失的指引或噪音段落。',
        '- 只有在确实应该修改时才选择最合适的 change_type。',
        '- 如果问题不能明确归因于 skill，请返回 should_patch=false。',
      ].join('\n')
    : [
        `Skill ID: ${window.skillId}`,
        `Runtime: ${window.runtime}`,
        `Window ID: ${window.windowId}`,
        `Close Reason: ${window.closeReason}`,
        `Started At: ${window.startedAt}`,
        `Last Trace At: ${window.lastTraceAt}`,
        `Trace Count: ${window.traces.length}`,
        '',
        'Current Skill Content:',
        '```markdown',
        skillContent,
        '```',
        '',
        'Window Timeline:',
        ...window.traces.map((trace: Trace, index: number) => `${index + 1}. [${trace.timestamp}] ${summarizeTrace(trace, lang)}`),
        '',
        'Decision request:',
        '- Determine whether the skill should be patched for this call window.',
        '- Explain the concrete missing instruction or noisy section in reason.',
        '- Choose the best change_type only if patching is justified.',
        '- If the issue is not clearly caused by the skill, set should_patch=false.',
      ].join('\n');

  return { systemPrompt, userPrompt };
}

function extractJsonObject(raw: string): string | null {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start >= 0 && end > start) return raw.slice(start, end + 1);
  return null;
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

function parseEvaluationPayload(
  payload: AnalyzerResponsePayload,
  window: SkillCallWindow,
  lang: Language
): EvaluationResult {
  const shouldPatch = Boolean(payload.should_patch);
  const changeType = normalizeChangeType(payload.change_type);
  const targetSection = typeof payload.target_section === 'string' && payload.target_section.trim()
    ? payload.target_section.trim()
    : undefined;
  const reason = typeof payload.reason === 'string' && payload.reason.trim()
    ? payload.reason.trim()
    : (lang === 'zh' ? 'Agent 分析没有返回明确理由。' : 'Agent analysis did not provide a reason.');
  const confidence = normalizeConfidence(payload.confidence);
  const pattern = typeof payload.pattern === 'string' && payload.pattern.trim()
    ? payload.pattern.trim()
    : undefined;
  const evidence = normalizeEvidence(payload.evidence);

  return {
    should_patch: shouldPatch,
    change_type: shouldPatch ? changeType : undefined,
    reason,
    source_sessions: [window.sessionId],
    confidence,
    target_section: targetSection,
    rule_name: 'agent_call_window_analysis',
    patch_context: {
      pattern,
      reason: evidence.length > 0 ? evidence.join(' | ') : reason,
      section: targetSection,
    },
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

    if (!activeProvider || !activeProvider.apiKey) {
      logger.warn('Skill call analysis blocked: provider not configured', {
        projectPath,
        windowId: window.windowId,
        skillId: window.skillId,
      });
      return {
        success: false,
        model: 'none',
        error: 'provider_not_configured',
        tokenUsage: {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
        },
      };
    }

    const client = createLiteLLMClient({
      provider: activeProvider.provider,
      modelName: activeProvider.modelName,
      apiKey: activeProvider.apiKey,
      maxTokens: 1400,
    });
    const prompt = buildPrompt(window, skillContent, lang);
    const model = `${activeProvider.provider}/${activeProvider.modelName}`;
    const started = Date.now();

    try {
      const raw = await client.completion({
        prompt: prompt.userPrompt,
        systemPrompt: prompt.systemPrompt,
        temperature: 0.1,
        maxTokens: 1400,
        timeout: 45000,
        responseFormat: 'json_object',
      });
      const usage = client.getTokenUsage();
      recordAgentUsage(projectPath, {
        scope: 'skill_call_analyzer',
        eventId: window.windowId,
        skillId: window.skillId,
        model,
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        totalTokens: usage.totalTokens,
        durationMs: Date.now() - started,
      });
      const jsonText = extractJsonObject(raw);
      if (!jsonText) {
        logger.warn('Skill call analysis failed to return JSON', {
          projectPath,
          windowId: window.windowId,
          skillId: window.skillId,
          model,
        });
        return {
          success: false,
          model,
          error: 'invalid_analysis_json',
          tokenUsage: usage,
        };
      }

      const payload = JSON.parse(jsonText) as AnalyzerResponsePayload;
      const evaluation = parseEvaluationPayload(payload, window, lang);
      logger.info('Skill call analysis completed', {
        projectPath,
        windowId: window.windowId,
        skillId: window.skillId,
        model,
        shouldPatch: evaluation.should_patch,
        changeType: evaluation.change_type ?? null,
        confidence: evaluation.confidence,
        totalTokens: usage.totalTokens,
      });
      return {
        success: true,
        evaluation,
        model,
        tokenUsage: usage,
      };
    } catch (error) {
      const usage = client.getTokenUsage();
      logger.error('Skill call analysis failed', {
        projectPath,
        windowId: window.windowId,
        skillId: window.skillId,
        model,
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        success: false,
        model,
        error: error instanceof Error ? error.message : String(error),
        tokenUsage: usage,
      };
    }
  }
}

export function createSkillCallAnalyzer(): SkillCallAnalyzer {
  return new SkillCallAnalyzer();
}
