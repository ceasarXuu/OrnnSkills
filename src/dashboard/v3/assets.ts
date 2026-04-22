import { existsSync, readFileSync } from 'node:fs';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDashboardHtml } from '../ui.js';
import type { Language } from '../i18n.js';

interface DashboardV3DocumentResponse {
  body: string;
  hasBuild: boolean;
}

interface DashboardV3DocumentOptions {
  buildId?: string;
  lang?: Language;
  requestPath?: string;
}

interface DashboardV3StaticAsset {
  body: Buffer;
  contentType: string;
  cacheControl: string;
}

export function isDashboardV3DocumentRequest(requestPath: string): boolean {
  return (
    requestPath === '/v3' ||
    requestPath === '/v3/' ||
    requestPath === '/v3/skills' ||
    requestPath === '/v3/skills/' ||
    requestPath === '/v3/project' ||
    requestPath === '/v3/project/' ||
    requestPath === '/v3/config' ||
    requestPath === '/v3/config/'
  );
}

function getDashboardV3DistRoot(): string {
  if (typeof process.env.ORNNSKILLS_DASHBOARD_V3_DIST_DIR === 'string') {
    const customRoot = process.env.ORNNSKILLS_DASHBOARD_V3_DIST_DIR.trim();
    if (customRoot.length > 0) {
      return resolve(customRoot);
    }
  }

  return resolve(fileURLToPath(new URL('../../dashboard-v3/', import.meta.url)));
}

function getContentType(filePath: string): string {
  const extension = extname(filePath).toLowerCase();
  switch (extension) {
    case '.css':
      return 'text/css; charset=utf-8';
    case '.js':
      return 'application/javascript; charset=utf-8';
    case '.html':
      return 'text/html; charset=utf-8';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.svg':
      return 'image/svg+xml';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.ico':
      return 'image/x-icon';
    default:
      return 'application/octet-stream';
  }
}

function resolveDashboardV3RequestedMainTab(
  requestPath: string,
): 'skills' | 'project' | 'config' {
  if (requestPath === '/v3/config' || requestPath === '/v3/config/') {
    return 'config';
  }

  if (requestPath === '/v3/project' || requestPath === '/v3/project/') {
    return 'project';
  }

  return 'skills';
}

export function getDashboardV3DocumentResponse(
  options: DashboardV3DocumentOptions = {},
): DashboardV3DocumentResponse {
  const requestPath = options.requestPath || '/v3/skills';
  const lang = options.lang || 'en';
  const buildId = options.buildId || 'dev';

  return {
    body: getDashboardHtml(0, lang, buildId, {
      requestedMainTab: resolveDashboardV3RequestedMainTab(requestPath),
    }),
    hasBuild: true,
  };
}

export function resolveDashboardV3StaticAsset(
  requestPath: string,
): DashboardV3StaticAsset | null {
  if (!requestPath.startsWith('/v3/')) {
    return null;
  }

  const relativePath = requestPath.slice('/v3/'.length);
  if (relativePath.length === 0) {
    return null;
  }

  const distRoot = getDashboardV3DistRoot();
  const assetPath = resolve(distRoot, relativePath);
  const normalizedRoot = `${distRoot}${sep}`;
  if (assetPath !== distRoot && !assetPath.startsWith(normalizedRoot)) {
    return null;
  }

  if (!existsSync(assetPath)) {
    return null;
  }

  return {
    body: readFileSync(assetPath),
    contentType: getContentType(assetPath),
    cacheControl: relativePath.startsWith('assets/')
      ? 'public, max-age=31536000, immutable'
      : 'no-store, no-cache, must-revalidate, max-age=0',
  };
}
