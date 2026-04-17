import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ProjectRuntimeRegistry } from '../../src/daemon/project-runtime-registry.js';
import { RetryQueueStore } from '../../src/daemon/retry-queue.js';
import { DaemonCheckpointService } from '../../src/daemon/checkpoint-service.js';
import { DaemonLifecycleCoordinator } from '../../src/daemon/daemon-lifecycle.js';
import type { ProjectRuntime } from '../../src/daemon/daemon-types.js';
import type { Trace } from '../../src/types/index.js';

describe('daemon components', () => {
  const cleanupPaths = new Set<string>();

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    for (const path of cleanupPaths) {
      if (existsSync(path)) {
        rmSync(path, { recursive: true, force: true });
      }
    }
    cleanupPaths.clear();
  });

  const makeProjectRoot = (name: string) => {
    const projectRoot = join(tmpdir(), `ornn-daemon-components-${Date.now()}-${Math.random()}-${name}`);
    cleanupPaths.add(projectRoot);
    mkdirSync(projectRoot, { recursive: true });
    return projectRoot;
  };

  const makeTrace = (traceId: string, projectPath: string): Trace => ({
    trace_id: traceId,
    runtime: 'codex',
    session_id: `session-${traceId}`,
    turn_id: `turn-${traceId}`,
    event_type: 'assistant_output',
    timestamp: '2026-04-18T00:00:00.000Z',
    status: 'success',
    metadata: { projectPath },
  });

  it('project runtime registry syncs active projects and resolves matching trace roots', async () => {
    const managers = new Map<string, { init: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> }>();
    const listProjects = vi
      .fn()
      .mockReturnValueOnce([
        { path: '/projects/alpha', name: 'alpha', registeredAt: '', lastSeenAt: '', monitoringState: 'active' },
        { path: '/projects/beta', name: 'beta', registeredAt: '', lastSeenAt: '', monitoringState: 'active' },
      ])
      .mockReturnValueOnce([
        { path: '/projects/alpha', name: 'alpha', registeredAt: '', lastSeenAt: '', monitoringState: 'active' },
      ]);

    const registry = new ProjectRuntimeRegistry({
      listProjects,
      getProjectRegistration: (projectRoot) => ({
        path: projectRoot,
        name: projectRoot,
        registeredAt: '',
        lastSeenAt: '',
        monitoringState: 'active',
        pausedAt: null,
      }),
      createShadowManager: (projectRoot) => {
        const manager = {
          init: vi.fn(async () => {}),
          processTrace: vi.fn(async () => {}),
          close: vi.fn(async () => {}),
          cleanupOldTraces: vi.fn(() => 0),
        };
        managers.set(projectRoot, manager);
        return manager;
      },
      touchProject: vi.fn(),
      startFileWatcher: () => null,
    });

    await registry.syncRegisteredProjects();
    expect(Array.from(registry.keys()).sort()).toEqual(['/projects/alpha', '/projects/beta']);

    const matched = await registry.ensureRuntimeForTrace(
      makeTrace('trace-1', '/projects/alpha/subdir/file.ts')
    );
    expect(matched).toBe('/projects/alpha');

    await registry.syncRegisteredProjects();
    expect(Array.from(registry.keys())).toEqual(['/projects/alpha']);
    expect(managers.get('/projects/beta')?.close).toHaveBeenCalledTimes(1);
  });

  it('ignores traces for stale runtimes after a project is removed from the registry', async () => {
    let isRegistered = true;
    const registry = new ProjectRuntimeRegistry({
      listProjects: () =>
        isRegistered
          ? [
              {
                path: '/projects/alpha',
                name: 'alpha',
                registeredAt: '',
                lastSeenAt: '',
                monitoringState: 'active',
              },
            ]
          : [],
      getProjectRegistration: (projectRoot) =>
        isRegistered
          ? {
              path: projectRoot,
              name: projectRoot,
              registeredAt: '',
              lastSeenAt: '',
              monitoringState: 'active',
              pausedAt: null,
            }
          : null,
      createShadowManager: () => ({
        init: vi.fn(async () => {}),
        processTrace: vi.fn(async () => {}),
        close: vi.fn(async () => {}),
        cleanupOldTraces: vi.fn(() => 0),
      }),
      touchProject: vi.fn(),
      startFileWatcher: () => null,
    });

    await registry.syncRegisteredProjects();
    expect(Array.from(registry.keys())).toEqual(['/projects/alpha']);

    isRegistered = false;

    const matched = await registry.ensureRuntimeForTrace(
      makeTrace('trace-stale', '/projects/alpha/subdir/file.ts')
    );

    expect(matched).toBeNull();
    expect(Array.from(registry.keys())).toEqual(['/projects/alpha']);
  });

  it('retry queue deduplicates traces, drops the oldest when full, and clears project entries', () => {
    const queue = new RetryQueueStore({
      maxRetries: 3,
      maxQueueSize: 2,
    });

    queue.add(makeTrace('trace-1', '/projects/alpha'), new Error('alpha'), '/projects/alpha');
    queue.add(makeTrace('trace-1', '/projects/alpha'), new Error('duplicate'), '/projects/alpha');
    queue.add(makeTrace('trace-2', '/projects/beta'), new Error('beta'), '/projects/beta');
    queue.add(makeTrace('trace-3', '/projects/gamma'), new Error('gamma'), '/projects/gamma');

    expect(queue.size).toBe(2);
    expect(queue.has('trace-1')).toBe(false);
    expect(queue.has('trace-2')).toBe(true);
    expect(queue.has('trace-3')).toBe(true);
    expect(queue.clearForProject('/projects/beta')).toBe(1);
    expect(queue.size).toBe(1);
  });

  it('checkpoint service writes daemon state and debounces scheduled saves', async () => {
    const projectRoot = makeProjectRoot('checkpoint');
    const runtime: ProjectRuntime = {
      projectRoot,
      shadowManager: {
        init: vi.fn(async () => {}),
        processTrace: vi.fn(async () => {}),
        close: vi.fn(async () => {}),
        cleanupOldTraces: vi.fn(() => 0),
      },
      watcher: null,
      processedTraces: 12,
      lastCheckpointAt: null,
      checkpointFlushTimer: null,
    };

    const service = new DaemonCheckpointService({
      getMonitoringState: () => ({ monitoringState: 'active', pausedAt: null }),
      getRetryQueueSizeForProject: () => 2,
      getIsRunning: () => true,
      getStartedAt: () => '2026-04-18T00:00:00.000Z',
      getOptimizationStatus: () => ({
        currentState: 'optimizing',
        currentSkillId: 'skill-a',
        lastOptimizationAt: '2026-04-18T00:01:00.000Z',
        lastError: null,
        queueSize: 1,
      }),
    });

    service.schedule(runtime, 10);
    await vi.advanceTimersByTimeAsync(20);

    const checkpointPath = join(projectRoot, '.ornn', 'state', 'daemon-checkpoint.json');
    const checkpoint = JSON.parse(readFileSync(checkpointPath, 'utf-8')) as Record<string, unknown>;

    expect(checkpoint.processedTraces).toBe(12);
    expect(checkpoint.retryQueueSize).toBe(2);
    expect((checkpoint.optimizationStatus as Record<string, unknown>).currentSkillId).toBe('skill-a');
    expect(runtime.lastCheckpointAt).toBeTypeOf('string');
    expect(runtime.checkpointFlushTimer).toBeNull();
  });

  it('daemon lifecycle starts maintenance timers and cleans up runtimes', async () => {
    const cleanupTask = vi.fn();
    const retryTask = vi.fn();
    const checkpointTask = vi.fn(async () => {});
    const registrySyncTask = vi.fn(async () => {});

    const lifecycle = new DaemonLifecycleCoordinator({
      retryDelayMs: 20,
      cleanupIntervalMs: 30,
      checkpointIntervalMs: 40,
      registrySyncIntervalMs: 50,
      onCleanupTick: cleanupTask,
      onRetryTick: retryTask,
      onCheckpointTick: checkpointTask,
      onRegistrySyncTick: registrySyncTask,
    });

    lifecycle.startMaintenanceTasks();
    await vi.advanceTimersByTimeAsync(60);

    expect(cleanupTask).toHaveBeenCalled();
    expect(retryTask).toHaveBeenCalled();
    expect(checkpointTask).toHaveBeenCalled();
    expect(registrySyncTask).toHaveBeenCalled();

    const runtime: ProjectRuntime = {
      projectRoot: '/projects/alpha',
      shadowManager: {
        init: vi.fn(async () => {}),
        processTrace: vi.fn(async () => {}),
        close: vi.fn(async () => {}),
        cleanupOldTraces: vi.fn(() => 0),
      },
      watcher: null,
      processedTraces: 0,
      lastCheckpointAt: null,
      checkpointFlushTimer: setTimeout(() => {}, 1000),
    };

    const stopObserver = vi.fn(async () => {});
    const saveCheckpoint = vi.fn(async () => {});
    const closeRuntime = vi.fn(async (_runtime: ProjectRuntime) => {});

    await lifecycle.cleanup({
      stopObserver,
      runtimes: [runtime],
      saveCheckpointForRuntime: saveCheckpoint,
      closeRuntime,
    });

    expect(stopObserver).toHaveBeenCalledTimes(1);
    expect(saveCheckpoint).toHaveBeenCalledWith(runtime);
    expect(closeRuntime).toHaveBeenCalledWith(runtime);
  });
});
