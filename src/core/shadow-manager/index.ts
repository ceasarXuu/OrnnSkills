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
      this.taskEpisodes.recordContextTrace(trace);
      return;
    }

    // 记录命中次数，供 dashboard 监控展示
    const skillId = skillIdFromShadowId(shadowId);
    const runtime = runtimeFromShadowId(shadowId);
    if (skillId) {
      this.shadowRegistry.incrementTraceCount(skillId, (runtime ?? trace.runtime) as RuntimeType);
    }

    const eventContext = buildActivityEventContext({ shadowId, trace, traces: recentTraces });
    const episode = this.taskEpisodes.recordTrace(trace, {
      skillId: eventContext.skillId,
      shadowId,
      runtime: eventContext.runtime,
    }, recentTraces);
    const trigger = this.taskEpisodes.shouldTriggerProbe(episode, trace);
    if (!trigger.shouldProbe) {
      if (episode.analysisStatus === 'running' || episode.state === 'analyzing') {
        logger.debug('Skipping duplicate window analysis trigger while analysis is already running', {
          traceId: trace.trace_id,
          sessionId: eventContext.sessionId,
          skillId: eventContext.skillId,
          runtime: eventContext.runtime,
          windowId: eventContext.windowId,
        });
      }
      return;
    }

    await this.runWindowAnalysis(episode, shadowId, recentTraces, eventContext, trigger);
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
      windowId: context.windowId,
      skillId: context.skillId,
      runtime: context.runtime,
      sessionId: context.sessionId,
      closeReason: 'window_threshold_reached',
      startedAt: episode.startedAt,
      lastTraceAt: traces[traces.length - 1]?.timestamp ?? episode.lastActivityAt,
      traces,
    });
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
    this.taskEpisodes.markAnalysisState(context.sessionId, context.skillId, context.runtime, 'running');
    this.daemonStatus.setAnalyzing(context.skillId);
    this.decisionEvents.record(buildAnalysisRequestedEvent({
      context,
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
        context,
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
        context,
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
        context,
        status: 'no_patch_needed',
        detail: result.detail,
        evaluation: result.evaluation,
      }));
      await this.recordSkillFeedback(context, result.evaluation, windowTraces);
      this.taskEpisodes.markAnalysisState(context.sessionId, context.skillId, context.runtime, 'completed');
      this.daemonStatus.setIdle();
      return;
    }

    await this.recordSkillFeedback(context, result.evaluation, windowTraces);
    await this.handleEvaluation(shadowId, result.evaluation, windowTraces, context, {
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
    _traces: Trace[],
    context: ActivityEventContext,
    options: { skipAnalysisRequested?: boolean; closeOnSkip?: boolean } = {}
  ): Promise<void> {
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
      return;
    }

    this.taskEpisodes.markAnalysisState(context.sessionId, context.skillId, context.runtime, 'running');
    this.daemonStatus.setAnalyzing(context.skillId);
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
      return;
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
  async triggerOptimize(shadowId: string): Promise<EvaluationResult | null> {
    // 获取最近的 traces
    const traces = await this.traceManager.getRecentTraces(100);
    const runtime = (runtimeFromShadowId(shadowId) ?? 'codex') as RuntimeType;
    const skillId = skillIdFromShadowId(shadowId) ?? shadowId.split('@')[0];
    const fallbackTrace: Trace = traces[traces.length - 1] ?? {
      trace_id: `manual-optimize:${Date.now()}`,
      session_id: `manual-optimize:${Date.now()}`,
      turn_id: 'manual',
      runtime,
      event_type: 'status',
      status: 'success',
      timestamp: new Date().toISOString(),
      metadata: { skill_id: skillId },
    };
    const eventContext = buildActivityEventContext({ shadowId, trace: fallbackTrace, traces });
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
        windowId: `manual::${eventContext.windowId}`,
        skillId,
        runtime,
        sessionId: fallbackTrace.session_id,
        closeReason: 'manual_trigger',
        startedAt: traces[0]?.timestamp ?? fallbackTrace.timestamp,
        lastTraceAt: traces[traces.length - 1]?.timestamp ?? fallbackTrace.timestamp,
        traces,
      }),
      skillContent: this.shadowRegistry.readContent(skillId, runtime),
      mode: 'manual',
    });

    if (result.kind === 'missing_skill_content') {
      this.daemonStatus.setError(skillId, result.detail);
      this.decisionEvents.record(buildAnalysisFailedEvent({
        context: eventContext,
        detail: result.detail,
        evaluation: null,
        reason: result.reasonCode,
      }));
      return null;
    }

    if (result.kind === 'analysis_failed') {
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
      return null;
    }

    if (result.kind === 'need_more_context') {
      this.decisionEvents.record(buildEvaluationResultEvent({
        shadowId,
        context: eventContext,
        status: 'continue_collecting',
        detail: result.detail,
        evaluation: result.evaluation,
      }));
      return result.evaluation;
    }

    if (result.kind === 'no_optimization') {
      this.decisionEvents.record(buildEvaluationResultEvent({
        shadowId,
        context: eventContext,
        status: 'no_patch_needed',
        detail: result.detail,
        evaluation: result.evaluation,
      }));
      return result.evaluation;
    }

    void this.handleEvaluation(shadowId, result.evaluation, traces, eventContext, {
      skipAnalysisRequested: true,
    });
    return result.evaluation;
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
