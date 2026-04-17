import { buildActivityEventContext } from '../activity-event-builder/index.js';
import { createChildLogger } from '../../utils/logger.js';
import { runtimeFromShadowId, skillIdFromShadowId } from '../../utils/parse.js';
import type { TaskEpisode } from '../task-episode/index.js';
import type { EpisodeProbeServiceLike, ShadowRegistryLike, TaskEpisodeStoreLike, TraceManagerLike, TraceSkillMapperLike } from './shadow-manager-types.js';
import type { Trace } from '../../types/index.js';

const logger = createChildLogger('shadow-trace-ingest-service');

export class ShadowTraceIngestService {
  constructor(
    private readonly options: {
      projectRoot: string;
      traceManager: Pick<TraceManagerLike, 'recordTrace' | 'getSessionTraces'>;
      traceSkillMapper: Pick<TraceSkillMapperLike, 'mapTrace'>;
      shadowRegistry: Pick<ShadowRegistryLike, 'incrementTraceCount'>;
      taskEpisodes: Pick<TaskEpisodeStoreLike, 'recordTrace' | 'recordContextTrace'>;
      episodeProbeService: Pick<EpisodeProbeServiceLike, 'maybeRunEpisodeProbe'>;
    }
  ) {}

  async processTrace(trace: Trace): Promise<void> {
    this.options.traceManager.recordTrace(trace);
    const recentTraces = await this.options.traceManager.getSessionTraces(trace.session_id);

    const shadowId = this.findShadowForTrace(trace);
    if (!shadowId) {
      const affectedEpisodes = this.options.taskEpisodes.recordContextTrace(trace);
      for (const episode of affectedEpisodes) {
        const segment = this.getEpisodeTriggerSegment(episode);
        if (!segment?.shadowId) {
          continue;
        }

        logger.debug('Re-checking probe readiness after context trace expanded episode window', {
          traceId: trace.trace_id,
          sessionId: trace.session_id,
          episodeId: episode.episodeId,
          skillId: segment.skillId,
          runtime: segment.runtime,
          totalTraceCount: episode.stats.totalTraceCount,
          tracesSinceLastProbe: episode.stats.tracesSinceLastProbe,
        });

        await this.options.episodeProbeService.maybeRunEpisodeProbe(
          episode,
          segment.shadowId,
          trace,
          recentTraces
        );
      }
      return;
    }

    const skillId = skillIdFromShadowId(shadowId);
    const runtime = runtimeFromShadowId(shadowId);
    if (skillId) {
      this.options.shadowRegistry.incrementTraceCount(skillId, runtime ?? trace.runtime);
    }

    const baseEventContext = buildActivityEventContext({ shadowId, trace, traces: recentTraces });
    const episode = this.options.taskEpisodes.recordTrace(
      trace,
      {
        skillId: baseEventContext.skillId,
        shadowId,
        runtime: baseEventContext.runtime,
      },
      recentTraces
    );
    const eventContext = buildActivityEventContext({
      episodeId: episode.episodeId,
      shadowId,
      trace,
      traces: recentTraces,
    });
    await this.options.episodeProbeService.maybeRunEpisodeProbe(
      episode,
      shadowId,
      trace,
      recentTraces,
      eventContext
    );
  }

  private findShadowForTrace(trace: Trace): string | null {
    try {
      const mapping = this.options.traceSkillMapper.mapTrace(trace);

      if (mapping.shadow_id && mapping.confidence >= 0.5) {
        logger.debug('Shadow found for trace', {
          trace_id: trace.trace_id,
          skill_id: mapping.skill_id,
          shadow_id: mapping.shadow_id,
          confidence: mapping.confidence,
          reason: mapping.reason,
        });
        return mapping.shadow_id;
      }

      logger.debug('No shadow found for trace', {
        trace_id: trace.trace_id,
        event_type: trace.event_type,
        reason: mapping.reason,
      });

      return null;
    } catch (error) {
      logger.error('Error finding shadow for trace', {
        trace_id: trace.trace_id,
        error,
      });
      return null;
    }
  }

  private getEpisodeTriggerSegment(episode: TaskEpisode): TaskEpisode['skillSegments'][number] | null {
    return (
      [...episode.skillSegments].sort((left, right) =>
        String(right.lastActivityAt).localeCompare(String(left.lastActivityAt))
      )[0] ?? null
    );
  }
}
