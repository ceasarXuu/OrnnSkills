import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { startDashboardServerOnAvailablePort } from '../../src/cli/commands/daemon/dashboard-launcher.js';

describe('daemon dashboard launcher', () => {
  it('increments the port until a server starts successfully', async () => {
    const firstServer = {
      start: vi.fn(async () => {
        throw new Error('port busy');
      }),
      stop: vi.fn(async () => {}),
    };
    const secondServer = {
      start: vi.fn(async () => {}),
      stop: vi.fn(async () => {}),
    };
    const createServer = vi
      .fn()
      .mockReturnValueOnce(firstServer)
      .mockReturnValueOnce(secondServer);

    const result = await startDashboardServerOnAvailablePort(47432, 'zh', {
      createServer,
      maxAttempts: 2,
    });

    expect(createServer).toHaveBeenNthCalledWith(1, 47432, 'zh');
    expect(createServer).toHaveBeenNthCalledWith(2, 47433, 'zh');
    expect(result.port).toBe(47433);
    expect(result.server).toBe(secondServer);
  });

  it('throws when all candidate ports fail', async () => {
    const createServer = vi.fn(() => ({
      start: vi.fn(async () => {
        throw new Error('still busy');
      }),
      stop: vi.fn(async () => {}),
    }));

    await expect(
      startDashboardServerOnAvailablePort(47432, 'en', {
        createServer,
        maxAttempts: 2,
      })
    ).rejects.toThrow('Could not find an available port');
  });
});

describe('openBrowser', () => {
  const mockSpawn = vi.fn();
  let originalPlatform: string | undefined;
  let cliInfoSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    originalPlatform = process.platform;
    mockSpawn.mockReset();
    mockSpawn.mockReturnValue({ on: vi.fn(), unref: vi.fn() });
    cliInfoSpy = vi.fn();
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });

  async function loadOpenBrowser(platform: string) {
    vi.resetModules();
    Object.defineProperty(process, 'platform', { value: platform });
    vi.doMock('node:child_process', () => ({ spawn: mockSpawn }));
    vi.doMock('../../src/utils/cli-output.js', () => ({ cliInfo: cliInfoSpy }));
    const mod = await import('../../src/cli/commands/daemon/dashboard-launcher.js');
    return mod.openBrowser;
  }

  it('spawns "open" on darwin with url as argument', async () => {
    const openBrowser = await loadOpenBrowser('darwin');

    openBrowser('http://localhost:47432/v3/');

    expect(mockSpawn).toHaveBeenCalledWith('open', ['http://localhost:47432/v3/'], {
      detached: true,
      stdio: 'ignore',
    });
  });

  it('spawns "cmd /c start" on win32 with url as argument', async () => {
    const openBrowser = await loadOpenBrowser('win32');

    openBrowser('http://localhost:47432/v3/');

    expect(mockSpawn).toHaveBeenCalledWith('cmd', ['/c', 'start', '', 'http://localhost:47432/v3/'], {
      detached: true,
      stdio: 'ignore',
    });
  });

  it('spawns "xdg-open" on linux with url as argument', async () => {
    const openBrowser = await loadOpenBrowser('linux');

    openBrowser('http://localhost:47432/v3/');

    expect(mockSpawn).toHaveBeenCalledWith('xdg-open', ['http://localhost:47432/v3/'], {
      detached: true,
      stdio: 'ignore',
    });
  });

  it('calls unref on child process', async () => {
    const mockChild = { on: vi.fn(), unref: vi.fn() };
    mockSpawn.mockReturnValue(mockChild);
    const openBrowser = await loadOpenBrowser('darwin');

    openBrowser('http://localhost:47432/v3/');

    expect(mockChild.unref).toHaveBeenCalled();
  });

  it('registers error handler that logs fallback message', async () => {
    const mockChild = { on: vi.fn(), unref: vi.fn() };
    mockSpawn.mockReturnValue(mockChild);
    const openBrowser = await loadOpenBrowser('darwin');

    openBrowser('http://localhost:47432/v3/');

    expect(mockChild.on).toHaveBeenCalledWith('error', expect.any(Function));
    // Simulate error and verify fallback message
    const errorHandler = mockChild.on.mock.calls.find(c => c[0] === 'error')![1];
    errorHandler();
    expect(cliInfoSpy).toHaveBeenCalledWith('Could not open browser automatically. Visit: http://localhost:47432/v3/');
  });
});