import { createChildLogger } from '../../utils/logger.js';
import { withTimeout } from '../../utils/timeout.js';
import { createTraceManager } from '../observer/trace-manager.js';
import { createTraceSkillMapper } from '../trace-skill-mapper/index.js';
import { createSkillCallAnalyzer } from '../skill-call-analyzer/index.js';
import { createShadowRegistry } from '../shadow-registry/index.js';
import type { Trace, EvaluationResult } from '../../types/index.js';
import { runtimeFromShadowId } from '../../utils/parse.js';
import { createSkillCallWindow, type SkillCallWindow } from '../skill-call-window/index.js';
import {
  collectSessionWindowCandidates,
  type SessionWindowCandidate,
} from '../session-window-candidates/index.js';

const logger = createChildLogger('pipeline');

/**
 * Pipeline 配置
 */
export interface PipelineConfig {
  projectRoot: string;
  autoOptimize: boolean;
  minConfidence: number;
}

/**
 * 优化任务
 */
export interface OptimizationTask {
  skill_id: string;
  shadow_id: string;
  traces: Trace[];
  evaluation: EvaluationResult;
}

/**
 * Pipeline 状态
 */
export interface PipelineState {
  isRunning: boolean;
  lastRunAt: string | null;
  processedTraces: number;
  generatedTasks: number;
  errors: string[];
}

/**
 * 最大错误记录数
 */
const MAX_ERRORS = 1000;

/**
 * 默认超时时间（毫秒）
 */
const DEFAULT_TIMEOUT_MS = 30000; // 30秒

/**
 * OptimizationPipeline
 * 自动优化闭环的核心编排模块
 *
 * 流程: Trace采集 -> Trace-Skill映射 -> 窗口分析 -> 生成优化任务
 */
export class OptimizationPipeline {
  private config: PipelineConfig;
  private traceManager;
  private traceSkillMapper;
  private shadowRegistry;
  private skillCallAnalyzer;
  private state: PipelineState;
  private runningPromise: Promise<OptimizationTask[]> | null = null;
  private backgroundTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config: PipelineConfig) {
    this.config = config;
    this.traceManager = createTraceManager(config.projectRoot);
    this.traceSkillMapper = createTraceSkillMapper(config.projectRoot);
    this.shadowRegistry = createShadowRegistry(config.projectRoot);
    this.skillCallAnalyzer = createSkillCallAnalyzer();
    this.state = {
      isRunning: false,
      lastRunAt: null,
      processedTraces: 0,
      generatedTasks: 0,
      errors: [],
    };
  }

  /**
   * 初始化 pipeline
   */
  async init(): Promise<void> {
    await this.traceManager.init();
    await this.traceSkillMapper.init();
    this.shadowRegistry.init();
    logger.info('OptimizationPipeline initialized', { projectRoot: this.config.projectRoot });
  }

  /**
   * 执行一次完整的 pipeline 循环
   *
   * @returns 生成的优化任务列表
   */
  async runOnce(timeoutMs: number = DEFAULT_TIMEOUT_MS): Promise<OptimizationTask[]> {
    // 如果已经在运行，返回现有的 Promise（防止竞态条件）
    if (this.runningPromise) {
      logger.warn('Pipeline is already running, returning existing promise');
      return this.runningPromise;
    }

    this.state.isRunning = true;
    this.runningPromise = withTimeout(this.doRunOnce(), timeoutMs, 'Pipeline run');

    try {
      return await this.runningPromise;
    } finally {
      this.runningPromise = null;
      this.state.isRunning = false;
    }
  }

  /**
   * 实际执行 pipeline 循环
   */
  private async doRunOnce(): Promise<OptimizationTask[]> {
    const tasks: OptimizationTask[] = [];

    try {
      logger.info('Starting pipeline run');

      // Step 1: 获取最近的 traces
      const recentTraces = await this.traceManager.getRecentTraces(100);
      if (recentTraces.length === 0) {
        logger.info('No recent traces found, skipping pipeline run');
        return [];
      }

      // Step 2: 基于 recent traces 恢复真实 session 窗口候选
      const windowCandidates = await this.collectWindowCandidates(recentTraces);
      logger.info('Session-backed analysis windows collected', { windows: windowCandidates.length });

      // Step 3: 对每个真实窗口进行分析（带超时控制）
      for (const candidate of windowCandidates) {
        try {
          const groupTasks = await this.evaluateWindowCandidate(candidate);
          if (groupTasks.length > 0) {
            tasks.push(...groupTasks);
          }
        } catch (error) {
          const errorMsg = `Failed to analyze skill window ${candidate.skill_id}@${candidate.sessionId}: ${String(error)}`;
          logger.error(errorMsg);
          this.addError(errorMsg);
        }
      }

      // 更新状态
      this.state.processedTraces += recentTraces.length;
      this.state.generatedTasks += tasks.length;
      this.state.lastRunAt = new Date().toISOString();

      logger.info('Pipeline run completed', {
        processedTraces: recentTraces.length,
        generatedTasks: tasks.length,
      });

      return tasks;
    } catch (error) {
      const errorMsg = `Pipeline run failed: ${String(error)}`;
      logger.error(errorMsg);
      this.addError(errorMsg);
      throw error;
    }
  }

  /**
   * 添加错误记录（限制数组大小）
   */
  private addError(errorMsg: string): void {
    if (this.state.errors.length >= MAX_ERRORS) {
      this.state.errors.shift(); // 移除最旧的错误
    }
    this.state.errors.push(errorMsg);
  }

  private getPatchContextIssue(evaluation: EvaluationResult): string | null {
    if (!evaluation.should_patch || !evaluation.change_type) {
      return null;
    }

    if (
      (evaluation.change_type === 'prune_noise' || evaluation.change_type === 'rewrite_section') &&
      !evaluation.target_section?.trim()
    ) {
      return 'missing_target_section';
    }

    return null;
  }

  private buildAnalysisWindow(candidate: SessionWindowCandidate): SkillCallWindow {
    const shadowId = candidate.shadow_id;
    const skillId = candidate.skill_id;
    const sessionId = candidate.sessionId;
    const runtime = runtimeFromShadowId(shadowId) ?? 'codex';

    return createSkillCallWindow({
      windowId: `pipeline::session::${runtime}::${skillId}::${sessionId}`,
      skillId,
      runtime,
      sessionId,
      closeReason: 'session_timeline_replay',
      traces: candidate.sessionTraces,
    });
  }

  /**
   * 从 recent traces 恢复基于真实 session 时间线的分析窗口候选。
   * 只要拿不到完整 session timeline，就不再退回到 mapped-only traces。
   */
  private async collectWindowCandidates(recentTraces: Trace[]): Promise<SessionWindowCandidate[]> {
    const sessionsWithoutTimeline = new Set<string>();
    const candidates = await collectSessionWindowCandidates({
      recentTraces,
      loadSessionTraces: async (sessionId) => {
        const traces = await this.traceManager.getSessionTraces(sessionId);
        if (traces.length === 0) {
          sessionsWithoutTimeline.add(sessionId);
        }
        return traces;
      },
      mapTrace: (trace) => this.traceSkillMapper.mapTrace(trace),
      minConfidence: 0.5,
    });

    for (const sessionId of sessionsWithoutTimeline) {
      logger.warn('Skipping pipeline session because no full session timeline is available', {
        sessionId,
      });
    }
    return candidates;
  }

  /**
   * 分析单个真实 session 窗口（带超时控制）
   */
  private async evaluateWindowCandidate(candidate: SessionWindowCandidate): Promise<OptimizationTask[]> {
    const { skill_id, shadow_id, sessionId, sessionTraces } = candidate;
    const runtime = runtimeFromShadowId(shadow_id) ?? 'codex';
    const tasks: OptimizationTask[] = [];

    // 检查 shadow skill 是否存在
    const shadow = this.shadowRegistry.get(skill_id, runtime);
    if (!shadow) {
      logger.debug('Shadow skill not found, skipping', { skill_id, runtime });
      return tasks;
    }

    // 检查是否被冻结
    if (shadow.status === 'frozen') {
      logger.debug('Shadow skill is frozen, skipping', { skill_id, runtime });
      return tasks;
    }

    const currentContent = this.shadowRegistry.readContent(skill_id, runtime);
    if (!currentContent?.trim()) {
      logger.debug('Shadow skill content is empty, skipping pipeline analysis', { skill_id, runtime });
      return tasks;
    }

    const analysis = await this.evaluateWithTimeout(
      this.buildAnalysisWindow(candidate),
      currentContent,
      10000
    );
    if (!analysis.success || !analysis.decision) {
      logger.warn('Pipeline window analysis failed', {
        skill_id,
        runtime,
        sessionId,
        error: analysis.error ?? analysis.errorCode ?? analysis.technicalDetail ?? analysis.userMessage,
      });
      return tasks;
    }

    const evaluation = analysis.evaluation ?? {
      should_patch: analysis.decision === 'apply_optimization',
      reason: analysis.userMessage ?? 'Pipeline window analysis returned no concrete conclusion.',
      source_sessions: [sessionId],
      confidence: 0,
      rule_name: 'llm_window_analysis',
    };

    if (analysis.decision !== 'apply_optimization' || !evaluation.should_patch) {
      logger.debug('Pipeline window does not require optimization yet', {
        skill_id,
        runtime,
        sessionId,
        decision: analysis.decision,
      });
      return tasks;
    }

    if (this.getPatchContextIssue(evaluation)) {
      logger.debug('Pipeline window suggested a patch without executable context, skipping', {
        skill_id,
        runtime,
        sessionId,
        changeType: evaluation.change_type,
      });
      return tasks;
    }

    if (evaluation.confidence < this.config.minConfidence) {
      logger.debug('Pipeline window analysis confidence too low, skipping', {
        skill_id,
        sessionId,
        confidence: evaluation.confidence,
        minConfidence: this.config.minConfidence,
      });
      return tasks;
    }

    logger.info('Optimization task generated from session-backed window analysis', {
      skill_id,
      sessionId,
      mappedTraceCount: candidate.mappedTraces.length,
      sessionTraceCount: sessionTraces.length,
      change_type: evaluation.change_type,
      confidence: evaluation.confidence,
    });

    tasks.push({
      skill_id,
      shadow_id,
      traces: sessionTraces,
      evaluation,
    });

    return tasks;
  }

  /**
   * 带超时控制的窗口分析。
   * 超时或分析异常时抛出，调用方可在 evaluateSkillGroup 中统一捕获并记录错误。
   */
  private async evaluateWithTimeout(
    window: SkillCallWindow,
    skillContent: string,
    timeoutMs: number
  ) {
    const evaluatePromise = new Promise<Awaited<ReturnType<typeof this.skillCallAnalyzer.analyzeWindow>>>(
      (resolve, reject) => {
      try {
        resolve(this.skillCallAnalyzer.analyzeWindow(this.config.projectRoot, window, skillContent));
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    }
    );

    return withTimeout(evaluatePromise, timeoutMs, 'Pipeline window analysis');
  }

  /**
   * 启动后台循环
   */
  startBackgroundLoop(intervalMs: number = 60000): void {
    if (this.backgroundTimer !== null) {
      logger.warn('Background loop already running');
      return;
    }
    logger.info('Starting background pipeline loop', { intervalMs });

    this.backgroundTimer = setInterval(() => {
      void (async (): Promise<void> => {
        try {
          if (this.config.autoOptimize) {
            await this.runOnce();
          }
        } catch (error) {
          logger.error('Background pipeline run failed', { error });
        }
      })();
    }, intervalMs);
  }

  /**
   * 停止后台循环
   */
  stopBackgroundLoop(): void {
    if (this.backgroundTimer !== null) {
      clearInterval(this.backgroundTimer);
      this.backgroundTimer = null;
      logger.info('Background pipeline loop stopped');
    }
  }

  /**
   * 获取 pipeline 状态
   */
  getState(): PipelineState {
    return { ...this.state };
  }

  /**
   * 获取映射统计
   */
  getMappingStats(): {
    total_mappings: number;
    by_skill: Record<string, number>;
    avg_confidence: number;
  } {
    return this.traceSkillMapper.getMappingStats();
  }

  /**
   * 注册 skill（用于映射）
   */
  registerSkill(skillId: string, originPath: string): void {
    // 这里需要从 origin registry 获取完整的 skill 信息
    // 暂时使用简化的实现
    logger.debug('Registering skill for mapping', { skillId, originPath });
  }

  /**
   * 清理旧数据
   */
  cleanup(retentionDays: number = 30): void {
    this.traceManager.cleanupOldTraces(retentionDays);
    this.traceSkillMapper.cleanupOldMappings(retentionDays);
    logger.info('Cleanup completed', { retentionDays });
  }

  /**
   * 关闭 pipeline
   */
  close(): void {
    this.stopBackgroundLoop();
    this.traceManager.close();
    this.traceSkillMapper.close();
    this.shadowRegistry.close();
    logger.info('Pipeline closed');
  }
}

// 导出工厂函数
export function createOptimizationPipeline(config: PipelineConfig): OptimizationPipeline {
  return new OptimizationPipeline(config);
}
