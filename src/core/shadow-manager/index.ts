import { createChildLogger } from '../../utils/logger.js';
import { configManager } from '../../config/index.js';
import { createShadowRegistry } from '../shadow-registry/index.js';
import { createJournalManager } from '../journal/index.js';
import { createTraceManager } from '../observer/trace-manager.js';
import { createTraceSkillMapper } from '../trace-skill-mapper/index.js';
import { patchGenerator } from '../patch-generator/index.js';
import { createSkillVersionManager } from '../skill-version/index.js';
import { createDecisionEventRecorder } from '../decision-events/index.js';
import {
  createTaskEpisodeStore,
  type ProbeTriggerDecision,
  type TaskEpisode,
} from '../task-episode/index.js';
import { createSkillCallAnalyzer } from '../skill-call-analyzer/index.js';
import { generateDecisionExplanation } from '../decision-explainer/index.js';
import { analyzeSkillWindow } from '../analyze-skill-window/index.js';
import {
  buildActivityEventContext,
  buildAnalysisFailedEvent,
  buildAnalysisRequestedEvent,
  buildEvaluationResultEvent,
  buildPatchAppliedEvent,
  buildSkillFeedbackEvent,
} from '../activity-event-builder/index.js';
import type { ActivityEventContext } from '../activity-event-builder/index.js';
import { createDaemonStatusStore } from '../daemon-status-store/index.js';
import { resolveOptimizationEligibility } from '../optimization-eligibility/index.js';
import { executeOptimizationPatch } from '../optimization-executor/index.js';
import { bootstrapSkillsForMonitoring } from '../shadow-bootstrapper/index.js';
import { runtimeFromShadowId, skillIdFromShadowId } from '../../utils/parse.js';
import { createSQLiteStorage } from '../../storage/sqlite.js';
import { join } from 'node:path';
import type {
  Trace,
  EvaluationResult,
  AutoOptimizePolicy,
  RuntimeType,
} from '../../types/index.js';
import { createSkillCallWindow, type SkillCallWindow } from '../skill-call-window/index.js';

const logger = createChildLogger('shadow-manager');
const MANUAL_OPTIMIZE_RECENT_TRACE_LIMIT = 200;

export interface TriggerOptimizeResult {
  kind:
    | 'missing_window'
    | 'analysis_failed'
    | 'need_more_context'
    | 'no_optimization'
    | 'optimization_skipped'
    | 'patch_applied'
    | 'patch_failed';
  evaluation: EvaluationResult | null;
  detail: string;
  status?: string;
}

interface ManualOptimizationScope {
  traces: Trace[];
  context: ActivityEventContext;
  episodeId: string | null;
}

/**
 * Shadow Manager
 * 负责编排整个演化流程
 */
export class ShadowManager {
  private projectRoot: string;
  private shadowRegistry;
  private journalManager;
  private traceManager;
  private traceSkillMapper;
  private db: Awaited<ReturnType<typeof createSQLiteStorage>> | null = null;
  private dbPath: string;
  private policy: AutoOptimizePolicy;
  private decisionEvents;
  private taskEpisodes;
  private skillCallAnalyzer;
  private daemonStatus;
  private lastPatchTime: Map<string, number> = new Map();
  private patchCountToday: Map<string, number> = new Map();

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.shadowRegistry = createShadowRegistry(projectRoot);
    this.journalManager = createJournalManager(projectRoot);
    this.traceManager = createTraceManager(projectRoot);
    this.traceSkillMapper = createTraceSkillMapper(projectRoot);
    this.decisionEvents = createDecisionEventRecorder(projectRoot);
    this.taskEpisodes = createTaskEpisodeStore(projectRoot);
    this.skillCallAnalyzer = createSkillCallAnalyzer();
    this.daemonStatus = createDaemonStatusStore(projectRoot);
    this.dbPath = join(projectRoot, '.ornn', 'state', 'sessions.db');

    const patchConfig = configManager.getPatchConfig();
    this.policy = {
      min_signal_count: configManager.getEvaluatorConfig().min_signal_count,
      min_source_sessions: configManager.getEvaluatorConfig().min_source_sessions,
      min_confidence: configManager.getEvaluatorConfig().min_confidence,
      cooldown_hours: patchConfig.cooldown_hours,
      max_patches_per_day: patchConfig.max_patches_per_day,
      pause_after_rollback_hours: 48,
    };
  }

  /**
   * 初始化
   */
  async init(): Promise<void> {
    this.shadowRegistry.init();
    await this.journalManager.init();
    await this.traceManager.init();
    await this.traceSkillMapper.init();
    this.db = await createSQLiteStorage(this.dbPath);
    await this.db.init();
    if (!this.db) throw new Error('ShadowManager database not initialized');
    bootstrapSkillsForMonitoring({
      projectRoot: this.projectRoot,
      db: this.db,
      shadowRegistry: this.shadowRegistry,
      traceSkillMapper: this.traceSkillMapper,
      createVersionManager: (input) => createSkillVersionManager(input),
      originPaths: configManager.getOriginPaths(),
      enabledRuntimes: configManager.getGlobalConfig().observer.enabled_runtimes,
    });
    logger.debug('Shadow manager initialized');
  }

  /**
   * 处理 trace
   */
  async processTrace(trace: Trace): Promise<void> {
    // 记录 trace
    this.traceManager.recordTrace(trace);
    const recentTraces = await this.traceManager.getSessionTraces(trace.session_id);

    // 检查是否需要触发评估
    const shadowId = this.findShadowForTrace(trace);
    if (!shadowId) {
      const affectedEpisodes = this.taskEpisodes.recordContextTrace(trace);
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

        await this.maybeRunEpisodeProbe(episode, segment.shadowId, trace, recentTraces);
      }
      return;
    }

    // 记录命中次数，供 dashboard 监控展示
    const skillId = skillIdFromShadowId(shadowId);
    const runtime = runtimeFromShadowId(shadowId);
    if (skillId) {
      this.shadowRegistry.incrementTraceCount(skillId, runtime ?? trace.runtime);
    }

    const baseEventContext = buildActivityEventContext({ shadowId, trace, traces: recentTraces });
    const episode = this.taskEpisodes.recordTrace(trace, {
      skillId: baseEventContext.skillId,
      shadowId,
      runtime: baseEventContext.runtime,
    }, recentTraces);
    const eventContext = buildActivityEventContext({
      episodeId: episode.episodeId,
      shadowId,
      trace,
      traces: recentTraces,
    });
    await this.maybeRunEpisodeProbe(episode, shadowId, trace, recentTraces, eventContext);
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

  private getEpisodeTriggerSegment(episode: TaskEpisode): TaskEpisode['skillSegments'][number] | null {
    return [...episode.skillSegments]
      .sort((a, b) => String(b.lastActivityAt).localeCompare(String(a.lastActivityAt)))[0] ?? null;
  }

  private async maybeRunEpisodeProbe(
    episode: TaskEpisode,
    shadowId: string,
    trace: Trace,
    sessionTraces: Trace[],
    eventContext?: ActivityEventContext
  ): Promise<void> {
    const trigger = this.taskEpisodes.shouldTriggerProbe(episode, trace);
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

    await this.runWindowAnalysis(episode, shadowId, sessionTraces, context, trigger);
  }

  private async recordSkillFeedback(
    context: ActivityEventContext,
    evaluation: EvaluationResult,
    traces: Trace[]
  ): Promise<void> {
    const explanation = await generateDecisionExplanation(
      this.projectRoot,
      context.skillId,
      evaluation,
      traces,
      null
    );

    this.decisionEvents.record(buildSkillFeedbackEvent({ context, evaluation, explanation }));
  }

  private buildEpisodeWindowTraces(episode: TaskEpisode, sessionTraces: Trace[]): Trace[] {
    const traceRefSet = new Set(episode.traceRefs);
    return sessionTraces.filter((trace) => traceRefSet.has(trace.trace_id));
  }

  private buildScopedTraceSlice(sessionTraces: Trace[], anchorTraceIds: string[]): Trace[] {
    if (anchorTraceIds.length === 0) {
      return [];
    }

    const ordered = [...sessionTraces].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
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

  private findLatestEpisodeForSkill(skillId: string, runtime: RuntimeType): TaskEpisode | null {
    return this.taskEpisodes
      .listEpisodes()
      .filter((episode) =>
        episode.runtime === runtime &&
        episode.traceRefs.length > 0 &&
        episode.skillSegments.some((segment) => segment.skillId === skillId)
      )
      .sort((a, b) => String(b.lastActivityAt).localeCompare(String(a.lastActivityAt)))[0] ?? null;
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

  private async resolveManualOptimizationScope(shadowId: string): Promise<ManualOptimizationScope | null> {
    const runtime = (runtimeFromShadowId(shadowId) ?? 'codex') as RuntimeType;
    const skillId = skillIdFromShadowId(shadowId) ?? shadowId.split('@')[0];
    const episode = this.findLatestEpisodeForSkill(skillId, runtime);

    if (episode) {
      const sessionId = episode.sessionIds[episode.sessionIds.length - 1];
      if (sessionId) {
        const sessionTraces = await this.traceManager.getSessionTraces(sessionId);
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

    const recentTraces = await this.traceManager.getRecentTraces(MANUAL_OPTIMIZE_RECENT_TRACE_LIMIT);
    for (let index = recentTraces.length - 1; index >= 0; index -= 1) {
      const trace = recentTraces[index];
      const mapping = this.traceSkillMapper.mapTrace(trace);
      if (!this.matchesManualShadowTarget(trace, mapping, skillId, runtime)) {
        continue;
      }

      const sessionTraces = await this.traceManager.getSessionTraces(trace.session_id);
      const anchorTraceIds = sessionTraces
        .filter((sessionTrace) => {
          const sessionMapping = this.traceSkillMapper.mapTrace(sessionTrace);
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

  private async runWindowAnalysis(
    episode: TaskEpisode,
    shadowId: string,
    sessionTraces: Trace[],
    context: ActivityEventContext,
    trigger: ProbeTriggerDecision
  ): Promise<void> {
    const currentContent = this.shadowRegistry.readContent(context.skillId, context.runtime);
    if (!currentContent) {
      this.taskEpisodes.markAnalysisState(context.sessionId, context.skillId, context.runtime, 'failed');
      this.daemonStatus.setError(context.skillId, '当前技能内容为空，无法启动窗口分析。');
      this.decisionEvents.record(buildAnalysisFailedEvent({
        context,
        detail: '当前技能内容为空，无法启动窗口分析。',
        evaluation: null,
        reason: 'missing_skill_content',
      }));
      return;
    }

    const windowTraces = this.buildEpisodeWindowTraces(episode, sessionTraces);
    const window = this.buildSkillCallWindow(episode, windowTraces, context);
    const anchorTrace = windowTraces[windowTraces.length - 1]
      ?? sessionTraces.find((item) => item.trace_id === context.traceId)
      ?? sessionTraces[sessionTraces.length - 1];
    const scopedContext = buildActivityEventContext({
      episodeId: episode.episodeId,
      shadowId,
      trace: anchorTrace,
      traces: windowTraces.length > 0 ? windowTraces : (anchorTrace ? [anchorTrace] : []),
    });
    this.taskEpisodes.markAnalysisState(context.sessionId, context.skillId, context.runtime, 'running');
    this.daemonStatus.setAnalyzing(context.skillId);
    this.decisionEvents.record(buildAnalysisRequestedEvent({
      context: scopedContext,
      evaluation: null,
      detail: this.describeProbeRequest(trigger).replace('时机探测', '窗口分析'),
      status: 'window_ready',
    }));

    const result = await analyzeSkillWindow({
      analyzeWindow: this.skillCallAnalyzer.analyzeWindow.bind(this.skillCallAnalyzer),
      projectPath: this.projectRoot,
      window,
      skillContent: currentContent,
      mode: 'auto',
    });

    if (result.kind === 'missing_skill_content') {
      this.taskEpisodes.markAnalysisState(context.sessionId, context.skillId, context.runtime, 'failed');
      this.daemonStatus.setError(context.skillId, result.detail);
      this.decisionEvents.record(buildAnalysisFailedEvent({
        context,
        detail: result.detail,
        evaluation: null,
        reason: result.reasonCode,
      }));
      return;
    }

    if (result.kind === 'analysis_failed') {
      this.taskEpisodes.markAnalysisState(context.sessionId, context.skillId, context.runtime, 'failed');
      this.daemonStatus.setError(context.skillId, result.detail);
      this.decisionEvents.record(buildAnalysisFailedEvent({
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
      this.taskEpisodes.applyNeedMoreContextHint(episode.episodeId, result.nextWindowHint);
      this.decisionEvents.record(buildEvaluationResultEvent({
        shadowId,
        context: scopedContext,
        status: 'continue_collecting',
        detail: result.detail,
        evaluation: result.evaluation,
      }));
      this.daemonStatus.setIdle();
      return;
    }

    if (result.kind === 'no_optimization') {
      this.decisionEvents.record(buildEvaluationResultEvent({
        shadowId,
        context: scopedContext,
        status: 'no_patch_needed',
        detail: result.detail,
        evaluation: result.evaluation,
      }));
      await this.recordSkillFeedback(scopedContext, result.evaluation, windowTraces);
      this.taskEpisodes.markAnalysisState(context.sessionId, context.skillId, context.runtime, 'completed');
      this.daemonStatus.setIdle();
      return;
    }

    await this.recordSkillFeedback(scopedContext, result.evaluation, windowTraces);
    await this.handleEvaluation(shadowId, result.evaluation, windowTraces, scopedContext, {
      skipAnalysisRequested: true,
      closeOnSkip: true,
    });
  }

  /**
   * 查找 trace 对应的 shadow
   * 使用 TraceSkillMapper 的多策略映射
   */
  private findShadowForTrace(trace: Trace): string | null {
    try {
      // 使用 TraceSkillMapper 进行映射
      const mapping = this.traceSkillMapper.mapTrace(trace);

      // 如果映射成功且置信度足够
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

      // 映射失败，记录日志
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

  /**
   * 处理评估结果
   */
  private async handleEvaluation(
    shadowId: string,
    evaluation: EvaluationResult,
    traces: Trace[],
    context: ActivityEventContext,
    options: { skipAnalysisRequested?: boolean; closeOnSkip?: boolean } = {}
  ): Promise<TriggerOptimizeResult> {
    const skillId = skillIdFromShadowId(shadowId) ?? shadowId.split('@')[0];
    const runtime = runtimeFromShadowId(shadowId) ?? 'codex';
    const shadow = this.shadowRegistry.get(skillId, runtime);

    const eligibility = resolveOptimizationEligibility({
      evaluation,
      minConfidence: this.policy.min_confidence,
      inCooldown: this.isInCooldown(shadowId),
      exceedsDailyLimit: this.exceedsDailyLimit(shadowId),
      shadowStatus: shadow?.status === 'frozen' ? 'frozen' : 'active',
    });

    if (eligibility.kind === 'skip') {
      logger.debug(`Optimization skipped by eligibility policy`, {
        shadowId,
        status: eligibility.status,
      });
      this.decisionEvents.record(buildEvaluationResultEvent({
        shadowId,
        context,
        status: eligibility.status,
        detail: eligibility.detail,
        evaluation,
      }));
      if (options.closeOnSkip) {
        this.taskEpisodes.markAnalysisState(context.sessionId, context.skillId, context.runtime, 'completed');
        this.daemonStatus.setIdle();
      }
      return {
        kind: 'optimization_skipped',
        evaluation,
        detail: eligibility.detail,
        status: eligibility.status,
      };
    }

    this.daemonStatus.setOptimizing(context.skillId);
    if (!options.skipAnalysisRequested) {
      this.decisionEvents.record(buildAnalysisRequestedEvent({ context, evaluation }));
    }

    const patchResult = await executeOptimizationPatch({
      shadowId,
      evaluation,
      readContent: (currentSkillId, currentRuntime) =>
        this.shadowRegistry.readContent(currentSkillId, currentRuntime),
      writeContent: (currentSkillId, content, currentRuntime) =>
        this.shadowRegistry.writeContent(currentSkillId, content, currentRuntime),
      generatePatch: (changeType, currentContent, patchContext) =>
        patchGenerator.generate(changeType, currentContent, patchContext),
      getLatestRevision: (currentShadowId) => this.journalManager.getLatestRevision(currentShadowId),
      createSnapshot: (currentShadowId, revision) =>
        this.journalManager.createSnapshot(currentShadowId, revision),
      recordJournal: (currentShadowId, data) => this.journalManager.record(currentShadowId, data),
      onPatchApplied: (currentShadowId) => {
        this.lastPatchTime.set(currentShadowId, Date.now());
        const today = new Date().toDateString();
        const key = `${currentShadowId}:${today}`;
        this.patchCountToday.set(key, (this.patchCountToday.get(key) ?? 0) + 1);
      },
    });
    if (!patchResult.ok) {
      this.taskEpisodes.markAnalysisState(context.sessionId, context.skillId, context.runtime, 'failed');
      this.daemonStatus.setError(
        context.skillId,
        patchResult.error ?? '本轮优化未完成，但系统没有返回更具体的原因。'
      );
      this.decisionEvents.record(buildAnalysisFailedEvent({
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

    try {
      const updatedContent = this.shadowRegistry.readContent(skillId, runtime);
      if (updatedContent) {
        createSkillVersionManager({
          projectPath: this.projectRoot,
          skillId,
          runtime,
        }).createVersion(
          updatedContent,
          evaluation.reason ?? 'Auto optimization',
          traces.map((trace) => trace.trace_id).filter(Boolean),
          undefined,
          undefined,
          context.episodeId ? { activityScopeId: context.episodeId } : undefined
        );
      } else {
        logger.warn('Skipped skill version snapshot after patch because updated shadow content was empty', {
          projectRoot: this.projectRoot,
          skillId,
          runtime,
          shadowId,
        });
      }
    } catch (error) {
      logger.error('Failed to persist skill version after optimization patch', {
        projectRoot: this.projectRoot,
        skillId,
        runtime,
        shadowId,
        episodeId: context.episodeId ?? null,
        error,
      });
    }

    this.decisionEvents.record(buildPatchAppliedEvent({
      context,
      evaluation,
      revision: patchResult.revision ?? 0,
      linesAdded: patchResult.linesAdded ?? null,
      linesRemoved: patchResult.linesRemoved ?? null,
    }));
    this.taskEpisodes.markAnalysisState(context.sessionId, context.skillId, context.runtime, 'completed');
    this.daemonStatus.setIdle();
    return {
      kind: 'patch_applied',
      evaluation,
      detail: '已完成本轮优化并写回 shadow skill。',
    };
  }

  /**
   * 检查是否在冷却期
   */
  private isInCooldown(shadowId: string): boolean {
    const lastTime = this.lastPatchTime.get(shadowId);
    if (!lastTime) {
      return false;
    }

    const cooldownMs = this.policy.cooldown_hours * 60 * 60 * 1000;
    return Date.now() - lastTime < cooldownMs;
  }

  /**
   * 检查是否超过每日限制
   */
  private exceedsDailyLimit(shadowId: string): boolean {
    const today = new Date().toDateString();
    const key = `${shadowId}:${today}`;
    const count = this.patchCountToday.get(key) ?? 0;
    return count >= this.policy.max_patches_per_day;
  }

  /**
   * 手动触发优化
   */
  async triggerOptimize(shadowId: string): Promise<TriggerOptimizeResult> {
    const runtime = (runtimeFromShadowId(shadowId) ?? 'codex') as RuntimeType;
    const skillId = skillIdFromShadowId(shadowId) ?? shadowId.split('@')[0];
    const scope = await this.resolveManualOptimizationScope(shadowId);
    const eventContext = scope?.context ?? this.buildFallbackManualContext(shadowId);
    const traces = scope?.traces ?? [];
    const currentContent = this.shadowRegistry.readContent(skillId, runtime);

    if (!scope) {
      logger.warn('Manual optimization aborted because no scoped window could be resolved', {
        shadowId,
        skillId: eventContext.skillId,
        runtime: eventContext.runtime,
      });
      this.daemonStatus.setError(eventContext.skillId, '当前没有可复用的真实调用窗口，无法手动触发优化。');
      this.decisionEvents.record(buildAnalysisFailedEvent({
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

    if (!currentContent) {
      if (scope.episodeId) {
        this.taskEpisodes.markAnalysisState(eventContext.sessionId, eventContext.skillId, eventContext.runtime, 'failed');
      }
      this.daemonStatus.setError(skillId, '当前技能内容为空，无法启动窗口分析。');
      this.decisionEvents.record(buildAnalysisFailedEvent({
        context: eventContext,
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

    if (scope.episodeId) {
      this.taskEpisodes.markAnalysisState(eventContext.sessionId, eventContext.skillId, eventContext.runtime, 'running');
    }
    this.daemonStatus.setAnalyzing(skillId);
    this.decisionEvents.record(buildAnalysisRequestedEvent({
      context: eventContext,
      evaluation: null,
      detail: '手动触发窗口分析。',
      status: 'manual',
    }));
    const result = await analyzeSkillWindow({
      analyzeWindow: this.skillCallAnalyzer.analyzeWindow.bind(this.skillCallAnalyzer),
      projectPath: this.projectRoot,
      window: createSkillCallWindow({
        episodeId: scope.episodeId ?? undefined,
        windowId: `manual::${eventContext.windowId}`,
        skillId,
        runtime,
        sessionId: eventContext.sessionId,
        triggerTraceId: eventContext.traceId,
        closeReason: 'manual_trigger',
        startedAt: traces[0]?.timestamp,
        lastTraceAt: traces[traces.length - 1]?.timestamp,
        traces,
      }),
      skillContent: currentContent,
      mode: 'manual',
    });

    if (result.kind === 'missing_skill_content') {
      if (scope.episodeId) {
        this.taskEpisodes.markAnalysisState(eventContext.sessionId, eventContext.skillId, eventContext.runtime, 'failed');
      }
      this.daemonStatus.setError(skillId, result.detail);
      this.decisionEvents.record(buildAnalysisFailedEvent({
        context: eventContext,
        detail: result.detail,
        evaluation: null,
        reason: result.reasonCode,
      }));
      return {
        kind: 'analysis_failed',
        evaluation: null,
        detail: result.detail,
      };
    }

    if (result.kind === 'analysis_failed') {
      if (scope.episodeId) {
        this.taskEpisodes.markAnalysisState(eventContext.sessionId, eventContext.skillId, eventContext.runtime, 'failed');
      }
      this.daemonStatus.setError(skillId, result.detail);
      this.decisionEvents.record(buildAnalysisFailedEvent({
        context: eventContext,
        detail: result.detail,
        evaluation: result.evaluation ?? null,
        reason: result.reasonCode,
        evidence: result.technicalDetail
          ? {
              rawEvidence: result.technicalDetail,
            }
          : null,
      }));
      return {
        kind: 'analysis_failed',
        evaluation: result.evaluation ?? null,
        detail: result.detail,
      };
    }

    if (result.kind === 'need_more_context') {
      if (scope.episodeId) {
        this.taskEpisodes.applyNeedMoreContextHint(scope.episodeId, result.nextWindowHint);
      }
      this.decisionEvents.record(buildEvaluationResultEvent({
        shadowId,
        context: eventContext,
        status: 'continue_collecting',
        detail: result.detail,
        evaluation: result.evaluation,
      }));
      this.daemonStatus.setIdle();
      return {
        kind: 'need_more_context',
        evaluation: result.evaluation,
        detail: result.detail,
      };
    }

    if (result.kind === 'no_optimization') {
      this.decisionEvents.record(buildEvaluationResultEvent({
        shadowId,
        context: eventContext,
        status: 'no_patch_needed',
        detail: result.detail,
        evaluation: result.evaluation,
      }));
      if (scope.episodeId) {
        this.taskEpisodes.markAnalysisState(eventContext.sessionId, eventContext.skillId, eventContext.runtime, 'completed');
      }
      this.daemonStatus.setIdle();
      return {
        kind: 'no_optimization',
        evaluation: result.evaluation,
        detail: result.detail,
      };
    }

    return this.handleEvaluation(shadowId, result.evaluation, traces, eventContext, {
      skipAnalysisRequested: true,
      closeOnSkip: true,
    });
  }

  /**
   * 获取 shadow 状态
   */
  getShadowState(shadowId: string): {
    shadow: { skillId: string; status: string; content: string };
    latest_revision: number;
    snapshot_count: number;
    last_patch_time: number | undefined;
  } | null {
    const skillId = skillIdFromShadowId(shadowId) ?? shadowId.split('@')[0];
    const runtime = runtimeFromShadowId(shadowId) ?? 'codex';
    const shadow = this.shadowRegistry.get(skillId, runtime);

    if (!shadow) {
      return null;
    }

    const latestRevision = this.journalManager.getLatestRevision(shadowId);
    const snapshots = this.journalManager.getSnapshots(shadowId);

    return {
      shadow,
      latest_revision: latestRevision,
      snapshot_count: snapshots.length,
      last_patch_time: this.lastPatchTime.get(shadowId),
    };
  }

  /**
   * 清理旧 traces
   */
  cleanupOldTraces(retentionDays: number): number {
    return this.traceManager.cleanupOldTraces(retentionDays);
  }

  /**
   * 关闭
   */
  async close(): Promise<void> {
    this.shadowRegistry.close();
    await this.journalManager.close();
    this.traceManager.close();
    this.traceSkillMapper.close();
    logger.info('Shadow manager closed');
  }
}

// 导出工厂函数
export function createShadowManager(projectRoot: string): ShadowManager {
  return new ShadowManager(projectRoot);
}
