import { describe, it, expect } from 'vitest';
import { normalizeDashboardLang, resolveCliEntryPath } from '../../src/cli/lib/daemon-helpers.js';

describe('daemon helpers', () => {
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
});
