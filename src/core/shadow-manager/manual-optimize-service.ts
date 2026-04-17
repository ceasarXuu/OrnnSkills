import {
  buildActivityEventContext,
  buildAnalysisFailedEvent,
  type ActivityEventContext,
} from '../activity-event-builder/index.js';
import { createChildLogger } from '../../utils/logger.js';
import { runtimeFromShadowId, skillIdFromShadowId } from '../../utils/parse.js';
import type { TaskEpisode } from '../task-episode/index.js';
import type {
  DaemonStatusLike,
  DecisionEventsLike,
  EpisodeProbeServiceLike,
  ManualOptimizationScope,
  TaskEpisodeStoreLike,
  TraceManagerLike,
  TraceSkillMapperLike,
  TriggerOptimizeResult,
} from './shadow-manager-types.js';
import type { RuntimeType, Trace } from '../../types/index.js';

const logger = createChildLogger('shadow-manual-optimize-service');
const MANUAL_OPTIMIZE_RECENT_TRACE_LIMIT = 200;

export class ShadowManualOptimizeService {
  constructor(
    private readonly options: {
      projectRoot: string;
      traceManager: Pick<TraceManagerLike, 'getSessionTraces' | 'getRecentTraces'>;
      traceSkillMapper: Pick<TraceSkillMapperLike, 'mapTrace'>;
      taskEpisodes: Pick<TaskEpisodeStoreLike, 'listEpisodes'>;
      decisionEvents: DecisionEventsLike;
      daemonStatus: Pick<DaemonStatusLike, 'setError'>;
      episodeProbeService: Pick<EpisodeProbeServiceLike, 'analyzeManualScope'>;
    }
  ) {}

  async triggerOptimize(shadowId: string): Promise<TriggerOptimizeResult> {
    const skillId = skillIdFromShadowId(shadowId) ?? shadowId.split('@')[0];
    const scope = await this.resolveManualOptimizationScope(shadowId);
    const eventContext = scope?.context ?? this.buildFallbackManualContext(shadowId);

    if (!scope) {
      logger.warn('Manual optimization aborted because no scoped window could be resolved', {
        shadowId,
        skillId: eventContext.skillId,
        runtime: eventContext.runtime,
      });
      this.options.daemonStatus.setError(
        eventContext.skillId,
        '当前没有可复用的真实调用窗口，无法手动触发优化。'
      );
      this.options.decisionEvents.record(buildAnalysisFailedEvent({
        context: eventContext,
        detail: '当前没有可复用的真实调用窗口，无法手动触发优化。',
        evaluation: null,
        reason: 'missing_window_scope',
      }));
      return {
        kind: 'missing_window',
        evaluation: null,
        detail: '当前没有可复用的真实调用窗口，无法手动触发优化。',
      };
    }

    logger.debug('Manual optimization scope resolved', {
      shadowId,
      skillId,
      episodeId: scope.episodeId,
      traceCount: scope.traces.length,
    });

    return this.options.episodeProbeService.analyzeManualScope({
      shadowId,
      traces: scope.traces,
      context: scope.context,
      episodeId: scope.episodeId,
    });
  }

  private async resolveManualOptimizationScope(
    shadowId: string
  ): Promise<ManualOptimizationScope | null> {
    const runtime = (runtimeFromShadowId(shadowId) ?? 'codex') as RuntimeType;
    const skillId = skillIdFromShadowId(shadowId) ?? shadowId.split('@')[0];
    const episode = this.findLatestEpisodeForSkill(skillId, runtime);

    if (episode) {
      const sessionId = episode.sessionIds[episode.sessionIds.length - 1];
      if (sessionId) {
        const sessionTraces = await this.options.traceManager.getSessionTraces(sessionId);
        const traces = this.buildEpisodeWindowTraces(episode, sessionTraces);
        if (traces.length > 0) {
          logger.debug('Resolved manual optimization scope from latest task episode', {
            skillId,
            runtime,
            episodeId: episode.episodeId,
            sessionId,
            traceCount: traces.length,
          });
          return {
            traces,
            context: buildActivityEventContext({
              episodeId: episode.episodeId,
              shadowId,
              trace: traces[traces.length - 1],
              traces,
            }),
            episodeId: episode.episodeId,
          };
        }
      }
    }

    const recentTraces = await this.options.traceManager.getRecentTraces(
      MANUAL_OPTIMIZE_RECENT_TRACE_LIMIT
    );
    for (let index = recentTraces.length - 1; index >= 0; index -= 1) {
      const trace = recentTraces[index];
      const mapping = this.options.traceSkillMapper.mapTrace(trace);
      if (!this.matchesManualShadowTarget(trace, mapping, skillId, runtime)) {
        continue;
      }

      const sessionTraces = await this.options.traceManager.getSessionTraces(trace.session_id);
      const anchorTraceIds = sessionTraces
        .filter((sessionTrace) => {
          const sessionMapping = this.options.traceSkillMapper.mapTrace(sessionTrace);
          return this.matchesManualShadowTarget(sessionTrace, sessionMapping, skillId, runtime);
        })
        .map((sessionTrace) => sessionTrace.trace_id);
      const traces = this.buildScopedTraceSlice(sessionTraces, anchorTraceIds);
      if (traces.length === 0) {
        continue;
      }

      logger.debug('Resolved manual optimization scope from recent session traces', {
        skillId,
        runtime,
        sessionId: trace.session_id,
        traceCount: traces.length,
      });
      return {
        traces,
        context: buildActivityEventContext({
          shadowId,
          trace: traces[traces.length - 1],
          traces,
        }),
        episodeId: null,
      };
    }

    return null;
  }

  private findLatestEpisodeForSkill(skillId: string, runtime: RuntimeType): TaskEpisode | null {
    return (
      this.options.taskEpisodes
        .listEpisodes()
        .filter(
          (episode) =>
            episode.runtime === runtime &&
            episode.traceRefs.length > 0 &&
            episode.skillSegments.some((segment) => segment.skillId === skillId)
        )
        .sort((left, right) =>
          String(right.lastActivityAt).localeCompare(String(left.lastActivityAt))
        )[0] ?? null
    );
  }

  private buildFallbackManualContext(shadowId: string): ActivityEventContext {
    const runtime = (runtimeFromShadowId(shadowId) ?? 'codex') as RuntimeType;
    const skillId = skillIdFromShadowId(shadowId) ?? shadowId.split('@')[0];
    const fallbackTrace: Trace = {
      trace_id: `manual-optimize:${Date.now()}`,
      session_id: `manual-optimize:${Date.now()}`,
      turn_id: 'manual',
      runtime,
      event_type: 'status',
      status: 'success',
      timestamp: new Date().toISOString(),
      metadata: { skill_id: skillId },
    };

    return buildActivityEventContext({
      shadowId,
      trace: fallbackTrace,
      traces: [fallbackTrace],
    });
  }

  private buildEpisodeWindowTraces(episode: TaskEpisode, sessionTraces: Trace[]): Trace[] {
    const traceRefSet = new Set(episode.traceRefs);
    return sessionTraces.filter((trace) => traceRefSet.has(trace.trace_id));
  }

  private buildScopedTraceSlice(sessionTraces: Trace[], anchorTraceIds: string[]): Trace[] {
    if (anchorTraceIds.length === 0) {
      return [];
    }

    const ordered = [...sessionTraces].sort((left, right) =>
      left.timestamp.localeCompare(right.timestamp)
    );
    const anchorSet = new Set(anchorTraceIds);
    const firstIndex = ordered.findIndex((trace) => anchorSet.has(trace.trace_id));
    if (firstIndex < 0) {
      return [];
    }

    let lastIndex = firstIndex;
    for (let index = firstIndex; index < ordered.length; index += 1) {
      if (anchorSet.has(ordered[index]?.trace_id ?? '')) {
        lastIndex = index;
      }
    }

    return ordered.slice(firstIndex, lastIndex + 1);
  }

  private matchesManualShadowTarget(
    trace: Trace,
    mapping: { skill_id: string | null; shadow_id: string | null; confidence: number },
    skillId: string,
    runtime: RuntimeType
  ): boolean {
    if (!mapping.skill_id || mapping.confidence < 0.5) {
      return false;
    }

    const mappedRuntime = runtimeFromShadowId(mapping.shadow_id ?? '') ?? trace.runtime ?? 'codex';
    return mapping.skill_id === skillId && mappedRuntime === runtime;
  }
}
