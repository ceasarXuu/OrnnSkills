import { watch, type FSWatcher } from 'chokidar';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createChildLogger } from '../utils/logger.js';
import { createShadowManager } from '../core/shadow-manager/index.js';
import { createCodexObserver } from '../core/observer/codex-observer.js';

const logger = createChildLogger('daemon');

/**
 * 后台守护进程
 * 负责监听文件变化和定时任务
 */
export class Daemon {
  private projectRoot: string;
  private shadowManager;
  private codexObserver;
  private watcher: FSWatcher | null = null;
  private isRunning: boolean = false;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.shadowManager = createShadowManager(projectRoot);
    this.codexObserver = createCodexObserver();
  }

  /**
   * 启动守护进程
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Daemon already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting daemon', { projectRoot: this.projectRoot });

    // 初始化 shadow manager
    await this.shadowManager.init();

    // 设置 trace 回调
    this.codexObserver.onTrace((trace) => {
      this.shadowManager.processTrace(trace).catch((error) => {
        logger.error('Failed to process trace', { error });
      });
    });

    // 启动 codex observer
    await this.codexObserver.start();

    // 监听项目 .sea 目录变化
    this.startFileWatcher();

    // 启动定时清理任务
    this.startCleanupTask();

    logger.info('Daemon started successfully');
  }

  /**
   * 启动文件监听器
   */
  private startFileWatcher(): void {
    const seaDir = join(this.projectRoot, '.sea');

    if (!existsSync(seaDir)) {
      logger.debug('.sea directory not found, skipping file watcher');
      return;
    }

    this.watcher = watch(seaDir, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 200,
        pollInterval: 100,
      },
    });

    this.watcher.on('change', (path) => {
      logger.debug('File changed', { path });
      // 可以在这里处理文件变化
    });

    this.watcher.on('error', (error) => {
      logger.error('File watcher error', { error });
    });

    logger.info('File watcher started', { path: seaDir });
  }

  /**
   * 启动定时清理任务
   */
  private startCleanupTask(): void {
    // 每小时清理一次旧 traces
    this.cleanupInterval = setInterval(
      async () => {
        try {
          const retentionDays = 30;
          const cleaned = await this.shadowManager.cleanupOldTraces(retentionDays);
          if (cleaned > 0) {
            logger.info(`Cleaned ${cleaned} old traces`);
          }
        } catch (error) {
          logger.error('Cleanup task failed', { error });
        }
      },
      60 * 60 * 1000 // 1 小时
    );

    logger.info('Cleanup task started');
  }

  /**
   * 停止守护进程
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    logger.info('Stopping daemon');

    // 停止 codex observer
    await this.codexObserver.stop();

    // 停止文件监听器
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }

    // 停止定时任务
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // 关闭 shadow manager
    this.shadowManager.close();

    logger.info('Daemon stopped');
  }

  /**
   * 检查是否正在运行
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * 获取 shadow manager
   */
  getShadowManager() {
    return this.shadowManager;
  }

  /**
   * 获取 codex observer
   */
  getCodexObserver() {
    return this.codexObserver;
  }
}

// 导出工厂函数
export function createDaemon(projectRoot: string): Daemon {
  return new Daemon(projectRoot);
}