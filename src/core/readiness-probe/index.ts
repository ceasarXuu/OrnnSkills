import { createChildLogger } from '../../utils/logger.js';
import { createLiteLLMClient } from '../../llm/litellm-client.js';
import { readDashboardConfig } from '../../config/manager.js';
import { buildAgentUsageModelId, recordAgentUsage } from '../agent-usage/index.js';
import { readProjectLanguage } from '../../dashboard/language-state.js';
import type { Language } from '../../dashboard/i18n.js';
import { normalizeNarrativeArray, normalizeNarrativeString } from '../llm-localization/index.js';
import { getReadinessProbeBaseSystemPrompt } from '../prompt-defaults.js';
import { appendProjectPromptOverride } from '../prompt-overrides.js';
import { buildTraceTimelineText } from '../trace-summary/index.js';
import { extractJsonObject } from '../../utils/json-response.js';
import type { Trace } from '../../types/index.js';
import type {
  ReadinessProbeResult,
  TaskEpisode,
  TaskEpisodeSkillSegment,
} from '../task-episode/index.js';

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

function buildFallbackProbeResult(
  episode: TaskEpisode,
  traces: Trace[],
  lang: Language
): ReadinessProbeResult {
  const readyReason =
    lang === 'zh'
      ? '当前窗口已经积累到足够的 trace 数量，可以进入深度分析。'
      : 'Fallback threshold reached by trace count.';
  const waitReason =
    lang === 'zh'
      ? '当前 trace 仍然偏少，还需要继续收集上下文。'
      : 'Need more traces before deep analysis.';
  return {
    decision: traces.length >= 60 ? 'ready_for_analysis' : 'continue_collecting',
    reason: traces.length >= 60 ? readyReason : waitReason,
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
  lang: Language,
  promptOverride: string
): { systemPrompt: string; userPrompt: string } {
  const isZh = lang === 'zh';
  const baseSystemPrompt = getReadinessProbeBaseSystemPrompt(lang);
  const systemPrompt = appendProjectPromptOverride(baseSystemPrompt, promptOverride, lang);

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
        ...buildTraceTimelineText(traces.slice(-40), lang).split('\n'),
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
        ...buildTraceTimelineText(traces.slice(-40), lang).split('\n'),
        '',
        'Decide whether Ornn should keep collecting traces, pause and wait for a better event, close without action, split into a new episode, or start deep optimization analysis now.',
      ].join('\n');

  return { systemPrompt, userPrompt };
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

function normalizeNextProbeHint(
  value: unknown,
  fallback: ReadinessProbeResult
): ReadinessProbeResult['nextProbeHint'] {
  const source = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
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
  const source = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return {
    closeCurrent: Boolean(source.close_current),
    openNew: Boolean(source.open_new),
  };
}

function parseProbePayload(
  payload: ProbeResponsePayload,
  fallback: ReadinessProbeResult,
  lang: Language
): ReadinessProbeResult {
  return {
    decision: normalizeProbeDecision(payload.decision),
    reason: normalizeNarrativeString(payload.reason, fallback.reason, lang),
    observedOutcomes: normalizeNarrativeArray(
      payload.observed_outcomes,
      fallback.observedOutcomes,
      lang
    ),
    missingEvidence: normalizeNarrativeArray(
      payload.missing_evidence,
      fallback.missingEvidence,
      lang
    ),
    nextProbeHint: normalizeNextProbeHint(payload.next_probe_hint, fallback),
    episodeAction: normalizeEpisodeAction(payload.episode_action),
    skillFocus: normalizeNarrativeArray(payload.skill_focus, fallback.skillFocus, lang),
  };
}

export class ReadinessProbeAnalyzer {
  async probeEpisode(
    projectPath: string,
    episode: TaskEpisode,
    traces: Trace[]
  ): Promise<ReadinessProbeResult> {
    const lang = await readProjectLanguage(projectPath, 'en');
    const fallback = buildFallbackProbeResult(episode, traces, lang);
    const config = await readDashboardConfig(projectPath);
    const activeProvider = config.providers[0];
    const promptOverride = config.promptOverrides?.readinessProbe || '';

    if (!activeProvider || !activeProvider.apiKey) {
      return fallback;
    }

    if (promptOverride.trim()) {
      logger.info('Applying readiness probe prompt override', {
        projectPath,
        episodeId: episode.episodeId,
        overrideLength: promptOverride.trim().length,
      });
    }

    const client = createLiteLLMClient({
      provider: activeProvider.provider,
      modelName: activeProvider.modelName,
      apiKey: activeProvider.apiKey,
      maxTokens: 900,
    });
    const prompt = buildPrompt(episode, traces, lang, promptOverride);
    const model = buildAgentUsageModelId(activeProvider.provider, activeProvider.modelName);
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
      return parseProbePayload(payload, fallback, lang);
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
