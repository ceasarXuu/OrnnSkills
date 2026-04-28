import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdirSync, rmSync, existsSync } from 'node:fs';

describe('dashboard project management routes', () => {
  const makeLogger = () => ({
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns false for unrelated routes', async () => {
    const { handleProjectManagementRoutes } = await import('../../src/dashboard/routes/project-management-routes.js');

    const handled = await handleProjectManagementRoutes({
      path: '/api/dashboard/runtime',
      method: 'GET',
      json: vi.fn(),
      parseBody: vi.fn(),
      getProjectsWithStatus: vi.fn(),
      onboardProjectForMonitoring: vi.fn(),
      pickProjectDirectory: vi.fn(),
      setProjectMonitoringState: vi.fn(),
      readGlobalLogs: vi.fn(),
      logger: makeLogger(),
    });

    expect(handled).toBe(false);
  });

  it('handles GET /api/projects', async () => {
    const { handleProjectManagementRoutes } = await import('../../src/dashboard/routes/project-management-routes.js');
    const json = vi.fn();
    const projects = [{ path: '/tmp/demo', name: 'demo', isRunning: true, skillCount: 1 }];

    const handled = await handleProjectManagementRoutes({
      path: '/api/projects',
      method: 'GET',
      json,
      parseBody: vi.fn(),
      getProjectsWithStatus: vi.fn().mockReturnValue(projects),
      onboardProjectForMonitoring: vi.fn(),
      pickProjectDirectory: vi.fn(),
      setProjectMonitoringState: vi.fn(),
      readGlobalLogs: vi.fn(),
      logger: makeLogger(),
    });

    expect(handled).toBe(true);
    expect(json).toHaveBeenCalledWith({ projects });
  });

  it('handles POST /api/projects/pick', async () => {
    const { handleProjectManagementRoutes } = await import('../../src/dashboard/routes/project-management-routes.js');
    const json = vi.fn();
    const getProjectsWithStatus = vi.fn().mockReturnValue([{ path: '/tmp/picked', name: 'picked', isRunning: true, skillCount: 0 }]);
    const onboardProjectForMonitoring = vi.fn().mockResolvedValue({
      projectPath: '/tmp/picked',
      initialized: true,
      daemonStarted: true,
      daemonRunning: true,
    });
    const pickProjectDirectory = vi.fn().mockResolvedValue('/tmp/picked');

    const handled = await handleProjectManagementRoutes({
      path: '/api/projects/pick',
      method: 'POST',
      json,
      parseBody: vi.fn(),
      getProjectsWithStatus,
      onboardProjectForMonitoring,
      pickProjectDirectory,
      setProjectMonitoringState: vi.fn(),
      readGlobalLogs: vi.fn(),
      logger: makeLogger(),
    });

    expect(handled).toBe(true);
    expect(pickProjectDirectory).toHaveBeenCalledTimes(1);
    expect(onboardProjectForMonitoring).toHaveBeenCalledWith('/tmp/picked');
    expect(json).toHaveBeenCalledWith({
      ok: true,
      path: '/tmp/picked',
      initialized: true,
      daemonStarted: true,
      daemonRunning: true,
      projects: [{ path: '/tmp/picked', name: 'picked', isRunning: true, skillCount: 0 }],
    });
  });

  it('handles PATCH /api/projects/:id/monitoring', async () => {
    const { handleProjectManagementRoutes } = await import('../../src/dashboard/routes/project-management-routes.js');
    const json = vi.fn();
    const getProjectsWithStatus = vi.fn().mockReturnValue([
      {
        path: '/tmp/demo',
        name: 'demo',
        monitoringState: 'paused',
        pausedAt: '2026-04-17T09:00:00.000Z',
        isPaused: true,
        isRunning: false,
        skillCount: 0,
      },
    ]);
    const updatedProject = {
      path: '/tmp/demo',
      name: 'demo',
      monitoringState: 'paused',
      pausedAt: '2026-04-17T09:00:00.000Z',
    };

    const handled = await handleProjectManagementRoutes({
      path: '/api/projects/demo/monitoring',
      method: 'PATCH',
      projectPath: '/tmp/demo',
      subPath: '/monitoring',
      json,
      parseBody: vi.fn().mockResolvedValue({ paused: true }),
      getProjectsWithStatus,
      onboardProjectForMonitoring: vi.fn(),
      pickProjectDirectory: vi.fn(),
      setProjectMonitoringState: vi.fn().mockReturnValue(updatedProject),
      readGlobalLogs: vi.fn(),
      logger: makeLogger(),
    });

    expect(handled).toBe(true);
    expect(json).toHaveBeenCalledWith({
      ok: true,
      project: {
        path: '/tmp/demo',
        name: 'demo',
        monitoringState: 'paused',
        pausedAt: '2026-04-17T09:00:00.000Z',
        isPaused: true,
        isRunning: false,
        skillCount: 0,
      },
      projects: [
        {
          path: '/tmp/demo',
          name: 'demo',
          monitoringState: 'paused',
          pausedAt: '2026-04-17T09:00:00.000Z',
          isPaused: true,
          isRunning: false,
          skillCount: 0,
        },
      ],
    });
  });

  it('handles GET /api/logs', async () => {
    const { handleProjectManagementRoutes } = await import('../../src/dashboard/routes/project-management-routes.js');
    const json = vi.fn();
    const lines = [{ ts: '2026-04-17T00:00:00.000Z', line: 'boot' }];

    const handled = await handleProjectManagementRoutes({
      path: '/api/logs',
      method: 'GET',
      json,
      parseBody: vi.fn(),
      getProjectsWithStatus: vi.fn(),
      onboardProjectForMonitoring: vi.fn(),
      pickProjectDirectory: vi.fn(),
      setProjectMonitoringState: vi.fn(),
      readGlobalLogs: vi.fn().mockReturnValue(lines),
      logger: makeLogger(),
    });

    expect(handled).toBe(true);
    expect(json).toHaveBeenCalledWith({ lines });
  });

  describe('POST /api/projects path validation', () => {
    const testDir = join(tmpdir(), 'ornn-route-test-' + Date.now());

    beforeEach(() => {
      mkdirSync(testDir, { recursive: true });
    });

    afterEach(() => {
      if (existsSync(testDir)) {
        rmSync(testDir, { recursive: true, force: true });
      }
    });

    it('rejects path with NUL bytes', async () => {
      const { handleProjectManagementRoutes } = await import('../../src/dashboard/routes/project-management-routes.js');
      const json = vi.fn();

      const handled = await handleProjectManagementRoutes({
        path: '/api/projects',
        method: 'POST',
        json,
        parseBody: vi.fn().mockResolvedValue({ path: '/tmp/test\0evil' }),
        getProjectsWithStatus: vi.fn(),
        onboardProjectForMonitoring: vi.fn(),
        pickProjectDirectory: vi.fn(),
        setProjectMonitoringState: vi.fn(),
        readGlobalLogs: vi.fn(),
        logger: makeLogger(),
      });

      expect(handled).toBe(true);
      expect(json).toHaveBeenCalledWith(expect.objectContaining({ ok: false }), 400);
    });

    it('rejects path traversal', async () => {
      const { handleProjectManagementRoutes } = await import('../../src/dashboard/routes/project-management-routes.js');
      const json = vi.fn();

      const handled = await handleProjectManagementRoutes({
        path: '/api/projects',
        method: 'POST',
        json,
        parseBody: vi.fn().mockResolvedValue({ path: '../../../etc/passwd' }),
        getProjectsWithStatus: vi.fn(),
        onboardProjectForMonitoring: vi.fn(),
        pickProjectDirectory: vi.fn(),
        setProjectMonitoringState: vi.fn(),
        readGlobalLogs: vi.fn(),
        logger: makeLogger(),
      });

      expect(handled).toBe(true);
      expect(json).toHaveBeenCalledWith(expect.objectContaining({ ok: false }), 400);
    });

    it('passes validated path to onboardProjectForMonitoring', async () => {
      const { handleProjectManagementRoutes } = await import('../../src/dashboard/routes/project-management-routes.js');
      const json = vi.fn();
      const onboardProjectForMonitoring = vi.fn().mockResolvedValue({
        projectPath: testDir,
        initialized: true,
        daemonStarted: false,
        daemonRunning: true,
      });

      const handled = await handleProjectManagementRoutes({
        path: '/api/projects',
        method: 'POST',
        json,
        parseBody: vi.fn().mockResolvedValue({ path: testDir }),
        getProjectsWithStatus: vi.fn().mockReturnValue([]),
        onboardProjectForMonitoring,
        pickProjectDirectory: vi.fn(),
        setProjectMonitoringState: vi.fn(),
        readGlobalLogs: vi.fn(),
        logger: makeLogger(),
      });

      expect(handled).toBe(true);
      expect(onboardProjectForMonitoring).toHaveBeenCalledWith(testDir, undefined);
      expect(json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
    });
  });
});
