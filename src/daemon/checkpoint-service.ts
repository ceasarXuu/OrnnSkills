import { existsSync, mkdirSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createChildLogger } from '../utils/logger.js';
import type { DaemonState, OptimizationStatus, ProjectRuntime } from './daemon-types.js';

const logger = createChildLogger('daemon-checkpoint-service');

export const CHECKPOINT_FILE = '.ornn/state/daemon-checkpoint.json';

export class DaemonCheckpointService {
  constructor(
    private readonly options: {
      getMonitoringState: (
        projectRoot: string
      ) => { monitoringState: DaemonState['monitoringState']; pausedAt: string | null };
      getRetryQueueSizeForProject: (projectRoot: string) => number;
      getIsRunning: () => boolean;
      getStartedAt: () => string;
      getOptimizationStatus: () => OptimizationStatus;
    }
  ) {}

  async saveAll(runtimes: Iterable<ProjectRuntime>): Promise<void> {
    for (const runtime of runtimes) {
      await this.saveForRuntime(runtime);
    }
  }

  async saveForRuntime(runtime: ProjectRuntime): Promise<void> {
    try {
      const lastCheckpointAt = new Date().toISOString();
      const monitoring = this.options.getMonitoringState(runtime.projectRoot);
      const state: DaemonState = {
        isRunning: this.options.getIsRunning() && monitoring.monitoringState !== 'paused',
        startedAt: this.options.getStartedAt(),
        processedTraces: runtime.processedTraces,
        lastCheckpointAt,
        retryQueueSize: this.options.getRetryQueueSizeForProject(runtime.projectRoot),
        monitoringState: monitoring.monitoringState,
        pausedAt: monitoring.pausedAt,
        optimizationStatus: { ...this.options.getOptimizationStatus() },
      };

      const checkpointPath = join(runtime.projectRoot, CHECKPOINT_FILE);
      const checkpointDir = dirname(checkpointPath);

      if (!existsSync(checkpointDir)) {
        mkdirSync(checkpointDir, { recursive: true });
      }

      const tempPath = `${checkpointPath}.tmp`;
      writeFileSync(tempPath, JSON.stringify(state, null, 2), 'utf-8');

      try {
        renameSync(tempPath, checkpointPath);
      } catch (error) {
        try {
          if (existsSync(tempPath)) {
            unlinkSync(tempPath);
          }
        } catch {
          // ignore cleanup errors
        }
        throw error;
      }

      runtime.lastCheckpointAt = lastCheckpointAt;
      logger.debug('Daemon checkpoint saved', {
        projectRoot: runtime.projectRoot,
        path: checkpointPath,
      });
    } catch (error) {
      logger.error('Failed to save daemon checkpoint', {
        projectRoot: runtime.projectRoot,
        error,
      });
    }
  }

  schedule(runtime: ProjectRuntime, delayMs = 250): void {
    if (runtime.checkpointFlushTimer) {
      clearTimeout(runtime.checkpointFlushTimer);
    }

    runtime.checkpointFlushTimer = setTimeout(() => {
      runtime.checkpointFlushTimer = null;
      void this.saveForRuntime(runtime);
    }, delayMs);
  }
}
