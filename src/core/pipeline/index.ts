import { createChildLogger } from '../../utils/logger.js';
import { withTimeout } from '../../utils/timeout.js';
import { createTraceManager } from '../observer/trace-manager.js';
import { createTraceSkillMapper } from '../trace-skill-mapper/index.js';
import { createSkillCallAnalyzer } from '../skill-call-analyzer/index.js';
import { createShadowRegistry } from '../shadow-registry/index.js';
import type { Trace, EvaluationResult, SkillTracesGroup } from '../../types/index.js';
import { runtimeFromShadowId } from '../../utils/parse.js';
import type { SkillCallWindow } from '../skill-call-window/index.js';

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

      // Step 2: 将 traces 映射到 skills 并分组
      const skillGroups = this.traceSkillMapper.mapAndGroupTraces(recentTraces);
      logger.info('Traces mapped to skills', { groups: skillGroups.length });

      // Step 3: 对每个 skill 分组进行窗口分析（带超时控制）
      for (const group of skillGroups) {
        try {
          const groupTasks = await this.evaluateSkillGroup(group);
          if (groupTasks.length > 0) {
            tasks.push(...groupTasks);
          }
        } catch (error) {
          const errorMsg = `Failed to analyze skill window ${group.skill_id}: ${String(error)}`;
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

  private buildAnalysisWindow(skillId: string, shadowId: string, traces: Trace[], sessionId: string): SkillCallWindow {
    const orderedTraces = [...traces].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    const runtime = runtimeFromShadowId(shadowId) ?? 'codex';

    return {
      windowId: `pipeline::${runtime}::${skillId}::${sessionId}`,
      skillId,
      runtime,
      sessionId,
      closeReason: 'window_threshold_reached',
      startedAt: orderedTraces[0]?.timestamp ?? new Date().toISOString(),
      lastTraceAt: orderedTraces[orderedTraces.length - 1]?.timestamp ?? new Date().toISOString(),
      traces: orderedTraces,
    };
  }

  /**
   * 分析单个 skill 分组（带超时控制）
   */
  private async evaluateSkillGroup(group: SkillTracesGroup): Promise<OptimizationTask[]> {
    const { skill_id, shadow_id, traces } = group;
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

    const sessionIds = [...new Set(traces.map((trace) => trace.session_id).filter(Boolean))];
    for (const sessionId of sessionIds) {
      const mappedSessionTraces = traces
        .filter((trace) => trace.session_id === sessionId)
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      const sessionTraces = await this.traceManager.getSessionTraces(sessionId);
      const windowTraces = (sessionTraces.length > 0 ? sessionTraces : mappedSessionTraces)
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

      const analysis = await this.evaluateWithTimeout(
        this.buildAnalysisWindow(skill_id, shadow_id, windowTraces, sessionId),
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
        continue;
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
        continue;
      }

      if (this.getPatchContextIssue(evaluation)) {
        logger.debug('Pipeline window suggested a patch without executable context, skipping', {
          skill_id,
          runtime,
          sessionId,
          changeType: evaluation.change_type,
        });
        continue;
      }

      if (evaluation.confidence < this.config.minConfidence) {
        logger.debug('Pipeline window analysis confidence too low, skipping', {
          skill_id,
          sessionId,
          confidence: evaluation.confidence,
          minConfidence: this.config.minConfidence,
        });
        continue;
      }

      logger.info('Optimization task generated from window analysis', {
        skill_id,
        sessionId,
        change_type: evaluation.change_type,
        confidence: evaluation.confidence,
      });

      tasks.push({
        skill_id,
        shadow_id,
        traces: windowTraces,
        evaluation,
      });
    }

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
