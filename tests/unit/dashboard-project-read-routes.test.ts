import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  readProjectSnapshot: vi.fn(),
  readDaemonStatus: vi.fn(),
  readRecentTraces: vi.fn(),
  computeTraceStats: vi.fn(),
  readTaskEpisodeSnapshot: vi.fn(),
  readRecentDecisionEvents: vi.fn(),
  readAgentUsageRecords: vi.fn(),
  readTracesBySessionWindow: vi.fn(),
  readProjectLanguage: vi.fn(),
  buildActivityScopeDetailFromData: vi.fn(),
}));

vi.mock('../../src/dashboard/data-reader.js', () => ({
  readProjectSnapshot: mocks.readProjectSnapshot,
  readDaemonStatus: mocks.readDaemonStatus,
  readRecentTraces: mocks.readRecentTraces,
  computeTraceStats: mocks.computeTraceStats,
  readTaskEpisodeSnapshot: mocks.readTaskEpisodeSnapshot,
  readRecentDecisionEvents: mocks.readRecentDecisionEvents,
  readAgentUsageRecords: mocks.readAgentUsageRecords,
  readTracesBySessionWindow: mocks.readTracesBySessionWindow,
}));

vi.mock('../../src/dashboard/language-state.js', () => ({
  readProjectLanguage: mocks.readProjectLanguage,
}));

vi.mock('../../src/dashboard/activity-scope-reader.js', () => ({
  buildActivityScopeDetailFromData: mocks.buildActivityScopeDetailFromData,
}));

describe('dashboard project read routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns false for unrelated project routes', async () => {
    const { handleProjectReadRoutes } = await import('../../src/dashboard/routes/project-read-routes.js');

    const handled = await handleProjectReadRoutes({
      subPath: '/config',
      method: 'GET',
      projectPath: '/tmp/demo',
      currentLang: 'en',
      json: vi.fn(),
      notFound: vi.fn(),
      logger: { debug: vi.fn(), warn: vi.fn() },
    });

    expect(handled).toBe(false);
  });

  it('handles GET /api/projects/:id/snapshot', async () => {
    const { handleProjectReadRoutes } = await import('../../src/dashboard/routes/project-read-routes.js');
    const json = vi.fn();
    const snapshot = { summary: { traces: 12 } };
    mocks.readProjectSnapshot.mockReturnValue(snapshot);

    const handled = await handleProjectReadRoutes({
      subPath: '/snapshot',
      method: 'GET',
      projectPath: '/tmp/demo',
      currentLang: 'en',
      json,
      notFound: vi.fn(),
      logger: { debug: vi.fn(), warn: vi.fn() },
    });

    expect(handled).toBe(true);
    expect(mocks.readProjectSnapshot).toHaveBeenCalledWith('/tmp/demo');
    expect(json).toHaveBeenCalledWith(snapshot);
  });

  it('handles GET /api/projects/:id/status', async () => {
    const { handleProjectReadRoutes } = await import('../../src/dashboard/routes/project-read-routes.js');
    const json = vi.fn();
    const status = { isRunning: true, pid: 1234 };
    mocks.readDaemonStatus.mockReturnValue(status);

    const handled = await handleProjectReadRoutes({
      subPath: '/status',
      method: 'GET',
      projectPath: '/tmp/demo',
      currentLang: 'en',
      json,
      notFound: vi.fn(),
      logger: { debug: vi.fn(), warn: vi.fn() },
    });

    expect(handled).toBe(true);
    expect(mocks.readDaemonStatus).toHaveBeenCalledWith('/tmp/demo');
    expect(json).toHaveBeenCalledWith(status);
  });

  it('handles GET /api/projects/:id/traces', async () => {
    const { handleProjectReadRoutes } = await import('../../src/dashboard/routes/project-read-routes.js');
    const json = vi.fn();
    const traces = [{ traceId: 'trace-1' }];
    const stats = { total: 1 };
    mocks.readRecentTraces.mockReturnValue(traces);
    mocks.computeTraceStats.mockReturnValue(stats);

    const handled = await handleProjectReadRoutes({
      subPath: '/traces',
      method: 'GET',
      projectPath: '/tmp/demo',
      currentLang: 'en',
      json,
      notFound: vi.fn(),
      logger: { debug: vi.fn(), warn: vi.fn() },
    });

    expect(handled).toBe(true);
    expect(mocks.readRecentTraces).toHaveBeenCalledWith('/tmp/demo', 50);
    expect(mocks.computeTraceStats).toHaveBeenCalledWith(traces);
    expect(json).toHaveBeenCalledWith({ traces, stats });
  });

  it('handles GET /api/projects/:id/activity-scopes/:scopeId', async () => {
    const { handleProjectReadRoutes } = await import('../../src/dashboard/routes/project-read-routes.js');
    const json = vi.fn();
    const episode = {
      episodeId: 'scope-1',
      traceRefs: ['trace-1'],
      sessionIds: ['session-1'],
      startedAt: '2026-04-20T08:00:00.000Z',
      lastActivityAt: '2026-04-20T08:05:00.000Z',
    };
    const detail = { scopeId: 'scope-1', status: 'active', timeline: [] };
    mocks.readTaskEpisodeSnapshot.mockReturnValue({ episodes: [episode] });
    mocks.readProjectLanguage.mockResolvedValue('zh');
    mocks.readRecentDecisionEvents.mockReturnValue([{ id: 'decision-1' }]);
    mocks.readAgentUsageRecords.mockReturnValue([{ id: 'agent-1' }]);
    mocks.readTracesBySessionWindow.mockReturnValue([{ traceId: 'trace-1' }]);
    mocks.buildActivityScopeDetailFromData.mockReturnValue(detail);

    const handled = await handleProjectReadRoutes({
      subPath: '/activity-scopes/scope-1',
      method: 'GET',
      projectPath: '/tmp/demo-project',
      currentLang: 'en',
      json,
      notFound: vi.fn(),
      logger: { debug: vi.fn(), warn: vi.fn() },
    });

    expect(handled).toBe(true);
    expect(mocks.readTaskEpisodeSnapshot).toHaveBeenCalledWith('/tmp/demo-project');
    expect(mocks.readProjectLanguage).toHaveBeenCalledWith('/tmp/demo-project', 'en');
    expect(mocks.readTracesBySessionWindow).toHaveBeenCalledWith(
      '/tmp/demo-project',
      ['session-1'],
      '2026-04-20T08:00:00.000Z',
      '2026-04-20T08:05:00.000Z'
    );
    expect(mocks.buildActivityScopeDetailFromData).toHaveBeenCalledWith({
      lang: 'zh',
      projectName: 'demo-project',
      episode,
      decisionEvents: [{ id: 'decision-1' }],
      agentUsageRecords: [{ id: 'agent-1' }],
      traces: [{ traceId: 'trace-1' }],
    });
    expect(json).toHaveBeenCalledWith({ detail });
  });
});
