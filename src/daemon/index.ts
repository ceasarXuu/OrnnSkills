import { watch, type FSWatcher } from 'chokidar';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { createChildLogger } from '../utils/logger.js';
import { createShadowManager } from '../core/shadow-manager/index.js';
import { createCodexObserver } from '../core/observer/codex-observer.js';
import { listProjects, touchProject } from '../dashboard/projects-registry.js';
import type { Trace } from '../types/index.js';

const logger = createChildLogger('daemon');

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

interface RetryQueueEntry {
  traceId: string;
  projectRoot: string | null;
  attempts: number;
  lastErrorMessage?: string;
  addedAt: number;
}

interface ProjectRuntime {
  projectRoot: string;
  shadowManager: ReturnType<typeof createShadowManager>;
  watcher: FSWatcher | null;
  processedTraces: number;
  lastCheckpointAt: string | null;
  checkpointFlushTimer: NodeJS.Timeout | null;
}

const CHECKPOINT_FILE = '.ornn/state/daemon-checkpoint.json';

export class Daemon {
  private launchContext: string;
  private codexObserver;
  private projectRuntimes: Map<string, ProjectRuntime> = new Map();
  private isRunning = false;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private retryQueue: Map<string, RetryQueueEntry> = new Map();
  private retryInterval: NodeJS.Timeout | null = null;
  private checkpointInterval: NodeJS.Timeout | null = null;
  private registrySyncInterval: NodeJS.Timeout | null = null;
  private maxRetries = 3;
  private retryDelay = 5000;
  private maxQueueSize = 1000;
  private startedAt = '';
  private optimizationStatus: OptimizationStatus = {
    currentState: 'idle',
    currentSkillId: null,
    lastOptimizationAt: null,
    lastError: null,
    queueSize: 0,
  };
  private optimizationQueue: string[] = [];

  constructor(launchContext: string) {
    this.launchContext = resolve(launchContext);
    this.codexObserver = createCodexObserver();
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Daemon already running');
      return;
    }

    logger.debug('Starting daemon', { launchContext: this.launchContext });

    try {
      this.startedAt = new Date().toISOString();

      await this.syncRegisteredProjects();

      this.codexObserver.onTrace((trace) => {
        void this.processTraceWithRetry(trace);
      });
      this.codexObserver.start();
      logger.debug('Codex observer started');

      this.startMaintenanceTasks();
      this.isRunning = true;
      await this.saveAllCheckpoints();
      this.registerShutdownHooks();

      logger.info('Daemon started in global mode', {
        projectCount: this.projectRuntimes.size,
        projects: Array.from(this.projectRuntimes.keys()),
      });
    } catch (error) {
      this.isRunning = false;
      await this.cleanup();
      logger.error('Failed to start daemon', { error });
      throw new Error(`Daemon startup failed: ${String(error)}`);
    }
  }

  private async syncRegisteredProjects(): Promise<void> {
    const registeredRoots = this.getRegisteredProjectRoots();
    const nextRoots = new Set(registeredRoots);

    for (const projectRoot of registeredRoots) {
      await this.ensureProjectRuntime(projectRoot);
    }

    for (const projectRoot of Array.from(this.projectRuntimes.keys())) {
      if (!nextRoots.has(projectRoot)) {
        await this.removeProjectRuntime(projectRoot);
      }
    }

    logger.debug('Synchronized daemon project registry', {
      projectCount: this.projectRuntimes.size,
      projects: Array.from(this.projectRuntimes.keys()),
    });
  }

  private getRegisteredProjectRoots(): string[] {
    return listProjects().map((project) => resolve(project.path));
  }

  private async ensureProjectRuntime(projectRoot: string): Promise<ProjectRuntime> {
    const normalizedProjectRoot = resolve(projectRoot);
    const existing = this.projectRuntimes.get(normalizedProjectRoot);
    if (existing) {
      return existing;
    }

    const shadowManager = createShadowManager(normalizedProjectRoot);
    await shadowManager.init();

    const runtime: ProjectRuntime = {
      projectRoot: normalizedProjectRoot,
      shadowManager,
      watcher: this.startFileWatcher(normalizedProjectRoot),
      processedTraces: 0,
      lastCheckpointAt: null,
      checkpointFlushTimer: null,
    };

    this.projectRuntimes.set(normalizedProjectRoot, runtime);
    touchProject(normalizedProjectRoot);
    await this.saveCheckpointForProject(normalizedProjectRoot);

    logger.info('Registered project runtime for daemon monitoring', {
      projectRoot: normalizedProjectRoot,
    });

    return runtime;
  }

  private async removeProjectRuntime(projectRoot: string): Promise<void> {
    const runtime = this.projectRuntimes.get(projectRoot);
    if (!runtime) {
      return;
    }

    try {
      if (runtime.watcher) {
        await runtime.watcher.close();
      }
      if (runtime.checkpointFlushTimer) {
        clearTimeout(runtime.checkpointFlushTimer);
      }
      await this.saveCheckpointForProject(projectRoot);
      await runtime.shadowManager.close();
    } finally {
      this.projectRuntimes.delete(projectRoot);
    }

    logger.info('Removed project runtime from daemon monitoring', { projectRoot });
  }

  private startFileWatcher(projectRoot: string): FSWatcher | null {
    const seaDir = join(projectRoot, '.sea');

    if (!existsSync(seaDir)) {
      logger.debug('.sea directory not found, skipping file watcher', { projectRoot });
      return null;
    }

    const watcher = watch(seaDir, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 200,
        pollInterval: 100,
      },
    });

    watcher.on('change', (path) => {
      logger.debug('Project file changed', { projectRoot, path });
    });

    watcher.on('error', (error) => {
      logger.error('File watcher error', { projectRoot, error });
    });

    logger.info('File watcher started', { projectRoot, path: seaDir });
    return watcher;
  }

  private startMaintenanceTasks(): void {
    this.cleanupInterval = setInterval(
      () => {
        for (const runtime of this.projectRuntimes.values()) {
          try {
            const retentionDays = 30;
            const cleaned = runtime.shadowManager.cleanupOldTraces(retentionDays);
            if (cleaned > 0) {
              logger.info('Cleaned old traces for project', {
                projectRoot: runtime.projectRoot,
                cleaned,
              });
            }
          } catch (error) {
            logger.error('Cleanup task failed', { projectRoot: runtime.projectRoot, error });
          }
        }
      },
      60 * 60 * 1000
    );

    this.retryInterval = setInterval(() => {
      this.processRetryQueue();
    }, this.retryDelay);

    this.checkpointInterval = setInterval(() => {
      void this.saveAllCheckpoints();
    }, 60 * 1000);

    this.registrySyncInterval = setInterval(() => {
      void this.syncRegisteredProjects();
    }, 5000);

    logger.debug('Daemon maintenance tasks started');
  }

  private async saveAllCheckpoints(): Promise<void> {
    for (const projectRoot of this.projectRuntimes.keys()) {
      await this.saveCheckpointForProject(projectRoot);
    }
  }

  private async saveCheckpointForProject(projectRoot: string): Promise<void> {
    const runtime = this.projectRuntimes.get(projectRoot);
    if (!runtime) {
      return;
    }

    try {
      const lastCheckpointAt = new Date().toISOString();
      const state: DaemonState = {
        isRunning: this.isRunning,
        startedAt: this.startedAt,
        processedTraces: runtime.processedTraces,
        lastCheckpointAt,
        retryQueueSize: Array.from(this.retryQueue.values()).filter(
          (entry) => entry.projectRoot === projectRoot
        ).length,
        optimizationStatus: { ...this.optimizationStatus },
      };

      const checkpointPath = join(projectRoot, CHECKPOINT_FILE);
      const checkpointDir = dirname(checkpointPath);

      if (!existsSync(checkpointDir)) {
        mkdirSync(checkpointDir, { recursive: true });
      }

      const tempPath = `${checkpointPath}.tmp`;
      writeFileSync(tempPath, JSON.stringify(state, null, 2), 'utf-8');

      const { renameSync, unlinkSync } = await import('node:fs');
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
      logger.debug('Daemon checkpoint saved', { projectRoot, path: checkpointPath });
    } catch (error) {
      logger.error('Failed to save daemon checkpoint', { projectRoot, error });
    }
  }

  private scheduleCheckpointSave(projectRoot: string, delayMs = 250): void {
    const runtime = this.projectRuntimes.get(projectRoot);
    if (!runtime) {
      return;
    }

    if (runtime.checkpointFlushTimer) {
      clearTimeout(runtime.checkpointFlushTimer);
    }

    runtime.checkpointFlushTimer = setTimeout(() => {
      runtime.checkpointFlushTimer = null;
      void this.saveCheckpointForProject(projectRoot);
    }, delayMs);
  }

  updateOptimizationStatus(
    state: 'idle' | 'analyzing' | 'optimizing' | 'error',
    skillId?: string,
    error?: string
  ): void {
    this.optimizationStatus.currentState = state;
    this.optimizationStatus.currentSkillId = state === 'idle' ? null : (skillId ?? null);
    this.optimizationStatus.lastError = error ?? null;
    if (state === 'idle') {
      this.optimizationStatus.lastOptimizationAt = new Date().toISOString();
    }
    logger.debug('Optimization status updated', { state, skillId });
  }

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

  dequeueOptimization(): string | undefined {
    const skillId = this.optimizationQueue.shift();
    this.optimizationStatus.queueSize = this.optimizationQueue.length;
    return skillId;
  }

  completeOptimization(skillId: string): void {
    this.optimizationStatus.currentState = 'idle';
    this.optimizationStatus.currentSkillId = null;
    this.optimizationStatus.lastOptimizationAt = new Date().toISOString();
    this.optimizationStatus.lastError = null;
    logger.info('Optimization completed', { skillId });
  }

  getState(projectRoot?: string): DaemonState {
    const runtime =
      (projectRoot ? this.projectRuntimes.get(resolve(projectRoot)) : null) ??
      this.projectRuntimes.values().next().value ??
      null;

    return {
      isRunning: this.isRunning,
      startedAt: this.startedAt,
      processedTraces: runtime?.processedTraces ?? 0,
      lastCheckpointAt: runtime?.lastCheckpointAt ?? null,
      retryQueueSize: this.retryQueue.size,
      optimizationStatus: { ...this.optimizationStatus },
    };
  }

  private async processTraceWithRetry(trace: unknown): Promise<void> {
    const typedTrace = trace as Trace;
    const projectRoot = await this.ensureRuntimeForTrace(typedTrace);
    if (!projectRoot) {
      logger.debug('Ignoring trace for unregistered project', {
        traceId: typedTrace.trace_id,
        projectPath: typedTrace.metadata?.projectPath,
      });
      return;
    }

    const runtime = this.projectRuntimes.get(projectRoot);
    if (!runtime) {
      logger.warn('Resolved trace project without active runtime', {
        traceId: typedTrace.trace_id,
        projectRoot,
      });
      return;
    }

    try {
      await runtime.shadowManager.processTrace(typedTrace);
      runtime.processedTraces++;
      this.scheduleCheckpointSave(projectRoot);
    } catch (error) {
      logger.warn('Failed to process trace, adding to retry queue', {
        projectRoot,
        traceId: typedTrace.trace_id,
        error,
      });
      this.addToRetryQueue(typedTrace, error as Error, projectRoot);
    }
  }

  private async ensureRuntimeForTrace(trace: Trace): Promise<string | null> {
    const rawProjectPath = trace.metadata?.projectPath;
    if (typeof rawProjectPath !== 'string' || rawProjectPath.trim().length === 0) {
      return null;
    }

    const normalizedTracePath = resolve(rawProjectPath);
    const activeMatch = this.findBestProjectMatch(
      normalizedTracePath,
      Array.from(this.projectRuntimes.keys())
    );
    if (activeMatch) {
      return activeMatch;
    }

    const registeredMatch = this.findBestProjectMatch(
      normalizedTracePath,
      this.getRegisteredProjectRoots()
    );
    if (!registeredMatch) {
      return null;
    }

    await this.ensureProjectRuntime(registeredMatch);
    return registeredMatch;
  }

  private findBestProjectMatch(tracePath: string, projectRoots: string[]): string | null {
    const sortedRoots = [...projectRoots].sort((left, right) => right.length - left.length);
    for (const projectRoot of sortedRoots) {
      if (tracePath === projectRoot || tracePath.startsWith(projectRoot + sep)) {
        return projectRoot;
      }
    }
    return null;
  }

  private addToRetryQueue(trace: Trace, error: Error, projectRoot: string | null): void {
    const traceId = trace.trace_id;

    if (this.retryQueue.has(traceId)) {
      logger.debug('Trace already in retry queue, skipping', { traceId });
      return;
    }

    if (this.retryQueue.size >= this.maxQueueSize) {
      const firstKey = this.retryQueue.keys().next().value;
      if (firstKey) {
        this.retryQueue.delete(firstKey);
        logger.warn('Retry queue is full, dropping oldest trace', { droppedTraceId: firstKey });
      }
    }

    this.retryQueue.set(traceId, {
      traceId,
      projectRoot,
      attempts: 0,
      lastErrorMessage: error.message,
      addedAt: Date.now(),
    });

    logger.debug('Trace added to retry queue', {
      traceId,
      projectRoot,
      queueSize: this.retryQueue.size,
    });
  }

  private processRetryQueue(): void {
    if (this.retryQueue.size === 0) {
      return;
    }

    const entriesToProcess = Array.from(this.retryQueue.entries());

    for (const [traceId, entry] of entriesToProcess) {
      if (entry.attempts >= this.maxRetries) {
        logger.error('Trace exceeded max retries, discarding', {
          traceId,
          projectRoot: entry.projectRoot,
          attempts: entry.attempts,
          lastErrorMessage: entry.lastErrorMessage,
        });
        this.retryQueue.delete(traceId);
        continue;
      }

      try {
        logger.warn('Retry queue processing requires trace store lookup', {
          traceId,
          projectRoot: entry.projectRoot,
        });
        this.retryQueue.delete(traceId);
      } catch (error) {
        entry.attempts++;
        entry.lastErrorMessage = error instanceof Error ? error.message : String(error);

        if (entry.attempts >= this.maxRetries) {
          logger.error('Trace failed after max retries', {
            traceId,
            projectRoot: entry.projectRoot,
            attempts: entry.attempts,
            error: entry.lastErrorMessage,
          });
          this.retryQueue.delete(traceId);
        } else {
          logger.debug('Trace retry failed, will retry again', {
            traceId,
            projectRoot: entry.projectRoot,
            attempts: entry.attempts,
          });
        }
      }
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping daemon');

    try {
      this.isRunning = false;
      await this.cleanup();
      logger.info('Daemon stopped successfully');
    } catch (error) {
      logger.error('Error during daemon shutdown', { error });
      await this.cleanup();
    }
  }

  private async cleanup(): Promise<void> {
    const errors: Error[] = [];

    try {
      await this.codexObserver.stop();
      logger.debug('Codex observer stopped');
    } catch (error) {
      logger.error('Failed to stop codex observer', { error });
      errors.push(error as Error);
    }

    try {
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
    } catch (error) {
      logger.error('Failed to stop daemon timers', { error });
      errors.push(error as Error);
    }

    for (const runtime of this.projectRuntimes.values()) {
      try {
        if (runtime.watcher) {
          await runtime.watcher.close();
        }
        if (runtime.checkpointFlushTimer) {
          clearTimeout(runtime.checkpointFlushTimer);
          runtime.checkpointFlushTimer = null;
        }
        await this.saveCheckpointForProject(runtime.projectRoot);
        await runtime.shadowManager.close();
      } catch (error) {
        logger.error('Failed to clean up project runtime', {
          projectRoot: runtime.projectRoot,
          error,
        });
        errors.push(error as Error);
      }
    }

    this.projectRuntimes.clear();

    if (errors.length > 0) {
      logger.warn(`Cleanup completed with ${errors.length} error(s)`);
    }
  }

  private registerShutdownHooks(): void {
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
        await this.stop();

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

  isActive(): boolean {
    return this.isRunning;
  }

  getShadowManager(
    projectRoot?: string
  ): import('../core/shadow-manager/index.js').ShadowManager | null {
    const runtime =
      (projectRoot ? this.projectRuntimes.get(resolve(projectRoot)) : null) ??
      this.projectRuntimes.values().next().value ??
      null;
    return runtime?.shadowManager ?? null;
  }

  getCodexObserver(): import('../core/observer/codex-observer.js').CodexObserver {
    return this.codexObserver;
  }
}

export function createDaemon(projectRoot: string): Daemon {
  return new Daemon(projectRoot);
}
