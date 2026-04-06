/**
 * Dashboard HTTP Server
 *
 * 提供多项目 REST API + SSE 实时推送。
 * 零外部依赖，仅使用 Node.js 内置 http 模块。
 * 默认端口 47432；端口冲突时由 CLI 层自动 fallback。
 * 支持多语言（中英文切换）。
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import {
  listProjects,
  addProject,
  type RegisteredProject,
} from './projects-registry.js';
import {
  readDaemonStatus,
  readSkills,
  readSkillContent,
  readSkillVersion,
  readRecentTraces,
  computeTraceStats,
  readGlobalLogs,
  readLogsSince,
  type ProjectData,
} from './data-reader.js';
import { getDashboardHtml } from './ui.js';
import type { Language } from './i18n.js';
import { createChildLogger } from '../utils/logger.js';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProjectWithStatus extends RegisteredProject {
  isRunning: boolean;
  skillCount: number;
}

interface SseClient {
  res: ServerResponse;
  id: string;
}

const logger = createChildLogger('dashboard');

// ─── Server ───────────────────────────────────────────────────────────────────

export function createDashboardServer(port: number, defaultLang: Language = 'en') {
  let currentLang: Language = defaultLang;
  const clients: Set<SseClient> = new Set();
  let sseInterval: ReturnType<typeof setInterval> | null = null;
  let logByteOffset = 0;

  // ── Helpers ──────────────────────────────────────────────────────────────

  function json(res: ServerResponse, data: unknown, status = 200) {
    const body = JSON.stringify(data);
    res.writeHead(status, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(body);
  }

  function notFound(res: ServerResponse) {
    json(res, { error: 'not found' }, 404);
  }

  function parseBody(req: IncomingMessage): Promise<unknown> {
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

  function normalizeLanguage(lang?: string | null): Language {
    return lang === 'zh' ? 'zh' : 'en';
  }

  function detectLangFromAcceptLanguage(acceptLanguageHeader?: string | string[]): Language {
    if (!acceptLanguageHeader) return 'en';

    const headerValue = Array.isArray(acceptLanguageHeader)
      ? acceptLanguageHeader.join(',')
      : acceptLanguageHeader;

    const candidates = headerValue
      .split(',')
      .map((part) => {
        const [tagPart, qPart] = part.trim().split(';');
        const qMatch = qPart?.match(/q=([0-9.]+)/i);
        const q = qMatch ? Number(qMatch[1]) : 1;
        const tag = (tagPart ?? '').toLowerCase();
        return { tag, q: Number.isFinite(q) ? q : 1 };
      })
      .filter((entry) => entry.tag.length > 0)
      .sort((a, b) => b.q - a.q);

    for (const { tag } of candidates) {
      if (tag === 'zh' || tag.startsWith('zh-')) return 'zh';
      if (tag === 'en' || tag.startsWith('en-')) return 'en';
    }

    return 'en';
  }

  function getProjectsWithStatus(): ProjectWithStatus[] {
    return listProjects().map((p) => {
      try {
        const daemon = readDaemonStatus(p.path);
        const skills = readSkills(p.path);
        return { ...p, isRunning: daemon.isRunning, skillCount: skills.length };
      } catch {
        return { ...p, isRunning: false, skillCount: 0 };
      }
    });
  }

  function getProjectSnapshot(projectPath: string): ProjectData {
    const traces = readRecentTraces(projectPath, 50);
    return {
      daemon: readDaemonStatus(projectPath),
      skills: readSkills(projectPath),
      traceStats: computeTraceStats(traces),
      recentTraces: traces,
    };
  }

  // ── SSE Push Loop ────────────────────────────────────────────────────────

  function sendSseEvent(client: SseClient, event: string, data: unknown) {
    try {
      client.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    } catch {
      clients.delete(client);
    }
  }

  function broadcastUpdate() {
    if (clients.size === 0) return;

    const projects = getProjectsWithStatus();

    // Build per-project data
    const projectData: Record<string, ProjectData> = {};
    for (const p of projects) {
      try {
        projectData[p.path] = getProjectSnapshot(p.path);
      } catch {
        // skip
      }
    }

    // Fetch new log lines since last offset
    const { lines: newLogs, newOffset } = readLogsSince(logByteOffset);
    logByteOffset = newOffset;

    const payload = {
      projects,
      projectData,
      logs: newLogs,
    };
    const payloadBytes = Buffer.byteLength(JSON.stringify(payload), 'utf-8');
    if (payloadBytes > 128 * 1024) {
      logger.warn('Dashboard SSE payload is large', {
        bytes: payloadBytes,
        clients: clients.size,
        projectCount: projects.length,
      });
    }

    for (const client of clients) {
      sendSseEvent(client, 'update', payload);
    }
  }

  // ── Request Router ────────────────────────────────────────────────────────

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? '/', `http://localhost:${port}`);
    const path = url.pathname;
    const method = req.method ?? 'GET';

    try {
      // ── Dashboard HTML ──
      if (path === '/' && method === 'GET') {
        const detectedLang = detectLangFromAcceptLanguage(req.headers['accept-language']);
        currentLang = normalizeLanguage(detectedLang);
        logger.debug('Resolved dashboard language from request', {
          acceptLanguage: req.headers['accept-language'],
          resolvedLang: currentLang,
        });
        const html = getDashboardHtml(port, currentLang);
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
        return;
      }

      // ── API: Get/Set language ──
      if (path === '/api/lang' && method === 'GET') {
        json(res, { lang: currentLang });
        return;
      }
      if (path === '/api/lang' && method === 'POST') {
        try {
          const body = (await parseBody(req)) as { lang?: string };
          if (body.lang === 'en' || body.lang === 'zh') {
            currentLang = normalizeLanguage(body.lang);
            json(res, { ok: true, lang: currentLang });
          } else {
            json(res, { ok: false, error: 'Invalid language. Use "en" or "zh"' }, 400);
          }
        } catch (e) {
          json(res, { ok: false, error: String(e) }, 400);
        }
        return;
      }

      // ── SSE Stream ──
      if (path === '/events' && method === 'GET') {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
          'Access-Control-Allow-Origin': '*',
        });
        res.write('retry: 3000\n\n');

        const client: SseClient = { res, id: Math.random().toString(36).slice(2) };
        clients.add(client);

        // Send initial full snapshot
        const projects = getProjectsWithStatus();
        const projectData: Record<string, ProjectData> = {};
        for (const p of projects) {
          try {
            projectData[p.path] = getProjectSnapshot(p.path);
          } catch {
            // skip
          }
        }
        const initialLogs = readGlobalLogs(100);
        sendSseEvent(client, 'update', { projects, projectData, logs: initialLogs });

        req.on('close', () => clients.delete(client));
        return;
      }

      // ── API: List projects ──
      if (path === '/api/projects' && method === 'GET') {
        json(res, { projects: getProjectsWithStatus() });
        return;
      }

      // ── API: Add project ──
      if (path === '/api/projects' && method === 'POST') {
        try {
          const body = (await parseBody(req)) as { path?: string; name?: string };
          if (!body.path) {
            json(res, { ok: false, error: 'path is required' }, 400);
            return;
          }
          addProject(body.path, body.name);
          json(res, { ok: true, projects: getProjectsWithStatus() });
        } catch (e) {
          json(res, { ok: false, error: String(e) }, 400);
        }
        return;
      }

      // ── API: Global logs ──
      if (path === '/api/logs' && method === 'GET') {
        const lines = readGlobalLogs(200);
        json(res, { lines });
        return;
      }

      // ── API: Project routes ──
      // /api/projects/:encodedPath/...
      const projectMatch = path.match(/^\/api\/projects\/([^/]+)(\/.*)?$/);
      if (projectMatch) {
        const projectPath = decodeURIComponent(projectMatch[1]);
        const subPath = projectMatch[2] ?? '';

        // GET /api/projects/:id/snapshot
        if (subPath === '/snapshot' && method === 'GET') {
          const snapshot = getProjectSnapshot(projectPath);
          const snapshotBytes = Buffer.byteLength(JSON.stringify(snapshot), 'utf-8');
          if (snapshotBytes > 128 * 1024) {
            logger.warn('Dashboard snapshot payload is large', {
              projectPath,
              bytes: snapshotBytes,
            });
          }
          json(res, snapshot);
          return;
        }

        // GET /api/projects/:id/status
        if (subPath === '/status' && method === 'GET') {
          json(res, readDaemonStatus(projectPath));
          return;
        }

        // GET /api/projects/:id/skills
        if (subPath === '/skills' && method === 'GET') {
          json(res, { skills: readSkills(projectPath) });
          return;
        }

        // GET /api/projects/:id/skills/:skillId
        const skillMatch = subPath.match(/^\/skills\/([^/]+)$/);
        if (skillMatch && method === 'GET') {
          const skillId = decodeURIComponent(skillMatch[1]);
          const runtimeParam = url.searchParams.get('runtime');
          const runtime =
            runtimeParam === 'claude' || runtimeParam === 'opencode' || runtimeParam === 'codex'
              ? runtimeParam
              : 'codex';
          const content = readSkillContent(projectPath, skillId, runtime);
          const skills = readSkills(projectPath);
          const skill = skills.find((s) => s.skillId === skillId && (s.runtime ?? 'codex') === runtime);
          if (content === null) {
            logger.warn('Skill content not found for dashboard request', {
              projectPath,
              skillId,
              runtime,
            });
          }
          json(res, {
            skillId,
            runtime,
            content,
            versions: skill?.versionsAvailable ?? [],
            status: skill?.status,
          });
          return;
        }

        // GET /api/projects/:id/skills/:skillId/versions/:v
        const versionMatch = subPath.match(/^\/skills\/([^/]+)\/versions\/(\d+)$/);
        if (versionMatch && method === 'GET') {
          const skillId = decodeURIComponent(versionMatch[1]);
          const version = parseInt(versionMatch[2], 10);
          const result = readSkillVersion(projectPath, skillId, version);
          if (!result) {
            notFound(res);
            return;
          }
          json(res, result);
          return;
        }

        // GET /api/projects/:id/traces
        if (subPath === '/traces' && method === 'GET') {
          const traces = readRecentTraces(projectPath, 50);
          json(res, { traces, stats: computeTraceStats(traces) });
          return;
        }
      }

      notFound(res);
    } catch (err) {
      json(res, { error: 'Internal server error', detail: String(err) }, 500);
    }
  });

  function start(): Promise<void> {
    if (sseInterval !== null) {
      return Promise.resolve(); // Already running
    }

    // Initialize log offset to current file end so we only stream new lines
    try {
      const logPath = join(homedir(), '.ornn', 'logs', 'combined.log');
      logByteOffset = statSync(logPath).size;
    } catch {
      logByteOffset = 0;
    }

    return new Promise((resolve, reject) => {
      const onError = (err: Error) => {
        server.removeListener('error', onError);
        reject(err);
      };
      server.once('error', onError);
      server.listen(port, '127.0.0.1', () => {
        server.removeListener('error', onError);
        sseInterval = setInterval(broadcastUpdate, 3000);
        resolve();
      });
    });
  }

  function stop(): Promise<void> {
    if (sseInterval !== null) {
      clearInterval(sseInterval);
      sseInterval = null;
    }
    for (const client of clients) {
      try {
        client.res.end();
      } catch {
        // ignore
      }
    }
    clients.clear();
    return new Promise((resolve) => server.close(() => resolve()));
  }

  return { start, stop, port };
}
