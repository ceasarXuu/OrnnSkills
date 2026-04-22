import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('package scripts', () => {
  it('does not keep frontend-v3 in the default build or dev entrypoints', () => {
    const packageJson = JSON.parse(
      readFileSync(new URL('../../package.json', import.meta.url), 'utf-8'),
    ) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.build).not.toContain('build:dashboard-v3');
    expect(packageJson.scripts?.['dev:dashboard-v3']).toBeUndefined();
    expect(packageJson.scripts?.['build:dashboard-v3']).toBeUndefined();
  });
});
