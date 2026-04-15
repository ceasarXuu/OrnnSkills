import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  let observerCallback: ((trace: unknown) => void) | null = null;

  const projectManagers = new Map<
    string,
    {
      init: ReturnType<typeof vi.fn>;
      processTrace: ReturnType<typeof vi.fn>;
      close: ReturnType<typeof vi.fn>;
    }
  >();

  return {
    observerCallbackRef: {
      get: () => observerCallback,
      set: (callback: ((trace: unknown) => void) | null) => {
        observerCallback = callback;
      },
    },
    projectManagers,
    createShadowManager: vi.fn((projectRoot: string) => {
      const manager = {
        init: vi.fn(async () => {}),
        processTrace: vi.fn(async () => {}),
        close: vi.fn(async () => {}),
      };
      projectManagers.set(projectRoot, manager);
      return manager;
    }),
    createCodexObserver: vi.fn(() => ({
      onTrace: vi.fn((callback: (trace: unknown) => void) => {
        observerCallback = callback;
      }),
      start: vi.fn(),
      stop: vi.fn(async () => {}),
    })),
    listProjects: vi.fn(() => [
      {
        path: '/projects/alpha',
        name: 'alpha',
        registeredAt: '2026-04-16T00:00:00.000Z',
        lastSeenAt: '2026-04-16T00:00:00.000Z',
      },
      {
        path: '/projects/beta',
        name: 'beta',
        registeredAt: '2026-04-16T00:00:00.000Z',
        lastSeenAt: '2026-04-16T00:00:00.000Z',
      },
    ]),
    touchProject: vi.fn(),
    validateProjectRootOrExit: vi.fn(() => {
      throw new Error('start should not require an initialized cwd');
    }),
    readPidFile: vi.fn(() => null),
    writePidFile: vi.fn(),
    removePidFile: vi.fn(),
    isProcessRunning: vi.fn(() => false),
    formatUptime: vi.fn(() => '1m'),
    getLogStats: vi.fn(() => ({ errorCount: 0, warningCount: 0 })),
    resolveCliEntryPath: vi.fn(() => '/tmp/dist/cli/index.js'),
    normalizeDashboardLang: vi.fn(() => 'en'),
    spawn: vi.fn(() => ({
      unref: vi.fn(),
    })),
    exec: vi.fn(),
    oraStart: vi.fn(() => ({
      text: '',
      succeed: vi.fn(),
      fail: vi.fn(),
      warn: vi.fn(),
    })),
    createDashboardServer: vi.fn(() => ({
      start: vi.fn(async () => {}),
      stop: vi.fn(async () => {}),
    })),
    printErrorAndExit: vi.fn((message: string) => {
      throw new Error(`printErrorAndExit called: ${message}`);
    }),
    cliInfo: vi.fn(),
  };
});

vi.mock('../../src/core/shadow-manager/index.js', () => ({
  createShadowManager: mocks.createShadowManager,
}));

vi.mock('../../src/core/observer/codex-observer.js', () => ({
  createCodexObserver: mocks.createCodexObserver,
}));

vi.mock('../../src/dashboard/projects-registry.js', () => ({
  listProjects: mocks.listProjects,
  touchProject: mocks.touchProject,
  registerProject: vi.fn(),
}));

vi.mock('../../src/cli/lib/cli-setup.js', () => ({
  validateProjectRootOrExit: mocks.validateProjectRootOrExit,
}));

vi.mock('../../src/cli/lib/daemon-helpers.js', () => ({
  readPidFile: mocks.readPidFile,
  writePidFile: mocks.writePidFile,
  removePidFile: mocks.removePidFile,
  isProcessRunning: mocks.isProcessRunning,
  formatUptime: mocks.formatUptime,
  getLogStats: mocks.getLogStats,
  resolveCliEntryPath: mocks.resolveCliEntryPath,
  normalizeDashboardLang: mocks.normalizeDashboardLang,
}));

vi.mock('node:child_process', () => ({
  exec: mocks.exec,
  spawn: mocks.spawn,
}));

vi.mock('../../src/dashboard/server.js', () => ({
  createDashboardServer: mocks.createDashboardServer,
}));

vi.mock('../../src/utils/error-helper.js', () => ({
  printErrorAndExit: mocks.printErrorAndExit,
}));

vi.mock('../../src/utils/cli-output.js', () => ({
  cliInfo: mocks.cliInfo,
}));

vi.mock('ora', () => ({
  default: (text: string) => ({
    text,
    start: mocks.oraStart,
  }),
}));

describe('global daemon architecture', () => {
  beforeEach(() => {
    mocks.projectManagers.clear();
    mocks.observerCallbackRef.set(null);
    mocks.createShadowManager.mockClear();
    mocks.createCodexObserver.mockClear();
    mocks.listProjects.mockClear();
    mocks.touchProject.mockClear();
    mocks.validateProjectRootOrExit.mockClear();
    mocks.readPidFile.mockClear();
    mocks.writePidFile.mockClear();
    mocks.removePidFile.mockClear();
    mocks.isProcessRunning.mockClear();
    mocks.spawn.mockClear();
    mocks.printErrorAndExit.mockClear();
    mocks.cliInfo.mockClear();
    mocks.oraStart.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('routes traces to the registered project managers instead of the launcher cwd', async () => {
    const { Daemon } = await import('../../src/daemon/index.js');

    const daemon = new Daemon('/launcher-context');
    await daemon.start();

    const observerCallback = mocks.observerCallbackRef.get();
    expect(observerCallback).toBeTypeOf('function');

    observerCallback?.({
      trace_id: 'trace-alpha',
      runtime: 'codex',
      session_id: 'session-alpha',
      turn_id: 'turn-1',
      event_type: 'user_input',
      timestamp: '2026-04-16T00:00:00.000Z',
      status: 'success',
      metadata: { projectPath: '/projects/alpha' },
    });
    observerCallback?.({
      trace_id: 'trace-beta',
      runtime: 'codex',
      session_id: 'session-beta',
      turn_id: 'turn-1',
      event_type: 'assistant_output',
      timestamp: '2026-04-16T00:00:01.000Z',
      status: 'success',
      metadata: { projectPath: '/projects/beta' },
    });
    observerCallback?.({
      trace_id: 'trace-ignored',
      runtime: 'codex',
      session_id: 'session-ignored',
      turn_id: 'turn-1',
      event_type: 'assistant_output',
      timestamp: '2026-04-16T00:00:02.000Z',
      status: 'success',
      metadata: { projectPath: '/projects/gamma' },
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(mocks.projectManagers.has('/launcher-context')).toBe(false);
    expect(mocks.projectManagers.get('/projects/alpha')?.init).toHaveBeenCalledTimes(1);
    expect(mocks.projectManagers.get('/projects/beta')?.init).toHaveBeenCalledTimes(1);
    expect(mocks.projectManagers.get('/projects/alpha')?.processTrace).toHaveBeenCalledTimes(1);
    expect(mocks.projectManagers.get('/projects/beta')?.processTrace).toHaveBeenCalledTimes(1);
    expect(mocks.touchProject).toHaveBeenCalledWith('/projects/alpha');
    expect(mocks.touchProject).toHaveBeenCalledWith('/projects/beta');
    expect(mocks.touchProject).not.toHaveBeenCalledWith('/launcher-context');

    await daemon.stop();
  });

  it('starts in background without validating the current project directory', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    const { createStartCommand } = await import('../../src/cli/commands/daemon.js');

    const command = createStartCommand();
    await command.parseAsync(['--background', '--no-dashboard'], { from: 'user' });

    expect(mocks.validateProjectRootOrExit).not.toHaveBeenCalled();
    expect(mocks.spawn).toHaveBeenCalledTimes(1);
    expect(exitSpy).toHaveBeenCalledWith(0);
  });
});
