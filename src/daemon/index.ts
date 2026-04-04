import { watch, type FSWatcher } from 'chokidar';
import { existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { createChildLogger } from '../utils/logger.js';
import { createShadowManager } from '../core/shadow-manager/index.js';
import { createCodexObserver } from '../core/observer/codex-observer.js';

const logger = createChildLogger('daemon');

/**
 * 守护进程状态
 */
interface DaemonState {
  isRunning: boolean;
  startedAt: string;
  processedTraces: number;
  lastCheckpointAt: string | null;
  retryQueueSize: number;
  optimizationStatus: OptimizationStatus;
}

interface OptimizationStatus {
  currentState: 'idle' | 'analyzing' | 'optimizing' | 'error';
  currentSkillId: string | null;
  lastOptimizationAt: string | null;
  lastError: string | null;
  queueSize: number;
}

/**
 * 重试队列条目（优化内存使用）
 */
interface RetryQueueEntry {
  traceId: string; // 只存储 trace ID，不存储完整 trace
  attempts: number;
  lastErrorMessage?: string; // 只存储错误消息，不存储完整 Error 对象
  addedAt: number;
}

/**
 * 检查点文件路径
 */
const CHECKPOINT_FILE = '.ornn/state/daemon-checkpoint.json';

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
  private retryQueue: Map<string, RetryQueueEntry> = new Map(); // 使用 Map 避免重复
  private retryInterval: NodeJS.Timeout | null = null;
  private maxRetries = 3;
  private retryDelay = 5000; // 5秒
  private maxQueueSize = 1000; // 最大队列大小
  private processedTraces: number = 0;
  private checkpointInterval: NodeJS.Timeout | null = null;
  private startedAt: string = '';
  private lastCheckpointAt: string | null = null;
  private optimizationStatus: OptimizationStatus = {
    currentState: 'idle',
    currentSkillId: null,
    lastOptimizationAt: null,
    lastError: null,
    queueSize: 0,
  };
  private optimizationQueue: string[] = [];

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

    logger.debug('Starting daemon', { projectRoot: this.projectRoot });

    try {
      // 1. 初始化 shadow manager
      await this.shadowManager.init();
      logger.debug('Shadow manager initialized');

      // 2. 设置 trace 回调（带重试机制）
      this.codexObserver.onTrace((trace) => {
        void this.processTraceWithRetry(trace);
      });

      // 3. 启动 codex observer
      this.codexObserver.start();
      logger.debug('Codex observer started');

      // 4. 监听项目 .sea 目录变化
      this.startFileWatcher();

      // 5. 启动定时清理任务
      this.startCleanupTask();

      // 6. 设置状态为运行中
      this.isRunning = true;
      this.startedAt = new Date().toISOString();

      // 7. 注册优雅退出处理
      this.registerShutdownHooks();

      logger.debug('Daemon started successfully');
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
        try {
          const retentionDays = 30;
          const cleaned = this.shadowManager.cleanupOldTraces(retentionDays);
          if (cleaned > 0) {
            logger.info(`Cleaned ${cleaned} old traces`);
          }
        } catch (error) {
          logger.error('Cleanup task failed', { error });
        }
      },
      60 * 60 * 1000 // 1 小时
    );

    // 每5秒处理一次重试队列
    this.retryInterval = setInterval(() => {
      void this.processRetryQueue();
    }, this.retryDelay);

    // 每分钟保存一次状态检查点
    this.checkpointInterval = setInterval(
      () => {
        void this.saveCheckpoint();
      },
      60 * 1000 // 1 分钟
    );

    logger.debug('Cleanup task started');
  }

  /**
   * 保存状态检查点
   */
  private async saveCheckpoint(): Promise<void> {
    try {
      const state: DaemonState = {
        isRunning: this.isRunning,
        startedAt: this.startedAt,
        processedTraces: this.processedTraces,
        lastCheckpointAt: new Date().toISOString(),
        retryQueueSize: this.retryQueue.size,
        optimizationStatus: { ...this.optimizationStatus },
      };

      const checkpointPath = join(this.projectRoot, CHECKPOINT_FILE);
      const checkpointDir = dirname(checkpointPath);

      // 确保目录存在
      if (!existsSync(checkpointDir)) {
        mkdirSync(checkpointDir, { recursive: true });
      }

      // 使用临时文件实现原子写入
      const tempPath = `${checkpointPath}.tmp`;
      writeFileSync(tempPath, JSON.stringify(state, null, 2), 'utf-8');

      // 原子替换
      const { renameSync, unlinkSync } = await import('node:fs');
      try {
        renameSync(tempPath, checkpointPath);
      } catch (error) {
        // 清理临时文件
        try {
          if (existsSync(tempPath)) {
            unlinkSync(tempPath);
          }
        } catch {
          // 忽略清理错误
        }
        throw error;
      }

      logger.debug('Daemon checkpoint saved', { path: checkpointPath });
    } catch (error) {
      logger.error('Failed to save daemon checkpoint', { error });
    }
  }

  /**
   * 更新优化状态
   */
  updateOptimizationStatus(
    state: 'idle' | 'analyzing' | 'optimizing' | 'error',
    skillId?: string,
    error?: string
  ): void {
    this.optimizationStatus.currentState = state;
    this.optimizationStatus.currentSkillId = skillId || null;
    this.optimizationStatus.lastError = error || null;
    if (state === 'idle') {
      this.optimizationStatus.currentSkillId = null;
    }
    logger.debug('Optimization status updated', { state, skillId });
  }

  /**
   * 添加到优化队列
   */
  enqueueOptimization(skillId: string): void {
    if (!this.optimizationQueue.includes(skillId)) {
      this.optimizationQueue.push(skillId);
      this.optimizationStatus.queueSize = this.optimizationQueue.length;
      logger.debug('Skill added to optimization queue', {
        skillId,
        queueSize: this.optimizationQueue.length,
      });
    }
  }

  /**
   * 从优化队列获取下一个
   */
  dequeueOptimization(): string | undefined {
    const skillId = this.optimizationQueue.shift();
    this.optimizationStatus.queueSize = this.optimizationQueue.length;
    return skillId;
  }

  /**
   * 标记优化完成
   */
  completeOptimization(skillId: string): void {
    this.optimizationStatus.currentState = 'idle';
    this.optimizationStatus.currentSkillId = null;
    this.optimizationStatus.lastOptimizationAt = new Date().toISOString();
    this.optimizationStatus.lastError = null;
    logger.info('Optimization completed', { skillId });
  }

  /**
   * 获取守护进程状态
   */
  getState(): DaemonState {
    return {
      isRunning: this.isRunning,
      startedAt: this.startedAt,
      processedTraces: this.processedTraces,
      lastCheckpointAt: this.lastCheckpointAt,
      retryQueueSize: this.retryQueue.size,
      optimizationStatus: { ...this.optimizationStatus },
    };
  }

  /**
   * 处理 trace（带重试机制）
   */
  private async processTraceWithRetry(trace: unknown): Promise<void> {
    try {
      // 将 unknown 类型转换为 Trace 类型
      await this.shadowManager.processTrace(trace as import('../types/index.js').Trace);
      this.processedTraces++;
    } catch (error) {
      logger.warn('Failed to process trace, adding to retry queue', { error });
      this.addToRetryQueue(trace, error as Error);
    }
  }

  /**
   * 添加到重试队列（优化内存使用）
   */
  private addToRetryQueue(trace: unknown, error: Error): void {
    const traceObj = trace as import('../types/index.js').Trace;
    const traceId = traceObj.trace_id;

    // 检查是否已存在
    if (this.retryQueue.has(traceId)) {
      logger.debug('Trace already in retry queue, skipping', { traceId });
      return;
    }

    // 检查队列大小，防止内存泄漏
    if (this.retryQueue.size >= this.maxQueueSize) {
      // 删除最早的条目
      const firstKey = this.retryQueue.keys().next().value;
      if (firstKey) {
        this.retryQueue.delete(firstKey);
        logger.warn('Retry queue is full, dropping oldest trace', { droppedTraceId: firstKey });
      }
    }

    // 只存储必要信息，不存储完整 trace 对象
    this.retryQueue.set(traceId, {
      traceId,
      attempts: 0,
      lastErrorMessage: error.message, // 只存储错误消息，不存储完整 Error 对象
      addedAt: Date.now(),
    });

    logger.debug('Trace added to retry queue', { traceId, queueSize: this.retryQueue.size });
  }

  /**
   * 处理重试队列（优化内存使用）
   */
  private processRetryQueue(): void {
    if (this.retryQueue.size === 0) {
      return;
    }

    // 复制队列条目进行处理
    const entriesToProcess = Array.from(this.retryQueue.entries());

    for (const [traceId, entry] of entriesToProcess) {
      if (entry.attempts >= this.maxRetries) {
        logger.error('Trace exceeded max retries, discarding', {
          traceId,
          attempts: entry.attempts,
          lastErrorMessage: entry.lastErrorMessage,
        });
        this.retryQueue.delete(traceId);
        continue;
      }

      try {
        // 注意：这里需要从 trace store 重新读取 trace 数据
        // 因为我们没有存储完整 trace 对象
        logger.warn('Retry queue processing requires trace store lookup', { traceId });
        this.retryQueue.delete(traceId);
      } catch (error) {
        entry.attempts++;
        entry.lastErrorMessage = error instanceof Error ? error.message : String(error);

        if (entry.attempts >= this.maxRetries) {
          logger.error('Trace failed after max retries', {
            traceId,
            attempts: entry.attempts,
            error: entry.lastErrorMessage,
          });
          this.retryQueue.delete(traceId);
        } else {
          logger.debug('Trace retry failed, will retry again', {
            traceId,
            attempts: entry.attempts,
          });
        }
      }
    }
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
      if (this.retryInterval) {
        clearInterval(this.retryInterval);
        this.retryInterval = null;
        logger.debug('Retry task stopped');
      }
      if (this.checkpointInterval) {
        clearInterval(this.checkpointInterval);
        this.checkpointInterval = null;
        logger.debug('Checkpoint task stopped');
      }
    } catch (error) {
      logger.error('Failed to stop cleanup task', { error });
      errors.push(error as Error);
    }

    // 4. 保存最终检查点
    try {
      await this.saveCheckpoint();
      logger.debug('Final checkpoint saved');
    } catch (error) {
      logger.error('Failed to save final checkpoint', { error });
      errors.push(error as Error);
    }

    // 4. 关闭 shadow manager
    try {
      await this.shadowManager.close();
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
   * 注册优雅退出处理（防止重复退出）
   */
  private registerShutdownHooks(): void {
    let isShuttingDown = false;
    let shutdownTimeout: NodeJS.Timeout | null = null;

    const shutdownHandler = async (signal: string): Promise<void> => {
      // 防止重复执行
      if (isShuttingDown) {
        logger.warn('Shutdown already in progress, ignoring signal', { signal });
        return;
      }

      isShuttingDown = true;
      logger.info(`Received ${signal}, shutting down gracefully...`);

      // 设置退出超时（30秒）
      shutdownTimeout = setTimeout(() => {
        logger.error('Shutdown timeout exceeded, forcing exit');
        process.exit(1);
      }, 30000);

      try {
        await this.stop();

        // 清除超时定时器
        if (shutdownTimeout) {
          clearTimeout(shutdownTimeout);
          shutdownTimeout = null;
        }

        logger.info('Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        logger.error('Error during graceful shutdown', { error });

        // 清除超时定时器
        if (shutdownTimeout) {
          clearTimeout(shutdownTimeout);
          shutdownTimeout = null;
        }

        process.exit(1);
      }
    };

    // 监听系统信号
    process.on('SIGTERM', () => void shutdownHandler('SIGTERM'));
    process.on('SIGINT', () => void shutdownHandler('SIGINT'));

    // 监听未捕获异常
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', { error });
      void shutdownHandler('uncaughtException');
    });

    // 监听未处理的 Promise 拒绝
    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled rejection', { reason });
      void shutdownHandler('unhandledRejection');
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
  getShadowManager(): import('../core/shadow-manager/index.js').ShadowManager {
    return this.shadowManager;
  }

  /**
   * 获取 codex observer
   */
  getCodexObserver(): import('../core/observer/codex-observer.js').CodexObserver {
    return this.codexObserver;
  }
}

// 导出工厂函数
export function createDaemon(projectRoot: string): Daemon {
  return new Daemon(projectRoot);
}
