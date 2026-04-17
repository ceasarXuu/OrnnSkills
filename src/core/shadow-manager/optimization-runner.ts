import { buildAnalysisFailedEvent, buildAnalysisRequestedEvent, buildEvaluationResultEvent, buildPatchAppliedEvent } from '../activity-event-builder/index.js';
import { createChildLogger } from '../../utils/logger.js';
import { resolveOptimizationEligibility } from '../optimization-eligibility/index.js';
import { executeOptimizationPatch } from '../optimization-executor/index.js';
import { createSkillVersionManager } from '../skill-version/index.js';
import { runtimeFromShadowId, skillIdFromShadowId } from '../../utils/parse.js';
import type { ActivityEventContext } from '../activity-event-builder/index.js';
import type { EvaluationResult, Trace } from '../../types/index.js';
import type {
  CreateSkillVersionManagerLike,
  DaemonStatusLike,
  DecisionEventsLike,
  ExecuteOptimizationPatchLike,
  JournalManagerLike,
  OptimizationPolicy,
  ShadowRegistryLike,
  TaskEpisodeStoreLike,
  TriggerOptimizeResult,
} from './shadow-manager-types.js';

const logger = createChildLogger('shadow-optimization-runner');

export class ShadowOptimizationRunner {
  private readonly lastPatchTime = new Map<string, number>();
  private readonly patchCountToday = new Map<string, number>();
  private readonly executePatch: ExecuteOptimizationPatchLike;
  private readonly createVersionManager: CreateSkillVersionManagerLike;

  constructor(
    private readonly options: {
      projectRoot: string;
      policy: OptimizationPolicy;
      shadowRegistry: ShadowRegistryLike;
      journalManager: JournalManagerLike;
      decisionEvents: DecisionEventsLike;
      daemonStatus: DaemonStatusLike;
      taskEpisodes: Pick<TaskEpisodeStoreLike, 'markAnalysisState'>;
      executeOptimizationPatch?: ExecuteOptimizationPatchLike;
      createSkillVersionManager?: CreateSkillVersionManagerLike;
    }
  ) {
    this.executePatch = options.executeOptimizationPatch ?? executeOptimizationPatch;
    this.createVersionManager = options.createSkillVersionManager ?? createSkillVersionManager;
  }

  async handleEvaluation(
    shadowId: string,
    evaluation: EvaluationResult,
    traces: Trace[],
    context: ActivityEventContext,
    options: { skipAnalysisRequested?: boolean; closeOnSkip?: boolean } = {}
  ): Promise<TriggerOptimizeResult> {
    const skillId = skillIdFromShadowId(shadowId) ?? shadowId.split('@')[0];
    const runtime = runtimeFromShadowId(shadowId) ?? 'codex';
    const shadow = this.options.shadowRegistry.get(skillId, runtime);

    const eligibility = resolveOptimizationEligibility({
      evaluation,
      minConfidence: this.options.policy.min_confidence,
      inCooldown: this.isInCooldown(shadowId),
      exceedsDailyLimit: this.exceedsDailyLimit(shadowId),
      shadowStatus: shadow?.status === 'frozen' ? 'frozen' : 'active',
    });

    if (eligibility.kind === 'skip') {
      logger.debug('Optimization skipped by eligibility policy', {
        shadowId,
        status: eligibility.status,
      });
      this.options.decisionEvents.record(buildEvaluationResultEvent({
        shadowId,
        context,
        status: eligibility.status,
        detail: eligibility.detail,
        evaluation,
      }));
      if (options.closeOnSkip) {
        this.options.taskEpisodes.markAnalysisState(
          context.sessionId,
          context.skillId,
          context.runtime,
          'completed'
        );
        this.options.daemonStatus.setIdle();
      }
      return {
        kind: 'optimization_skipped',
        evaluation,
        detail: eligibility.detail,
        status: eligibility.status,
      };
    }

    this.options.daemonStatus.setOptimizing(context.skillId);
    if (!options.skipAnalysisRequested) {
      this.options.decisionEvents.record(buildAnalysisRequestedEvent({ context, evaluation }));
    }

    const patchResult = await this.executePatch({
      shadowId,
      evaluation,
      readContent: (currentSkillId, currentRuntime) =>
        this.options.shadowRegistry.readContent(currentSkillId, currentRuntime),
      writeContent: (currentSkillId, content, currentRuntime) =>
        this.options.shadowRegistry.writeContent(currentSkillId, content, currentRuntime),
      generatePatch: async (changeType, currentContent, patchContext) =>
        (await import('../patch-generator/index.js')).patchGenerator.generate(
          changeType,
          currentContent,
          patchContext
        ),
      getLatestRevision: (currentShadowId) => this.options.journalManager.getLatestRevision(currentShadowId),
      createSnapshot: (currentShadowId, revision) =>
        this.options.journalManager.createSnapshot(currentShadowId, revision),
      recordJournal: (currentShadowId, data) => this.options.journalManager.record(currentShadowId, data),
      onPatchApplied: (currentShadowId) => this.markPatchApplied(currentShadowId),
    });

    if (!patchResult.ok) {
      this.options.taskEpisodes.markAnalysisState(
        context.sessionId,
        context.skillId,
        context.runtime,
        'failed'
      );
      this.options.daemonStatus.setError(
        context.skillId,
        patchResult.error ?? '本轮优化未完成，但系统没有返回更具体的原因。'
      );
      this.options.decisionEvents.record(buildAnalysisFailedEvent({
        context,
        detail: patchResult.error ?? '本轮优化未完成，但系统没有返回更具体的原因。',
        evaluation,
      }));
      return {
        kind: 'patch_failed',
        evaluation,
        detail: patchResult.error ?? '本轮优化未完成，但系统没有返回更具体的原因。',
      };
    }

    this.persistSkillVersion({
      shadowId,
      skillId,
      runtime,
      evaluation,
      traces,
      context,
    });

    this.options.decisionEvents.record(buildPatchAppliedEvent({
      context,
      evaluation,
      revision: patchResult.revision ?? 0,
      linesAdded: patchResult.linesAdded ?? null,
      linesRemoved: patchResult.linesRemoved ?? null,
    }));
    this.options.taskEpisodes.markAnalysisState(
      context.sessionId,
      context.skillId,
      context.runtime,
      'completed'
    );
    this.options.daemonStatus.setIdle();
    return {
      kind: 'patch_applied',
      evaluation,
      detail: '已完成本轮优化并写回 shadow skill。',
    };
  }

  getLastPatchTime(shadowId: string): number | undefined {
    return this.lastPatchTime.get(shadowId);
  }

  private markPatchApplied(shadowId: string): void {
    this.lastPatchTime.set(shadowId, Date.now());
    const today = new Date().toDateString();
    const key = `${shadowId}:${today}`;
    this.patchCountToday.set(key, (this.patchCountToday.get(key) ?? 0) + 1);
  }

  private isInCooldown(shadowId: string): boolean {
    const lastTime = this.lastPatchTime.get(shadowId);
    if (!lastTime) {
      return false;
    }

    const cooldownMs = this.options.policy.cooldown_hours * 60 * 60 * 1000;
    return Date.now() - lastTime < cooldownMs;
  }

  private exceedsDailyLimit(shadowId: string): boolean {
    const today = new Date().toDateString();
    const key = `${shadowId}:${today}`;
    const count = this.patchCountToday.get(key) ?? 0;
    return count >= this.options.policy.max_patches_per_day;
  }

  private persistSkillVersion(input: {
    shadowId: string;
    skillId: string;
    runtime: 'codex' | 'claude' | 'opencode';
    evaluation: EvaluationResult;
    traces: Trace[];
    context: ActivityEventContext;
  }): void {
    try {
      const updatedContent = this.options.shadowRegistry.readContent(input.skillId, input.runtime);
      if (updatedContent) {
        this.createVersionManager({
          projectPath: this.options.projectRoot,
          skillId: input.skillId,
          runtime: input.runtime,
        }).createVersion(
          updatedContent,
          input.evaluation.reason ?? 'Auto optimization',
          input.traces.map((trace) => trace.trace_id).filter(Boolean),
          undefined,
          undefined,
          input.context.episodeId ? { activityScopeId: input.context.episodeId } : undefined
        );
      } else {
        logger.warn('Skipped skill version snapshot after patch because updated shadow content was empty', {
          projectRoot: this.options.projectRoot,
          skillId: input.skillId,
          runtime: input.runtime,
          shadowId: input.shadowId,
        });
      }
    } catch (error) {
      logger.error('Failed to persist skill version after optimization patch', {
        projectRoot: this.options.projectRoot,
        skillId: input.skillId,
        runtime: input.runtime,
        shadowId: input.shadowId,
        episodeId: input.context.episodeId ?? null,
        error,
      });
    }
  }
}
