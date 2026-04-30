import type { DecisionEventRecord } from '../core/decision-events/index.js';
import { filterEpisodeWindowTraces, type TaskEpisode } from '../core/task-episode/index.js';
import { buildTraceTimelineText, summarizeTraceForTimeline } from '../core/trace-summary/index.js';
import type { Language } from './i18n.js';
import type { AgentUsageRecord, Trace } from '../types/index.js';

export type ActivityScopeStatus = 'observing' | 'optimized' | 'no_optimization';

export interface ActivityScopeSummary {
  scopeId: string;
  createdAt: string;
  updatedAt: string;
  skillId: string | null;
  runtime: string | null;
  projectName: string;
  status: ActivityScopeStatus;
  sessionId: string | null;
}

export interface ActivityScopeTimelineNode {
  id: string;
  type: 'skill_called' | 'analysis_submitted' | 'analysis_result' | 'optimization_completed' | 'no_optimization';
  timestamp: string;
  summary: string;
  model?: string | null;
  traceCount?: number | null;
  charCount?: number | null;
  traceText?: string | null;
  outcome?: 'need_more_context' | 'apply_optimization' | 'no_optimization' | null;
}

export interface ActivityScopeDetail extends ActivityScopeSummary {
  timeline: ActivityScopeTimelineNode[];
}

interface BuildActivityScopeSummaryInput {
  projectName: string;
  episodes: TaskEpisode[];
  decisionEvents: DecisionEventRecord[];
}

interface BuildActivityScopeDetailInput {
  lang: Language;
  projectName: string;
  episode: TaskEpisode;
  decisionEvents: DecisionEventRecord[];
  agentUsageRecords: AgentUsageRecord[];
  traces: Trace[];
}

function getEpisodePrimarySkillId(episode: TaskEpisode): string | null {
  return episode.skillSegments[0]?.skillId ?? null;
}

function getEpisodePrimaryRuntime(episode: TaskEpisode): string | null {
  return episode.skillSegments[0]?.runtime ?? episode.runtime ?? null;
}

function getEpisodePrimarySessionId(episode: TaskEpisode): string | null {
  return episode.sessionIds[0] ?? null;
}

function eventBelongsToEpisode(event: DecisionEventRecord, episode: TaskEpisode): boolean {
  if (event.episodeId && event.episodeId === episode.episodeId) {
    return true;
  }

  const skillId = getEpisodePrimarySkillId(episode);
  if (event.skillId && skillId && event.skillId !== skillId) {
    return false;
  }
  if (event.sessionId && !episode.sessionIds.includes(event.sessionId)) {
    return false;
  }
  if (event.traceId && episode.traceRefs.includes(event.traceId)) {
    return true;
  }
  if (!event.timestamp) {
    return false;
  }
  return event.timestamp >= episode.startedAt && event.timestamp <= episode.lastActivityAt;
}

function sortByTimestampAsc<T extends { timestamp?: string | null }>(items: T[]): T[] {
  return [...items].sort((a, b) => String(a.timestamp || '').localeCompare(String(b.timestamp || '')));
}

function getEpisodeEvents(episode: TaskEpisode, decisionEvents: DecisionEventRecord[]): DecisionEventRecord[] {
  return sortByTimestampAsc(decisionEvents.filter((event) => eventBelongsToEpisode(event, episode)));
}

function isTerminalNoOptimizationStatus(status: string | null | undefined): boolean {
  return status === 'no_patch_needed' ||
    status === 'cooldown' ||
    status === 'daily_limit_reached' ||
    status === 'frozen' ||
    status === 'confidence_too_low';
}

function deriveScopeStatus(
  episode: TaskEpisode,
  events: DecisionEventRecord[],
): { status: ActivityScopeStatus | null; updatedAt: string } {
  const patchApplied = [...events].reverse().find((event) => event.tag === 'patch_applied');
  if (patchApplied) {
    return {
      status: 'optimized',
      updatedAt: patchApplied.timestamp || episode.lastActivityAt,
    };
  }

  const noOptimization = [...events].reverse().find((event) =>
    event.tag === 'evaluation_result' && isTerminalNoOptimizationStatus(event.status)
  );
  if (noOptimization) {
    return {
      status: 'no_optimization',
      updatedAt: noOptimization.timestamp || episode.lastActivityAt,
    };
  }

  const analysisFailed = [...events].reverse().find((event) => event.tag === 'analysis_failed');
  if (analysisFailed || episode.analysisStatus === 'failed') {
    return {
      status: 'observing',
      updatedAt: analysisFailed?.timestamp || episode.lastActivityAt,
    };
  }

  return {
    status: 'observing',
    updatedAt: episode.lastActivityAt,
  };
}

function buildSubmittedTraceText(traces: Trace[], lang: Language): string {
  return buildTraceTimelineText(traces, lang);
}

function findAnalyzerUsageForEvent(
  episode: TaskEpisode,
  event: DecisionEventRecord,
  records: AgentUsageRecord[],
): AgentUsageRecord | null {
  const relevant = records
    .filter((record) => record.scope === 'skill_call_analyzer')
    .filter((record) => !record.skillId || record.skillId === getEpisodePrimarySkillId(episode))
    .filter((record) => {
      if (record.episodeId && record.episodeId === episode.episodeId) {
        if (!record.triggerTraceId || !event.traceId || record.triggerTraceId === event.traceId) {
          return true;
        }
      }
      if (record.triggerTraceId && event.traceId && record.triggerTraceId === event.traceId) {
        return true;
      }
      const recordWindowId = record.windowId || record.eventId;
      return Boolean(event.windowId && recordWindowId && event.windowId === recordWindowId);
    })
    .sort((a, b) => {
      const eventTime = new Date(event.timestamp || '').getTime();
      const deltaA = Math.abs(new Date(a.timestamp).getTime() - eventTime);
      const deltaB = Math.abs(new Date(b.timestamp).getTime() - eventTime);
      return deltaA - deltaB;
    });

  return relevant[0] ?? null;
}

function buildAnalysisResultNode(
  event: DecisionEventRecord,
  fallbackSummary: string,
): ActivityScopeTimelineNode {
  const summary = String(event.reason || event.detail || fallbackSummary || '').trim();
  const outcome = isTerminalNoOptimizationStatus(event.status)
    ? 'no_optimization'
    : event.status === 'continue_collecting'
    ? 'need_more_context'
    : 'no_optimization';

  return {
    id: `analysis-result:${event.id}`,
    type: 'analysis_result',
    timestamp: event.timestamp || '',
    summary,
    outcome,
  };
}

function buildAnalysisFailedNode(event: DecisionEventRecord): ActivityScopeTimelineNode {
  const summary = String(event.detail || event.judgment || event.reason || '').trim();
  return {
    id: `analysis-failed:${event.id}`,
    type: 'analysis_result',
    timestamp: event.timestamp || '',
    summary,
    outcome: null,
  };
}

function buildCloseSummary(kind: 'no_optimization' | 'optimization_completed', lang: Language): string {
  if (lang === 'zh') {
    return kind === 'no_optimization'
      ? '本轮已判定无需优化，当前 scope 已关闭。'
      : '本轮优化已执行完成，当前 scope 已关闭。';
  }
  return kind === 'no_optimization'
    ? 'This scope is now closed because the current window was concluded as no optimization needed.'
    : 'This scope is now closed because the optimization for the current window has completed.';
}

function buildTraceLookup(traces: Trace[]): Map<string, Trace> {
  const lookup = new Map<string, Trace>();
  for (const trace of traces) {
    lookup.set(trace.trace_id, trace);
  }
  return lookup;
}

function buildEpisodeTraces(episode: TaskEpisode, traces: Trace[]): Trace[] {
  return filterEpisodeWindowTraces(episode, traces);
}

export function buildActivityScopeSummariesFromData(
  input: BuildActivityScopeSummaryInput,
): ActivityScopeSummary[] {
  return input.episodes
    .map((episode) => {
      const events = getEpisodeEvents(episode, input.decisionEvents);
      const derived = deriveScopeStatus(episode, events);
      if (!derived.status) {
        return null;
      }
      return {
        scopeId: episode.episodeId,
        createdAt: episode.startedAt,
        updatedAt: derived.updatedAt,
        skillId: getEpisodePrimarySkillId(episode),
        runtime: getEpisodePrimaryRuntime(episode),
        projectName: input.projectName,
        status: derived.status,
        sessionId: getEpisodePrimarySessionId(episode),
      } satisfies ActivityScopeSummary;
    })
    .filter((item): item is ActivityScopeSummary => Boolean(item))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export function buildActivityScopeDetailFromData(
  input: BuildActivityScopeDetailInput,
): ActivityScopeDetail | null {
  const events = getEpisodeEvents(input.episode, input.decisionEvents);
  const derived = deriveScopeStatus(input.episode, events);
  if (!derived.status) {
    return null;
  }

  const episodeTraces = buildEpisodeTraces(input.episode, input.traces);
  const traceLookup = buildTraceLookup(episodeTraces);
  const firstMappedTraceId = input.episode.skillSegments[0]?.firstMappedTraceId || input.episode.traceRefs[0];
  const firstTrace = firstMappedTraceId ? traceLookup.get(firstMappedTraceId) : episodeTraces[0];
  const timeline: ActivityScopeTimelineNode[] = [];

  if (firstTrace) {
    timeline.push({
      id: `skill-called:${firstTrace.trace_id}`,
      type: 'skill_called',
      timestamp: firstTrace.timestamp,
      summary: summarizeTraceForTimeline(firstTrace, input.lang),
    });
  }

  const analysisRequestedEvents = events.filter((event) => event.tag === 'analysis_requested');
  for (let index = 0; index < analysisRequestedEvents.length; index += 1) {
    const analysisEvent = analysisRequestedEvents[index];
    const nextRequested = analysisRequestedEvents[index + 1];
    const submissionTraces = episodeTraces.filter((trace) =>
      trace.timestamp >= input.episode.startedAt &&
      trace.timestamp <= (analysisEvent.timestamp || '')
    );
    const traceText = buildSubmittedTraceText(submissionTraces, input.lang);
    const usage = findAnalyzerUsageForEvent(input.episode, analysisEvent, input.agentUsageRecords);

    timeline.push({
      id: `analysis-submitted:${analysisEvent.id}`,
      type: 'analysis_submitted',
      timestamp: analysisEvent.timestamp || '',
      summary: String(analysisEvent.detail || analysisEvent.judgment || '').trim(),
      model: usage?.model ?? null,
      traceCount: analysisEvent.traceCount ?? submissionTraces.length,
      charCount: traceText.length,
      traceText,
    });

    const windowEnd = nextRequested?.timestamp || '9999-12-31T23:59:59.999Z';
    const followupEvents = events.filter((event) =>
      event.timestamp &&
      event.timestamp > (analysisEvent.timestamp || '') &&
      event.timestamp < windowEnd
    );

    const evaluationResult = followupEvents.find((event) => event.tag === 'evaluation_result');
    if (evaluationResult) {
      timeline.push(buildAnalysisResultNode(
        evaluationResult,
        String(evaluationResult.detail || evaluationResult.judgment || '').trim(),
      ));
      if (isTerminalNoOptimizationStatus(evaluationResult.status)) {
        timeline.push({
          id: `no-optimization:${evaluationResult.id}`,
          type: 'no_optimization',
          timestamp: evaluationResult.timestamp || '',
          summary: buildCloseSummary('no_optimization', input.lang),
        });
      }
      continue;
    }

    const analysisFailed = followupEvents.find((event) => event.tag === 'analysis_failed');
    if (analysisFailed) {
      timeline.push(buildAnalysisFailedNode(analysisFailed));
      continue;
    }

    const patchApplied = followupEvents.find((event) => event.tag === 'patch_applied');
    if (patchApplied) {
      timeline.push({
        id: `analysis-result:${patchApplied.id}`,
        type: 'analysis_result',
        timestamp: patchApplied.timestamp || '',
        summary: String(patchApplied.reason || patchApplied.detail || '').trim(),
        outcome: 'apply_optimization',
      });
      timeline.push({
        id: `optimization-completed:${patchApplied.id}`,
        type: 'optimization_completed',
        timestamp: patchApplied.timestamp || '',
        summary: buildCloseSummary('optimization_completed', input.lang),
      });
    }
  }

  return {
    scopeId: input.episode.episodeId,
    createdAt: input.episode.startedAt,
    updatedAt: derived.updatedAt,
    skillId: getEpisodePrimarySkillId(input.episode),
    runtime: getEpisodePrimaryRuntime(input.episode),
    projectName: input.projectName,
    status: derived.status,
    sessionId: getEpisodePrimarySessionId(input.episode),
    timeline,
  };
}
