import { createChildLogger } from '../../utils/logger.js';
import { configManager } from '../../config/index.js';
import { createShadowRegistry } from '../shadow-registry/index.js';
import { createJournalManager } from '../journal/index.js';
import { createTraceManager } from '../observer/trace-manager.js';
import { createTraceSkillMapper } from '../trace-skill-mapper/index.js';
import { evaluator } from '../evaluator/index.js';
import { patchGenerator } from '../patch-generator/index.js';
import { hashString } from '../../utils/hash.js';
import { skillIdFromShadowId } from '../../utils/parse.js';
import { createSQLiteStorage } from '../../storage/sqlite.js';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { Trace, EvaluationResult, AutoOptimizePolicy, ShadowStatus } from '../../types/index.js';

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
  private lastPatchTime: Map<string, number> = new Map();
  private patchCountToday: Map<string, number> = new Map();

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.shadowRegistry = createShadowRegistry(projectRoot);
    this.journalManager = createJournalManager(projectRoot);
    this.traceManager = createTraceManager(projectRoot);
    this.traceSkillMapper = createTraceSkillMapper(projectRoot);
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

    const candidateRoots = new Set<string>([
      ...configManager.getOriginPaths(),
      join(homedir(), '.agents', 'skills'),
      join(homedir(), '.codex', 'skills'),
    ]);

    let discovered = 0;
    let registered = 0;
    let createdShadows = 0;

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

        let content = '';
        try {
          content = readFileSync(skillPath, 'utf-8');
        } catch {
          continue;
        }

        const now = new Date().toISOString();
        const originVersion = hashString(content);
        const origin = {
          skill_id: skillId,
          origin_path: skillPath,
          origin_version: originVersion,
          source: 'local' as const,
          installed_at: now,
          last_seen_at: now,
        };

        this.db.upsertOriginSkill(origin);

        if (!this.shadowRegistry.has(skillId)) {
          this.shadowRegistry.create(skillId, content, originVersion);
          createdShadows++;
        }

        const shadowEntry = this.shadowRegistry.get(skillId);
        const status: ShadowStatus = shadowEntry?.status === 'frozen' ? 'frozen' : 'active';
        const shadow = {
          project_id: this.projectRoot,
          skill_id: skillId,
          shadow_id: `${skillId}@${this.projectRoot}`,
          origin_skill_id: skillId,
          origin_version_at_fork: originVersion,
          shadow_path: join(this.projectRoot, '.ornn', 'shadows', `${skillId}.md`),
          current_revision: 0,
          status,
          created_at: now,
          last_optimized_at: now,
        };
        this.db.upsertShadowSkill(shadow);
        this.traceSkillMapper.registerSkill(origin, shadow);
        registered++;
      }
    }

    logger.info('Skill monitoring bootstrap completed', {
      discovered,
      registered,
      createdShadows,
      roots: Array.from(candidateRoots),
    });
  }

  /**
   * 处理 trace
   */
  async processTrace(trace: Trace): Promise<void> {
    // 记录 trace
    this.traceManager.recordTrace(trace);

    // 检查是否需要触发评估
    const shadowId = this.findShadowForTrace(trace);
    if (!shadowId) {
      return;
    }

    // 记录命中次数，供 dashboard 监控展示
    const skillId = skillIdFromShadowId(shadowId);
    if (skillId) {
      this.shadowRegistry.incrementTraceCount(skillId);
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
    const shadow = this.shadowRegistry.get(skillIdFromShadowId(shadowId) ?? shadowId.split('@')[0]);
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
    const skillId = skillIdFromShadowId(shadowId) ?? shadowId.split('@')[0];

    try {
      // 读取当前内容
      const currentContent = this.shadowRegistry.readContent(skillId);
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

      const patchResult = await patchGenerator.generate(
        evaluation.change_type!,
        currentContent,
        context
      );

      if (!patchResult.success) {
        logger.warn(`Patch generation failed: ${patchResult.error}`);
        return;
      }

      // 获取当前 revision
      const currentRevision = this.journalManager.getLatestRevision(shadowId);

      // 写入新内容
      this.shadowRegistry.writeContent(skillId, patchResult.newContent);

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
      void this.handleEvaluation(shadowId, evaluation, traces);
    }

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
    const shadow = this.shadowRegistry.get(skillId);

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
