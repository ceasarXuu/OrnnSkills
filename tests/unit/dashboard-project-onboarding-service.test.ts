import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  addProject: vi.fn(),
  writeProjectLanguage: vi.fn(),
  ensureProjectInitialized: vi.fn(),
  ensureMonitoringDaemon: vi.fn(),
}));

vi.mock('../../src/dashboard/projects-registry.js', () => ({
  addProject: mocks.addProject,
}));

vi.mock('../../src/dashboard/language-state.js', () => ({
  writeProjectLanguage: mocks.writeProjectLanguage,
}));

vi.mock('../../src/dashboard/project-onboarding.js', () => ({
  ensureProjectInitialized: mocks.ensureProjectInitialized,
  ensureMonitoringDaemon: mocks.ensureMonitoringDaemon,
}));

describe('dashboard project onboarding service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes, registers, localizes, and starts monitoring for the project', async () => {
    const { onboardProjectForMonitoring } = await import('../../src/dashboard/services/project-onboarding-service.js');
    const logger = { info: vi.fn() };

    mocks.ensureProjectInitialized.mockResolvedValue({
      projectPath: '/tmp/initialized-project',
      initialized: true,
    });
    mocks.ensureMonitoringDaemon.mockResolvedValue({
      daemonStarted: true,
      daemonRunning: true,
    });

    const result = await onboardProjectForMonitoring({
      projectPath: '/tmp/raw-project',
      name: 'demo-project',
      currentLang: 'zh',
      logger,
    });

    expect(mocks.ensureProjectInitialized).toHaveBeenCalledWith('/tmp/raw-project');
    expect(mocks.addProject).toHaveBeenCalledWith('/tmp/initialized-project', 'demo-project');
    expect(mocks.writeProjectLanguage).toHaveBeenCalledWith('/tmp/initialized-project', 'zh');
    expect(mocks.ensureMonitoringDaemon).toHaveBeenCalledWith('/tmp/initialized-project');
    expect(result).toEqual({
      projectPath: '/tmp/initialized-project',
      initialized: true,
      daemonStarted: true,
      daemonRunning: true,
    });
    expect(logger.info).toHaveBeenCalledWith(
      'Project onboarded for dashboard monitoring',
      expect.objectContaining({
        projectPath: '/tmp/initialized-project',
        initialized: true,
        daemonStarted: true,
        daemonRunning: true,
        source: 'dashboard.project_onboarding',
      })
    );
  });
});
