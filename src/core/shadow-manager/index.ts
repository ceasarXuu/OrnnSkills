import { createChildLogger } from '../../utils/logger.js';
import { configManager } from '../../config/index.js';
import { createShadowRegistry } from '../shadow-registry/index.js';
import { createJournalManager } from '../journal/index.js';
import { createTraceManager } from '../observer/trace-manager.js';
import { evaluator } from '../evaluator/index.js';
import { patchGenerator } from '../patch-generator/index.js';
import { hashString } from '../../utils/hash.js';
import type { Trace, EvaluationResult, AutoOptimizePolicy } from '../../types/index.js';

const logger = createChildLogger('shadow-manager');

/**
 * Shadow Manager
 * 负责编排整个演化流程
 */
export class ShadowManager {
  private shadowRegistry;
  private journalManager;
  private traceManager;
  private policy: AutoOptimizePolicy;
  private lastPatchTime: Map<string, number> = new Map();
  private patchCountToday: Map<string, number> = new Map();

  constructor(projectRoot: string) {
    this.shadowRegistry = createShadowRegistry(projectRoot);
    this.journalManager = createJournalManager(projectRoot);
    this.traceManager = createTraceManager(projectRoot);

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
    await this.shadowRegistry.init();
    await this.journalManager.init();
    await this.traceManager.init();
    logger.info('Shadow manager initialized');
  }

  /**
   * 处理 trace
   */
  async processTrace(trace: Trace): Promise<void> {
    // 记录 trace
    this.traceManager.recordTrace(trace);

    // 检查是否需要触发评估
    const shadowId = await this.findShadowForTrace(trace);
    if (!shadowId) {
      return;
    }

    // 获取最近的 traces
    const recentTraces = await this.traceManager.getSessionTraces(trace.session_id);

    // 评估是否需要优化
    const evaluation = evaluator.evaluate(recentTraces);

    if (evaluation && evaluation.should_patch) {
      await this.handleEvaluation(shadowId, evaluation, recentTraces);
    }
  }

  /**
   * 查找 trace 对应的 shadow
   */
  private async findShadowForTrace(_trace: Trace): Promise<string | null> {
    // 这里需要根据 trace 的内容推断对应的 skill
    // 简化实现：返回 null，实际需要更复杂的逻辑
    return null;
  }

  /**
   * 处理评估结果
   */
  private async handleEvaluation(
    shadowId: string,
    evaluation: EvaluationResult,
    _traces: Trace[]
  ): Promise<void> {
    // 检查是否在冷却期
    if (this.isInCooldown(shadowId)) {
      logger.debug(`Shadow ${shadowId} is in cooldown, skipping patch`);
      return;
    }

    // 检查是否超过每日限制
    if (this.exceedsDailyLimit(shadowId)) {
      logger.debug(`Shadow ${shadowId} exceeds daily patch limit, skipping`);
      return;
    }

    // 检查是否被冻结
    const shadow = await this.shadowRegistry.get(shadowId.split('@')[0]);
    if (shadow?.status === 'frozen') {
      logger.debug(`Shadow ${shadowId} is frozen, skipping patch`);
      return;
    }

    // 检查置信度
    if (evaluation.confidence < this.policy.min_confidence) {
      logger.debug(`Confidence ${evaluation.confidence} below threshold, skipping patch`);
      return;
    }

    // 执行 patch
    await this.executePatch(shadowId, evaluation);
  }

  /**
   * 执行 patch
   */
  private async executePatch(shadowId: string, evaluation: EvaluationResult): Promise<void> {
    const skillId = shadowId.split('@')[0];

    try {
      // 读取当前内容
      const currentContent = await this.shadowRegistry.readContent(skillId);
      if (!currentContent) {
        logger.warn(`Cannot read shadow content: ${skillId}`);
        return;
      }

      // 生成 patch
      const context = {
        pattern: evaluation.reason,
        reason: evaluation.reason,
        section: evaluation.target_section,
      };

      const patchResult = patchGenerator.generate(
        evaluation.change_type!,
        currentContent,
        context
      );

      if (!patchResult.success) {
        logger.warn(`Patch generation failed: ${patchResult.error}`);
        return;
      }

      // 获取当前 revision
      const currentRevision = await this.journalManager.getLatestRevision(shadowId);

      // 写入新内容
      await this.shadowRegistry.writeContent(skillId, patchResult.newContent);

      // 记录演化
      await this.journalManager.record(shadowId, {
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
        await this.journalManager.createSnapshot(shadowId, currentRevision + 1);
      }

      logger.info(`Patch executed successfully`, {
        shadow_id: shadowId,
        change_type: evaluation.change_type,
        revision: currentRevision + 1,
      });
    } catch (error) {
      logger.error(`Patch execution failed`, { shadow_id: shadowId, error });
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

    // 评估
    const evaluation = evaluator.evaluate(traces);

    if (evaluation && evaluation.should_patch) {
      await this.executePatch(shadowId, evaluation);
    }

    return evaluation;
  }

  /**
   * 获取 shadow 状态
   */
  async getShadowState(shadowId: string) {
    const skillId = shadowId.split('@')[0];
    const shadow = await this.shadowRegistry.get(skillId);

    if (!shadow) {
      return null;
    }

    const latestRevision = await this.journalManager.getLatestRevision(shadowId);
    const snapshots = await this.journalManager.getSnapshots(shadowId);

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
  async cleanupOldTraces(retentionDays: number): Promise<number> {
    return this.traceManager.cleanupOldTraces(retentionDays);
  }

  /**
   * 关闭
   */
  close(): void {
    this.shadowRegistry.close();
    this.journalManager.close();
    this.traceManager.close();
    logger.info('Shadow manager closed');
  }
}

// 导出工厂函数
export function createShadowManager(projectRoot: string): ShadowManager {
  return new ShadowManager(projectRoot);
}