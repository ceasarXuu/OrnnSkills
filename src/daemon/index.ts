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

    logger.info('Starting daemon', { projectRoot: this.projectRoot });

    try {
      // 1. 初始化 shadow manager
      await this.shadowManager.init();
      logger.info('Shadow manager initialized');

      // 2. 设置 trace 回调
      this.codexObserver.onTrace((trace) => {
        void this.shadowManager.processTrace(trace).catch((error) => {
          logger.error('Failed to process trace', { error });
        });
      });

      // 3. 启动 codex observer
      await this.codexObserver.start();
      logger.info('Codex observer started');

      // 4. 监听项目 .sea 目录变化
      this.startFileWatcher();

      // 5. 启动定时清理任务
      this.startCleanupTask();

      // 6. 设置状态为运行中
      this.isRunning = true;

      // 7. 注册优雅退出处理
      this.registerShutdownHooks();

      logger.info('Daemon started successfully');
    } catch (error) {
      // 启动失败，清理资源
      this.isRunning = false;
      await this.cleanup();
      
      logger.error('Failed to start daemon', { error });
      throw new Error(`Daemon startup failed: ${String(error)}`);
    }
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
      () => {
        void (async () => {
          try {
            const retentionDays = 30;
            const cleaned = await this.shadowManager.cleanupOldTraces(retentionDays);
            if (cleaned > 0) {
              logger.info(`Cleaned ${cleaned} old traces`);
            }
          } catch (error) {
            logger.error('Cleanup task failed', { error });
          }
        })();
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

    logger.info('Stopping daemon');

    try {
      // 设置状态为停止
      this.isRunning = false;

      // 停止所有组件
      await this.cleanup();

      logger.info('Daemon stopped successfully');
    } catch (error) {
      logger.error('Error during daemon shutdown', { error });
      // 即使出错也要继续清理
      await this.cleanup();
    }
  }

  /**
   * 清理资源
   */
  private async cleanup(): Promise<void> {
    const errors: Error[] = [];

    // 1. 停止 codex observer
    try {
      await this.codexObserver.stop();
      logger.debug('Codex observer stopped');
    } catch (error) {
      logger.error('Failed to stop codex observer', { error });
      errors.push(error as Error);
    }

      // 2. 停止文件监听器
      try {
        if (this.watcher) {
          await this.watcher.close();
          this.watcher = null;
          logger.debug('File watcher stopped');
        }
      } catch (error) {
        logger.error('Failed to stop file watcher', { error });
        errors.push(error as Error);
      }

    // 3. 停止定时任务
    try {
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
        this.cleanupInterval = null;
        logger.debug('Cleanup task stopped');
      }
    } catch (error) {
      logger.error('Failed to stop cleanup task', { error });
      errors.push(error as Error);
    }

    // 4. 关闭 shadow manager
    try {
      this.shadowManager.close();
      logger.debug('Shadow manager closed');
    } catch (error) {
      logger.error('Failed to close shadow manager', { error });
      errors.push(error as Error);
    }

    // 如果有错误，记录但不抛出（避免阻塞进程退出）
    if (errors.length > 0) {
      logger.warn(`Cleanup completed with ${errors.length} error(s)`);
    }
  }

  /**
   * 注册优雅退出处理
   */
  private registerShutdownHooks(): void {
    const shutdownHandler = (signal: string) => {
      void (async () => {
        logger.info(`Received ${signal}, shutting down gracefully...`);
        try {
          await this.stop();
          process.exit(0);
        } catch (error) {
          logger.error('Error during graceful shutdown', { error });
          process.exit(1);
        }
      })();
    };

    // 监听系统信号
    process.on('SIGTERM', () => shutdownHandler('SIGTERM'));
    process.on('SIGINT', () => shutdownHandler('SIGINT'));

    // 监听未捕获异常
    process.on('uncaughtException', (error) => {
      void (async () => {
        logger.error('Uncaught exception', { error });
        try {
          await this.stop();
        } catch (cleanupError) {
          logger.error('Error during cleanup after uncaught exception', { cleanupError });
        }
        process.exit(1);
      })();
    });

    // 监听未处理的 Promise 拒绝
    process.on('unhandledRejection', (reason, promise) => {
      void (async () => {
        logger.error('Unhandled rejection', { reason, promise });
        try {
          await this.stop();
        } catch (cleanupError) {
          logger.error('Error during cleanup after unhandled rejection', { cleanupError });
        }
        process.exit(1);
      })();
    });

    logger.debug('Shutdown hooks registered');
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