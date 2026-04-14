import { afterEach, describe, expect, it, vi } from 'vitest';
import { createServer } from 'node:net';

const mocks = vi.hoisted(() => ({
  listProjects: vi.fn(),
  addProject: vi.fn(),
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
  getLiteLLMCatalog: vi.fn(),
}));

vi.mock('../../src/dashboard/projects-registry.js', () => ({
  listProjects: mocks.listProjects,
  addProject: mocks.addProject,
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
}));

vi.mock('../../src/config/litellm-catalog.js', () => ({
  getLiteLLMCatalog: mocks.getLiteLLMCatalog,
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
});
