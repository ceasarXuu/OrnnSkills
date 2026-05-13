import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { ProjectRuntimeRegistry } from '../../src/daemon/project-runtime-registry.js';
import {
  EVOLUTION_PRODUCTION_ENTRYPOINT,
  getEvolutionArchitectureStatus,
} from '../../src/core/evolution/architecture-status.js';
import type { Trace } from '../../src/types/index.js';

const repoRoot = process.cwd();

function readRepoFile(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf-8');
}

function makeTrace(traceId: string, projectPath: string): Trace {
  return {
    trace_id: traceId,
    runtime: 'codex',
    session_id: `session-${traceId}`,
    turn_id: `turn-${traceId}`,
    event_type: 'assistant_output',
    timestamp: '2026-05-13T00:00:00.000Z',
    status: 'success',
    metadata: { projectPath },
  };
}

describe('evolution architecture boundary', () => {
  it('declares ShadowManager as the only production evolution entrypoint', () => {
    const status = getEvolutionArchitectureStatus();
    const productionModules = status.modules.filter((module) => module.status === 'production');

    expect(EVOLUTION_PRODUCTION_ENTRYPOINT).toBe('shadow-manager');
    expect(status.productionEntryPoint).toBe('shadow-manager');
    expect(productionModules).toEqual([
      expect.objectContaining({
        module: 'ShadowManager',
        path: 'src/core/shadow-manager/index.ts',
        status: 'production',
      }),
    ]);
  });

  it('marks legacy and sidecar evolution modules outside the production path', () => {
    const statusByPath = new Map(
      getEvolutionArchitectureStatus().modules.map((module) => [module.path, module.status])
    );

    expect(statusByPath.get('src/core/skill-evolution/index.ts')).toBe('legacy');
    expect(statusByPath.get('src/core/pipeline/index.ts')).toBe('to_migrate');
    expect(statusByPath.get('src/core/readiness-probe/index.ts')).toBe('to_remove');
  });

  it('keeps daemon production code from importing legacy evolution engines', () => {
    for (const path of ['src/daemon/index.ts', 'src/daemon/project-runtime-registry.ts']) {
      const source = readRepoFile(path);

      expect(source).toContain('shadowManager');
      expect(source).not.toContain('../core/skill-evolution');
      expect(source).not.toContain('../core/pipeline');
      expect(source).not.toContain('../core/readiness-probe');
    }
  });

  it('creates project evolution runtimes through the ShadowManager facade', async () => {
    const init = vi.fn(async () => {});
    const processTrace = vi.fn(async () => {});
    const close = vi.fn(async () => {});
    const cleanupOldTraces = vi.fn(() => 0);
    const touchProject = vi.fn();

    const registry = new ProjectRuntimeRegistry({
      listProjects: () => [{ path: '/projects/alpha', monitoringState: 'active' }],
      getProjectRegistration: (projectRoot) => ({
        path: projectRoot,
        monitoringState: 'active',
        pausedAt: null,
      }),
      createShadowManager: () => ({
        init,
        processTrace,
        close,
        cleanupOldTraces,
      }),
      touchProject,
      startFileWatcher: () => null,
    });

    const matchedProject = await registry.ensureRuntimeForTrace(
      makeTrace('trace-alpha', '/projects/alpha/src/file.ts')
    );
    const runtime = registry.get('/projects/alpha');

    expect(matchedProject).toBe('/projects/alpha');
    expect(init).toHaveBeenCalledTimes(1);
    expect(touchProject).toHaveBeenCalledWith('/projects/alpha');
    expect(runtime?.shadowManager.processTrace).toBe(processTrace);
  });
});
