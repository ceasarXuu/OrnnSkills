/**
 * Dashboard HTTP Server
 *
 * 提供多项目 REST API + SSE 实时推送。
 * 零外部依赖，仅使用 Node.js 内置 http 模块。
 * 默认端口 47432；端口冲突时由 CLI 层自动 fallback。
 * 支持多语言（中英文切换）。
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import {
  listProjects,
  addProject,
  setProjectMonitoringState,
  type RegisteredProject,
} from './projects-registry.js';
import { writeProjectLanguage } from './language-state.js';
import {
  readDaemonStatus,
  readSkills,
  readProjectSnapshotVersion,
  readGlobalLogs,
  readLogsSince,
  createGlobalLogCursor,
  type LogCursor,
} from './data-reader.js';
import { getDashboardHtml } from './ui.js';
import type { Language } from './i18n.js';
import { createChildLogger } from '../utils/logger.js';
import {
  checkProvidersConnectivity,
  readDashboardConfig,
} from '../config/manager.js';
import { pickProjectDirectory } from './native-project-picker.js';
import { ensureMonitoringDaemon, ensureProjectInitialized } from './project-onboarding.js';
import { handleGlobalConfigRoutes } from './routes/global-config-routes.js';
import { handleProjectConfigRoutes } from './routes/project-config-routes.js';
import { handleProjectManagementRoutes } from './routes/project-management-routes.js';
import { handleProjectReadRoutes } from './routes/project-read-routes.js';
import { handleProjectSkillRoutes } from './routes/project-skill-routes.js';
import { handleProjectVersionRoutes } from './routes/project-version-routes.js';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProjectWithStatus extends RegisteredProject {
  isRunning: boolean;
  isPaused: boolean;
  skillCount: number;
}

interface SseClient {
  res: ServerResponse;
  id: string;
  projectSnapshotVersions: Map<string, string>;
  projectsSignature: string;
}

interface DashboardClientErrorEvent {
  message?: string;
  stack?: string;
  source?: string;
  lineno?: number;
  colno?: number;
  href?: string;
  ua?: string;
  timestamp?: string;
  buildId?: string;
}

interface ProviderHealthSummary {
  level: 'ok' | 'warn';
  code: 'ok' | 'provider_not_configured' | 'provider_connectivity_failed';
  message: string;
  checkedAt: string;
  results: Awaited<ReturnType<typeof checkProvidersConnectivity>>;
}

const logger = createChildLogger('dashboard');

// ─── Server ───────────────────────────────────────────────────────────────────

export function createDashboardServer(port: number, defaultLang: Language = 'en') {
  let currentLang: Language = defaultLang;
  const clients: Set<SseClient> = new Set();
  let sseInterval: ReturnType<typeof setInterval> | null = null;
  let logCursor: LogCursor = { path: null, offset: 0 };
  const buildId = `${Date.now()}`;
  const startedAt = new Date().toISOString();
  const clientErrors: DashboardClientErrorEvent[] = [];

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
      const monitoringState = p.monitoringState === 'paused' ? 'paused' : 'active';
      const pausedAt = monitoringState === 'paused' ? p.pausedAt ?? null : null;
      try {
        const daemon = readDaemonStatus(p.path);
        const skills = readSkills(p.path);
        return {
          ...p,
          monitoringState,
          pausedAt,
          isPaused: monitoringState === 'paused',
          isRunning: monitoringState === 'paused' ? false : daemon.isRunning,
          skillCount: skills.length,
        };
      } catch {
        return {
          ...p,
          monitoringState,
          pausedAt,
          isPaused: monitoringState === 'paused',
          isRunning: false,
          skillCount: 0,
        };
      }
    });
  }

  function buildProjectsSignature(projects: ProjectWithStatus[]): string {
    return JSON.stringify(
      projects.map((project) => ({
        path: project.path,
        name: project.name,
        isRunning: project.isRunning,
        monitoringState: project.monitoringState,
        pausedAt: project.pausedAt ?? null,
        skillCount: project.skillCount,
      }))
    );
  }

  function seedClientSnapshotVersions(client: SseClient, projects: ProjectWithStatus[]): void {
    const livePaths = new Set(projects.map((project) => project.path));
    for (const existingPath of Array.from(client.projectSnapshotVersions.keys())) {
      if (!livePaths.has(existingPath)) {
        client.projectSnapshotVersions.delete(existingPath);
      }
    }
    for (const project of projects) {
      try {
        client.projectSnapshotVersions.set(project.path, readProjectSnapshotVersion(project.path));
      } catch {
        client.projectSnapshotVersions.delete(project.path);
      }
    }
  }

  async function getProviderHealthSummary(projectPath?: string): Promise<ProviderHealthSummary> {
    const checkedAt = new Date().toISOString();
    const config = await readDashboardConfig(projectPath);
    const providers = config.providers ?? [];

    if (providers.length === 0) {
      logger.warn('Provider health check warning: provider not configured', { projectPath });
      return {
        level: 'warn',
        code: 'provider_not_configured',
        message: 'No provider configured',
        checkedAt,
        results: [],
      };
    }

    const results = await checkProvidersConnectivity(projectPath, providers);
    const failed = results.filter((item) => !item.ok);
    if (failed.length > 0) {
      logger.warn('Provider health check warning: provider connectivity failed', {
        projectPath,
        failedProviders: failed.map((item) => `${item.provider}/${item.modelName}`),
      });
      return {
        level: 'warn',
        code: 'provider_connectivity_failed',
        message: `${failed.length}/${results.length} provider(s) connectivity check failed`,
        checkedAt,
        results,
      };
    }

    return {
      level: 'ok',
      code: 'ok',
      message: 'All providers are healthy',
      checkedAt,
      results,
    };
  }

  async function onboardProjectForMonitoring(projectPath: string, name?: string) {
    const initialization = await ensureProjectInitialized(projectPath);
    addProject(initialization.projectPath, name);
    await writeProjectLanguage(initialization.projectPath, currentLang);
    const monitoring = await ensureMonitoringDaemon(initialization.projectPath);

    logger.info('Project onboarded for dashboard monitoring', {
      projectPath: initialization.projectPath,
      initialized: initialization.initialized,
      daemonStarted: monitoring.daemonStarted,
      daemonRunning: monitoring.daemonRunning,
      source: 'dashboard.project_onboarding',
    });

    return {
      projectPath: initialization.projectPath,
      initialized: initialization.initialized,
      daemonStarted: monitoring.daemonStarted,
      daemonRunning: monitoring.daemonRunning,
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
    const projectPaths = new Set(projects.map((project) => project.path));
    const projectsSignature = buildProjectsSignature(projects);

    const { lines: newLogs, cursor } = readLogsSince(logCursor);
    logCursor = cursor;

    for (const client of clients) {
      for (const existingPath of Array.from(client.projectSnapshotVersions.keys())) {
        if (!projectPaths.has(existingPath)) {
          client.projectSnapshotVersions.delete(existingPath);
        }
      }

      const changedProjects: string[] = [];
      for (const project of projects) {
        try {
          const version = readProjectSnapshotVersion(project.path);
          if (client.projectSnapshotVersions.get(project.path) === version) {
            continue;
          }
          client.projectSnapshotVersions.set(project.path, version);
          changedProjects.push(project.path);
        } catch {
          client.projectSnapshotVersions.delete(project.path);
        }
      }

      const projectsChanged = client.projectsSignature !== projectsSignature;
      if (!projectsChanged && changedProjects.length === 0 && newLogs.length === 0) {
        continue;
      }
      client.projectsSignature = projectsSignature;

      const payload = {
        ...(projectsChanged ? { projects } : {}),
        ...(changedProjects.length > 0 ? { changedProjects } : {}),
        ...(newLogs.length > 0 ? { logs: newLogs } : {}),
      };
      const payloadBytes = Buffer.byteLength(JSON.stringify(payload), 'utf-8');
      if (payloadBytes > 128 * 1024) {
        logger.warn('Dashboard SSE payload is large', {
          bytes: payloadBytes,
          clients: clients.size,
          projectCount: projects.length,
          clientId: client.id,
        });
      }
      sendSseEvent(client, 'update', payload);
    }
  }

  // ── Request Router ────────────────────────────────────────────────────────

  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    void (async () => {
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
        const html = getDashboardHtml(port, currentLang, buildId);
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          Pragma: 'no-cache',
          Expires: '0',
          'X-Dashboard-Build': buildId,
        });
        res.end(html);
        return;
      }

      // ── API: Get/Set language ──
      if (path === '/api/lang' && method === 'GET') {
        json(res, { lang: currentLang });
        return;
      }

      // ── API: Dashboard runtime info ──
      if (path === '/api/dashboard/runtime' && method === 'GET') {
        json(res, {
          buildId,
          startedAt,
          pid: process.pid,
          clientErrorCount: clientErrors.length,
        });
        return;
      }

      // ── API: Browser client error report ──
      if (path === '/api/dashboard/client-errors' && method === 'POST') {
        const body = (await parseBody(req)) as DashboardClientErrorEvent | { events?: DashboardClientErrorEvent[] };
        const events = Array.isArray((body as { events?: DashboardClientErrorEvent[] }).events)
          ? (body as { events?: DashboardClientErrorEvent[] }).events ?? []
          : [body as DashboardClientErrorEvent];
        for (const event of events) {
          if (!event || typeof event !== 'object') continue;
          clientErrors.unshift({
            message: String(event.message ?? ''),
            stack: String(event.stack ?? ''),
            source: String(event.source ?? ''),
            lineno: Number(event.lineno ?? 0) || undefined,
            colno: Number(event.colno ?? 0) || undefined,
            href: String(event.href ?? ''),
            ua: String(event.ua ?? ''),
            timestamp: String(event.timestamp ?? new Date().toISOString()),
          });
        }
        if (clientErrors.length > 200) {
          clientErrors.length = 200;
        }
        if (events.length > 0) {
          const latest = clientErrors[0];
          logger.error('Dashboard client runtime error reported', {
            message: latest?.message ?? '',
            source: latest?.source ?? '',
            line: latest?.lineno ?? 0,
            col: latest?.colno ?? 0,
          });
        }
        json(res, { ok: true, accepted: events.length });
        return;
      }
      if (path === '/api/lang' && method === 'POST') {
        try {
          const body = (await parseBody(req)) as { lang?: string; projectPath?: string };
          if (body.lang === 'en' || body.lang === 'zh') {
            currentLang = normalizeLanguage(body.lang);
            if (typeof body.projectPath === 'string' && body.projectPath.length > 0) {
              await writeProjectLanguage(body.projectPath, currentLang);
              logger.debug('Persisted dashboard language for project', {
                projectPath: body.projectPath,
                lang: currentLang,
                source: 'api.lang',
              });
            }
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

        const projects = getProjectsWithStatus();
        const client: SseClient = {
          res,
          id: Math.random().toString(36).slice(2),
          projectSnapshotVersions: new Map<string, string>(),
          projectsSignature: buildProjectsSignature(projects),
        };
        seedClientSnapshotVersions(client, projects);
        clients.add(client);

        const initialLogs = readGlobalLogs(100);
        sendSseEvent(client, 'update', { projects, logs: initialLogs });

        req.on('close', () => clients.delete(client));
        return;
      }

      if (await handleGlobalConfigRoutes({
        path,
        method,
        url,
        json: (data, status = 200) => json(res, data, status),
        parseBody: () => parseBody(req),
        getProviderHealthSummary,
        logger,
      })) {
        return;
      }

      if (await handleProjectManagementRoutes({
        path,
        method,
        json: (data, status = 200) => json(res, data, status),
        parseBody: () => parseBody(req),
        getProjectsWithStatus,
        onboardProjectForMonitoring,
        pickProjectDirectory,
        setProjectMonitoringState,
        readGlobalLogs,
        logger,
      })) {
        return;
      }

      // ── API: Project routes ──
      // /api/projects/:encodedPath/...
      const projectMatch = path.match(/^\/api\/projects\/([^/]+)(\/.*)?$/);
      if (projectMatch) {
        const projectPath = decodeURIComponent(projectMatch[1]);
        const subPath = projectMatch[2] ?? '';

        if (await handleProjectReadRoutes({
          subPath,
          method,
          projectPath,
          currentLang,
          json: (data, status = 200) => json(res, data, status),
          notFound: () => notFound(res),
          logger,
        })) {
          return;
        }

        if (await handleProjectManagementRoutes({
          path,
          method,
          projectPath,
          subPath,
          json: (data, status = 200) => json(res, data, status),
          parseBody: () => parseBody(req),
          getProjectsWithStatus,
          onboardProjectForMonitoring,
          pickProjectDirectory,
          setProjectMonitoringState,
          readGlobalLogs,
          logger,
        })) {
          return;
        }

        if (await handleProjectSkillRoutes({
          subPath,
          method,
          projectPath,
          url,
          json: (data, status = 200) => json(res, data, status),
          parseBody: () => parseBody(req),
          notFound: () => notFound(res),
          logger,
        })) {
          return;
        }

        if (await handleProjectVersionRoutes({
          subPath,
          method,
          projectPath,
          url,
          json: (data, status = 200) => json(res, data, status),
          parseBody: () => parseBody(req),
          notFound: () => notFound(res),
          logger,
        })) {
          return;
        }

        if (await handleProjectConfigRoutes({
          subPath,
          method,
          projectPath,
          json: (data, status = 200) => json(res, data, status),
          parseBody: () => parseBody(req),
          getProviderHealthSummary,
          logger,
        })) {
          return;
        }
      }

        notFound(res);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message === 'Invalid JSON' || message === 'Request body too large') {
          json(res, { error: message }, 400);
          return;
        }
        logger.error('Dashboard request failed', {
          method,
          path,
          error: message,
        });
        json(res, { error: 'Internal server error', detail: message }, 500);
      }
    })();
  });

  function start(): Promise<void> {
    if (sseInterval !== null) {
      return Promise.resolve(); // Already running
    }

    // Initialize the log cursor at the latest active rotated file.
    logCursor = createGlobalLogCursor();

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
