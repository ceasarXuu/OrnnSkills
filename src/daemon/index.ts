import { resolve } from 'node:path';
import { createCodexObserver } from '../core/observer/codex-observer.js';
import { createShadowManager, type ShadowManager } from '../core/shadow-manager/index.js';
import * as projectsRegistry from '../dashboard/projects-registry.js';
import type { Trace } from '../types/index.js';
import { createChildLogger } from '../utils/logger.js';
import { DaemonCheckpointService } from './checkpoint-service.js';
import { DaemonLifecycleCoordinator } from './daemon-lifecycle.js';
import type { DaemonState, OptimizationStatus, ProjectRuntime } from './daemon-types.js';
import { ProjectRuntimeRegistry } from './project-runtime-registry.js';
import { RetryQueueStore } from './retry-queue.js';

const logger = createChildLogger('daemon');

const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
const CHECKPOINT_INTERVAL_MS = 60 * 1000;
const REGISTRY_SYNC_INTERVAL_MS = 1000;

export class Daemon {
  private readonly launchContext: string;
  private readonly codexObserver;
  private readonly projectRuntimeRegistry: ProjectRuntimeRegistry;
  private readonly retryQueue: RetryQueueStore;
  private readonly checkpointService: DaemonCheckpointService;
  private readonly lifecycle: DaemonLifecycleCoordinator;
  private isRunning = false;
  private readonly maxRetries = 3;
  private readonly retryDelay = 5000;
  private readonly maxQueueSize = 1000;
  private startedAt = '';
  private readonly optimizationStatus: OptimizationStatus = {
    currentState: 'idle',
    currentSkillId: null,
    lastOptimizationAt: null,
    lastError: null,
    queueSize: 0,
  };
  private readonly optimizationQueue: string[] = [];

  constructor(launchContext: string) {
    this.launchContext = resolve(launchContext);
    this.codexObserver = createCodexObserver();
    this.retryQueue = new RetryQueueStore({
      maxRetries: this.maxRetries,
      maxQueueSize: this.maxQueueSize,
    });
    this.checkpointService = new DaemonCheckpointService({
      getMonitoringState: (projectRoot) => this.projectRuntimeRegistry.getProjectMonitoringState(projectRoot),
      getRetryQueueSizeForProject: (projectRoot) => this.retryQueue.sizeForProject(projectRoot),
      getIsRunning: () => this.isRunning,
      getStartedAt: () => this.startedAt,
      getOptimizationStatus: () => ({ ...this.optimizationStatus }),
    });
    this.projectRuntimeRegistry = new ProjectRuntimeRegistry({
      createShadowManager,
      listProjects: projectsRegistry.listProjects,
      getProjectRegistration: (projectRoot) => this.lookupProjectRegistration(projectRoot),
      touchProject: projectsRegistry.touchProject,
      afterCreateRuntime: async (runtime) => {
        await this.checkpointService.saveForRuntime(runtime);
      },
      beforeRemoveRuntime: async (runtime) => {
        this.retryQueue.clearForProject(runtime.projectRoot);
        await this.checkpointService.saveForRuntime(runtime);
      },
    });
    this.lifecycle = new DaemonLifecycleCoordinator({
      retryDelayMs: this.retryDelay,
      cleanupIntervalMs: CLEANUP_INTERVAL_MS,
      checkpointIntervalMs: CHECKPOINT_INTERVAL_MS,
      registrySyncIntervalMs: REGISTRY_SYNC_INTERVAL_MS,
      onCleanupTick: () => this.cleanupOldTraces(),
      onRetryTick: () => this.processRetryQueue(),
      onCheckpointTick: () => this.saveAllCheckpoints(),
      onRegistrySyncTick: () => this.syncRegisteredProjects(),
    });
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

      this.lifecycle.startMaintenanceTasks();
      this.isRunning = true;
      await this.saveAllCheckpoints();
      this.registerShutdownHooks();

      logger.info('Daemon started in global mode', {
        projectCount: Array.from(this.projectRuntimeRegistry.keys()).length,
        projects: Array.from(this.projectRuntimeRegistry.keys()),
      });
    } catch (error) {
      this.isRunning = false;
      await this.cleanup();
      logger.error('Failed to start daemon', { error });
      throw new Error(`Daemon startup failed: ${String(error)}`);
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
      (projectRoot ? this.projectRuntimeRegistry.get(projectRoot) : null) ??
      this.projectRuntimeRegistry.values().next().value ??
      null;
    const monitoring = this.projectRuntimeRegistry.getProjectMonitoringState(
      projectRoot ?? runtime?.projectRoot ?? this.launchContext
    );

    return {
      isRunning: this.isRunning && monitoring.monitoringState !== 'paused',
      startedAt: this.startedAt,
      processedTraces: runtime?.processedTraces ?? 0,
      lastCheckpointAt: runtime?.lastCheckpointAt ?? null,
      retryQueueSize: this.retryQueue.size,
      monitoringState: monitoring.monitoringState,
      pausedAt: monitoring.pausedAt,
      optimizationStatus: { ...this.optimizationStatus },
    };
  }

  isActive(): boolean {
    return this.isRunning;
  }

  getShadowManager(projectRoot?: string): ShadowManager | null {
    const runtime =
      (projectRoot ? this.projectRuntimeRegistry.get(projectRoot) : null) ??
      this.projectRuntimeRegistry.values().next().value ??
      null;
    return (runtime?.shadowManager as ShadowManager | undefined) ?? null;
  }

  getCodexObserver(): import('../core/observer/codex-observer.js').CodexObserver {
    return this.codexObserver;
  }

  private async syncRegisteredProjects(): Promise<void> {
    await this.projectRuntimeRegistry.syncRegisteredProjects();
  }

  private async processTraceWithRetry(trace: unknown): Promise<void> {
    const typedTrace = trace as Trace;
    const projectRoot = await this.ensureRuntimeForTrace(typedTrace);
    if (!projectRoot) {
      const rawProjectPath =
        typeof typedTrace.metadata?.projectPath === 'string' ? typedTrace.metadata.projectPath : null;
      const registration = rawProjectPath ? this.lookupProjectRegistration(rawProjectPath) : null;
      if (registration?.monitoringState === 'paused') {
        logger.info('Skipped trace because project monitoring is paused', {
          traceId: typedTrace.trace_id,
          projectPath: rawProjectPath,
          pausedAt: registration.pausedAt ?? null,
        });
      } else {
        logger.debug('Ignoring trace for unregistered project', {
          traceId: typedTrace.trace_id,
          projectPath: typedTrace.metadata?.projectPath,
        });
      }
      return;
    }

    const runtime = this.projectRuntimeRegistry.get(projectRoot);
    if (!runtime) {
      logger.warn('Resolved trace project without active runtime', {
        traceId: typedTrace.trace_id,
        projectRoot,
      });
      return;
    }

    try {
      await runtime.shadowManager.processTrace(typedTrace);
      runtime.processedTraces += 1;
      this.scheduleCheckpointSave(projectRoot);
    } catch (error) {
      logger.warn('Failed to process trace, adding to retry queue', {
        projectRoot,
        traceId: typedTrace.trace_id,
        error,
      });
      this.retryQueue.add(typedTrace, error as Error, projectRoot);
    }
  }

  private ensureRuntimeForTrace(trace: Trace): Promise<string | null> {
    return this.projectRuntimeRegistry.ensureRuntimeForTrace(trace);
  }

  private processRetryQueue(): void {
    this.retryQueue.process();
  }

  private async saveAllCheckpoints(): Promise<void> {
    for (const projectRoot of this.projectRuntimeRegistry.keys()) {
      await this.saveCheckpointForProject(projectRoot);
    }
  }

  private async saveCheckpointForProject(projectRoot: string): Promise<void> {
    const runtime = this.projectRuntimeRegistry.get(projectRoot);
    if (!runtime) {
      return;
    }

    await this.checkpointService.saveForRuntime(runtime);
  }

  private scheduleCheckpointSave(projectRoot: string, delayMs = 250): void {
    const runtime = this.projectRuntimeRegistry.get(projectRoot);
    if (!runtime) {
      return;
    }

    this.checkpointService.schedule(runtime, delayMs);
  }

  private lookupProjectRegistration(projectRoot: string) {
    try {
      return projectsRegistry.getProjectRegistration(projectRoot);
    } catch {
      return null;
    }
  }

  private cleanupOldTraces(): void {
    for (const runtime of this.projectRuntimeRegistry.values()) {
      try {
        const cleaned = runtime.shadowManager.cleanupOldTraces(30);
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
  }

  private async cleanup(): Promise<void> {
    const runtimes = Array.from(this.projectRuntimeRegistry.values());
    await this.lifecycle.cleanup({
      stopObserver: () => this.codexObserver.stop(),
      runtimes,
      saveCheckpointForRuntime: (runtime) => this.checkpointService.saveForRuntime(runtime),
      closeRuntime: (runtime) => this.closeRuntime(runtime),
    });
    this.projectRuntimeRegistry.clear();
  }

  private async closeRuntime(runtime: ProjectRuntime): Promise<void> {
    try {
      if (runtime.watcher) {
        await runtime.watcher.close();
      }
      if (runtime.checkpointFlushTimer) {
        clearTimeout(runtime.checkpointFlushTimer);
        runtime.checkpointFlushTimer = null;
      }
      await runtime.shadowManager.close();
    } finally {
      this.retryQueue.clearForProject(runtime.projectRoot);
      this.projectRuntimeRegistry.delete(runtime.projectRoot);
    }
  }

  private registerShutdownHooks(): void {
    this.lifecycle.registerShutdownHooks(() => this.stop());
  }
}

export function createDaemon(projectRoot: string): Daemon {
  return new Daemon(projectRoot);
}
