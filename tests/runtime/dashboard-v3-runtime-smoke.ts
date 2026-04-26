import { createServer } from 'node:net';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';

interface RuntimeContext {
  baseUrl: string;
  port: number;
  projectRoot: string;
  stop: () => Promise<void>;
  rootDir: string;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function getFreePort(): Promise<number> {
  return await new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('failed to resolve free port')));
        return;
      }
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(address.port);
      });
    });
  });
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, JSON.stringify(value, null, 2), 'utf-8');
}

function createRuntimeFixture(): { rootDir: string; homeDir: string; projectRoot: string } {
  const rootDir = mkdtempSync(join(tmpdir(), 'ornn-runtime-smoke-'));
  const homeDir = join(rootDir, 'home');
  const projectRoot = join(rootDir, 'RuntimeProject');
  const now = '2026-04-27T00:00:00.000Z';

  mkdirSync(join(homeDir, '.ornn'), { recursive: true });
  mkdirSync(join(projectRoot, '.ornn', 'shadows', 'codex'), { recursive: true });
  mkdirSync(join(projectRoot, '.ornn', 'state'), { recursive: true });
  mkdirSync(join(projectRoot, '.ornn', 'skills', 'codex', 'runtime-smoke', 'versions', 'v1'), { recursive: true });

  writeJson(join(homeDir, '.ornn', 'projects.json'), {
    projects: [
      {
        path: projectRoot,
        name: basename(projectRoot),
        registeredAt: now,
        lastSeenAt: now,
        monitoringState: 'active',
        pausedAt: null,
      },
    ],
  });

  writeJson(join(projectRoot, '.ornn', 'shadows', 'index.json'), [
    {
      skillId: 'runtime-smoke',
      runtime: 'codex',
      version: 'v1',
      content: '',
      status: 'active',
      createdAt: now,
      updatedAt: now,
      traceCount: 3,
    },
  ]);
  writeFileSync(
    join(projectRoot, '.ornn', 'shadows', 'codex', 'runtime-smoke.md'),
    '# runtime-smoke\n\nRuntime smoke fixture skill.\n',
    'utf-8'
  );
  writeFileSync(
    join(projectRoot, '.ornn', 'skills', 'codex', 'runtime-smoke', 'versions', 'v1', 'skill.md'),
    '# runtime-smoke\n',
    'utf-8'
  );
  writeJson(join(projectRoot, '.ornn', 'skills', 'codex', 'runtime-smoke', 'versions', 'v1', 'metadata.json'), {
    version: 1,
    createdAt: now,
    reason: 'runtime smoke',
    traceIds: [],
    previousVersion: null,
  });
  writeJson(join(projectRoot, '.ornn', 'state', 'task-episodes.json'), {
    updatedAt: now,
    episodes: [],
  });
  writeJson(join(projectRoot, '.ornn', 'state', 'agent-usage-summary.json'), {
    updatedAt: now,
    scope: 'ornn_agent',
    callCount: 1,
    promptTokens: 100,
    completionTokens: 20,
    totalTokens: 120,
    byModel: {},
    byScope: {},
    bySkill: {},
  });

  return { rootDir, homeDir, projectRoot };
}

async function startRuntime(): Promise<RuntimeContext> {
  const fixture = createRuntimeFixture();
  process.env.HOME = fixture.homeDir;
  process.env.USERPROFILE = fixture.homeDir;
  process.env.ORNNSKILLS_DASHBOARD_V3_DIST_DIR = join(process.cwd(), 'dist', 'dashboard-v3');
  const { createDashboardServer } = await import('../../src/dashboard/server.js');
  const port = await getFreePort();
  const dashboard = createDashboardServer(port, 'zh');
  await dashboard.start();
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    port,
    projectRoot: fixture.projectRoot,
    rootDir: fixture.rootDir,
    stop: dashboard.stop,
  };
}

async function expectJson<T>(response: Response, label: string): Promise<T> {
  assert(response.ok, `${label} expected 2xx, got ${response.status}`);
  return await response.json() as T;
}

async function readFirstSseUpdate(url: string): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  const response = await fetch(url, { signal: controller.signal });
  assert(response.ok && response.body, `SSE expected open stream, got ${response.status}`);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { value, done } = await reader.read();
      assert(!done, 'SSE stream ended before update event');
      buffer += decoder.decode(value, { stream: true });
      while (true) {
        const boundary = buffer.indexOf('\n\n');
        if (boundary === -1) {
          break;
        }
        const chunk = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const eventLine = chunk.split('\n').find((line) => line.startsWith('event: '));
        const dataLine = chunk.split('\n').find((line) => line.startsWith('data: '));
        if (eventLine === 'event: update' && dataLine) {
          return JSON.parse(dataLine.slice(6)) as Record<string, unknown>;
        }
      }
    }
  } finally {
    clearTimeout(timeout);
    await reader.cancel().catch(() => undefined);
  }
}

async function run(): Promise<void> {
  const runtime = await startRuntime();
  try {
    const rootResponse = await fetch(`${runtime.baseUrl}/`, { redirect: 'manual' });
    assert(rootResponse.status === 302, `root redirect expected 302, got ${rootResponse.status}`);
    assert(rootResponse.headers.get('location') === '/v3/', 'root should redirect to /v3/');

    const documentResponse = await fetch(`${runtime.baseUrl}/v3/project`);
    const documentHtml = await documentResponse.text();
    assert(documentResponse.ok, `/v3/project expected 2xx, got ${documentResponse.status}`);
    assert(documentResponse.headers.get('x-dashboard-v3') === 'built', '/v3/project should serve built v3 bundle');
    assert(documentHtml.includes('<div id="root"></div>'), '/v3/project should contain React root');

    const assetPaths = [...documentHtml.matchAll(/(?:src|href)="([^"]*\/v3\/assets\/[^"]+)"/g)].map((match) => match[1]);
    assert(assetPaths.length >= 2, 'dashboard document should reference built JS and CSS assets');
    for (const assetPath of assetPaths) {
      const assetResponse = await fetch(`${runtime.baseUrl}${assetPath}`);
      assert(assetResponse.ok, `asset ${assetPath} expected 2xx, got ${assetResponse.status}`);
      assert((await assetResponse.text()).length > 0, `asset ${assetPath} should not be empty`);
    }

    const projectsPayload = await expectJson<{ projects: Array<{ path: string; skillCount: number }> }>(
      await fetch(`${runtime.baseUrl}/api/projects`),
      '/api/projects'
    );
    assert(projectsPayload.projects.length === 1, '/api/projects should expose the registered project');
    assert(projectsPayload.projects[0]?.path === runtime.projectRoot, '/api/projects should preserve project path');
    assert(projectsPayload.projects[0]?.skillCount === 1, '/api/projects should include skill count');

    const snapshotPayload = await expectJson<{ skills: Array<{ skillId: string; runtime: string }> }>(
      await fetch(`${runtime.baseUrl}/api/projects/${encodeURIComponent(runtime.projectRoot)}/snapshot`),
      '/api/projects/:project/snapshot'
    );
    assert(snapshotPayload.skills.some((skill) => skill.skillId === 'runtime-smoke' && skill.runtime === 'codex'), 'snapshot should include the fixture skill');

    const familiesPayload = await expectJson<{ families: Array<{ familyName: string }> }>(
      await fetch(`${runtime.baseUrl}/api/skills/families`),
      '/api/skills/families'
    );
    assert(familiesPayload.families.some((family) => family.familyName === 'runtime-smoke'), 'skill families should include the fixture skill');

    const ssePayload = await readFirstSseUpdate(`${runtime.baseUrl}/events`);
    assert(Array.isArray(ssePayload.projects), 'SSE update should include project list');

    const clientErrorResponse = await fetch(`${runtime.baseUrl}/api/dashboard/client-errors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: [] }),
    });
    const clientErrorPayload = await expectJson<{ ok: boolean; accepted: number }>(
      clientErrorResponse,
      '/api/dashboard/client-errors'
    );
    assert(clientErrorPayload.ok && clientErrorPayload.accepted === 0, 'client error endpoint should accept empty batches');

    console.log(`dashboard v3 runtime smoke passed on ${runtime.baseUrl}`);
  } finally {
    await runtime.stop();
    rmSync(runtime.rootDir, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
