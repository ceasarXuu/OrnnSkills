import {
  readDaemonStatus,
  readRecentDecisionEvents,
  readRecentTraces,
  readTaskEpisodeSnapshot,
  readAgentUsageRecords,
  readTracesBySessionWindow,
  computeTraceStats,
  readProjectSnapshot,
} from '../data-reader.js';
import { readProjectLanguage } from '../language-state.js';
import { buildActivityScopeDetailFromData } from '../activity-scope-reader.js';
import type { Language } from '../i18n.js';

interface RouteLogger {
  debug(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
}

interface ProjectReadRouteContext {
  subPath: string;
  method: string;
  projectPath: string;
  currentLang: Language;
  json: (data: unknown, status?: number) => void;
  notFound: () => void;
  logger: RouteLogger;
}

export async function handleProjectReadRoutes(context: ProjectReadRouteContext): Promise<boolean> {
  const { subPath, method, projectPath, currentLang, json, notFound, logger } = context;

  if (subPath === '/snapshot' && method === 'GET') {
    const snapshot = readProjectSnapshot(projectPath);
    const snapshotBytes = Buffer.byteLength(JSON.stringify(snapshot), 'utf-8');
    if (snapshotBytes > 128 * 1024) {
      logger.warn('Dashboard snapshot payload is large', {
        projectPath,
        bytes: snapshotBytes,
      });
    }
    json(snapshot);
    return true;
  }

  if (subPath === '/status' && method === 'GET') {
    json(readDaemonStatus(projectPath));
    return true;
  }

  if (subPath === '/traces' && method === 'GET') {
    const traces = readRecentTraces(projectPath, 50);
    json({ traces, stats: computeTraceStats(traces) });
    return true;
  }

  const activityScopeMatch = subPath.match(/^\/activity-scopes\/([^/]+)$/);
  if (activityScopeMatch && method === 'GET') {
    const scopeId = decodeURIComponent(activityScopeMatch[1]);
    const snapshot = readTaskEpisodeSnapshot(projectPath);
    const episode = snapshot.episodes.find((item) => item.episodeId === scopeId);
    if (!episode) {
      notFound();
      return true;
    }

    const lang = await readProjectLanguage(projectPath, currentLang);
    const detail = buildActivityScopeDetailFromData({
      lang,
      projectName: projectPath.split('/').filter(Boolean).pop() || projectPath,
      episode,
      decisionEvents: readRecentDecisionEvents(projectPath, 800),
      agentUsageRecords: readAgentUsageRecords(projectPath, 800),
      traces: readTracesBySessionWindow(
        projectPath,
        episode.sessionIds,
        episode.startedAt,
        episode.lastActivityAt
      ),
    });

    if (!detail) {
      notFound();
      return true;
    }

    logger.debug('Dashboard activity scope detail loaded', {
      projectPath,
      scopeId,
      status: detail.status,
      timelineLength: detail.timeline.length,
    });
    json({ detail });
    return true;
  }

  return false;
}
