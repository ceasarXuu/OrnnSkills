/**
 * Dashboard server — HTTP helpers
 *
 * Extracted from server.ts to keep individual files under the 500-line policy.
 * Pure helpers with no closure state, safe to share across routes.
 */
import { createHash } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

export function jsonResponse(res: ServerResponse, data: unknown, status = 200): void {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(body);
}

export function notFoundResponse(res: ServerResponse): void {
  jsonResponse(res, { error: 'not found' }, 404);
}

export function normalizeEtag(value: string): string {
  const hash = createHash('sha1').update(value, 'utf-8').digest('hex');
  return `"${hash}"`;
}

export function matchesIfNoneMatch(
  headerValue: string | string[] | undefined,
  etag: string,
): boolean {
  if (!headerValue) return false;
  const normalizedHeader = Array.isArray(headerValue) ? headerValue.join(',') : headerValue;
  return normalizedHeader
    .split(',')
    .map((part) => part.trim())
    .some((candidate) => candidate === '*' || candidate === etag);
}

export function respondNotModified(
  req: IncomingMessage,
  res: ServerResponse,
  etagValue: string,
): boolean {
  const etag = normalizeEtag(etagValue);
  if (!matchesIfNoneMatch(req.headers['if-none-match'], etag)) {
    return false;
  }

  res.writeHead(304, {
    ETag: etag,
    'Cache-Control': 'no-cache',
    'Access-Control-Allow-Origin': '*',
  });
  res.end();
  return true;
}

export function jsonWithEtag(
  req: IncomingMessage,
  res: ServerResponse,
  data: unknown,
  etagValue: string,
  status = 200,
): void {
  if (respondNotModified(req, res, etagValue)) {
    return;
  }

  const etag = normalizeEtag(etagValue);
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
    'Access-Control-Allow-Origin': '*',
    ETag: etag,
  });
  res.end(body);
}

export function parseBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1e6) {
        // 1MB limit
        reject(new Error('Request body too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}
