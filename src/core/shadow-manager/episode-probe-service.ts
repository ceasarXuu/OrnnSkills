import {
  buildActivityEventContext,
  buildAnalysisFailedEvent,
  buildAnalysisRequestedEvent,
  buildEvaluationResultEvent,
  buildSkillFeedbackEvent,
} from '../activity-event-builder/index.js';
import { analyzeSkillWindow } from '../analyze-skill-window/index.js';
import { generateDecisionExplanation } from '../decision-explainer/index.js';
import { createSkillCallWindow, type SkillCallWindow } from '../skill-call-window/index.js';
import { filterEpisodeWindowTraces } from '../task-episode/index.js';
import type { SkillCallAnalysisResult } from '../skill-call-analyzer/index.js';
import { createChildLogger } from '../../utils/logger.js';
import { runtimeFromShadowId, skillIdFromShadowId } from '../../utils/parse.js';
import type { ActivityEventContext } from '../activity-event-builder/index.js';
import type { AnalyzeSkillWindowLike, DaemonStatusLike, DecisionEventsLike, OptimizationRunnerLike, ShadowRegistryLike, TaskEpisodeStoreLike, TriggerOptimizeResult } from './shadow-manager-types.js';
import type { ProbeTriggerDecision, TaskEpisode } from '../task-episode/index.js';
import type { EvaluationResult, RuntimeType, Trace } from '../../types/index.js';

const logger = createChildLogger('shadow-episode-probe-service');

export class ShadowEpisodeProbeService {
  private readonly analyzeWindow: AnalyzeSkillWindowLike;

  constructor(
    private readonly options: {
      projectRoot: string;
      shadowRegistry: Pick<ShadowRegistryLike, 'readContent'>;
      taskEpisodes: Pick<
        TaskEpisodeStoreLike,
        'shouldTriggerProbe' | 'applyNeedMoreContextHint' | 'markAnalysisState'
      >;
      decisionEvents: DecisionEventsLike;
      daemonStatus: DaemonStatusLike;
      optimizationRunner: OptimizationRunnerLike;
      analyzeSkillWindow?: AnalyzeSkillWindowLike;
      skillCallAnalyzer?: {
        analyzeWindow(
          projectPath: string,
          window: SkillCallWindow,
          skillContent: string
        ): Promise<SkillCallAnalysisResult>;
      };
      generateDecisionExplanation?: typeof generateDecisionExplanation;
    }
  ) {
    this.analyzeWindow = options.analyzeSkillWindow ?? analyzeSkillWindow;
  }

  async maybeRunEpisodeProbe(
    episode: TaskEpisode,
    shadowId: string,
    trace: Trace,
    sessionTraces: Trace[],
    eventContext?: ActivityEventContext
  ): Promise<void> {
    const trigger = this.options.taskEpisodes.shouldTriggerProbe(episode, trace);
    const context =
      eventContext ??
      buildActivityEventContext({
        episodeId: episode.episodeId,
        shadowId,
        trace,
        traces: sessionTraces,
      });

    if (!trigger.shouldProbe) {
      if (episode.analysisStatus === 'running' || episode.state === 'analyzing') {
        logger.debug('Skipping duplicate window analysis trigger while analysis is already running', {
          traceId: trace.trace_id,
          sessionId: context.sessionId,
          skillId: context.skillId,
          runtime: context.runtime,
          windowId: context.windowId,
        });
      }
      return;
    }

    await this.runAutoWindowAnalysis(episode, shadowId, sessionTraces, context, trigger);
  }

  async analyzeManualScope(input: {
    shadowId: string;
    traces: Trace[];
    context: ActivityEventContext;
    episodeId: string | null;
  }): Promise<TriggerOptimizeResult> {
    const runtime = (runtimeFromShadowId(input.shadowId) ?? 'codex') as RuntimeType;
    const skillId = skillIdFromShadowId(input.shadowId) ?? input.shadowId.split('@')[0];
    const currentContent = this.options.shadowRegistry.readContent(skillId, runtime);

    if (!currentContent) {
      if (input.episodeId) {
        this.options.taskEpisodes.markAnalysisState(
          input.context.sessionId,
          input.context.skillId,
          input.context.runtime,
          'failed'
        );
      }
      this.options.daemonStatus.setError(skillId, '当前技能内容为空，无法启动窗口分析。');
      this.options.decisionEvents.record(buildAnalysisFailedEvent({
        context: input.context,
        detail: '当前技能内容为空，无法启动窗口分析。',
        evaluation: null,
        reason: 'missing_skill_content',
      }));
      return {
        kind: 'analysis_failed',
        evaluation: null,
        detail: '当前技能内容为空，无法启动窗口分析。',
      };
    }

    if (input.episodeId) {
      this.options.taskEpisodes.markAnalysisState(
        input.context.sessionId,
        input.context.skillId,
        input.context.runtime,
        'running'
      );
    }
    this.options.daemonStatus.setAnalyzing(skillId);
    this.options.decisionEvents.record(buildAnalysisRequestedEvent({
      context: input.context,
      evaluation: null,
      detail: '手动触发窗口分析。',
      status: 'manual',
    }));

    const result = await this.analyzeWindow({
      analyzeWindow: this.getAnalyzeWindowFn(),
      projectPath: this.options.projectRoot,
      window: createSkillCallWindow({
        episodeId: input.episodeId ?? undefined,
        windowId: `manual::${input.context.windowId}`,
        skillId,
        runtime,
        sessionId: input.context.sessionId,
        triggerTraceId: input.context.traceId,
        closeReason: 'manual_trigger',
        startedAt: input.traces[0]?.timestamp,
        lastTraceAt: input.traces[input.traces.length - 1]?.timestamp,
        traces: input.traces,
      }),
      skillContent: currentContent,
      mode: 'manual',
    });

    return this.handleManualAnalysisResult({
      shadowId: input.shadowId,
      skillId,
      context: input.context,
      traces: input.traces,
      episodeId: input.episodeId,
      result,
    });
  }

  private async runAutoWindowAnalysis(
    episode: TaskEpisode,
    shadowId: string,
    sessionTraces: Trace[],
    context: ActivityEventContext,
    trigger: ProbeTriggerDecision
  ): Promise<void> {
    const currentContent = this.options.shadowRegistry.readContent(context.skillId, context.runtime);
    if (!currentContent) {
      this.options.taskEpisodes.markAnalysisState(
        context.sessionId,
        context.skillId,
        context.runtime,
        'failed'
      );
      this.options.daemonStatus.setError(context.skillId, '当前技能内容为空，无法启动窗口分析。');
      this.options.decisionEvents.record(buildAnalysisFailedEvent({
        context,
        detail: '当前技能内容为空，无法启动窗口分析。',
        evaluation: null,
        reason: 'missing_skill_content',
      }));
      return;
    }

    const windowTraces = this.buildEpisodeWindowTraces(episode, sessionTraces);
    const window = this.buildSkillCallWindow(episode, windowTraces, context);
    const anchorTrace =
      windowTraces[windowTraces.length - 1] ??
      sessionTraces.find((item) => item.trace_id === context.traceId) ??
      sessionTraces[sessionTraces.length - 1];
    const scopedContext = buildActivityEventContext({
      episodeId: episode.episodeId,
      shadowId,
      trace: anchorTrace,
      traces: windowTraces.length > 0 ? windowTraces : (anchorTrace ? [anchorTrace] : []),
    });

    this.options.taskEpisodes.markAnalysisState(
      context.sessionId,
      context.skillId,
      context.runtime,
      'running'
    );
    this.options.daemonStatus.setAnalyzing(context.skillId);
    this.options.decisionEvents.record(buildAnalysisRequestedEvent({
      context: scopedContext,
      evaluation: null,
      detail: this.describeProbeRequest(trigger).replace('时机探测', '窗口分析'),
      status: 'window_ready',
    }));

    const result = await this.analyzeWindow({
      analyzeWindow: this.getAnalyzeWindowFn(),
      projectPath: this.options.projectRoot,
      window,
      skillContent: currentContent,
      mode: 'auto',
    });

    if (result.kind === 'missing_skill_content') {
      this.options.taskEpisodes.markAnalysisState(
        context.sessionId,
        context.skillId,
        context.runtime,
        'failed'
      );
      this.options.daemonStatus.setError(context.skillId, result.detail);
      this.options.decisionEvents.record(buildAnalysisFailedEvent({
        context,
        detail: result.detail,
        evaluation: null,
        reason: result.reasonCode,
      }));
      return;
    }

    if (result.kind === 'analysis_failed') {
      this.options.taskEpisodes.markAnalysisState(
        context.sessionId,
        context.skillId,
        context.runtime,
        'failed'
      );
      this.options.daemonStatus.setError(context.skillId, result.detail);
      this.options.decisionEvents.record(buildAnalysisFailedEvent({
        context: scopedContext,
        detail: result.detail,
        evaluation: result.evaluation ?? null,
        reason: result.reasonCode,
        evidence: result.technicalDetail
          ? {
              rawEvidence: result.technicalDetail,
            }
          : null,
      }));
      return;
    }

    if (result.kind === 'need_more_context') {
      this.options.taskEpisodes.applyNeedMoreContextHint(episode.episodeId, result.nextWindowHint);
      this.options.decisionEvents.record(buildEvaluationResultEvent({
        shadowId,
        context: scopedContext,
        status: 'continue_collecting',
        detail: result.detail,
        evaluation: result.evaluation,
      }));
      this.options.daemonStatus.setIdle();
      return;
    }

    if (result.kind === 'no_optimization') {
      this.options.decisionEvents.record(buildEvaluationResultEvent({
        shadowId,
        context: scopedContext,
        status: 'no_patch_needed',
        detail: result.detail,
        evaluation: result.evaluation,
      }));
      await this.recordSkillFeedback(scopedContext, result.evaluation, windowTraces);
      this.options.taskEpisodes.markAnalysisState(
        context.sessionId,
        context.skillId,
        context.runtime,
        'completed'
      );
      this.options.daemonStatus.setIdle();
      return;
    }

    await this.recordSkillFeedback(scopedContext, result.evaluation, windowTraces);
    await this.options.optimizationRunner.handleEvaluation(
      shadowId,
      result.evaluation,
      windowTraces,
      scopedContext,
      {
        skipAnalysisRequested: true,
        closeOnSkip: true,
      }
    );
  }

  private async handleManualAnalysisResult(input: {
    shadowId: string;
    skillId: string;
    context: ActivityEventContext;
    traces: Trace[];
    episodeId: string | null;
    result: Awaited<ReturnType<AnalyzeSkillWindowLike>>;
  }): Promise<TriggerOptimizeResult> {
    if (input.result.kind === 'missing_skill_content') {
      if (input.episodeId) {
        this.options.taskEpisodes.markAnalysisState(
          input.context.sessionId,
          input.context.skillId,
          input.context.runtime,
          'failed'
        );
      }
      this.options.daemonStatus.setError(input.skillId, input.result.detail);
      this.options.decisionEvents.record(buildAnalysisFailedEvent({
        context: input.context,
        detail: input.result.detail,
        evaluation: null,
        reason: input.result.reasonCode,
      }));
      return {
        kind: 'analysis_failed',
        evaluation: null,
        detail: input.result.detail,
      };
    }

    if (input.result.kind === 'analysis_failed') {
      if (input.episodeId) {
        this.options.taskEpisodes.markAnalysisState(
          input.context.sessionId,
          input.context.skillId,
          input.context.runtime,
          'failed'
        );
      }
      this.options.daemonStatus.setError(input.skillId, input.result.detail);
      this.options.decisionEvents.record(buildAnalysisFailedEvent({
        context: input.context,
        detail: input.result.detail,
        evaluation: input.result.evaluation ?? null,
        reason: input.result.reasonCode,
        evidence: input.result.technicalDetail
          ? {
              rawEvidence: input.result.technicalDetail,
            }
          : null,
      }));
      return {
        kind: 'analysis_failed',
        evaluation: input.result.evaluation ?? null,
        detail: input.result.detail,
      };
    }

    if (input.result.kind === 'need_more_context') {
      if (input.episodeId) {
        this.options.taskEpisodes.applyNeedMoreContextHint(input.episodeId, input.result.nextWindowHint);
      }
      this.options.decisionEvents.record(buildEvaluationResultEvent({
        shadowId: input.shadowId,
        context: input.context,
        status: 'continue_collecting',
        detail: input.result.detail,
        evaluation: input.result.evaluation,
      }));
      this.options.daemonStatus.setIdle();
      return {
        kind: 'need_more_context',
        evaluation: input.result.evaluation,
        detail: input.result.detail,
      };
    }

    if (input.result.kind === 'no_optimization') {
      this.options.decisionEvents.record(buildEvaluationResultEvent({
        shadowId: input.shadowId,
        context: input.context,
        status: 'no_patch_needed',
        detail: input.result.detail,
        evaluation: input.result.evaluation,
      }));
      if (input.episodeId) {
        this.options.taskEpisodes.markAnalysisState(
          input.context.sessionId,
          input.context.skillId,
          input.context.runtime,
          'completed'
        );
      }
      this.options.daemonStatus.setIdle();
      return {
        kind: 'no_optimization',
        evaluation: input.result.evaluation,
        detail: input.result.detail,
      };
    }

    return this.options.optimizationRunner.handleEvaluation(
      input.shadowId,
      input.result.evaluation,
      input.traces,
      input.context,
      {
        skipAnalysisRequested: true,
        closeOnSkip: true,
      }
    );
  }

  private async recordSkillFeedback(
    context: ActivityEventContext,
    evaluation: EvaluationResult,
    traces: Trace[]
  ): Promise<void> {
    const explanation = await (this.options.generateDecisionExplanation ?? generateDecisionExplanation)(
      this.options.projectRoot,
      context.skillId,
      evaluation,
      traces,
      null
    );

    this.options.decisionEvents.record(buildSkillFeedbackEvent({ context, evaluation, explanation }));
  }

  private buildEpisodeWindowTraces(episode: TaskEpisode, sessionTraces: Trace[]): Trace[] {
    return filterEpisodeWindowTraces(episode, sessionTraces);
  }

  private buildSkillCallWindow(
    episode: TaskEpisode,
    traces: Trace[],
    context: ActivityEventContext
  ): SkillCallWindow {
    return createSkillCallWindow({
      episodeId: context.episodeId ?? episode.episodeId,
      windowId: context.windowId,
      skillId: context.skillId,
      runtime: context.runtime,
      sessionId: context.sessionId,
      triggerTraceId: context.traceId,
      closeReason: 'window_threshold_reached',
      startedAt: episode.startedAt,
      lastTraceAt: traces[traces.length - 1]?.timestamp ?? episode.lastActivityAt,
      traces,
    });
  }

  private describeProbeRequest(trigger: ProbeTriggerDecision): string {
    switch (trigger.reason) {
      case 'event_driven_signal':
        return '已捕获关键事件，提交一次新的时机探测。';
      case 'trace_delta_reached':
        return '新增 trace 已达到阈值，提交一次新的时机探测。';
      case 'turn_delta_reached':
        return '新增 turn 已达到阈值，提交一次新的时机探测。';
      case 'initial_window_ready':
      default:
        return '当前窗口已积累到初始观察量，提交首次时机探测。';
    }
  }

  private getAnalyzeWindowFn(): (
    projectPath: string,
    window: SkillCallWindow,
    skillContent: string
  ) => Promise<SkillCallAnalysisResult> {
    const analyzeWindow = this.options.skillCallAnalyzer?.analyzeWindow;
    if (!analyzeWindow) {
      return async () => {
        throw new Error('Skill call analyzer is not configured');
      };
    }

    return analyzeWindow.bind(this.options.skillCallAnalyzer);
  }
}
