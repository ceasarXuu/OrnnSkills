import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import { getDashboardHtml } from '../../src/dashboard/ui.js';

type FakeElement = {
  id?: string;
  innerHTML: string;
  outerHTML: string;
  textContent: string;
  value: string;
  checked: boolean;
  disabled: boolean;
  placeholder?: string;
  selectionStart: number | null;
  selectionEnd: number | null;
  classList: {
    add: (...tokens: string[]) => void;
    remove: (...tokens: string[]) => void;
    toggle: (token: string, force?: boolean) => boolean;
    contains: (token: string) => boolean;
  };
  style: Record<string, string>;
  focus: () => void;
  addEventListener: (type: string, handler: (...args: unknown[]) => void) => void;
  setSelectionRange: (start: number, end: number) => void;
};

type FetchResponse = {
  ok: boolean;
  status: number;
  statusText: string;
  json: () => Promise<unknown>;
};

function createFakeElement(id = ''): FakeElement {
  const classes = new Set<string>();
  return {
    id,
    innerHTML: '',
    outerHTML: '',
    textContent: '',
    value: '',
    checked: false,
    disabled: false,
    placeholder: '',
    selectionStart: null,
    selectionEnd: null,
    classList: {
      add: (...tokens: string[]) => {
        for (const token of tokens) classes.add(token);
      },
      remove: (...tokens: string[]) => {
        for (const token of tokens) classes.delete(token);
      },
      toggle: (token: string, force?: boolean) => {
        if (force === true) {
          classes.add(token);
          return true;
        }
        if (force === false) {
          classes.delete(token);
          return false;
        }
        if (classes.has(token)) {
          classes.delete(token);
          return false;
        }
        classes.add(token);
        return true;
      },
      contains: (token: string) => classes.has(token),
    },
    style: {},
    focus: () => undefined,
    addEventListener: () => undefined,
    setSelectionRange(start: number, end: number) {
      this.selectionStart = start;
      this.selectionEnd = end;
    },
  };
}

function createJsonResponse(payload: unknown): FetchResponse {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => payload,
  };
}

function loadDashboardHarness(
  fetchImpl: (url: string, init?: Record<string, unknown>) => Promise<FetchResponse>
) {
  const html = getDashboardHtml(47432, 'zh', 'test-build-id');
  const scriptMatch = html.match(/<script>([\s\S]*)<\/script>/);
  if (!scriptMatch) {
    throw new Error('Dashboard script not found');
  }

  const elements = new Map<string, FakeElement>();
  const selectors = new Map<string, FakeElement>();
  const fetchCalls: string[] = [];

  const ensureElement = (id: string) => {
    if (!elements.has(id)) {
      elements.set(id, createFakeElement(id));
    }
    return elements.get(id)!;
  };

  const document = {
    activeElement: null as FakeElement | null,
    documentElement: { lang: 'zh' },
    body: createFakeElement('body'),
    getElementById(id: string) {
      return ensureElement(id);
    },
    querySelector(selector: string) {
      if (!selectors.has(selector)) {
        selectors.set(selector, createFakeElement(selector));
      }
      return selectors.get(selector);
    },
    querySelectorAll(selector: string) {
      if (selector === '.lang-btn') {
        return [createFakeElement('lang-en'), createFakeElement('lang-zh')];
      }
      if (selector === '.modal-close') {
        return [createFakeElement('modal-close-1'), createFakeElement('modal-close-2')];
      }
      return [];
    },
  };

  const runtime = {
    document,
    window: {
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      location: {
        href: 'http://localhost/dashboard',
        search: '',
        reload: () => undefined,
      },
    },
    navigator: {
      userAgent: 'vitest',
      language: 'zh-CN',
      languages: ['zh-CN'],
      clipboard: {
        writeText: async () => undefined,
      },
    },
    localStorage: {
      getItem: () => null,
      setItem: () => undefined,
    },
    fetch: async (url: string, init?: Record<string, unknown>) => {
      fetchCalls.push(String(url));
      return fetchImpl(String(url), init);
    },
    console,
    alert: () => undefined,
    EventSource: class {
      addEventListener() {}
      close() {}
    },
    AbortController: class {
      signal = {};
      abort() {}
    },
    URLSearchParams,
    Intl,
    Date,
    Math,
    JSON,
    setTimeout,
    clearTimeout,
    globalThis: null as unknown,
  };
  runtime.globalThis = runtime;

  const script = scriptMatch[1]
    .replace(/\binit\(\);\s*$/, '')
    .concat('\n;globalThis.__dashboardTest = { state, init, handleUpdate };');

  vm.runInNewContext(script, runtime);

  return {
    dashboard: (
      runtime as typeof runtime & {
        __dashboardTest: {
          state: Record<string, any>;
          init: () => Promise<void>;
          handleUpdate: (data: Record<string, unknown>) => Promise<void>;
        };
      }
    ).__dashboardTest,
    getFetchCalls() {
      return fetchCalls.slice();
    },
    clearFetchCalls() {
      fetchCalls.length = 0;
    },
  };
}

async function flushAsync(times = 4): Promise<void> {
  for (let index = 0; index < times; index += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

describe('dashboard ui live refresh', () => {
  it('keeps skill-library live refresh off the full project snapshot path', async () => {
    const projectPath = '/tmp/ornn-project';
    const encodedProjectPath = encodeURIComponent(projectPath);
    const skillId = 'test-driven-development';
    const familyId = 'family-1';
    const instanceId = 'instance-1';
    const encodedFamilyId = encodeURIComponent(familyId);
    const encodedSkillId = encodeURIComponent(skillId);
    let snapshotFetches = 0;

    const harness = loadDashboardHarness(async (url) => {
      if (url === '/api/projects') {
        return createJsonResponse({
          projects: [{ path: projectPath, name: 'OrnnSkills', isRunning: true, skillCount: 1 }],
        });
      }

      if (url === '/api/logs') {
        return createJsonResponse({ lines: [] });
      }

      if (url === '/api/dashboard/runtime') {
        return createJsonResponse({ buildId: 'test-build-id', pid: 1 });
      }

      if (url === '/api/lang') {
        return createJsonResponse({ ok: true, lang: 'zh' });
      }

      if (url === `/api/projects/${encodedProjectPath}/snapshot`) {
        snapshotFetches += 1;
        return createJsonResponse({
          daemon: {
            isRunning: true,
            isPaused: false,
            monitoringState: 'active',
            pausedAt: null,
            pid: 1,
            startedAt: '2026-04-10T00:00:00.000Z',
            processedTraces: snapshotFetches,
            lastCheckpointAt: null,
            retryQueueSize: 0,
            optimizationStatus: {
              currentState: 'idle',
              currentSkillId: null,
              lastOptimizationAt: null,
              lastError: null,
              queueSize: 0,
            },
          },
          skills: [
            {
              skillId,
              runtime: 'codex',
              status: 'active',
              updatedAt: '2026-04-10T00:00:00.000Z',
              traceCount: 1,
              versionsAvailable: [1],
              effectiveVersion: 1,
            },
          ],
          skillGroups: [],
          skillInstances: [
            {
              instanceId,
              familyId,
              familyName: skillId,
              skillKey: `${skillId}:codex`,
              projectId: 'project-1',
              projectPath,
              skillId,
              runtime: 'codex',
              status: 'active',
              lastUsedAt: '2026-04-10T00:00:00.000Z',
              effectiveVersion: 1,
            },
          ],
          traceStats: { total: 1, byRuntime: { codex: 1 }, byStatus: { success: 1 }, byEventType: {} },
          recentTraces: [],
          decisionEvents: [],
          activityScopes: [],
          agentUsage: {
            callCount: 1,
            promptTokens: 10,
            completionTokens: 5,
            totalTokens: 15,
            durationMsTotal: 100,
            avgDurationMs: 100,
            lastCallAt: '2026-04-10T00:00:00.000Z',
            byModel: {},
            byScope: {},
            bySkill: {},
          },
        });
      }

      if (url === '/api/skills/families') {
        return createJsonResponse({
          families: [
            {
              familyId,
              familyName: skillId,
              runtimes: ['codex'],
              instanceCount: 1,
              projectCount: 1,
              runtimeCount: 1,
              status: 'active',
              lastSeenAt: '2026-04-10T00:00:00.000Z',
              usage: { observedCalls: 1 },
            },
          ],
        });
      }

      if (url === `/api/skills/families/${encodedFamilyId}`) {
        return createJsonResponse({
          family: {
            familyId,
            familyName: skillId,
            runtimes: ['codex'],
            instanceCount: 1,
            projectCount: 1,
            runtimeCount: 1,
            status: 'active',
            lastSeenAt: '2026-04-10T00:00:00.000Z',
            usage: { observedCalls: 1 },
          },
        });
      }

      if (url === `/api/skills/families/${encodedFamilyId}/instances`) {
        return createJsonResponse({
          instances: [
            {
              instanceId,
              familyId,
              familyName: skillId,
              projectPath,
              skillId,
              runtime: 'codex',
              status: 'active',
              effectiveVersion: 1,
              lastUsedAt: '2026-04-10T00:00:00.000Z',
            },
          ],
        });
      }

      if (url === `/api/projects/${encodedProjectPath}/skill-instances`) {
        return createJsonResponse({
          instances: [
            {
              instanceId,
              familyId,
              familyName: skillId,
              projectPath,
              skillId,
              runtime: 'codex',
              status: 'active',
              effectiveVersion: 1,
              lastUsedAt: '2026-04-10T00:00:00.000Z',
            },
          ],
        });
      }

      if (url === `/api/projects/${encodedProjectPath}/skills/${encodedSkillId}?runtime=codex`) {
        return createJsonResponse({
          content: 'Skill content',
          versions: [],
          effectiveVersion: 1,
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    await harness.dashboard.init();
    await flushAsync();

    expect(harness.dashboard.state.selectedMainTab).toBe('skills');
    expect(harness.dashboard.state.selectedSkillFamilyId).toBe(familyId);
    expect(snapshotFetches).toBeGreaterThan(0);

    const snapshotUrl = `/api/projects/${encodedProjectPath}/snapshot`;
    const baselineSnapshotFetches = snapshotFetches;
    harness.clearFetchCalls();

    await harness.dashboard.handleUpdate({ changedProjects: [projectPath] });
    await flushAsync();

    expect(harness.getFetchCalls()).not.toContain(snapshotUrl);
    expect(snapshotFetches).toBe(baselineSnapshotFetches);
    expect(harness.getFetchCalls()).toContain('/api/skills/families');
    expect(harness.dashboard.state.staleProjectData[projectPath]).toBe(true);
  });
});
