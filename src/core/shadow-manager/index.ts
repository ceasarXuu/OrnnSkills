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
import { hashString } from '../../utils/hash.js';
import { buildShadowId, runtimeFromShadowId, skillIdFromShadowId } from '../../utils/parse.js';
import { createSQLiteStorage } from '../../storage/sqlite.js';
import { existsSync, readdirSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type {
  Trace,
  EvaluationResult,
  AutoOptimizePolicy,
  ShadowStatus,
  RuntimeType,
} from '../../types/index.js';
import type { SkillCallWindow } from '../skill-call-window/index.js';

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
    this.bootstrapSkillsForMonitoring();
    logger.debug('Shadow manager initialized');
  }

  /**
   * 启动时自动发现并注册 skills，避免“trace 有了但无 skill 监控”
   */
  private bootstrapSkillsForMonitoring(): void {
    if (!this.db) throw new Error('ShadowManager database not initialized');

    // 宿主对齐：项目内 + 全局同扫；同名按项目优先，且按 runtime 维度独立决议来源。
    const projectRoots = [
      join(this.projectRoot, '.codex', 'skills'),
      join(this.projectRoot, '.claude', 'skills'),
      join(this.projectRoot, '.opencode', 'skills'),
      join(this.projectRoot, 'skills'),
      join(this.projectRoot, '.skills'),
      join(this.projectRoot, '.agents', 'skills'),
    ];
    const globalRoots = [
      ...configManager.getOriginPaths(),
      join(homedir(), '.agents', 'skills'),
      join(homedir(), '.codex', 'skills'),
    ];
    const candidateRoots = [...new Set<string>([...projectRoots, ...globalRoots])];
    const selectedSourceByRuntimeSkill = new Map<
      string,
      { root: string; skillPath: string; content: string; isProjectSource: boolean }
    >();

    const runtimes = configManager.getGlobalConfig().observer.enabled_runtimes;
    let discovered = 0;
    let registered = 0;
    let createdShadows = 0;
    let bootstrapVersionedUpdates = 0;
    let materializedToProject = 0;
    const originUpserted = new Set<string>();

    for (const root of candidateRoots) {
      if (!existsSync(root)) continue;

      let entries = [] as import('node:fs').Dirent[];
      try {
        entries = readdirSync(root, { withFileTypes: true, encoding: 'utf8' });
      } catch {
        continue;
      }

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const skillId = entry.name;
        const skillDir = join(root, skillId);
        const skillFileCandidates = [join(skillDir, 'SKILL.md'), join(skillDir, 'skill.md')];
        const skillPath = skillFileCandidates.find((p) => existsSync(p));
        if (!skillPath) continue;

        discovered++;
        const isProjectSource = root.startsWith(this.projectRoot);
        const runtimeScope = this.resolveRootRuntime(root);
        const applicableRuntimes =
          runtimeScope === null ? runtimes : runtimes.filter((r) => r === runtimeScope);

        let content = '';
        try {
          content = readFileSync(skillPath, 'utf-8');
        } catch {
          continue;
        }

        for (const runtime of applicableRuntimes) {
          const scopedKey = `${runtime}::${skillId}`;
          if (selectedSourceByRuntimeSkill.has(scopedKey)) continue;
          selectedSourceByRuntimeSkill.set(scopedKey, {
            root,
            skillPath,
            content,
            isProjectSource,
          });
        }
      }
    }

    for (const [scopedKey, selected] of selectedSourceByRuntimeSkill.entries()) {
      const [runtime, skillId] = scopedKey.split('::') as [RuntimeType, string];
      const now = new Date().toISOString();
      const originVersion = hashString(selected.content);

      if (!originUpserted.has(skillId)) {
        const origin = {
          skill_id: skillId,
          origin_path: selected.skillPath,
          origin_version: originVersion,
          source: 'local' as const,
          installed_at: now,
          last_seen_at: now,
        };
        this.db.upsertOriginSkill(origin);
        originUpserted.add(skillId);
      }

      if (!this.shadowRegistry.has(skillId, runtime)) {
        this.shadowRegistry.create(skillId, selected.content, originVersion, runtime);
        createdShadows++;
      } else {
        const current = this.shadowRegistry.readContent(skillId, runtime);
        if (current !== undefined && current !== selected.content) {
          this.shadowRegistry.updateContent(skillId, selected.content, runtime);
          const versionManager = createSkillVersionManager({
            projectPath: this.projectRoot,
            skillId,
            runtime,
          });
          versionManager.createVersion(
            selected.content,
            `Bootstrap source sync (${selected.isProjectSource ? 'project' : 'global'} -> project-preferred)`,
            []
          );
          bootstrapVersionedUpdates++;
        }
      }

      const shadowEntry = this.shadowRegistry.get(skillId, runtime);
      const status: ShadowStatus = shadowEntry?.status === 'frozen' ? 'frozen' : 'active';
      const shadow = {
        project_id: this.projectRoot,
        skill_id: scopedKey,
        runtime,
        shadow_id: buildShadowId(skillId, this.projectRoot, runtime),
        origin_skill_id: skillId,
        origin_version_at_fork: originVersion,
        shadow_path: join(this.projectRoot, '.ornn', 'shadows', runtime, `${skillId}.md`),
        current_revision: 0,
        status,
        created_at: now,
        last_optimized_at: now,
      };
      this.db.upsertShadowSkill(shadow);
      const originForMapper = {
        skill_id: skillId,
        origin_path: selected.skillPath,
        origin_version: originVersion,
        source: 'local' as const,
        installed_at: now,
        last_seen_at: now,
      };
      this.traceSkillMapper.registerSkill(originForMapper, shadow);
      registered++;

      // 当来源是全局 skill 且项目侧尚不存在时，物化到项目目录，
      // 保证后续由项目副本生效，避免改动全局影响其它项目。
      if (!selected.isProjectSource) {
        if (this.materializeSkillToProject(runtime, skillId, selected.content)) {
          materializedToProject++;
        }
      }
    }

    logger.info('Skill monitoring bootstrap completed', {
      discovered,
      registered,
      createdShadows,
      bootstrapVersionedUpdates,
      roots: candidateRoots,
      prioritizedProjectRoots: projectRoots,
      selectedSkills: selectedSourceByRuntimeSkill.size,
      materializedToProject,
    });
  }

  private resolveRootRuntime(root: string): RuntimeType | null {
    if (root.includes(`${this.projectRoot}/.codex/skills`) || root.includes('/.codex/skills')) {
      return 'codex';
    }
    if (root.includes(`${this.projectRoot}/.claude/skills`) || root.includes('/.claude/skills')) {
      return 'claude';
    }
    if (root.includes(`${this.projectRoot}/.opencode/skills`) || root.includes('/.opencode/skills')) {
      return 'opencode';
    }
    return null;
  }

  private getProjectSkillPath(runtime: RuntimeType, skillId: string): string {
    switch (runtime) {
      case 'codex':
        return join(this.projectRoot, '.codex', 'skills', skillId, 'SKILL.md');
      case 'claude':
        return join(this.projectRoot, '.claude', 'skills', skillId, 'SKILL.md');
      case 'opencode':
        return join(this.projectRoot, '.opencode', 'skills', skillId, 'SKILL.md');
      default:
        return join(this.projectRoot, 'skills', skillId, 'SKILL.md');
    }
  }

  private materializeSkillToProject(runtime: RuntimeType, skillId: string, content: string): boolean {
    const targetPath = this.getProjectSkillPath(runtime, skillId);
    if (existsSync(targetPath)) return false;

    mkdirSync(join(this.projectRoot, `.${runtime}`, 'skills', skillId), { recursive: true });
    writeFileSync(targetPath, content, 'utf-8');
    return true;
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

    const eventContext = this.buildDecisionEventContext(shadowId, trace, recentTraces);
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

  private buildDecisionEventContext(
    shadowId: string,
    trace: Trace,
    traces: Trace[]
  ): {
    skillId: string;
    runtime: RuntimeType;
    windowId: string;
    traceId: string;
    sessionId: string;
    traceCount: number;
    sessionCount: number;
  } {
    const skillId = skillIdFromShadowId(shadowId) ?? trace.metadata?.skill_id?.toString() ?? shadowId.split('@')[0];
    const runtime = (runtimeFromShadowId(shadowId) ?? trace.runtime ?? 'codex') as RuntimeType;
    const sessionIds = [...new Set(traces.map((item) => item.session_id).filter(Boolean))];
    const sessionId = trace.session_id || sessionIds[0] || 'unknown-session';
    const traceCount = traces.length;
    const sessionCount = sessionIds.length || 1;

    return {
      skillId,
      runtime,
      windowId: `${sessionId}::${skillId}`,
      traceId: trace.trace_id,
      sessionId,
      traceCount,
      sessionCount,
    };
  }

  private getPatchContextIssue(evaluation: EvaluationResult): string | null {
    if (!evaluation.should_patch || !evaluation.change_type) {
      return null;
    }

    if (
      (evaluation.change_type === 'prune_noise' || evaluation.change_type === 'rewrite_section') &&
      !evaluation.target_section?.trim()
    ) {
      return '缺少 target_section，无法定位需要修改的技能段落。';
    }

    return null;
  }

  private recordEvaluationResult(
    shadowId: string,
    context: ReturnType<ShadowManager['buildDecisionEventContext']>,
    status: string,
    detail: string,
    evaluation: EvaluationResult | null
  ): void {
    this.decisionEvents.record({
      tag: 'evaluation_result',
      skillId: context.skillId,
      runtime: context.runtime,
      windowId: context.windowId,
      traceId: context.traceId,
      sessionId: context.sessionId,
      status,
      detail,
      confidence: evaluation?.confidence ?? null,
      changeType: evaluation?.change_type ?? null,
      reason: evaluation?.reason ?? null,
      traceCount: context.traceCount,
      sessionCount: context.sessionCount,
      ruleName: evaluation?.rule_name ?? null,
      evidence: {
        directEvidence: [`shadow=${shadowId}`],
      },
    });
  }

  private recordAnalysisRequested(
    context: ReturnType<ShadowManager['buildDecisionEventContext']>,
    evaluation: EvaluationResult | null,
    detail = '已满足优化条件，开始生成改进方案。',
    status = 'ready'
  ): void {
    this.decisionEvents.record({
      tag: 'analysis_requested',
      skillId: context.skillId,
      runtime: context.runtime,
      windowId: context.windowId,
      traceId: context.traceId,
      sessionId: context.sessionId,
      status,
      detail,
      confidence: evaluation?.confidence ?? null,
      changeType: evaluation?.change_type ?? null,
      reason: evaluation?.reason ?? null,
      traceCount: context.traceCount,
      sessionCount: context.sessionCount,
      ruleName: evaluation?.rule_name ?? null,
    });
  }

  private recordAnalysisFailure(
    context: ReturnType<ShadowManager['buildDecisionEventContext']>,
    detail: string,
    evaluation: EvaluationResult | null = null,
    reason: string | null = null,
    evidence: Record<string, unknown> | null = null
  ): void {
    this.taskEpisodes.markAnalysisState(context.sessionId, context.skillId, context.runtime, 'failed');
    this.writeOptimizationCheckpoint('error', context.skillId, detail);
    this.decisionEvents.record({
      tag: 'analysis_failed',
      skillId: context.skillId,
      runtime: context.runtime,
      windowId: context.windowId,
      traceId: context.traceId,
      sessionId: context.sessionId,
      status: 'failed',
      detail,
      confidence: evaluation?.confidence ?? null,
      changeType: evaluation?.change_type ?? null,
      reason: reason ?? evaluation?.reason ?? null,
      traceCount: context.traceCount,
      sessionCount: context.sessionCount,
      ruleName: evaluation?.rule_name ?? null,
      evidence: evidence as never,
    });
  }

  private countPatchLines(patch: string): { linesAdded: number; linesRemoved: number } {
    let linesAdded = 0;
    let linesRemoved = 0;
    for (const line of patch.split('\n')) {
      if (!line) continue;
      if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('@@')) continue;
      if (line.startsWith('+')) linesAdded += 1;
      if (line.startsWith('-')) linesRemoved += 1;
    }
    return { linesAdded, linesRemoved };
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

  private writeOptimizationCheckpoint(
    state: 'idle' | 'analyzing' | 'optimizing' | 'error',
    skillId: string | null,
    error: string | null = null
  ): void {
    const checkpointPath = join(this.projectRoot, '.ornn', 'state', 'daemon-checkpoint.json');
    let checkpoint: Record<string, unknown> = {
      isRunning: true,
      startedAt: new Date().toISOString(),
      processedTraces: 0,
      lastCheckpointAt: null,
      retryQueueSize: 0,
      optimizationStatus: {
        currentState: 'idle',
        currentSkillId: null,
        lastOptimizationAt: null,
        lastError: null,
        queueSize: 0,
      },
    };

    if (existsSync(checkpointPath)) {
      try {
        checkpoint = JSON.parse(readFileSync(checkpointPath, 'utf-8')) as Record<string, unknown>;
      } catch {
        // fall back to defaults
      }
    }

    const previous = (checkpoint.optimizationStatus && typeof checkpoint.optimizationStatus === 'object')
      ? checkpoint.optimizationStatus as Record<string, unknown>
      : {};

    checkpoint.lastCheckpointAt = new Date().toISOString();
    checkpoint.optimizationStatus = {
      currentState: state,
      currentSkillId: state === 'idle' ? null : skillId,
      lastOptimizationAt: state === 'idle' ? new Date().toISOString() : previous.lastOptimizationAt ?? null,
      lastError: state === 'error' ? error : null,
      queueSize: state === 'idle' || state === 'error' ? 0 : 1,
    };

    mkdirSync(join(this.projectRoot, '.ornn', 'state'), { recursive: true });
    writeFileSync(checkpointPath, JSON.stringify(checkpoint, null, 2), 'utf-8');
  }

  private buildSkillCallWindow(
    episode: TaskEpisode,
    traces: Trace[],
    context: ReturnType<ShadowManager['buildDecisionEventContext']>
  ): SkillCallWindow {
    return {
      windowId: context.windowId,
      skillId: context.skillId,
      runtime: context.runtime,
      sessionId: context.sessionId,
      closeReason: 'window_threshold_reached',
      startedAt: episode.startedAt,
      lastTraceAt: traces[traces.length - 1]?.timestamp ?? episode.lastActivityAt,
      traces,
    };
  }

  private async recordSkillFeedback(
    context: ReturnType<ShadowManager['buildDecisionEventContext']>,
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

    const rawEvidenceParts = [
      explanation.decisionRationale,
      ...explanation.uncertainties.map((item) => `uncertainty: ${item}`),
      ...explanation.contradictions.map((item) => `contradiction: ${item}`),
    ].filter(Boolean);

    this.decisionEvents.record({
      tag: 'skill_feedback',
      skillId: context.skillId,
      runtime: context.runtime,
      windowId: context.windowId,
      traceId: context.traceId,
      sessionId: context.sessionId,
      status: evaluation.should_patch ? 'patch_recommended' : 'no_patch_needed',
      detail: explanation.summary,
      confidence: evaluation.confidence,
      changeType: evaluation.change_type ?? null,
      reason: evaluation.reason ?? null,
      traceCount: context.traceCount,
      sessionCount: context.sessionCount,
      ruleName: evaluation.rule_name ?? null,
      evidence: {
        directEvidence: explanation.evidenceReadout,
        causalJudgment: explanation.causalChain,
        action: explanation.recommendedAction,
        rawEvidence: rawEvidenceParts.join('\n'),
      },
    });
  }

  private buildEpisodeWindowTraces(episode: TaskEpisode, sessionTraces: Trace[]): Trace[] {
    const traceRefSet = new Set(episode.traceRefs);
    return sessionTraces.filter((trace) => traceRefSet.has(trace.trace_id));
  }

  private async runWindowAnalysis(
    episode: TaskEpisode,
    shadowId: string,
    sessionTraces: Trace[],
    context: ReturnType<ShadowManager['buildDecisionEventContext']>,
    trigger: ProbeTriggerDecision
  ): Promise<void> {
    const currentContent = this.shadowRegistry.readContent(context.skillId, context.runtime);
    if (!currentContent) {
      this.recordAnalysisFailure(
        context,
        '当前技能内容为空，无法启动窗口分析。',
        null,
        'missing_skill_content'
      );
      return;
    }

    const windowTraces = this.buildEpisodeWindowTraces(episode, sessionTraces);
    const fallbackHint = {
      suggestedTraceDelta: Math.max(6, Math.ceil(Math.max(windowTraces.length, 1) * 0.4)),
      suggestedTurnDelta: 2,
      waitForEventTypes: [],
      mode: 'count_driven' as const,
    };

    this.taskEpisodes.markAnalysisState(context.sessionId, context.skillId, context.runtime, 'running');
    this.writeOptimizationCheckpoint('analyzing', context.skillId, null);
    this.recordAnalysisRequested(
      context,
      null,
      this.describeProbeRequest(trigger).replace('时机探测', '窗口分析'),
      'window_ready'
    );

    const analysis = await this.skillCallAnalyzer.analyzeWindow(
      this.projectRoot,
      this.buildSkillCallWindow(episode, windowTraces, context),
      currentContent
    );

    if (!analysis.success || !analysis.decision) {
      this.recordAnalysisFailure(
        context,
        analysis.userMessage ?? '窗口分析没有返回可用结果。',
        null,
        analysis.technicalDetail ?? analysis.errorCode ?? analysis.error ?? null,
        analysis.technicalDetail
          ? {
              rawEvidence: analysis.technicalDetail,
            }
          : null
      );
      return;
    }

    const evaluation = analysis.evaluation ?? {
      should_patch: analysis.decision === 'apply_optimization',
      reason: analysis.userMessage ?? '当前窗口尚无明确结论。',
      source_sessions: [context.sessionId],
      confidence: 0,
      rule_name: 'llm_window_analysis',
    };
    const nextHint = analysis.nextWindowHint ?? fallbackHint;

    if (analysis.decision === 'need_more_context') {
      this.taskEpisodes.applyNeedMoreContextHint(episode.episodeId, nextHint);
      this.recordEvaluationResult(
        shadowId,
        context,
        'continue_collecting',
        analysis.userMessage ?? evaluation.reason ?? '当前窗口证据不足，继续扩展上下文。',
        evaluation
      );
      this.writeOptimizationCheckpoint('idle', null, null);
      return;
    }

    if (analysis.decision === 'no_optimization') {
      this.recordEvaluationResult(
        shadowId,
        context,
        'no_patch_needed',
        evaluation.reason ? `窗口分析结论：${evaluation.reason}` : '窗口分析认为当前无需修改。',
        evaluation
      );
      await this.recordSkillFeedback(context, evaluation, windowTraces);
      this.taskEpisodes.markAnalysisState(context.sessionId, context.skillId, context.runtime, 'completed');
      this.writeOptimizationCheckpoint('idle', null, null);
      return;
    }

    const patchContextIssue = this.getPatchContextIssue(evaluation);
    if (patchContextIssue) {
      logger.warn('Window analysis returned an incomplete patch recommendation; waiting for more context', {
        shadowId,
        skillId: context.skillId,
        changeType: evaluation.change_type,
        issue: patchContextIssue,
      });
      this.taskEpisodes.applyNeedMoreContextHint(episode.episodeId, nextHint);
      this.recordEvaluationResult(
        shadowId,
        context,
        'continue_collecting',
        `当前分析建议了优化，但还缺少可执行定位：${patchContextIssue}`,
        evaluation
      );
      this.writeOptimizationCheckpoint('idle', null, null);
      return;
    }

    await this.recordSkillFeedback(context, evaluation, windowTraces);
    await this.handleEvaluation(shadowId, evaluation, windowTraces, context, {
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
    context: ReturnType<ShadowManager['buildDecisionEventContext']>,
    options: { skipAnalysisRequested?: boolean; closeOnSkip?: boolean } = {}
  ): Promise<void> {
    // 检查是否在冷却期
    if (this.isInCooldown(shadowId)) {
      logger.debug(`Shadow ${shadowId} is in cooldown, skipping patch`);
      this.recordEvaluationResult(
        shadowId,
        context,
        'cooldown',
        '当前技能仍在冷却期，暂不重复优化。',
        evaluation
      );
      if (options.closeOnSkip) {
        this.taskEpisodes.markAnalysisState(context.sessionId, context.skillId, context.runtime, 'completed');
        this.writeOptimizationCheckpoint('idle', null, null);
      }
      return;
    }

    // 检查是否超过每日限制
    if (this.exceedsDailyLimit(shadowId)) {
      logger.debug(`Shadow ${shadowId} exceeds daily patch limit, skipping`);
      this.recordEvaluationResult(
        shadowId,
        context,
        'daily_limit_reached',
        '当前技能今天的自动优化次数已达上限。',
        evaluation
      );
      if (options.closeOnSkip) {
        this.taskEpisodes.markAnalysisState(context.sessionId, context.skillId, context.runtime, 'completed');
        this.writeOptimizationCheckpoint('idle', null, null);
      }
      return;
    }

    // 检查是否被冻结
    const skillId = skillIdFromShadowId(shadowId) ?? shadowId.split('@')[0];
    const runtime = runtimeFromShadowId(shadowId) ?? 'codex';
    const shadow = this.shadowRegistry.get(skillId, runtime);
    if (shadow?.status === 'frozen') {
      logger.debug(`Shadow ${shadowId} is frozen, skipping patch`);
      this.recordEvaluationResult(
        shadowId,
        context,
        'frozen',
        '当前技能已被冻结，暂不执行自动优化。',
        evaluation
      );
      if (options.closeOnSkip) {
        this.taskEpisodes.markAnalysisState(context.sessionId, context.skillId, context.runtime, 'completed');
        this.writeOptimizationCheckpoint('idle', null, null);
      }
      return;
    }

    // 检查置信度
    if (evaluation.confidence < this.policy.min_confidence) {
      logger.debug(`Confidence ${evaluation.confidence} below threshold, skipping patch`);
      this.recordEvaluationResult(
        shadowId,
        context,
        'confidence_too_low',
        '当前信号可信度不足，继续观察更多调用。',
        evaluation
      );
      if (options.closeOnSkip) {
        this.taskEpisodes.markAnalysisState(context.sessionId, context.skillId, context.runtime, 'completed');
        this.writeOptimizationCheckpoint('idle', null, null);
      }
      return;
    }

    this.taskEpisodes.markAnalysisState(context.sessionId, context.skillId, context.runtime, 'running');
    this.writeOptimizationCheckpoint('analyzing', context.skillId, null);
    if (!options.skipAnalysisRequested) {
      this.recordAnalysisRequested(context, evaluation);
    }

    // 执行 patch
    const patchResult = await this.executePatch(shadowId, evaluation);
    if (!patchResult.ok) {
      this.recordAnalysisFailure(
        context,
        patchResult.error ?? '本轮优化未完成，但系统没有返回更具体的原因。',
        evaluation
      );
      return;
    }

    this.decisionEvents.record({
      tag: 'patch_applied',
      skillId: context.skillId,
      runtime: context.runtime,
      windowId: context.windowId,
      traceId: context.traceId,
      sessionId: context.sessionId,
      status: 'success',
      detail: `已完成本轮优化并写回 shadow skill。revision=${patchResult.revision ?? 0}`,
      confidence: evaluation.confidence,
      changeType: evaluation.change_type ?? null,
      reason: evaluation.reason ?? null,
      traceCount: context.traceCount,
      sessionCount: context.sessionCount,
      ruleName: evaluation.rule_name ?? null,
      linesAdded: patchResult.linesAdded ?? null,
      linesRemoved: patchResult.linesRemoved ?? null,
    });
    this.taskEpisodes.markAnalysisState(context.sessionId, context.skillId, context.runtime, 'completed');
    this.writeOptimizationCheckpoint('idle', null, null);
  }

  /**
   * 执行 patch
   */
  private async executePatch(
    shadowId: string,
    evaluation: EvaluationResult
  ): Promise<{
    ok: boolean;
    error?: string;
    revision?: number;
    linesAdded?: number;
    linesRemoved?: number;
  }> {
    const skillId = skillIdFromShadowId(shadowId) ?? shadowId.split('@')[0];
    const runtime = runtimeFromShadowId(shadowId) ?? 'codex';

    try {
      // 读取当前内容
      const currentContent = this.shadowRegistry.readContent(skillId, runtime);
      if (!currentContent) {
        logger.warn(`Cannot read shadow content: ${skillId}`);
        return {
          ok: false,
          error: '当前技能内容为空，无法生成优化结果。',
        };
      }

      // 生成 patch
      const context = {
        pattern: evaluation.reason,
        reason: evaluation.reason,
        section: evaluation.target_section,
      };

      const patchResult = await patchGenerator.generate(
        evaluation.change_type!,
        currentContent,
        context
      );

      if (!patchResult.success) {
        logger.warn(`Patch generation failed: ${patchResult.error}`);
        return {
          ok: false,
          error: patchResult.error ?? 'Patch 生成失败。',
        };
      }

      // 获取当前 revision
      const currentRevision = this.journalManager.getLatestRevision(shadowId);

      // 先为当前 revision 保留快照，确保后续可回滚到本次改动前的版本。
      this.journalManager.createSnapshot(shadowId, currentRevision);

      // 写入新内容
      this.shadowRegistry.writeContent(skillId, patchResult.newContent, runtime);

      // 记录演化
      this.journalManager.record(shadowId, {
        shadow_id: shadowId,
        timestamp: new Date().toISOString(),
        reason: evaluation.reason ?? 'Auto optimization',
        source_sessions: evaluation.source_sessions,
        change_type: evaluation.change_type!,
        patch: patchResult.patch,
        before_hash: hashString(currentContent),
        after_hash: hashString(patchResult.newContent),
        applied_by: 'auto',
      });

      // 更新时间戳
      this.lastPatchTime.set(shadowId, Date.now());

      // 更新计数
      const today = new Date().toDateString();
      const key = `${shadowId}:${today}`;
      this.patchCountToday.set(key, (this.patchCountToday.get(key) ?? 0) + 1);

      // 检查是否需要创建 snapshot
      if (evaluation.change_type === 'rewrite_section' || (currentRevision + 1) % 5 === 0) {
        this.journalManager.createSnapshot(shadowId, currentRevision + 1);
      }

      const patchStats = this.countPatchLines(patchResult.patch);

      logger.info(`Patch executed successfully`, {
        shadow_id: shadowId,
        change_type: evaluation.change_type,
        revision: currentRevision + 1,
      });
      return {
        ok: true,
        revision: currentRevision + 1,
        linesAdded: patchStats.linesAdded,
        linesRemoved: patchStats.linesRemoved,
      };
    } catch (error) {
      logger.error(`Patch execution failed`, { shadow_id: shadowId, error });
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
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
    const eventContext = this.buildDecisionEventContext(shadowId, fallbackTrace, traces);
    const currentContent = this.shadowRegistry.readContent(skillId, runtime);
    if (!currentContent) {
      this.recordAnalysisFailure(
        eventContext,
        '当前技能内容为空，无法启动手动窗口分析。',
        null,
        'missing_skill_content'
      );
      return null;
    }

    this.recordAnalysisRequested(eventContext, null, '手动触发窗口分析。', 'manual');
    const analysis = await this.skillCallAnalyzer.analyzeWindow(
      this.projectRoot,
      {
        windowId: `manual::${eventContext.windowId}`,
        skillId,
        runtime,
        sessionId: fallbackTrace.session_id,
        closeReason: 'manual_trigger',
        startedAt: traces[0]?.timestamp ?? fallbackTrace.timestamp,
        lastTraceAt: traces[traces.length - 1]?.timestamp ?? fallbackTrace.timestamp,
        traces,
      },
      currentContent
    );

    if (!analysis.success || !analysis.decision) {
      this.recordAnalysisFailure(
        eventContext,
        analysis.userMessage ?? '手动窗口分析没有返回可用结果。',
        null,
        analysis.technicalDetail ?? analysis.errorCode ?? analysis.error ?? null
      );
      return null;
    }

    const evaluation = analysis.evaluation ?? {
      should_patch: analysis.decision === 'apply_optimization',
      reason: analysis.userMessage ?? '当前窗口尚无明确结论。',
      source_sessions: [eventContext.sessionId],
      confidence: 0,
      rule_name: 'llm_window_analysis',
    };

    if (analysis.decision === 'need_more_context') {
      this.recordEvaluationResult(
        shadowId,
        eventContext,
        'continue_collecting',
        analysis.userMessage ?? evaluation.reason ?? '当前窗口证据不足，继续观察。',
        evaluation
      );
      return evaluation;
    }

    if (analysis.decision === 'no_optimization') {
      this.recordEvaluationResult(
        shadowId,
        eventContext,
        'no_patch_needed',
        evaluation.reason ? `窗口分析结论：${evaluation.reason}` : '窗口分析认为当前无需修改。',
        evaluation
      );
      return evaluation;
    }

    void this.handleEvaluation(shadowId, evaluation, traces, eventContext, { skipAnalysisRequested: true });
    return evaluation;
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
