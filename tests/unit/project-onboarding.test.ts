import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const mocks = vi.hoisted(() => ({
  initCommand: vi.fn(),
  readPidFile: vi.fn(),
  isProcessRunning: vi.fn(),
  spawn: vi.fn(),
}));

vi.mock('../../src/commands/init.js', () => ({
  initCommand: mocks.initCommand,
}));

vi.mock('../../src/cli/lib/daemon-helpers.js', () => ({
  readPidFile: mocks.readPidFile,
  isProcessRunning: mocks.isProcessRunning,
}));

vi.mock('node:child_process', () => ({
  spawn: mocks.spawn,
}));

describe('project onboarding', () => {
  beforeEach(() => {
    mocks.initCommand.mockReset();
    mocks.readPidFile.mockReset();
    mocks.isProcessRunning.mockReset();
    mocks.spawn.mockReset();
    mocks.spawn.mockReturnValue({ unref: vi.fn() });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('initializes a project when the .ornn directory is missing', async () => {
    const projectPath = join(tmpdir(), `ornn-onboard-init-${Date.now()}`);
    mkdirSync(projectPath, { recursive: true });

    const { ensureProjectInitialized } = await import('../../src/dashboard/project-onboarding.js');
    await expect(ensureProjectInitialized(projectPath)).resolves.toEqual({
      projectPath,
      initialized: true,
    });
    expect(mocks.initCommand).toHaveBeenCalledWith(projectPath);
  });

  it('skips init when the selected project is already initialized', async () => {
    const projectPath = join(tmpdir(), `ornn-onboard-existing-${Date.now()}`);
    mkdirSync(join(projectPath, '.ornn'), { recursive: true });

    const { ensureProjectInitialized } = await import('../../src/dashboard/project-onboarding.js');
    await expect(ensureProjectInitialized(projectPath)).resolves.toEqual({
      projectPath,
      initialized: false,
    });
    expect(mocks.initCommand).not.toHaveBeenCalled();
  });

  it('starts the daemon in background when monitoring is not running yet', async () => {
    const projectPath = join(tmpdir(), `ornn-onboard-daemon-${Date.now()}`);
    mkdirSync(projectPath, { recursive: true });
    mocks.readPidFile
      .mockReturnValueOnce(null)
      .mockReturnValueOnce(4321);
    mocks.isProcessRunning.mockReturnValue(true);

    const { ensureMonitoringDaemon } = await import('../../src/dashboard/project-onboarding.js');
    await expect(ensureMonitoringDaemon(projectPath)).resolves.toEqual({
      daemonStarted: true,
      daemonRunning: true,
    });

    expect(mocks.spawn).toHaveBeenCalledTimes(1);
    const [command, args, options] = mocks.spawn.mock.calls[0]!;
    expect(command).toBe(process.execPath);
    expect(args).toContain('start');
    expect(args).toContain('--project');
    expect(args).toContain(projectPath);
    expect(args).toContain('--no-dashboard');
    expect(options).toMatchObject({
      cwd: projectPath,
      detached: true,
      stdio: 'ignore',
    });
  });

  it('does not spawn a daemon when one is already running', async () => {
    mocks.readPidFile.mockReturnValue(4321);
    mocks.isProcessRunning.mockReturnValue(true);

    const { ensureMonitoringDaemon } = await import('../../src/dashboard/project-onboarding.js');
    await expect(ensureMonitoringDaemon('/tmp/existing')).resolves.toEqual({
      daemonStarted: false,
      daemonRunning: true,
    });
    expect(mocks.spawn).not.toHaveBeenCalled();
  });
});
