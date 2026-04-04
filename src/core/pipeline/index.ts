import { createChildLogger } from '../../utils/logger.js';
import { withTimeout } from '../../utils/timeout.js';
import { createTraceManager } from '../observer/trace-manager.js';
import { createTraceSkillMapper } from '../trace-skill-mapper/index.js';
import { evaluator } from '../evaluator/index.js';
import { createShadowRegistry } from '../shadow-registry/index.js';
import type { Trace, EvaluationResult, SkillTracesGroup } from '../../types/index.js';

// Timer 类型（仅用于 startBackgroundLoop 返回值）
type Timer = ReturnType<typeof setInterval>;

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
 * 流程: Trace采集 -> Trace-Skill映射 -> 评估 -> 生成优化任务
 */
export class OptimizationPipeline {
  private config: PipelineConfig;
  private traceManager;
  private traceSkillMapper;
  private shadowRegistry;
  private state: PipelineState;
  private runningPromise: Promise<OptimizationTask[]> | null = null;

  constructor(config: PipelineConfig) {
    this.config = config;
    this.traceManager = createTraceManager(config.projectRoot);
    this.traceSkillMapper = createTraceSkillMapper(config.projectRoot);
    this.shadowRegistry = createShadowRegistry(config.projectRoot);
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

      // Step 3: 对每个 skill 分组进行评估（带超时控制）
      for (const group of skillGroups) {
        try {
          const task = await this.evaluateSkillGroup(group);
          if (task) {
            tasks.push(task);
          }
        } catch (error) {
          const errorMsg = `Failed to evaluate skill ${group.skill_id}: ${String(error)}`;
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

  /**
   * 评估单个 skill 分组（带超时控制）
   */
  private async evaluateSkillGroup(group: SkillTracesGroup): Promise<OptimizationTask | null> {
    const { skill_id, shadow_id, traces } = group;

    // 检查 shadow skill 是否存在
    const shadow = this.shadowRegistry.get(skill_id);
    if (!shadow) {
      logger.debug('Shadow skill not found, skipping', { skill_id });
      return null;
    }

    // 检查是否被冻结
    if (shadow.status === 'frozen') {
      logger.debug('Shadow skill is frozen, skipping', { skill_id });
      return null;
    }

    // 使用 evaluator 评估 traces（带超时控制）
    const evaluation = await this.evaluateWithTimeout(traces, 10000);
    if (!evaluation || !evaluation.should_patch) {
      logger.debug('No optimization needed for skill', { skill_id });
      return null;
    }

    // 检查置信度
    if (evaluation.confidence < this.config.minConfidence) {
      logger.debug('Confidence too low, skipping', {
        skill_id,
        confidence: evaluation.confidence,
        minConfidence: this.config.minConfidence,
      });
      return null;
    }

    logger.info('Optimization task generated', {
      skill_id,
      change_type: evaluation.change_type,
      confidence: evaluation.confidence,
    });

    return {
      skill_id,
      shadow_id,
      traces,
      evaluation,
    };
  }

  /**
   * 带超时控制的评估。
   * 超时或评估异常时抛出，调用方可在 evaluateSkillGroup 中统一捕获并记录错误。
   */
  private async evaluateWithTimeout(
    traces: Trace[],
    timeoutMs: number
  ): Promise<EvaluationResult | null> {
    const evaluatePromise = new Promise<EvaluationResult | null>((resolve, reject) => {
      try {
        resolve(evaluator.evaluate(traces));
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });

    return withTimeout(evaluatePromise, timeoutMs, 'Evaluation');
  }

  /**
   * 启动后台循环
   */
  startBackgroundLoop(intervalMs: number = 60000): Timer {
    logger.info('Starting background pipeline loop', { intervalMs });

    const timer = setInterval(() => {
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

    return timer;
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
