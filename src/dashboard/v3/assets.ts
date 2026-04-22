import { existsSync, readFileSync } from 'node:fs';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

interface DashboardV3DocumentResponse {
  body: string;
  hasBuild: boolean;
}

interface DashboardV3StaticAsset {
  body: Buffer;
  contentType: string;
  cacheControl: string;
}

export function isDashboardV3DocumentRequest(requestPath: string): boolean {
  if (requestPath === '/v3' || requestPath === '/v3/') {
    return true;
  }

  if (!requestPath.startsWith('/v3/')) {
    return false;
  }

  const relativePath = requestPath.slice('/v3/'.length);
  if (relativePath.length === 0 || relativePath.startsWith('assets/')) {
    return false;
  }

  const lastSegment = relativePath.split('/').pop() ?? '';
  return !lastSegment.includes('.');
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

function getFallbackHtml(): string {
  return [
    '<!DOCTYPE html>',
    '<html lang="zh-CN">',
    '<head>',
    '<meta charset="UTF-8"/>',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0"/>',
    '<title>OrnnSkills Dashboard V3</title>',
    '<style>',
    ':root{color-scheme:dark;}',
    'body{margin:0;min-height:100vh;display:grid;place-items:center;background:#272822;color:#f7f8f2;font-family:"DM Sans",system-ui,sans-serif;}',
    '.panel{width:min(720px,calc(100vw - 32px));border:1px solid rgba(255,255,255,.1);border-radius:20px;background:rgba(255,255,255,.04);padding:32px;box-shadow:0 24px 80px rgba(0,0,0,.28);}',
    '.eyebrow{font-size:11px;letter-spacing:.28em;text-transform:uppercase;color:rgba(247,248,242,.6);}',
    'h1{margin:14px 0 10px;font-size:34px;line-height:1.05;font-weight:600;}',
    'p{margin:0 0 12px;color:rgba(247,248,242,.72);line-height:1.7;}',
    'code{padding:3px 8px;border-radius:999px;background:rgba(13,122,53,.22);color:#f7f8f2;}',
    'a{color:#92e1a4;text-decoration:none;}',
    '</style>',
    '</head>',
    '<body>',
    '<div class="panel">',
    '<div class="eyebrow">Dashboard V3</div>',
    '<h1>Preview build is not available yet.</h1>',
    '<p>独立隔离的 V3 前端入口已经接好，但静态 bundle 还没有构建出来。</p>',
    '<p>先执行 <code>npm run build:dashboard-v3</code> 或 <code>npm run build</code>，然后刷新 <a href="/v3">/v3</a>。</p>',
    '</div>',
    '</body>',
    '</html>',
  ].join('');
}

export function getDashboardV3DocumentResponse(): DashboardV3DocumentResponse {
  const distRoot = getDashboardV3DistRoot();
  const indexPath = resolve(distRoot, 'index.html');
  if (!existsSync(indexPath)) {
    return {
      body: getFallbackHtml(),
      hasBuild: false,
    };
  }

  return {
    body: readFileSync(indexPath, 'utf-8'),
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
