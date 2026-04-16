import { afterEach, describe, expect, it, vi } from 'vitest';
import { createServer } from 'node:net';

const mocks = vi.hoisted(() => ({
  listProjects: vi.fn(),
  addProject: vi.fn(),
  setProjectMonitoringState: vi.fn(),
  pickProjectDirectory: vi.fn(),
  ensureProjectInitialized: vi.fn(),
  ensureMonitoringDaemon: vi.fn(),
  writeProjectLanguage: vi.fn(),
  readDaemonStatus: vi.fn(),
  readSkills: vi.fn(),
  readSkillContent: vi.fn(),
  readSkillVersion: vi.fn(),
  readRecentTraces: vi.fn(),
  computeTraceStats: vi.fn(),
  readProjectSnapshot: vi.fn(),
  readProjectSnapshotVersion: vi.fn(),
  readGlobalLogs: vi.fn(),
  readLogsSince: vi.fn(),
  readDashboardConfig: vi.fn(),
  writeDashboardConfig: vi.fn(),
  checkProvidersConnectivity: vi.fn(),
  resolveDashboardPromptOverrides: vi.fn((value) => ({
    skillCallAnalyzer: typeof value?.skillCallAnalyzer === 'string' ? value.skillCallAnalyzer.trim() : '',
    decisionExplainer: typeof value?.decisionExplainer === 'string' ? value.decisionExplainer.trim() : '',
    readinessProbe: typeof value?.readinessProbe === 'string' ? value.readinessProbe.trim() : '',
  })),
  getLiteLLMCatalog: vi.fn(),
  shadowRegistry: {
    init: vi.fn(),
    updateContent: vi.fn(),
  },
  createShadowRegistry: vi.fn(),
  versionManager: {
    createVersion: vi.fn(),
    setVersionDisabled: vi.fn(),
    getEffectiveVersion: vi.fn(),
  },
  SkillVersionManager: vi.fn(),
  deployer: {
    deploy: vi.fn(),
  },
  createSkillDeployer: vi.fn(),
}));

vi.mock('../../src/dashboard/projects-registry.js', () => ({
  listProjects: mocks.listProjects,
  addProject: mocks.addProject,
  setProjectMonitoringState: mocks.setProjectMonitoringState,
}));

vi.mock('../../src/dashboard/language-state.js', () => ({
  writeProjectLanguage: mocks.writeProjectLanguage,
}));

vi.mock('../../src/dashboard/native-project-picker.js', () => ({
  pickProjectDirectory: mocks.pickProjectDirectory,
}));

vi.mock('../../src/dashboard/project-onboarding.js', () => ({
  ensureProjectInitialized: mocks.ensureProjectInitialized,
  ensureMonitoringDaemon: mocks.ensureMonitoringDaemon,
}));

vi.mock('../../src/dashboard/data-reader.js', () => ({
  readDaemonStatus: mocks.readDaemonStatus,
  readSkills: mocks.readSkills,
  readSkillContent: mocks.readSkillContent,
  readSkillVersion: mocks.readSkillVersion,
  readRecentTraces: mocks.readRecentTraces,
  computeTraceStats: mocks.computeTraceStats,
  readProjectSnapshot: mocks.readProjectSnapshot,
  readProjectSnapshotVersion: mocks.readProjectSnapshotVersion,
  readGlobalLogs: mocks.readGlobalLogs,
  readLogsSince: mocks.readLogsSince,
}));

vi.mock('../../src/config/manager.js', () => ({
  readDashboardConfig: mocks.readDashboardConfig,
  writeDashboardConfig: mocks.writeDashboardConfig,
  checkProvidersConnectivity: mocks.checkProvidersConnectivity,
  resolveDashboardPromptOverrides: mocks.resolveDashboardPromptOverrides,
}));

vi.mock('../../src/config/litellm-catalog.js', () => ({
  getLiteLLMCatalog: mocks.getLiteLLMCatalog,
}));

vi.mock('../../src/core/shadow-registry/index.js', () => ({
  createShadowRegistry: mocks.createShadowRegistry,
}));

vi.mock('../../src/core/skill-version/index.js', () => ({
  SkillVersionManager: function SkillVersionManager(...args: unknown[]) {
    if (!mocks.SkillVersionManager.getMockImplementation()) {
      mocks.SkillVersionManager.mockImplementation(() => mocks.versionManager);
    }
    return mocks.SkillVersionManager(...args);
  },
}));

vi.mock('../../src/core/skill-deployer/index.js', () => ({
  createSkillDeployer: mocks.createSkillDeployer,
}));

async function getFreePort(): Promise<number> {
  return await new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('failed to resolve free port')));
        return;
      }
      const { port } = address;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(port);
      });
    });
  });
}

async function readFirstUpdateEvent(port: number): Promise<Record<string, unknown>> {
  const response = await fetch(`http://127.0.0.1:${port}/events`);
  if (!response.ok || !response.body) {
    throw new Error(`failed to open sse stream: HTTP ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      throw new Error('sse stream ended before first update event');
    }
    buffer += decoder.decode(value, { stream: true });
    while (true) {
      const boundary = buffer.indexOf('\n\n');
      if (boundary === -1) {
        break;
      }
      const chunk = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const dataLine = chunk
        .split('\n')
        .find((line) => line.startsWith('data: '));
      if (!dataLine) {
        continue;
      }
      reader.cancel().catch(() => undefined);
      return JSON.parse(dataLine.slice(6));
    }
  }
}

describe('dashboard server sse bootstrap', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('toggles a skill version disabled state and redeploys the latest effective version', async () => {
    const projectPath = '/tmp/demo-project';
    const skillId = 'demo-skill';
    const runtime = 'codex';
    const port = await getFreePort();
    mocks.createShadowRegistry.mockReturnValue(mocks.shadowRegistry);
    mocks.SkillVersionManager.mockImplementation(() => mocks.versionManager);
    mocks.createSkillDeployer.mockReturnValue(mocks.deployer);
    mocks.versionManager.setVersionDisabled.mockReturnValue({
      version: 4,
      content: '# muted',
      metadata: {
        version: 4,
        createdAt: '2026-04-17T00:00:00.000Z',
        reason: 'latest',
        traceIds: [],
        previousVersion: 3,
        isDisabled: true,
      },
    });
    mocks.versionManager.getEffectiveVersion.mockReturnValue({
      version: 3,
      content: '# active v3',
      metadata: {
        version: 3,
        createdAt: '2026-04-16T00:00:00.000Z',
        reason: 'previous',
        traceIds: [],
        previousVersion: 2,
        isDisabled: false,
      },
    });
    mocks.shadowRegistry.updateContent.mockReturnValue({ skillId, runtime });
    mocks.deployer.deploy.mockReturnValue({
      success: true,
      deployedPath: `/tmp/project/.${runtime}/skills/${skillId}/SKILL.md`,
      version: 3,
    });

    const { createDashboardServer } = await import('../../src/dashboard/server.js');
    const dashboard = createDashboardServer(port, 'en');
    await dashboard.start();

    try {
      const response = await fetch(
        `http://127.0.0.1:${port}/api/projects/${encodeURIComponent(projectPath)}/skills/${encodeURIComponent(skillId)}/versions/4?runtime=${runtime}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ disabled: true }),
        }
      );

      expect(response.ok).toBe(true);
      await expect(response.json()).resolves.toEqual({
        ok: true,
        skillId,
        runtime,
        version: 4,
        disabled: true,
        effectiveVersion: 3,
        metadata: expect.objectContaining({
          version: 4,
          isDisabled: true,
        }),
      });
      expect(mocks.versionManager.setVersionDisabled).toHaveBeenCalledWith(4, true);
      expect(mocks.shadowRegistry.updateContent).toHaveBeenCalledWith(skillId, '# active v3', runtime);
      expect(mocks.deployer.deploy).toHaveBeenCalledWith(
        skillId,
        expect.objectContaining({ version: 3, content: '# active v3' })
      );
    } finally {
      await dashboard.stop();
    }
  });

  it('applies the current skill content to every same-named registered skill as a one-off action', async () => {
    const sourceProject = '/tmp/source-project';
    const peerProject = '/tmp/peer-project';
    const skippedProject = '/tmp/skipped-project';
    const skillId = 'test-driven-development';
    const runtime = 'codex';
    const content = '# propagated skill';
    const port = await getFreePort();

    const sourceShadowRegistry = {
      init: vi.fn(),
      updateContent: vi.fn().mockReturnValue({ skillId, runtime }),
    };
    const peerShadowRegistry = {
      init: vi.fn(),
      updateContent: vi.fn().mockReturnValue({ skillId, runtime: 'claude' }),
    };
    const skippedShadowRegistry = {
      init: vi.fn(),
      updateContent: vi.fn().mockReturnValue({ skillId, runtime: 'opencode' }),
    };

    const sourceVersionManager = {
      createVersion: vi.fn().mockReturnValue({
        version: 4,
        content,
        metadata: {
          version: 4,
          createdAt: '2026-04-17T00:00:00.000Z',
          reason: 'Manual edit from dashboard',
          traceIds: [],
          previousVersion: 3,
          isDisabled: false,
        },
      }),
      setVersionDisabled: vi.fn(),
      getEffectiveVersion: vi.fn(),
    };
    const peerVersionManager = {
      createVersion: vi.fn().mockReturnValue({
        version: 9,
        content,
        metadata: {
          version: 9,
          createdAt: '2026-04-17T00:00:00.000Z',
          reason: 'Bulk apply from dashboard',
          traceIds: [],
          previousVersion: 8,
          isDisabled: false,
        },
      }),
      setVersionDisabled: vi.fn(),
      getEffectiveVersion: vi.fn(),
    };

    const sourceDeployer = {
      deploy: vi.fn().mockReturnValue({
        success: true,
        deployedPath: '/tmp/source-project/.codex/skills/test-driven-development/SKILL.md',
        version: 4,
      }),
    };
    const peerDeployer = {
      deploy: vi.fn().mockReturnValue({
        success: true,
        deployedPath: '/tmp/peer-project/.claude/skills/test-driven-development/SKILL.md',
        version: 9,
      }),
    };

    mocks.listProjects.mockReturnValue([
      {
        path: sourceProject,
        name: 'source-project',
        registeredAt: '2026-04-15T00:00:00.000Z',
        lastSeenAt: '2026-04-15T00:00:00.000Z',
      },
      {
        path: peerProject,
        name: 'peer-project',
        registeredAt: '2026-04-15T00:00:00.000Z',
        lastSeenAt: '2026-04-15T00:00:00.000Z',
      },
      {
        path: skippedProject,
        name: 'skipped-project',
        registeredAt: '2026-04-15T00:00:00.000Z',
        lastSeenAt: '2026-04-15T00:00:00.000Z',
      },
    ]);
    mocks.readSkills.mockImplementation((projectPath: string) => {
      if (projectPath === sourceProject) {
        return [{ skillId, runtime: 'codex' }];
      }
      if (projectPath === peerProject) {
        return [{ skillId, runtime: 'claude' }];
      }
      if (projectPath === skippedProject) {
        return [{ skillId, runtime: 'opencode' }];
      }
      return [];
    });
    mocks.readSkillContent.mockImplementation((projectPath: string, targetSkillId: string, targetRuntime?: string) => {
      if (targetSkillId !== skillId) return null;
      if (projectPath === sourceProject && targetRuntime === 'codex') return '# stale source';
      if (projectPath === peerProject && targetRuntime === 'claude') return '# stale peer';
      if (projectPath === skippedProject && targetRuntime === 'opencode') return content;
      return null;
    });
    mocks.createShadowRegistry.mockImplementation((projectPath: string) => {
      if (projectPath === sourceProject) return sourceShadowRegistry;
      if (projectPath === peerProject) return peerShadowRegistry;
      if (projectPath === skippedProject) return skippedShadowRegistry;
      return mocks.shadowRegistry;
    });
    mocks.SkillVersionManager.mockImplementation((options: { projectPath: string; runtime: string }) => {
      if (options.projectPath === sourceProject && options.runtime === 'codex') {
        return sourceVersionManager;
      }
      if (options.projectPath === peerProject && options.runtime === 'claude') {
        return peerVersionManager;
      }
      return mocks.versionManager;
    });
    mocks.createSkillDeployer.mockImplementation((options: { projectPath: string; runtime: string }) => {
      if (options.projectPath === sourceProject && options.runtime === 'codex') {
        return sourceDeployer;
      }
      if (options.projectPath === peerProject && options.runtime === 'claude') {
        return peerDeployer;
      }
      return mocks.deployer;
    });

    const { createDashboardServer } = await import('../../src/dashboard/server.js');
    const dashboard = createDashboardServer(port, 'en');
    await dashboard.start();

    try {
      const response = await fetch(
        `http://127.0.0.1:${port}/api/projects/${encodeURIComponent(sourceProject)}/skills/${encodeURIComponent(skillId)}/apply-to-all?runtime=${runtime}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content, runtime }),
        }
      );

      expect(response.ok).toBe(true);
      await expect(response.json()).resolves.toEqual({
        ok: true,
        skillId,
        runtime,
        source: {
          saved: true,
          version: 4,
        },
        totalTargets: 2,
        updatedTargets: 1,
        skippedTargets: 1,
        failedTargets: 0,
      });

      expect(sourceShadowRegistry.updateContent).toHaveBeenCalledWith(skillId, content, 'codex');
      expect(peerShadowRegistry.updateContent).toHaveBeenCalledWith(skillId, content, 'claude');
      expect(skippedShadowRegistry.updateContent).not.toHaveBeenCalled();

      expect(sourceVersionManager.createVersion).toHaveBeenCalledWith(
        content,
        expect.any(String),
        []
      );
      expect(peerVersionManager.createVersion).toHaveBeenCalledWith(
        content,
        expect.any(String),
        []
      );
      expect(sourceDeployer.deploy).toHaveBeenCalledWith(
        skillId,
        expect.objectContaining({ version: 4, content })
      );
      expect(peerDeployer.deploy).toHaveBeenCalledWith(
        skillId,
        expect.objectContaining({ version: 9, content })
      );
    } finally {
      await dashboard.stop();
    }
  });

  it('does not send full project snapshots in the initial sse payload', async () => {
    const projectPath = '/tmp/demo-project';
    const port = await getFreePort();
    mocks.listProjects.mockReturnValue([
      {
        path: projectPath,
        name: 'demo-project',
        registeredAt: '2026-04-15T00:00:00.000Z',
        lastSeenAt: '2026-04-15T00:00:00.000Z',
      },
    ]);
    mocks.readDaemonStatus.mockReturnValue({ isRunning: true });
    mocks.readSkills.mockReturnValue([{ skillId: 'demo-skill' }]);
    mocks.readProjectSnapshot.mockReturnValue({
      daemon: { isRunning: true },
      skills: [],
      traceStats: { total: 0, byRuntime: {}, byStatus: {}, byEventType: {} },
      recentTraces: [],
      decisionEvents: [],
      agentUsage: {
        callCount: 0,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        durationMsTotal: 0,
        avgDurationMs: 0,
        lastCallAt: null,
        byModel: {},
        byScope: {},
        bySkill: {},
      },
    });
    mocks.readGlobalLogs.mockReturnValue([{ ts: '2026-04-15T00:00:00.000Z', line: 'boot' }]);
    mocks.readLogsSince.mockReturnValue({ lines: [], newOffset: 0 });
    mocks.readProjectSnapshotVersion.mockReturnValue('v1');

    const { createDashboardServer } = await import('../../src/dashboard/server.js');
    const dashboard = createDashboardServer(port, 'zh');
    await dashboard.start();

    try {
      const payload = await readFirstUpdateEvent(port);
      expect(payload.projects).toEqual([
        expect.objectContaining({
          path: projectPath,
          name: 'demo-project',
          isRunning: true,
          skillCount: 1,
        }),
      ]);
      expect(payload.logs).toEqual([{ ts: '2026-04-15T00:00:00.000Z', line: 'boot' }]);
      expect(payload).not.toHaveProperty('projectData');
      expect(mocks.readProjectSnapshot).not.toHaveBeenCalled();
    } finally {
      await dashboard.stop();
    }
  });

  it('seeds snapshot versions on connect so the first steady-state broadcast stays idle', async () => {
    const originalSetInterval = globalThis.setInterval;
    vi.stubGlobal('setInterval', ((handler: TimerHandler, _timeout?: number, ...args: unknown[]) => {
      return originalSetInterval(handler, 20, ...args);
    }) as typeof setInterval);

    const projectPath = '/tmp/demo-project';
    const port = await getFreePort();
    mocks.listProjects.mockReturnValue([
      {
        path: projectPath,
        name: 'demo-project',
        registeredAt: '2026-04-15T00:00:00.000Z',
        lastSeenAt: '2026-04-15T00:00:00.000Z',
      },
    ]);
    mocks.readDaemonStatus.mockReturnValue({ isRunning: true });
    mocks.readSkills.mockReturnValue([{ skillId: 'demo-skill' }]);
    mocks.readProjectSnapshot.mockReturnValue({
      daemon: { isRunning: true },
      skills: [],
      traceStats: { total: 0, byRuntime: {}, byStatus: {}, byEventType: {} },
      recentTraces: [],
      decisionEvents: [],
      agentUsage: {
        callCount: 0,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        durationMsTotal: 0,
        avgDurationMs: 0,
        lastCallAt: null,
        byModel: {},
        byScope: {},
        bySkill: {},
      },
    });
    mocks.readProjectSnapshotVersion.mockReturnValue('steady-version');
    mocks.readGlobalLogs.mockReturnValue([]);
    mocks.readLogsSince.mockReturnValue({ lines: [], newOffset: 0 });

    const { createDashboardServer } = await import('../../src/dashboard/server.js');
    const dashboard = createDashboardServer(port, 'zh');
    await dashboard.start();

    try {
      const response = await fetch(`http://127.0.0.1:${port}/events`);
      expect(response.ok).toBe(true);
      await new Promise((resolve) => setTimeout(resolve, 70));
      expect(mocks.readProjectSnapshot).not.toHaveBeenCalled();
      response.body?.cancel().catch(() => undefined);
    } finally {
      await dashboard.stop();
    }
  });

  it('broadcasts changed project ids instead of embedding full project snapshots', async () => {
    const originalSetInterval = globalThis.setInterval;
    vi.stubGlobal('setInterval', ((handler: TimerHandler, _timeout?: number, ...args: unknown[]) => {
      return originalSetInterval(handler, 20, ...args);
    }) as typeof setInterval);

    const projectPath = '/tmp/demo-project';
    const port = await getFreePort();
    mocks.listProjects.mockReturnValue([
      {
        path: projectPath,
        name: 'demo-project',
        registeredAt: '2026-04-15T00:00:00.000Z',
        lastSeenAt: '2026-04-15T00:00:00.000Z',
      },
    ]);
    mocks.readDaemonStatus.mockReturnValue({ isRunning: true });
    mocks.readSkills.mockReturnValue([{ skillId: 'demo-skill' }]);
    mocks.readGlobalLogs.mockReturnValue([]);
    mocks.readLogsSince.mockReturnValue({ lines: [], newOffset: 0 });
    mocks.readProjectSnapshotVersion
      .mockReturnValueOnce('v1')
      .mockReturnValueOnce('v2');

    const { createDashboardServer } = await import('../../src/dashboard/server.js');
    const dashboard = createDashboardServer(port, 'en');
    await dashboard.start();

    try {
      const response = await fetch(`http://127.0.0.1:${port}/events`);
      expect(response.ok).toBe(true);
      expect(response.body).toBeTruthy();

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      const payloads: Array<Record<string, unknown>> = [];

      const readUntilUpdateCount = async (count: number) => {
        while (payloads.length < count) {
          const { value, done } = await reader.read();
          if (done) {
            throw new Error('sse stream ended before receiving expected updates');
          }
          buffer += decoder.decode(value, { stream: true });
          while (true) {
            const boundary = buffer.indexOf('\n\n');
            if (boundary === -1) break;
            const chunk = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary + 2);
            const dataLine = chunk
              .split('\n')
              .find((line) => line.startsWith('data: '));
            if (!dataLine) continue;
            payloads.push(JSON.parse(dataLine.slice(6)));
          }
        }
      };

      await readUntilUpdateCount(2);

      expect(payloads[1]).toEqual({
        changedProjects: [projectPath],
      });
      expect(mocks.readProjectSnapshot).not.toHaveBeenCalled();
      reader.cancel().catch(() => undefined);
    } finally {
      await dashboard.stop();
    }
  });

  it('persists the selected dashboard language for the requested project', async () => {
    const projectPath = '/tmp/demo-project';
    const port = await getFreePort();
    mocks.listProjects.mockReturnValue([
      {
        path: projectPath,
        name: 'demo-project',
        registeredAt: '2026-04-15T00:00:00.000Z',
        lastSeenAt: '2026-04-15T00:00:00.000Z',
      },
    ]);

    const { createDashboardServer } = await import('../../src/dashboard/server.js');
    const dashboard = createDashboardServer(port, 'en');
    await dashboard.start();

    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/lang`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lang: 'zh', projectPath }),
      });

      expect(response.ok).toBe(true);
      expect(await response.json()).toEqual({ ok: true, lang: 'zh' });
      expect(mocks.writeProjectLanguage).toHaveBeenCalledWith(projectPath, 'zh');
    } finally {
      await dashboard.stop();
    }
  });

  it('opens the native project picker and registers the selected project', async () => {
    const projectPath = '/tmp/picked-project';
    const port = await getFreePort();
    mocks.listProjects.mockReturnValue([
      {
        path: projectPath,
        name: 'picked-project',
        registeredAt: '2026-04-15T00:00:00.000Z',
        lastSeenAt: '2026-04-15T00:00:00.000Z',
      },
    ]);
    mocks.pickProjectDirectory.mockResolvedValue(projectPath);
    mocks.ensureProjectInitialized.mockResolvedValue({ projectPath, initialized: true });
    mocks.ensureMonitoringDaemon.mockResolvedValue({ daemonStarted: true, daemonRunning: true });
    mocks.readDaemonStatus.mockReturnValue({ isRunning: false });
    mocks.readSkills.mockReturnValue([]);
    mocks.readGlobalLogs.mockReturnValue([]);
    mocks.readLogsSince.mockReturnValue({ lines: [], newOffset: 0 });
    mocks.readProjectSnapshotVersion.mockReturnValue('v1');

    const { createDashboardServer } = await import('../../src/dashboard/server.js');
    const dashboard = createDashboardServer(port, 'en');
    await dashboard.start();

    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/projects/pick`, { method: 'POST' });
      expect(response.ok).toBe(true);
      await expect(response.json()).resolves.toEqual({
        ok: true,
        path: projectPath,
        initialized: true,
        daemonStarted: true,
        daemonRunning: true,
        projects: [
          expect.objectContaining({
            path: projectPath,
            name: 'picked-project',
            isRunning: false,
            skillCount: 0,
          }),
        ],
      });
      expect(mocks.pickProjectDirectory).toHaveBeenCalledTimes(1);
      expect(mocks.ensureProjectInitialized).toHaveBeenCalledWith(projectPath);
      expect(mocks.addProject).toHaveBeenCalledWith(projectPath, undefined);
      expect(mocks.writeProjectLanguage).toHaveBeenCalledWith(projectPath, 'en');
      expect(mocks.ensureMonitoringDaemon).toHaveBeenCalledWith(projectPath);
    } finally {
      await dashboard.stop();
    }
  });

  it('pauses and resumes project monitoring through the dashboard api', async () => {
    const projectPath = '/tmp/pauseable-project';
    const port = await getFreePort();
    const projects = [
      {
        path: projectPath,
        name: 'pauseable-project',
        registeredAt: '2026-04-15T00:00:00.000Z',
        lastSeenAt: '2026-04-15T00:00:00.000Z',
        monitoringState: 'active' as const,
        pausedAt: null,
      },
    ];

    mocks.listProjects.mockImplementation(() => projects.map((project) => ({ ...project })));
    mocks.setProjectMonitoringState.mockImplementation(
      (path: string, monitoringState: 'active' | 'paused') => {
        const index = projects.findIndex((project) => project.path === path);
        if (index === -1) return null;
        projects[index] = {
          ...projects[index],
          monitoringState,
          pausedAt: monitoringState === 'paused' ? '2026-04-17T09:00:00.000Z' : null,
        };
        return { ...projects[index] };
      }
    );
    mocks.readDaemonStatus.mockReturnValue({
      isRunning: true,
      pid: process.pid,
      startedAt: '2026-04-17T08:00:00.000Z',
      processedTraces: 12,
      lastCheckpointAt: '2026-04-17T08:30:00.000Z',
      retryQueueSize: 0,
      optimizationStatus: {
        currentState: 'idle',
        currentSkillId: null,
        lastOptimizationAt: '2026-04-17T08:20:00.000Z',
        lastError: null,
        queueSize: 0,
      },
      monitoringState: 'active',
      pausedAt: null,
    });
    mocks.readSkills.mockReturnValue([]);

    const { createDashboardServer } = await import('../../src/dashboard/server.js');
    const dashboard = createDashboardServer(port, 'en');
    await dashboard.start();

    try {
      const pauseResponse = await fetch(
        `http://127.0.0.1:${port}/api/projects/${encodeURIComponent(projectPath)}/monitoring`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paused: true }),
        }
      );

      expect(pauseResponse.ok).toBe(true);
      await expect(pauseResponse.json()).resolves.toEqual({
        ok: true,
        project: expect.objectContaining({
          path: projectPath,
          monitoringState: 'paused',
          pausedAt: '2026-04-17T09:00:00.000Z',
          isPaused: true,
          isRunning: false,
          skillCount: 0,
        }),
        projects: [
          expect.objectContaining({
            path: projectPath,
            monitoringState: 'paused',
            pausedAt: '2026-04-17T09:00:00.000Z',
            isPaused: true,
            isRunning: false,
            skillCount: 0,
          }),
        ],
      });
      expect(mocks.setProjectMonitoringState).toHaveBeenCalledWith(projectPath, 'paused');

      const resumeResponse = await fetch(
        `http://127.0.0.1:${port}/api/projects/${encodeURIComponent(projectPath)}/monitoring`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paused: false }),
        }
      );

      expect(resumeResponse.ok).toBe(true);
      await expect(resumeResponse.json()).resolves.toEqual({
        ok: true,
        project: expect.objectContaining({
          path: projectPath,
          monitoringState: 'active',
          pausedAt: null,
          isPaused: false,
          isRunning: true,
          skillCount: 0,
        }),
        projects: [
          expect.objectContaining({
            path: projectPath,
            monitoringState: 'active',
            pausedAt: null,
            isPaused: false,
            isRunning: true,
            skillCount: 0,
          }),
        ],
      });
      expect(mocks.setProjectMonitoringState).toHaveBeenLastCalledWith(projectPath, 'active');
    } finally {
      await dashboard.stop();
    }
  });

  it('serves global config from a project-independent endpoint', async () => {
    const port = await getFreePort();
    mocks.readDashboardConfig.mockResolvedValue({
      autoOptimize: true,
      userConfirm: false,
      runtimeSync: true,
      defaultProvider: 'deepseek',
      logLevel: 'info',
      providers: [{ provider: 'deepseek', modelName: 'deepseek/deepseek-chat', apiKeyEnvVar: 'DEEPSEEK_API_KEY', hasApiKey: true }],
    });

    const { createDashboardServer } = await import('../../src/dashboard/server.js');
    const dashboard = createDashboardServer(port, 'en');
    await dashboard.start();

    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/config`);
      expect(response.ok).toBe(true);
      expect(await response.json()).toEqual({
        config: expect.objectContaining({
          defaultProvider: 'deepseek',
          logLevel: 'info',
        }),
      });
      expect(mocks.readDashboardConfig).toHaveBeenCalledWith(undefined);
    } finally {
      await dashboard.stop();
    }
  });

  it('passes projectPath query to global config and provider health endpoints for legacy fallback', async () => {
    const port = await getFreePort();
    const projectPath = '/tmp/legacy-project';
    mocks.readDashboardConfig.mockResolvedValue({
      autoOptimize: true,
      userConfirm: false,
      runtimeSync: true,
      defaultProvider: 'deepseek',
      logLevel: 'info',
      providers: [{ provider: 'deepseek', modelName: 'deepseek/deepseek-chat', apiKeyEnvVar: 'DEEPSEEK_API_KEY', hasApiKey: true }],
    });
    mocks.checkProvidersConnectivity.mockResolvedValue([]);

    const { createDashboardServer } = await import('../../src/dashboard/server.js');
    const dashboard = createDashboardServer(port, 'en');
    await dashboard.start();

    try {
      const configResponse = await fetch(`http://127.0.0.1:${port}/api/config?projectPath=${encodeURIComponent(projectPath)}`);
      expect(configResponse.ok).toBe(true);
      expect(mocks.readDashboardConfig).toHaveBeenCalledWith(projectPath);

      await fetch(`http://127.0.0.1:${port}/api/provider-health?projectPath=${encodeURIComponent(projectPath)}`);
      expect(mocks.readDashboardConfig).toHaveBeenCalledWith(projectPath);
      expect(mocks.checkProvidersConnectivity).toHaveBeenCalledWith(projectPath, expect.any(Array));
    } finally {
      await dashboard.stop();
    }
  });

  it('persists llm safety settings from the config endpoint payload', async () => {
    const port = await getFreePort();
    const { createDashboardServer } = await import('../../src/dashboard/server.js');
    const dashboard = createDashboardServer(port, 'en');
    await dashboard.start();

    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: {
            autoOptimize: true,
            userConfirm: false,
            runtimeSync: true,
            defaultProvider: 'deepseek',
            logLevel: 'info',
            llmSafety: {
              enabled: true,
              windowMs: 45000,
              maxRequestsPerWindow: 7,
              maxConcurrentRequests: 1,
              maxEstimatedTokensPerWindow: 16000,
            },
            promptOverrides: {
              skillCallAnalyzer: 'Return strict JSON.',
              decisionExplainer: 'Stay concise.',
              readinessProbe: 'Delay until stable evidence appears.',
            },
            providers: [
              {
                provider: 'deepseek',
                modelName: 'deepseek/deepseek-chat',
                apiKeyEnvVar: 'DEEPSEEK_API_KEY',
              },
            ],
          },
        }),
      });

      expect(response.ok).toBe(true);
      expect(await response.json()).toEqual({ ok: true });
      expect(mocks.writeDashboardConfig).toHaveBeenCalledWith(undefined, expect.objectContaining({
        llmSafety: {
          enabled: true,
          windowMs: 45000,
          maxRequestsPerWindow: 7,
          maxConcurrentRequests: 1,
          maxEstimatedTokensPerWindow: 16000,
        },
        promptOverrides: {
          skillCallAnalyzer: 'Return strict JSON.',
          decisionExplainer: 'Stay concise.',
          readinessProbe: 'Delay until stable evidence appears.',
        },
      }));
    } finally {
      await dashboard.stop();
    }
  });
});
