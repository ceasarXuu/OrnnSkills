import { createChildLogger } from '../../utils/logger.js';
import { createLiteLLMClient } from '../../llm/litellm-client.js';
import { readDashboardConfig } from '../../config/manager.js';
import { recordAgentUsage } from '../agent-usage/index.js';
import { readProjectLanguage } from '../../dashboard/language-state.js';
import type { Language } from '../../dashboard/i18n.js';
import type { Trace } from '../../types/index.js';
import type { ReadinessProbeResult, TaskEpisode, TaskEpisodeSkillSegment } from '../task-episode/index.js';

const logger = createChildLogger('readiness-probe');

interface ProbeResponsePayload {
  decision?: unknown;
  reason?: unknown;
  observed_outcomes?: unknown;
  missing_evidence?: unknown;
  next_probe_hint?: unknown;
  episode_action?: unknown;
  skill_focus?: unknown;
}

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

function buildFallbackProbeResult(episode: TaskEpisode, traces: Trace[]): ReadinessProbeResult {
  return {
    decision: traces.length >= 60 ? 'ready_for_analysis' : 'continue_collecting',
    reason: traces.length >= 60
      ? 'Fallback threshold reached by trace count.'
      : 'Need more traces before deep analysis.',
    observedOutcomes: [],
    missingEvidence: [],
    nextProbeHint: {
      suggestedTraceDelta: Math.max(10, Math.ceil(traces.length * 0.3)),
      suggestedTurnDelta: 2,
      waitForEventTypes: [],
      mode: 'count_driven',
    },
    episodeAction: {
      closeCurrent: false,
      openNew: false,
    },
    skillFocus: episode.skillSegments.map((segment: TaskEpisodeSkillSegment) => segment.skillId),
  };
}

function buildPrompt(
  episode: TaskEpisode,
  traces: Trace[],
  lang: Language
): { systemPrompt: string; userPrompt: string } {
  const isZh = lang === 'zh';
  const systemPrompt = isZh
    ? [
        '你是 Ornn 的 readiness probe 分析器。',
        '你的任务是判断当前任务窗口是否已经收集到足够的 trace，可以进入深度 skill 优化分析。',
        '你必须关注“是否有足够证据支持开始分析”，而不是直接判断 skill 是否有问题。',
        '不要虚构用户意图、结果或缺失证据。',
        '只返回 JSON，字段固定为 decision, reason, observed_outcomes, missing_evidence, next_probe_hint, episode_action, skill_focus。',
        'decision 只能是: continue_collecting, ready_for_analysis, pause_waiting, close_no_action, split_episode。',
        '如果提供 next_probe_hint.mode，只能是 count_driven 或 event_driven。',
        'episode_action.close_current 和 episode_action.open_new 必须是布尔值。',
        '所有自然语言字段必须使用简体中文。',
      ].join('\n')
    : [
        'You are Ornn\'s readiness probe analyzer.',
        'Your task is to decide whether the current task window has enough trace evidence to start deep skill optimization analysis.',
        'Focus on readiness for deeper analysis, not on whether the skill is already broken.',
        'Do not invent user intent, outcomes, or missing evidence.',
        'Return only JSON with keys: decision, reason, observed_outcomes, missing_evidence, next_probe_hint, episode_action, skill_focus.',
        'decision must be one of: continue_collecting, ready_for_analysis, pause_waiting, close_no_action, split_episode.',
        'next_probe_hint.mode must be count_driven or event_driven when provided.',
        'episode_action.close_current and episode_action.open_new must be booleans.',
      ].join('\n');

  const userPrompt = isZh
    ? [
        `Episode ID: ${episode.episodeId}`,
        `运行时: ${episode.runtime}`,
        `Session 数: ${episode.sessionIds.length}`,
        `当前状态: ${episode.state}`,
        `开始时间: ${episode.startedAt}`,
        `最后活动时间: ${episode.lastActivityAt}`,
        `Trace 数量: ${episode.stats.totalTraceCount}`,
        `Turn 数量: ${episode.stats.totalTurnCount}`,
        `已映射 Trace 数量: ${episode.stats.mappedTraceCount}`,
        `Probe 次数: ${episode.probeState.probeCount}`,
        `当前 Probe 模式: ${episode.probeState.mode}`,
        `当前 Trace 增量阈值: ${episode.probeState.nextProbeTraceDelta}`,
        `当前 Turn 增量阈值: ${episode.probeState.nextProbeTurnDelta}`,
        `涉及 Skill: ${episode.skillSegments.map((segment: TaskEpisodeSkillSegment) => segment.skillId).join(', ') || 'none'}`,
        '',
        '最近时间线:',
        ...traces.slice(-40).map((trace: Trace, index: number) => `${index + 1}. [${trace.timestamp}] ${summarizeTrace(trace, lang)}`),
        '',
        '请判断 Ornn 应该继续收集 trace、暂停等待更好的事件、关闭当前窗口、拆分成新窗口，还是现在就启动深度优化分析。',
      ].join('\n')
    : [
        `Episode ID: ${episode.episodeId}`,
        `Runtime: ${episode.runtime}`,
        `Session Count: ${episode.sessionIds.length}`,
        `Current State: ${episode.state}`,
        `Started At: ${episode.startedAt}`,
        `Last Activity At: ${episode.lastActivityAt}`,
        `Trace Count: ${episode.stats.totalTraceCount}`,
        `Turn Count: ${episode.stats.totalTurnCount}`,
        `Mapped Trace Count: ${episode.stats.mappedTraceCount}`,
        `Probe Count: ${episode.probeState.probeCount}`,
        `Current Probe Mode: ${episode.probeState.mode}`,
        `Current Probe Trace Delta: ${episode.probeState.nextProbeTraceDelta}`,
        `Current Probe Turn Delta: ${episode.probeState.nextProbeTurnDelta}`,
        `Tracked Skills: ${episode.skillSegments.map((segment: TaskEpisodeSkillSegment) => segment.skillId).join(', ') || 'none'}`,
        '',
        'Recent Timeline:',
        ...traces.slice(-40).map((trace: Trace, index: number) => `${index + 1}. [${trace.timestamp}] ${summarizeTrace(trace, lang)}`),
        '',
        'Decide whether Ornn should keep collecting traces, pause and wait for a better event, close without action, split into a new episode, or start deep optimization analysis now.',
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

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

function normalizeProbeDecision(value: unknown): ReadinessProbeResult['decision'] {
  switch (value) {
    case 'ready_for_analysis':
    case 'pause_waiting':
    case 'close_no_action':
    case 'split_episode':
      return value;
    default:
      return 'continue_collecting';
  }
}

function normalizeNextProbeHint(value: unknown, fallback: ReadinessProbeResult): ReadinessProbeResult['nextProbeHint'] {
  const source = (value && typeof value === 'object') ? value as Record<string, unknown> : {};
  return {
    suggestedTraceDelta:
      typeof source.suggested_trace_delta === 'number'
        ? source.suggested_trace_delta
        : fallback.nextProbeHint.suggestedTraceDelta,
    suggestedTurnDelta:
      typeof source.suggested_turn_delta === 'number'
        ? source.suggested_turn_delta
        : fallback.nextProbeHint.suggestedTurnDelta,
    waitForEventTypes: normalizeStringArray(source.wait_for_event_types),
    mode:
      source.mode === 'event_driven' || source.mode === 'count_driven'
        ? source.mode
        : fallback.nextProbeHint.mode,
  };
}

function normalizeEpisodeAction(value: unknown): ReadinessProbeResult['episodeAction'] {
  const source = (value && typeof value === 'object') ? value as Record<string, unknown> : {};
  return {
    closeCurrent: Boolean(source.close_current),
    openNew: Boolean(source.open_new),
  };
}

function parseProbePayload(payload: ProbeResponsePayload, fallback: ReadinessProbeResult): ReadinessProbeResult {
  return {
    decision: normalizeProbeDecision(payload.decision),
    reason: typeof payload.reason === 'string' && payload.reason.trim() ? payload.reason.trim() : fallback.reason,
    observedOutcomes: normalizeStringArray(payload.observed_outcomes),
    missingEvidence: normalizeStringArray(payload.missing_evidence),
    nextProbeHint: normalizeNextProbeHint(payload.next_probe_hint, fallback),
    episodeAction: normalizeEpisodeAction(payload.episode_action),
    skillFocus: normalizeStringArray(payload.skill_focus),
  };
}

export class ReadinessProbeAnalyzer {
  async probeEpisode(projectPath: string, episode: TaskEpisode, traces: Trace[]): Promise<ReadinessProbeResult> {
    const fallback = buildFallbackProbeResult(episode, traces);
    const lang = await readProjectLanguage(projectPath, 'en');
    const config = await readDashboardConfig(projectPath);
    const activeProvider = config.providers[0];

    if (!activeProvider || !activeProvider.apiKey) {
      return fallback;
    }

    const client = createLiteLLMClient({
      provider: activeProvider.provider,
      modelName: activeProvider.modelName,
      apiKey: activeProvider.apiKey,
      maxTokens: 900,
    });
    const prompt = buildPrompt(episode, traces, lang);
    const model = `${activeProvider.provider}/${activeProvider.modelName}`;
    const started = Date.now();

    try {
      const raw = await client.completion({
        prompt: prompt.userPrompt,
        systemPrompt: prompt.systemPrompt,
        temperature: 0.1,
        maxTokens: 900,
        timeout: 30000,
        responseFormat: 'json_object',
      });
      const usage = client.getTokenUsage();
      recordAgentUsage(projectPath, {
        scope: 'readiness_probe',
        eventId: episode.episodeId,
        skillId: episode.skillSegments[0]?.skillId ?? null,
        model,
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        totalTokens: usage.totalTokens,
        durationMs: Date.now() - started,
      });
      const jsonText = extractJsonObject(raw);
      if (!jsonText) {
        logger.warn('Readiness probe failed to return JSON', {
          projectPath,
          episodeId: episode.episodeId,
          model,
        });
        return fallback;
      }
      const payload = JSON.parse(jsonText) as ProbeResponsePayload;
      return parseProbePayload(payload, fallback);
    } catch (error) {
      logger.warn('Readiness probe failed, using fallback', {
        projectPath,
        episodeId: episode.episodeId,
        error: error instanceof Error ? error.message : String(error),
      });
      return fallback;
    }
  }
}

export function createReadinessProbeAnalyzer(): ReadinessProbeAnalyzer {
  return new ReadinessProbeAnalyzer();
}
