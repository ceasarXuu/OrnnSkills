import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { normalizeDashboardLang, resolveCliEntryPath } from '../../src/cli/lib/daemon-helpers.js';

describe('daemon helpers', () => {
  const originalHome = process.env.HOME;

  afterEach(() => {
    process.env.HOME = originalHome;
    vi.resetModules();
  });

  it('normalizes dashboard language to supported values', () => {
    expect(normalizeDashboardLang('zh')).toBe('zh');
    expect(normalizeDashboardLang('en')).toBe('en');
    expect(normalizeDashboardLang('fr')).toBe('en');
    expect(normalizeDashboardLang(undefined)).toBe('en');
  });

  it('resolves cli entry path from daemon command path (posix)', () => {
    const cliEntry = resolveCliEntryPath('/tmp/app/dist/cli/commands/daemon.js');
    expect(cliEntry).toBe('/tmp/app/dist/cli/index.js');
  });

  it('resolves cli entry path from daemon command path (windows)', () => {
    const cliEntry = resolveCliEntryPath('C:\\app\\dist\\cli\\commands\\daemon.js');
    expect(cliEntry).toBe('C:\\app\\dist\\cli\\index.js');
  });

  it('counts only recent error entries from the global error log', async () => {
    const fakeHome = join(tmpdir(), `ornn-daemon-helpers-${Date.now()}`);
    const logDir = join(fakeHome, '.ornn', 'logs');
    mkdirSync(logDir, { recursive: true });
    writeFileSync(
      join(logDir, 'error.log'),
      [
        '[2026-04-18 01:00:00] ERROR [daemon] old failure',
        '[2026-04-18 02:00:00] ERROR [daemon] another old failure',
        '[2026-04-20 02:20:00] ERROR [dashboard] recent failure',
        '[2026-04-20 02:21:00] ERROR [dashboard] another recent failure',
      ].join('\n') + '\n',
      'utf-8'
    );

    process.env.HOME = fakeHome;
    vi.resetModules();

    const { getLogStats } = await import('../../src/cli/lib/daemon-helpers.js');
    const stats = getLogStats('2026-04-20T02:30:00.000Z');

    expect(stats).toEqual({ errorCount: 2, warningCount: 0 });

    rmSync(fakeHome, { recursive: true, force: true });
  });
});
