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

  it('returns the v1-compatible workspace shell for v3 document requests', async () => {
    const customRoot = mkdtempSync(join(tmpdir(), 'ornn-dashboard-v3-empty-'));
    cleanupPaths.push(customRoot);
    process.env.ORNNSKILLS_DASHBOARD_V3_DIST_DIR = customRoot;

    const { getDashboardV3DocumentResponse } = await import('../../src/dashboard/v3/assets.js');
    const document = getDashboardV3DocumentResponse({
      buildId: 'build-v3-test',
      lang: 'zh',
      requestPath: '/v3/config',
    });

    expect(document.hasBuild).toBe(true);
    expect(document.body).toContain('id="workspaceTabs"');
    expect(document.body).toContain('id="workspaceMain"');
    expect(document.body).toContain('"requestedMainTab":"config"');
    expect(document.body).not.toContain('Preview build is not available yet.');
  });

  it('keeps v3 document rendering on the shared dashboard shell even when a v3 dist exists', async () => {
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

    const document = getDashboardV3DocumentResponse({
      buildId: 'build-v3-test',
      lang: 'zh',
      requestPath: '/v3/project',
    });
    const asset = resolveDashboardV3StaticAsset('/v3/assets/app.js');

    expect(document.hasBuild).toBe(true);
    expect(document.body).toContain('id="workspaceTabs"');
    expect(document.body).toContain('"requestedMainTab":"project"');
    expect(document.body).not.toContain('dashboard v3');
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
