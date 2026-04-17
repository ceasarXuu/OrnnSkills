import { watch, type FSWatcher } from 'chokidar';
import { existsSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { createShadowManager } from '../core/shadow-manager/index.js';
import * as projectsRegistry from '../dashboard/projects-registry.js';
import type { RegisteredProject } from '../dashboard/projects-registry.js';
import type { Trace } from '../types/index.js';
import { createChildLogger } from '../utils/logger.js';
import type {
  ProjectMonitoringSnapshot,
  ProjectRuntime,
  ShadowManagerLike,
} from './daemon-types.js';

const logger = createChildLogger('project-runtime-registry');

function startProjectFileWatcher(projectRoot: string): FSWatcher | null {
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

type RegistryProject = Pick<RegisteredProject, 'path' | 'monitoringState' | 'pausedAt'>;

function getProjectRegistrationSafely(projectRoot: string): RegistryProject | null {
  try {
    return projectsRegistry.getProjectRegistration(projectRoot);
  } catch {
    return null;
  }
}

function findRegisteredProjectByRoot(
  projectRoot: string,
  listProjects: () => RegistryProject[]
): RegistryProject | null {
  const normalizedProjectRoot = resolve(projectRoot);
  return (
    listProjects().find((project) => resolve(project.path) === normalizedProjectRoot) ?? null
  );
}

export class ProjectRuntimeRegistry {
  private readonly projectRuntimes = new Map<string, ProjectRuntime>();

  constructor(
    private readonly options: {
      createShadowManager?: (projectRoot: string) => ShadowManagerLike;
      listProjects?: () => RegistryProject[];
      getProjectRegistration?: (projectRoot: string) => RegistryProject | null;
      touchProject?: (projectRoot: string) => void;
      startFileWatcher?: (projectRoot: string) => FSWatcher | null;
      afterCreateRuntime?: (runtime: ProjectRuntime) => Promise<void> | void;
      beforeRemoveRuntime?: (runtime: ProjectRuntime) => Promise<void> | void;
    } = {}
  ) {}

  keys(): IterableIterator<string> {
    return this.projectRuntimes.keys();
  }

  values(): IterableIterator<ProjectRuntime> {
    return this.projectRuntimes.values();
  }

  entries(): IterableIterator<[string, ProjectRuntime]> {
    return this.projectRuntimes.entries();
  }

  get(projectRoot: string): ProjectRuntime | undefined {
    return this.projectRuntimes.get(resolve(projectRoot));
  }

  clear(): void {
    this.projectRuntimes.clear();
  }

  delete(projectRoot: string): void {
    this.projectRuntimes.delete(resolve(projectRoot));
  }

  getRegisteredProjectRoots(): string[] {
    return (this.options.listProjects ?? projectsRegistry.listProjects)()
      .filter((project) => project.monitoringState !== 'paused')
      .map((project) => resolve(project.path));
  }

  getProjectMonitoringState(projectRoot: string): ProjectMonitoringSnapshot {
    const registration = this.getRegisteredProject(projectRoot);
    return {
      monitoringState: registration?.monitoringState === 'paused' ? 'paused' : 'active',
      pausedAt: registration?.monitoringState === 'paused' ? registration.pausedAt ?? null : null,
    };
  }

  async syncRegisteredProjects(): Promise<void> {
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

  async ensureProjectRuntime(projectRoot: string): Promise<ProjectRuntime> {
    const normalizedProjectRoot = resolve(projectRoot);
    const existing = this.projectRuntimes.get(normalizedProjectRoot);
    if (existing) {
      return existing;
    }

    const shadowManager = (this.options.createShadowManager ?? createShadowManager)(
      normalizedProjectRoot
    );
    await shadowManager.init();

    const runtime: ProjectRuntime = {
      projectRoot: normalizedProjectRoot,
      shadowManager,
      watcher: (this.options.startFileWatcher ?? startProjectFileWatcher)(normalizedProjectRoot),
      processedTraces: 0,
      lastCheckpointAt: null,
      checkpointFlushTimer: null,
    };

    this.projectRuntimes.set(normalizedProjectRoot, runtime);
    (this.options.touchProject ?? projectsRegistry.touchProject)(normalizedProjectRoot);
    await this.options.afterCreateRuntime?.(runtime);

    logger.info('Registered project runtime for daemon monitoring', {
      projectRoot: normalizedProjectRoot,
    });

    return runtime;
  }

  async removeProjectRuntime(projectRoot: string): Promise<void> {
    const normalizedProjectRoot = resolve(projectRoot);
    const runtime = this.projectRuntimes.get(normalizedProjectRoot);
    if (!runtime) {
      return;
    }

    try {
      await this.options.beforeRemoveRuntime?.(runtime);
      if (runtime.watcher) {
        await runtime.watcher.close();
      }
      if (runtime.checkpointFlushTimer) {
        clearTimeout(runtime.checkpointFlushTimer);
        runtime.checkpointFlushTimer = null;
      }
      await runtime.shadowManager.close();
    } finally {
      this.projectRuntimes.delete(normalizedProjectRoot);
    }

    logger.info('Removed project runtime from daemon monitoring', {
      projectRoot: normalizedProjectRoot,
    });
  }

  async ensureRuntimeForTrace(trace: Trace): Promise<string | null> {
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
      const registration = this.getRegisteredProject(activeMatch);
      if (!registration) {
        logger.debug('Ignoring trace for unregistered stale project runtime', {
          traceId: trace.trace_id,
          projectRoot: activeMatch,
        });
        return null;
      }

      if (registration.monitoringState === 'paused') {
        logger.debug('Ignoring trace for paused project monitoring', {
          traceId: trace.trace_id,
          projectRoot: activeMatch,
          pausedAt: registration.pausedAt ?? null,
        });
        return null;
      }

      return activeMatch;
    }

    const registeredProjects = (this.options.listProjects ?? projectsRegistry.listProjects)().map((project) => ({
      ...project,
      projectRoot: resolve(project.path),
    }));

    const matchedProject = [...registeredProjects]
      .sort((left, right) => right.projectRoot.length - left.projectRoot.length)
      .find((project) => {
        return (
          normalizedTracePath === project.projectRoot ||
          normalizedTracePath.startsWith(project.projectRoot + sep)
        );
      });

    if (!matchedProject) {
      return null;
    }

    if (matchedProject.monitoringState === 'paused') {
      logger.debug('Ignoring trace for paused project monitoring', {
        traceId: trace.trace_id,
        projectRoot: matchedProject.projectRoot,
        pausedAt: matchedProject.pausedAt ?? null,
      });
      return null;
    }

    await this.ensureProjectRuntime(matchedProject.projectRoot);
    return matchedProject.projectRoot;
  }

  findBestProjectMatch(tracePath: string, projectRoots: string[]): string | null {
    const sortedRoots = [...projectRoots].sort((left, right) => right.length - left.length);
    for (const projectRoot of sortedRoots) {
      if (tracePath === projectRoot || tracePath.startsWith(projectRoot + sep)) {
        return projectRoot;
      }
    }
    return null;
  }

  private getRegisteredProject(projectRoot: string): RegistryProject | null {
    const registration = (this.options.getProjectRegistration ?? getProjectRegistrationSafely)(
      projectRoot
    );
    if (registration) {
      return registration;
    }

    return findRegisteredProjectByRoot(
      projectRoot,
      this.options.listProjects ?? projectsRegistry.listProjects
    );
  }
}
