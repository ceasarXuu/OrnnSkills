import type { LogCursor } from '../data-reader.js';

interface SseResponseLike {
  writeHead(statusCode: number, headers: Record<string, string>): void;
  write(chunk: string): void;
  end(): void;
}

interface SseProjectState {
  path: string;
  name: string;
  isRunning: boolean;
  monitoringState: 'active' | 'paused';
  pausedAt: string | null;
  skillCount: number;
}

interface SseLogger {
  warn(message: string, meta?: Record<string, unknown>): void;
}

interface SseHubDependencies {
  createGlobalLogCursor: () => LogCursor;
  readGlobalLogs: (limit: number) => unknown[];
  readLogsSince: (cursor: LogCursor) => {
    lines: unknown[];
    cursor: LogCursor;
  };
  readProjectSnapshotVersion: (projectPath: string) => string;
  logger: SseLogger;
}

interface SseClient {
  id: string;
  res: SseResponseLike;
  projectSnapshotVersions: Map<string, string>;
  projectsSignature: string;
}

function buildProjectsSignature(projects: SseProjectState[]): string {
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

export function createDashboardSseHub(dependencies: SseHubDependencies) {
  const { createGlobalLogCursor, readGlobalLogs, readLogsSince, readProjectSnapshotVersion, logger } = dependencies;
  const clients = new Set<SseClient>();
  let logCursor: LogCursor = { path: null, offset: 0 };

  function seedClientSnapshotVersions(client: SseClient, projects: SseProjectState[]): void {
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

  function sendSseEvent(client: SseClient, event: string, data: unknown) {
    try {
      client.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    } catch {
      clients.delete(client);
    }
  }

  function initializeCursor(): void {
    logCursor = createGlobalLogCursor();
  }

  function connectClient(res: SseResponseLike, projects: SseProjectState[]): string {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });
    res.write('retry: 3000\n\n');

    const client: SseClient = {
      res,
      id: Math.random().toString(36).slice(2),
      projectSnapshotVersions: new Map<string, string>(),
      projectsSignature: buildProjectsSignature(projects),
    };
    seedClientSnapshotVersions(client, projects);
    clients.add(client);

    sendSseEvent(client, 'update', { projects, logs: readGlobalLogs(100) });
    return client.id;
  }

  function disconnectClient(clientId: string): void {
    for (const client of clients) {
      if (client.id === clientId) {
        clients.delete(client);
        break;
      }
    }
  }

  function broadcast(projects: SseProjectState[]): void {
    if (clients.size === 0) return;

    const projectPaths = new Set(projects.map((project) => project.path));
    const projectsSignature = buildProjectsSignature(projects);
    const liveProjectVersions = new Map<string, string>();
    const { lines: newLogs, cursor } = readLogsSince(logCursor);
    logCursor = cursor;

    for (const project of projects) {
      try {
        liveProjectVersions.set(project.path, readProjectSnapshotVersion(project.path));
      } catch {
        liveProjectVersions.delete(project.path);
      }
    }

    for (const client of clients) {
      for (const existingPath of Array.from(client.projectSnapshotVersions.keys())) {
        if (!projectPaths.has(existingPath)) {
          client.projectSnapshotVersions.delete(existingPath);
        }
      }

      const changedProjects: string[] = [];
      for (const project of projects) {
        const version = liveProjectVersions.get(project.path);
        if (!version) {
          client.projectSnapshotVersions.delete(project.path);
          continue;
        }
        if (client.projectSnapshotVersions.get(project.path) === version) {
          continue;
        }
        client.projectSnapshotVersions.set(project.path, version);
        changedProjects.push(project.path);
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

  function closeAllClients(): void {
    for (const client of clients) {
      try {
        client.res.end();
      } catch {
        // ignore close failures
      }
    }
    clients.clear();
  }

  return {
    initializeCursor,
    connectClient,
    disconnectClient,
    broadcast,
    closeAllClients,
  };
}

export type { SseProjectState };
