import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('dashboard v3 asset helpers', () => {
  const originalDistDir = process.env.ORNNSKILLS_DASHBOARD_V3_DIST_DIR;
  const cleanupPaths: string[] = [];

  afterEach(() => {
    process.env.ORNNSKILLS_DASHBOARD_V3_DIST_DIR = originalDistDir;
    while (cleanupPaths.length > 0) {
      const currentPath = cleanupPaths.pop();
      if (!currentPath) continue;
      rmSync(currentPath, { recursive: true, force: true });
    }
  });

  it('returns fallback html when no v3 build is present', async () => {
    const customRoot = mkdtempSync(join(tmpdir(), 'ornn-dashboard-v3-empty-'));
    cleanupPaths.push(customRoot);
    process.env.ORNNSKILLS_DASHBOARD_V3_DIST_DIR = customRoot;

    const { getDashboardV3DocumentResponse } = await import('../../src/dashboard/v3/assets.js');
    const document = getDashboardV3DocumentResponse();

    expect(document.hasBuild).toBe(false);
    expect(document.body).toContain('Preview build is not available yet.');
    expect(document.body).toContain('npm run build:dashboard-v3');
  });

  it('serves built html and static asset content from the configured v3 dist root', async () => {
    const customRoot = mkdtempSync(join(tmpdir(), 'ornn-dashboard-v3-built-'));
    cleanupPaths.push(customRoot);
    mkdirSync(join(customRoot, 'assets'), { recursive: true });
    writeFileSync(join(customRoot, 'index.html'), '<html><body>dashboard v3</body></html>');
    writeFileSync(join(customRoot, 'assets', 'app.js'), 'console.log("v3")');
    process.env.ORNNSKILLS_DASHBOARD_V3_DIST_DIR = customRoot;

    const {
      getDashboardV3DocumentResponse,
      isDashboardV3DocumentRequest,
      resolveDashboardV3StaticAsset,
    } = await import('../../src/dashboard/v3/assets.js');

    const document = getDashboardV3DocumentResponse();
    const asset = resolveDashboardV3StaticAsset('/v3/assets/app.js');

    expect(document.hasBuild).toBe(true);
    expect(document.body).toContain('dashboard v3');
    expect(asset?.contentType).toBe('application/javascript; charset=utf-8');
    expect(asset?.cacheControl).toContain('immutable');
    expect(asset?.body.toString('utf-8')).toContain('console.log("v3")');
    expect(isDashboardV3DocumentRequest('/v3/skills')).toBe(true);
    expect(isDashboardV3DocumentRequest('/v3/assets/app.js')).toBe(false);
  });

  it('rejects v3 static asset traversal outside of the dist root', async () => {
    const customRoot = mkdtempSync(join(tmpdir(), 'ornn-dashboard-v3-safety-'));
    cleanupPaths.push(customRoot);
    mkdirSync(join(customRoot, 'assets'), { recursive: true });
    process.env.ORNNSKILLS_DASHBOARD_V3_DIST_DIR = customRoot;

    const { resolveDashboardV3StaticAsset } = await import('../../src/dashboard/v3/assets.js');
    expect(resolveDashboardV3StaticAsset('/v3/../../etc/passwd')).toBeNull();
  });
});
