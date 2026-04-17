import { join } from 'node:path';
import { configManager } from '../../config/index.js';
import type { Trace } from '../../types/index.js';
import { createChildLogger } from '../../utils/logger.js';
import { createSQLiteStorage } from '../../storage/sqlite.js';
import { createDaemonStatusStore } from '../daemon-status-store/index.js';
import { createDecisionEventRecorder } from '../decision-events/index.js';
import { createJournalManager } from '../journal/index.js';
import { createTraceManager } from '../observer/trace-manager.js';
import { createShadowRegistry } from '../shadow-registry/index.js';
import { bootstrapSkillsForMonitoring } from '../shadow-bootstrapper/index.js';
import { createSkillCallAnalyzer } from '../skill-call-analyzer/index.js';
import { createTaskEpisodeStore } from '../task-episode/index.js';
import { createTraceSkillMapper } from '../trace-skill-mapper/index.js';
import { createSkillVersionManager } from '../skill-version/index.js';
import { ShadowEpisodeProbeService } from './episode-probe-service.js';
import { ShadowManualOptimizeService } from './manual-optimize-service.js';
import { ShadowOptimizationRunner } from './optimization-runner.js';
import { ShadowTraceIngestService } from './trace-ingest-service.js';
import type { TriggerOptimizeResult } from './shadow-manager-types.js';
import { runtimeFromShadowId, skillIdFromShadowId } from '../../utils/parse.js';

const logger = createChildLogger('shadow-manager');

export type { TriggerOptimizeResult } from './shadow-manager-types.js';

/**
 * Shadow Manager
 * 负责编排整个演化流程
 */
export class ShadowManager {
  private readonly shadowRegistry;
  private readonly journalManager;
  private readonly traceManager;
  private readonly traceSkillMapper;
  private readonly dbPath: string;
  private readonly policy;
  private readonly decisionEvents;
  private readonly taskEpisodes;
  private readonly skillCallAnalyzer;
  private readonly daemonStatus;
  private readonly optimizationRunner: ShadowOptimizationRunner;
  private readonly episodeProbeService: ShadowEpisodeProbeService;
  private readonly traceIngestService: ShadowTraceIngestService;
  private readonly manualOptimizeService: ShadowManualOptimizeService;
  private db: Awaited<ReturnType<typeof createSQLiteStorage>> | null = null;

  constructor(private readonly projectRoot: string) {
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

    this.optimizationRunner = new ShadowOptimizationRunner({
      projectRoot,
      policy: this.policy,
      shadowRegistry: this.shadowRegistry,
      journalManager: this.journalManager,
      decisionEvents: this.decisionEvents,
      daemonStatus: this.daemonStatus,
      taskEpisodes: this.taskEpisodes,
      createSkillVersionManager,
    });
    this.episodeProbeService = new ShadowEpisodeProbeService({
      projectRoot,
      shadowRegistry: this.shadowRegistry,
      taskEpisodes: this.taskEpisodes,
      decisionEvents: this.decisionEvents,
      daemonStatus: this.daemonStatus,
      optimizationRunner: this.optimizationRunner,
      skillCallAnalyzer: this.skillCallAnalyzer,
    });
    this.traceIngestService = new ShadowTraceIngestService({
      projectRoot,
      traceManager: this.traceManager,
      traceSkillMapper: this.traceSkillMapper,
      shadowRegistry: this.shadowRegistry,
      taskEpisodes: this.taskEpisodes,
      episodeProbeService: this.episodeProbeService,
    });
    this.manualOptimizeService = new ShadowManualOptimizeService({
      projectRoot,
      traceManager: this.traceManager,
      traceSkillMapper: this.traceSkillMapper,
      taskEpisodes: this.taskEpisodes,
      decisionEvents: this.decisionEvents,
      daemonStatus: this.daemonStatus,
      episodeProbeService: this.episodeProbeService,
    });
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
    if (!this.db) {
      throw new Error('ShadowManager database not initialized');
    }
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
    await this.traceIngestService.processTrace(trace);
  }

  /**
   * 手动触发优化
   */
  async triggerOptimize(shadowId: string): Promise<TriggerOptimizeResult> {
    return this.manualOptimizeService.triggerOptimize(shadowId);
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
      last_patch_time: this.optimizationRunner.getLastPatchTime(shadowId),
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
