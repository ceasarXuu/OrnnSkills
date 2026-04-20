import { beforeEach, describe, expect, it, vi } from 'vitest';

function createFakeResponse() {
  return {
    writeHead: vi.fn(),
    write: vi.fn(),
    end: vi.fn(),
  };
}

describe('dashboard sse hub', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('connects a client, seeds snapshot versions, and sends the initial update', async () => {
    const { createDashboardSseHub } = await import('../../src/dashboard/sse/hub.js');
    const res = createFakeResponse();
    const projects = [
      {
        path: '/tmp/demo-project',
        name: 'demo-project',
        isRunning: true,
        monitoringState: 'active' as const,
        pausedAt: null,
        skillCount: 1,
      },
    ];

    const hub = createDashboardSseHub({
      createGlobalLogCursor: vi.fn().mockReturnValue({ path: null, offset: 0 }),
      readGlobalLogs: vi.fn().mockReturnValue([{ ts: '2026-04-17T00:00:00.000Z', line: 'boot' }]),
      readLogsSince: vi.fn().mockReturnValue({
        lines: [],
        cursor: { path: null, offset: 0 },
      }),
      readProjectSnapshotVersion: vi.fn().mockReturnValue('v1'),
      logger: { warn: vi.fn() },
    });

    hub.initializeCursor();
    const clientId = hub.connectClient(res, projects);

    expect(clientId).toEqual(expect.any(String));
    expect(res.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    }));
    expect(res.write).toHaveBeenNthCalledWith(1, 'retry: 3000\n\n');

    const initialPayloadWrite = res.write.mock.calls[1]?.[0];
    expect(initialPayloadWrite).toContain('"projects"');
    expect(initialPayloadWrite).toContain('"logs"');
    expect(initialPayloadWrite).not.toContain('projectData');
  });

  it('stays idle when projects, versions, and logs have not changed', async () => {
    const { createDashboardSseHub } = await import('../../src/dashboard/sse/hub.js');
    const res = createFakeResponse();
    const projects = [
      {
        path: '/tmp/demo-project',
        name: 'demo-project',
        isRunning: true,
        monitoringState: 'active' as const,
        pausedAt: null,
        skillCount: 1,
      },
    ];

    const readProjectSnapshotVersion = vi.fn().mockReturnValue('steady-version');
    const hub = createDashboardSseHub({
      createGlobalLogCursor: vi.fn().mockReturnValue({ path: null, offset: 0 }),
      readGlobalLogs: vi.fn().mockReturnValue([]),
      readLogsSince: vi.fn().mockReturnValue({
        lines: [],
        cursor: { path: null, offset: 0 },
      }),
      readProjectSnapshotVersion,
      logger: { warn: vi.fn() },
    });

    hub.initializeCursor();
    hub.connectClient(res, projects);
    hub.broadcast(projects);

    expect(res.write).toHaveBeenCalledTimes(2);
  });

  it('broadcasts changed project ids instead of embedding full project snapshots', async () => {
    const { createDashboardSseHub } = await import('../../src/dashboard/sse/hub.js');
    const res = createFakeResponse();
    const projects = [
      {
        path: '/tmp/demo-project',
        name: 'demo-project',
        isRunning: true,
        monitoringState: 'active' as const,
        pausedAt: null,
        skillCount: 1,
      },
    ];

    const readProjectSnapshotVersion = vi
      .fn()
      .mockReturnValueOnce('v1')
      .mockReturnValueOnce('v2');
    const hub = createDashboardSseHub({
      createGlobalLogCursor: vi.fn().mockReturnValue({ path: null, offset: 0 }),
      readGlobalLogs: vi.fn().mockReturnValue([]),
      readLogsSince: vi.fn().mockReturnValue({
        lines: [],
        cursor: { path: null, offset: 0 },
      }),
      readProjectSnapshotVersion,
      logger: { warn: vi.fn() },
    });

    hub.initializeCursor();
    hub.connectClient(res, projects);
    hub.broadcast(projects);

    const broadcastPayloadWrite = res.write.mock.calls[2]?.[0];
    expect(broadcastPayloadWrite).toContain('"changedProjects":["/tmp/demo-project"]');
    expect(broadcastPayloadWrite).not.toContain('projectData');
  });

  it('reads each project snapshot version only once per broadcast even with multiple clients', async () => {
    const { createDashboardSseHub } = await import('../../src/dashboard/sse/hub.js');
    const resA = createFakeResponse();
    const resB = createFakeResponse();
    const projects = [
      {
        path: '/tmp/demo-project-a',
        name: 'demo-project-a',
        isRunning: true,
        monitoringState: 'active' as const,
        pausedAt: null,
        skillCount: 1,
      },
      {
        path: '/tmp/demo-project-b',
        name: 'demo-project-b',
        isRunning: false,
        monitoringState: 'active' as const,
        pausedAt: null,
        skillCount: 3,
      },
    ];

    const readProjectSnapshotVersion = vi.fn((projectPath: string) =>
      projectPath === '/tmp/demo-project-a' ? 'v-project-a' : 'v-project-b'
    );
    const hub = createDashboardSseHub({
      createGlobalLogCursor: vi.fn().mockReturnValue({ path: null, offset: 0 }),
      readGlobalLogs: vi.fn().mockReturnValue([]),
      readLogsSince: vi.fn().mockReturnValue({
        lines: [],
        cursor: { path: null, offset: 0 },
      }),
      readProjectSnapshotVersion,
      logger: { warn: vi.fn() },
    });

    hub.initializeCursor();
    hub.connectClient(resA, projects);
    hub.connectClient(resB, projects);

    readProjectSnapshotVersion.mockClear();
    hub.broadcast(projects);

    expect(readProjectSnapshotVersion).toHaveBeenCalledTimes(projects.length);
    expect(readProjectSnapshotVersion).toHaveBeenNthCalledWith(1, '/tmp/demo-project-a');
    expect(readProjectSnapshotVersion).toHaveBeenNthCalledWith(2, '/tmp/demo-project-b');
  });
});
