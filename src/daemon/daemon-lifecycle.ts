import { createChildLogger } from '../utils/logger.js';
import type { ProjectRuntime } from './daemon-types.js';

const logger = createChildLogger('daemon-lifecycle');

export class DaemonLifecycleCoordinator {
  private cleanupInterval: NodeJS.Timeout | null = null;
  private retryInterval: NodeJS.Timeout | null = null;
  private checkpointInterval: NodeJS.Timeout | null = null;
  private registrySyncInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly options: {
      retryDelayMs: number;
      cleanupIntervalMs: number;
      checkpointIntervalMs: number;
      registrySyncIntervalMs: number;
      onCleanupTick: () => void | Promise<void>;
      onRetryTick: () => void | Promise<void>;
      onCheckpointTick: () => void | Promise<void>;
      onRegistrySyncTick: () => void | Promise<void>;
    }
  ) {}

  startMaintenanceTasks(): void {
    this.stopMaintenanceTasks();

    this.cleanupInterval = setInterval(() => {
      void this.runTask('cleanup', this.options.onCleanupTick);
    }, this.options.cleanupIntervalMs);

    this.retryInterval = setInterval(() => {
      void this.runTask('retry', this.options.onRetryTick);
    }, this.options.retryDelayMs);

    this.checkpointInterval = setInterval(() => {
      void this.runTask('checkpoint', this.options.onCheckpointTick);
    }, this.options.checkpointIntervalMs);

    this.registrySyncInterval = setInterval(() => {
      void this.runTask('registry-sync', this.options.onRegistrySyncTick);
    }, this.options.registrySyncIntervalMs);

    logger.debug('Daemon maintenance tasks started');
  }

  stopMaintenanceTasks(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    if (this.retryInterval) {
      clearInterval(this.retryInterval);
      this.retryInterval = null;
    }
    if (this.checkpointInterval) {
      clearInterval(this.checkpointInterval);
      this.checkpointInterval = null;
    }
    if (this.registrySyncInterval) {
      clearInterval(this.registrySyncInterval);
      this.registrySyncInterval = null;
    }
  }

  async cleanup(
    options: {
      stopObserver: () => Promise<void>;
      runtimes: Iterable<ProjectRuntime>;
      saveCheckpointForRuntime: (runtime: ProjectRuntime) => Promise<void>;
      closeRuntime: (runtime: ProjectRuntime) => Promise<void>;
    }
  ): Promise<void> {
    const errors: Error[] = [];

    try {
      await options.stopObserver();
      logger.debug('Codex observer stopped');
    } catch (error) {
      logger.error('Failed to stop codex observer', { error });
      errors.push(error as Error);
    }

    try {
      this.stopMaintenanceTasks();
    } catch (error) {
      logger.error('Failed to stop daemon timers', { error });
      errors.push(error as Error);
    }

    for (const runtime of options.runtimes) {
      try {
        if (runtime.checkpointFlushTimer) {
          clearTimeout(runtime.checkpointFlushTimer);
          runtime.checkpointFlushTimer = null;
        }

        await options.saveCheckpointForRuntime(runtime);
        await options.closeRuntime(runtime);
      } catch (error) {
        logger.error('Failed to clean up project runtime', {
          projectRoot: runtime.projectRoot,
          error,
        });
        errors.push(error as Error);
      }
    }

    if (errors.length > 0) {
      logger.warn(`Cleanup completed with ${errors.length} error(s)`);
    }
  }

  registerShutdownHooks(stop: () => Promise<void>): void {
    let isShuttingDown = false;
    let shutdownTimeout: NodeJS.Timeout | null = null;

    const shutdownHandler = async (signal: string): Promise<void> => {
      if (isShuttingDown) {
        logger.warn('Shutdown already in progress, ignoring signal', { signal });
        return;
      }

      isShuttingDown = true;
      logger.info(`Received ${signal}, shutting down gracefully...`);

      shutdownTimeout = setTimeout(() => {
        logger.error('Shutdown timeout exceeded, forcing exit');
        process.exit(1);
      }, 30000);

      try {
        await stop();

        if (shutdownTimeout) {
          clearTimeout(shutdownTimeout);
          shutdownTimeout = null;
        }

        logger.info('Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        logger.error('Error during graceful shutdown', { error });

        if (shutdownTimeout) {
          clearTimeout(shutdownTimeout);
          shutdownTimeout = null;
        }

        process.exit(1);
      }
    };

    process.on('SIGTERM', () => void shutdownHandler('SIGTERM'));
    process.on('SIGINT', () => void shutdownHandler('SIGINT'));
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', { error });
      void shutdownHandler('uncaughtException');
    });
    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled rejection', { reason });
      void shutdownHandler('unhandledRejection');
    });

    logger.debug('Shutdown hooks registered');
  }

  private async runTask(name: string, task: () => void | Promise<void>): Promise<void> {
    try {
      await task();
    } catch (error) {
      logger.error('Daemon maintenance task failed', { task: name, error });
    }
  }
}
