import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import { getDashboardHtml } from '../../src/dashboard/ui.js';

type FakeElement = {
  id?: string;
  innerHTML: string;
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
    toggle: (...tokens: string[]) => boolean;
    contains: (...tokens: string[]) => boolean;
  };
  style: Record<string, string>;
  focus: () => void;
  addEventListener: (type: string, handler: (...args: unknown[]) => void) => void;
  setSelectionRange: (start: number, end: number) => void;
};

function createFakeElement(id = ''): FakeElement {
  return {
    id,
    innerHTML: '',
    textContent: '',
    value: '',
    checked: false,
    disabled: false,
    placeholder: '',
    selectionStart: null,
    selectionEnd: null,
    classList: {
      add: () => undefined,
      remove: () => undefined,
      toggle: () => false,
      contains: () => false,
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

function loadDashboardTestHarness(
  storageSeed: Record<string, string> = {},
  options: {
    lang?: 'zh' | 'en';
    fetchMap?: Record<string, unknown>;
    fetchImpl?: (url: string, init?: Record<string, unknown>) => Promise<{ ok: boolean; status?: number; statusText?: string; json: () => Promise<unknown> }>;
  } = {}
) {
  const lang = options.lang || 'zh';
  const html = getDashboardHtml(47432, lang, 'test-build-id');
  const scriptMatch = html.match(/<script>([\s\S]*)<\/script>/);
  if (!scriptMatch) {
    throw new Error('Dashboard script not found');
  }

  const elements = new Map<string, FakeElement>();
  const selectorMap = new Map<string, FakeElement>();
  const localStorageData = new Map<string, string>(Object.entries(storageSeed));
  const fetchCalls: Array<{ url: string; init?: Record<string, unknown> }> = [];
  let copiedText = '';

  const ensureElement = (id: string) => {
    if (!elements.has(id)) {
      elements.set(id, createFakeElement(id));
    }
    return elements.get(id)!;
  };

  const document = {
    activeElement: null as FakeElement | null,
    documentElement: { lang },
    body: createFakeElement('body'),
    getElementById(id: string) {
      return ensureElement(id);
    },
    querySelector(selector: string) {
      if (!selectorMap.has(selector)) {
        selectorMap.set(selector, createFakeElement(selector));
      }
      return selectorMap.get(selector);
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

  const defaultFetchJson = (url: string) => {
    if (url === '/api/projects') {
      return { projects: [] };
    }
    if (url === '/api/logs') {
      return { lines: [] };
    }
    if (url === '/api/dashboard/runtime') {
      return { buildId: 'test-build-id', pid: 1 };
    }
    if (url.includes('/snapshot')) {
      return {
        daemon: {
          isRunning: false,
          pid: null,
          startedAt: null,
          processedTraces: 0,
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
        skills: [],
        traceStats: { total: 0, byRuntime: {}, byStatus: {}, byEventType: {} },
        recentTraces: [],
        decisionEvents: [],
        agentUsage: {
          callCount: 0,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          durationMsTotal: 0,
          avgDurationMs: 0,
          lastCallAt: null,
          byModel: {},
          byScope: {},
          bySkill: {},
        },
      };
    }
    if (url.includes('/config')) {
      return {
        config: {
          autoOptimize: true,
          userConfirm: false,
          runtimeSync: true,
          llmSafety: {
            enabled: true,
            windowMs: 60000,
            maxRequestsPerWindow: 12,
            maxConcurrentRequests: 2,
            maxEstimatedTokensPerWindow: 48000,
          },
          defaultProvider: '',
          logLevel: 'info',
          providers: [],
        },
      };
    }
    if (url.includes('/provider-health')) {
      return {
        health: {
          level: 'ok',
          code: 'ok',
          message: 'All providers are healthy',
          checkedAt: '2026-04-10T00:00:00.000Z',
          results: [],
        },
      };
    }
    if (url === '/api/providers/catalog') {
      return {
        providers: [{
          id: 'deepseek',
          name: 'deepseek',
          models: ['deepseek/deepseek-reasoner'],
          modelDetails: [],
          defaultModel: 'deepseek/deepseek-reasoner',
          apiKeyEnvVar: 'DEEPSEEK_API_KEY',
        }],
      };
    }
    return { buildId: 'test-build-id', projects: [], providers: [] };
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
      clipboard: {
        writeText: async (text: string) => {
          copiedText = text;
        },
      },
    },
    localStorage: {
      getItem(key: string) {
        return localStorageData.has(key) ? localStorageData.get(key)! : null;
      },
      setItem(key: string, value: string) {
        localStorageData.set(key, value);
      },
    },
    fetch: async (url: string, init?: Record<string, unknown>) => {
      fetchCalls.push({ url: String(url), init });
      if (options.fetchImpl) {
        return options.fetchImpl(String(url), init);
      }
      const key = String(url);
      const json = options.fetchMap && Object.prototype.hasOwnProperty.call(options.fetchMap, key)
        ? options.fetchMap[key]
        : defaultFetchJson(key);
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => json,
      };
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
    .concat(
      '\n;globalThis.__dashboardTest = { state, init, switchLang, selectProject, selectMainTab, renderMainPanel, safeRenderMainPanel, renderSidebar, buildActivityRows, copyActivityDetail, openActivityDetail, renderCostPanel, viewSkill, loadVersion, handleUpdate, triggerProjectPicker: openProjectPicker };'
    );

  vm.runInNewContext(script, runtime);

  return {
    dashboard: (runtime as typeof runtime & {
      __dashboardTest: {
        state: Record<string, any>;
        init: () => Promise<void>;
        switchLang: (lang: string) => Promise<void>;
        selectProject: (projectPath: string) => Promise<void>;
        selectMainTab: (tab: string) => void;
        renderMainPanel: (projectPath: string) => void;
        safeRenderMainPanel: (projectPath: string, source?: string) => boolean;
        renderSidebar: () => void;
        buildActivityRows: (projectPath: string) => Array<Record<string, any>>;
        copyActivityDetail: (projectPath: string, rowId: string) => Promise<void>;
        openActivityDetail: (projectPath: string, rowId: string) => Promise<void>;
        renderCostPanel: (projectPath: string) => string;
        viewSkill: (projectPath: string, skillId: string, runtime?: string) => Promise<void>;
        loadVersion: (encProject: string, encSkill: string, encRuntime: string, version: number) => Promise<void>;
        handleUpdate: (data: Record<string, unknown>) => Promise<void> | void;
        triggerProjectPicker: () => Promise<void>;
      };
    }).__dashboardTest,
    getElement(id: string) {
      return ensureElement(id);
    },
    getCopiedText() {
      return copiedText;
    },
    getFetchCalls() {
      return fetchCalls.map((call) => call.url);
    },
    clearFetchCalls() {
      fetchCalls.length = 0;
    },
  };
}

describe('dashboard ui recovery', () => {
  it('uses host terminology consistently in localized dashboard copy', () => {
    const zhHtml = getDashboardHtml(47432, 'zh', 'test-build-id');
    expect(zhHtml).toContain('宿主');
    expect(zhHtml).not.toContain('客户端运行时错误');
    expect(zhHtml).toContain('客户端错误已经进入上报队列');
    expect(zhHtml).toContain('max-width: 100%;');
    expect(zhHtml).not.toContain('max-width: 30ch;');

    const enHtml = getDashboardHtml(47432, 'en', 'test-build-id');
    expect(enHtml).toContain('Host');
    expect(enHtml).not.toContain('client runtime errors');
    expect(enHtml).toContain('client errors have been queued for reporting');
  });

  it('warms the provider catalog during initial overview bootstrap without touching config-only dependencies', async () => {
    const projectPath = '/tmp/ornn-project';
    const encodedPath = encodeURIComponent(projectPath);
    const { dashboard, getFetchCalls } = loadDashboardTestHarness({}, {
      fetchMap: {
        '/api/projects': {
          projects: [{ path: projectPath, name: 'OrnnSkills', isRunning: true, skillCount: 1 }],
        },
        [`/api/projects/${encodedPath}/snapshot`]: {
          daemon: {
            isRunning: true,
            pid: 1,
            startedAt: '2026-04-10T00:00:00.000Z',
            processedTraces: 1,
            lastCheckpointAt: null,
            retryQueueSize: 0,
            optimizationStatus: { currentState: 'idle', currentSkillId: null, lastOptimizationAt: null, lastError: null, queueSize: 0 },
          },
          skills: [],
          traceStats: { total: 0, byRuntime: {}, byStatus: {}, byEventType: {} },
          recentTraces: [],
          decisionEvents: [],
          agentUsage: { callCount: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0, durationMsTotal: 0, avgDurationMs: 0, lastCallAt: null, byModel: {}, byScope: {}, bySkill: {} },
        },
      },
    });

    await dashboard.init();

    const fetchCalls = getFetchCalls();
    expect(fetchCalls).toContain('/api/projects');
    expect(fetchCalls).toContain(`/api/projects/${encodedPath}/snapshot`);
    expect(fetchCalls).toContain('/api/providers/catalog');
    expect(fetchCalls.some((url) => url.includes('/provider-health'))).toBe(false);
    expect(fetchCalls.some((url) => url.endsWith('/config'))).toBe(false);
  });

  it('loads config-only dependencies lazily after switching to the config tab', async () => {
    const projectPath = '/tmp/ornn-project';
    const encodedPath = encodeURIComponent(projectPath);
    const { dashboard, getFetchCalls, clearFetchCalls } = loadDashboardTestHarness({}, {
      fetchMap: {
        '/api/projects': {
          projects: [{ path: projectPath, name: 'OrnnSkills', isRunning: true, skillCount: 1 }],
        },
        [`/api/projects/${encodedPath}/snapshot`]: {
          daemon: {
            isRunning: true,
            pid: 1,
            startedAt: '2026-04-10T00:00:00.000Z',
            processedTraces: 1,
            lastCheckpointAt: null,
            retryQueueSize: 0,
            optimizationStatus: { currentState: 'idle', currentSkillId: null, lastOptimizationAt: null, lastError: null, queueSize: 0 },
          },
          skills: [],
          traceStats: { total: 0, byRuntime: {}, byStatus: {}, byEventType: {} },
          recentTraces: [],
          decisionEvents: [],
          agentUsage: { callCount: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0, durationMsTotal: 0, avgDurationMs: 0, lastCallAt: null, byModel: {}, byScope: {}, bySkill: {} },
        },
      },
    });

    await dashboard.init();
    clearFetchCalls();

    dashboard.selectMainTab('config');
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    const fetchCalls = getFetchCalls();
    expect(fetchCalls).not.toContain('/api/providers/catalog');
    expect(fetchCalls).toContain(`/api/provider-health?projectPath=${encodedPath}`);
    expect(fetchCalls).toContain(`/api/config?projectPath=${encodedPath}`);
  });

  it('refreshes only the selected project snapshot when sse reports changed projects', async () => {
    const projectPath = '/tmp/ornn-project';
    const otherProjectPath = '/tmp/other-project';
    const encodedProjectPath = encodeURIComponent(projectPath);
    let snapshotFetches = 0;

    const { dashboard, getFetchCalls, clearFetchCalls } = loadDashboardTestHarness({}, {
      fetchImpl: async (url) => {
        if (url === '/api/projects') {
          return {
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => ({
              projects: [
                { path: projectPath, name: 'OrnnSkills', isRunning: true, skillCount: 1 },
                { path: otherProjectPath, name: 'Other', isRunning: false, skillCount: 0 },
              ],
            }),
          };
        }
        if (url === `/api/projects/${encodedProjectPath}/snapshot`) {
          snapshotFetches += 1;
          return {
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => ({
              daemon: {
                isRunning: true,
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
              skills: [],
              traceStats: { total: 0, byRuntime: {}, byStatus: {}, byEventType: {} },
              recentTraces: [],
              decisionEvents: [],
              agentUsage: {
                callCount: 0,
                promptTokens: 0,
                completionTokens: 0,
                totalTokens: 0,
                durationMsTotal: 0,
                avgDurationMs: 0,
                lastCallAt: null,
                byModel: {},
                byScope: {},
                bySkill: {},
              },
            }),
          };
        }
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({ lines: [], buildId: 'test-build-id', pid: 1, providers: [], projects: [] }),
        };
      },
    });

    await dashboard.init();
    clearFetchCalls();

    dashboard.state.selectedProjectId = projectPath;
    dashboard.state.selectedMainTab = 'overview';
    dashboard.state.projectData[projectPath] = {
      daemon: { isRunning: true, processedTraces: 1, optimizationStatus: { queueSize: 0 } },
      skills: [],
      traceStats: { total: 0, byRuntime: {}, byStatus: {}, byEventType: {} },
      recentTraces: [],
      decisionEvents: [],
      activityScopes: [],
      agentUsage: {
        callCount: 0,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        durationMsTotal: 0,
        avgDurationMs: 0,
        lastCallAt: null,
        byModel: {},
        byScope: {},
        bySkill: {},
      },
    };

    await (dashboard as unknown as { handleUpdate: (data: Record<string, unknown>) => Promise<void> }).handleUpdate({
      changedProjects: [projectPath],
    });

    expect(getFetchCalls()).toContain(`/api/projects/${encodedProjectPath}/snapshot`);
    expect(dashboard.state.projectData[projectPath].daemon.processedTraces).toBe(2);

    clearFetchCalls();
    await (dashboard as unknown as { handleUpdate: (data: Record<string, unknown>) => Promise<void> }).handleUpdate({
      changedProjects: [otherProjectPath],
    });
    expect(getFetchCalls()).not.toContain(`/api/projects/${encodedProjectPath}/snapshot`);
  });

  it('renders api key inputs as hidden by default in the config tab', async () => {
    const projectPath = '/tmp/ornn-project';
    const encodedPath = encodeURIComponent(projectPath);
    const { dashboard, getElement } = loadDashboardTestHarness({}, {
      lang: 'en',
      fetchMap: {
        '/api/projects': {
          projects: [{ path: projectPath, name: 'OrnnSkills', isRunning: true, skillCount: 1 }],
        },
        [`/api/projects/${encodedPath}/snapshot`]: {
          daemon: {
            isRunning: true,
            pid: 1,
            startedAt: '2026-04-10T00:00:00.000Z',
            processedTraces: 1,
            lastCheckpointAt: null,
            retryQueueSize: 0,
            optimizationStatus: { currentState: 'idle', currentSkillId: null, lastOptimizationAt: null, lastError: null, queueSize: 0 },
          },
          skills: [],
          traceStats: { total: 0, byRuntime: {}, byStatus: {}, byEventType: {} },
          recentTraces: [],
          decisionEvents: [],
          agentUsage: { callCount: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0, durationMsTotal: 0, avgDurationMs: 0, lastCallAt: null, byModel: {}, byScope: {}, bySkill: {} },
        },
        [`/api/config?projectPath=${encodedPath}`]: {
          config: {
            autoOptimize: true,
            userConfirm: false,
            runtimeSync: true,
            llmSafety: {
              enabled: true,
              windowMs: 60000,
              maxRequestsPerWindow: 12,
              maxConcurrentRequests: 2,
              maxEstimatedTokensPerWindow: 48000,
            },
            defaultProvider: 'deepseek',
            logLevel: 'info',
            providers: [{
              provider: 'deepseek',
              modelName: 'deepseek/deepseek-reasoner',
              apiKey: 'sk-test-secret',
              apiKeyEnvVar: 'DEEPSEEK_API_KEY',
              hasApiKey: true,
            }],
          },
        },
      },
    });

    await dashboard.init();
    dashboard.selectMainTab('config');
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    const html = getElement('mainPanel').innerHTML;
    expect(html).toContain('class="config-input cfg_api_key" type="password"');
    expect(html).toContain('Show');
  });

  it('keeps the running status visible in the sidebar for unselected projects', () => {
    const { dashboard, getElement } = loadDashboardTestHarness({}, { lang: 'zh' });

    getElement('projectList');
    dashboard.state.projects = [
      { path: '/Users/xuzhang/OrnnSkills', name: 'OrnnSkills', isRunning: true, skillCount: 105 },
      { path: '/Users/xuzhang/mili', name: 'mili', isRunning: false, skillCount: 0 },
    ];
    dashboard.state.selectedProjectId = '/Users/xuzhang/mili';
    dashboard.state.projectData = {
      '/Users/xuzhang/OrnnSkills': {
        daemon: { isRunning: true },
        skills: new Array(105).fill(null).map((_, index) => ({ skillId: 'skill-' + index, runtime: 'codex' })),
      },
      '/Users/xuzhang/mili': {
        daemon: { isRunning: false },
        skills: [],
      },
    };

    dashboard.renderSidebar();

    const html = getElement('projectList').innerHTML;
    expect(html).toContain('● 运行中 · 105 个技能');
    expect(html).toContain('style="color:var(--green)"');
  });

  it('falls back to project list status when an unselected project snapshot is not loaded yet', () => {
    const { dashboard, getElement } = loadDashboardTestHarness({}, { lang: 'zh' });

    getElement('projectList');
    dashboard.state.projects = [
      { path: '/Users/xuzhang/OrnnSkills', name: 'OrnnSkills', isRunning: true, skillCount: 105 },
      { path: '/Users/xuzhang/mili', name: 'mili', isRunning: true, skillCount: 111 },
    ];
    dashboard.state.selectedProjectId = '/Users/xuzhang/OrnnSkills';
    dashboard.state.projectData = {
      '/Users/xuzhang/OrnnSkills': {
        daemon: { isRunning: true },
        skills: new Array(105).fill(null).map((_, index) => ({ skillId: 'skill-' + index, runtime: 'codex' })),
      },
    };

    dashboard.renderSidebar();

    const html = getElement('projectList').innerHTML;
    expect(html).toContain('mili');
    expect(html).toContain('● 运行中 · 111 个技能');
  });

  it('opens the native project picker and selects the chosen project directly from the add action', async () => {
    const projectPath = '/tmp/picked-project';
    const encodedPath = encodeURIComponent(projectPath);
    const { dashboard, getFetchCalls } = loadDashboardTestHarness({}, {
      fetchMap: {
        '/api/projects/pick': {
          ok: true,
          path: projectPath,
          projects: [{ path: projectPath, name: 'picked-project', isRunning: false, skillCount: 0 }],
        },
        [`/api/projects/${encodedPath}/snapshot`]: {
          daemon: {
            isRunning: false,
            pid: null,
            startedAt: null,
            processedTraces: 0,
            lastCheckpointAt: null,
            retryQueueSize: 0,
            optimizationStatus: { currentState: 'idle', currentSkillId: null, lastOptimizationAt: null, lastError: null, queueSize: 0 },
          },
          skills: [],
          traceStats: { total: 0, byRuntime: {}, byStatus: {}, byEventType: {} },
          recentTraces: [],
          decisionEvents: [],
          agentUsage: { callCount: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0, durationMsTotal: 0, avgDurationMs: 0, lastCallAt: null, byModel: {}, byScope: {}, bySkill: {} },
        },
      },
    });

    await dashboard.triggerProjectPicker();

    expect(dashboard.state.selectedProjectId).toBe(projectPath);
    expect(getFetchCalls()).toContain('/api/projects/pick');
    expect(getFetchCalls()).toContain(`/api/projects/${encodedPath}/snapshot`);
  });

  it('reuses one global config payload when switching projects on the config tab', async () => {
    const projectA = '/tmp/ornn-project-a';
    const projectB = '/tmp/ornn-project-b';
    const encodedA = encodeURIComponent(projectA);
    const encodedB = encodeURIComponent(projectB);
    const { dashboard, getFetchCalls, clearFetchCalls } = loadDashboardTestHarness({}, {
      fetchMap: {
        '/api/projects': {
          projects: [
            { path: projectA, name: 'A', isRunning: true, skillCount: 1 },
            { path: projectB, name: 'B', isRunning: true, skillCount: 1 },
          ],
        },
        [`/api/projects/${encodedA}/snapshot`]: {
          daemon: { isRunning: true, pid: 1, startedAt: '2026-04-10T00:00:00.000Z', processedTraces: 1, lastCheckpointAt: null, retryQueueSize: 0, optimizationStatus: { currentState: 'idle', currentSkillId: null, lastOptimizationAt: null, lastError: null, queueSize: 0 } },
          skills: [],
          traceStats: { total: 0, byRuntime: {}, byStatus: {}, byEventType: {} },
          recentTraces: [],
          decisionEvents: [],
          agentUsage: { callCount: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0, durationMsTotal: 0, avgDurationMs: 0, lastCallAt: null, byModel: {}, byScope: {}, bySkill: {} },
        },
        [`/api/projects/${encodedB}/snapshot`]: {
          daemon: { isRunning: true, pid: 2, startedAt: '2026-04-10T00:00:00.000Z', processedTraces: 2, lastCheckpointAt: null, retryQueueSize: 0, optimizationStatus: { currentState: 'idle', currentSkillId: null, lastOptimizationAt: null, lastError: null, queueSize: 0 } },
          skills: [],
          traceStats: { total: 0, byRuntime: {}, byStatus: {}, byEventType: {} },
          recentTraces: [],
          decisionEvents: [],
          agentUsage: { callCount: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0, durationMsTotal: 0, avgDurationMs: 0, lastCallAt: null, byModel: {}, byScope: {}, bySkill: {} },
        },
      },
    });

    await dashboard.init();
    dashboard.selectMainTab('config');
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
    clearFetchCalls();

    await dashboard.selectProject(projectB);
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    const fetchCalls = getFetchCalls();
    expect(fetchCalls).not.toContain('/api/config');
    expect(fetchCalls).not.toContain('/api/provider-health');
  });

  it('rerenders the cost tab as soon as the provider catalog arrives', async () => {
    const projectPath = '/tmp/ornn-project';
    const catalogResponse = {
      providers: [{
        id: 'deepseek',
        name: 'deepseek',
        models: ['deepseek/deepseek-reasoner'],
        modelDetails: [{
          id: 'deepseek/deepseek-reasoner',
          mode: 'chat',
          maxInputTokens: 64000,
          maxOutputTokens: 8000,
          inputCostPerToken: 0.00000055,
          outputCostPerToken: 0.00000219,
          supportsReasoning: true,
          supportsFunctionCalling: true,
          supportsPromptCaching: false,
          supportsStructuredOutput: true,
          supportsVision: false,
          supportsWebSearch: false,
        }],
        defaultModel: 'deepseek/deepseek-reasoner',
        apiKeyEnvVar: 'DEEPSEEK_API_KEY',
      }],
    };
    let resolveCatalog: ((value: unknown) => void) | null = null;
    const { dashboard, getElement } = loadDashboardTestHarness({}, {
      fetchImpl: async (url) => {
        if (url === '/api/providers/catalog') {
          const json = await new Promise((resolve) => {
            resolveCatalog = resolve;
          });
          return {
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => json,
          };
        }
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({ projects: [] }),
        };
      },
    });

    getElement('mainPanel');
    dashboard.state.selectedMainTab = 'cost';
    dashboard.state.selectedProjectId = projectPath;
    dashboard.state.projectData = {
      [projectPath]: {
        daemon: {},
        skills: [],
        traceStats: { total: 0, byRuntime: {}, byStatus: {}, byEventType: {} },
        recentTraces: [],
        decisionEvents: [],
        agentUsage: {
          callCount: 12,
          promptTokens: 120000,
          completionTokens: 30000,
          totalTokens: 150000,
          durationMsTotal: 24000,
          avgDurationMs: 2000,
          lastCallAt: '2026-04-10T05:23:00.000Z',
          byModel: {
            'deepseek/deepseek-reasoner': {
              callCount: 12,
              promptTokens: 120000,
              completionTokens: 30000,
              totalTokens: 150000,
              durationMsTotal: 24000,
              avgDurationMs: 2000,
              lastCallAt: '2026-04-10T05:23:00.000Z',
            },
          },
          byScope: {},
          bySkill: {},
        },
      },
    };

    dashboard.selectMainTab('cost');
    expect(getElement('mainPanel').innerHTML).toContain('暂无定价');

    resolveCatalog?.(catalogResponse);
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    const html = getElement('mainPanel').innerHTML;
    expect(html).toContain('deepseek/deepseek-reasoner');
    expect(html).toContain('$0.13');
    expect(html).not.toContain('暂无定价');
  });

  it('syncs the selected project language to the backend when the dashboard language changes', async () => {
    const requests: Array<{ url: string; init?: Record<string, unknown> }> = [];
    const projectPath = '/tmp/ornn-project';
    const { dashboard } = loadDashboardTestHarness({}, {
      fetchImpl: async (url, init) => {
        requests.push({ url, init });
        if (url === '/api/lang') {
          return {
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => ({ ok: true, lang: 'en' }),
          };
        }
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({ projects: [] }),
        };
      },
    });

    dashboard.state.selectedProjectId = projectPath;
    await dashboard.switchLang('en');

    expect(requests).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          url: '/api/lang',
          init: expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ lang: 'en', projectPath }),
          }),
        }),
      ])
    );
  });

  it('renders decision summary cards and metric groups in overview', () => {
    const { dashboard, getElement } = loadDashboardTestHarness();
    const projectPath = '/tmp/ornn-project';

    getElement('mainPanel');
    dashboard.state.selectedMainTab = 'overview';
    dashboard.state.selectedProjectId = projectPath;
    dashboard.state.projectData = {
      [projectPath]: {
        daemon: {
          isRunning: true,
          startedAt: '2026-04-10T00:00:00.000Z',
          processedTraces: 42,
          lastCheckpointAt: null,
          retryQueueSize: 0,
          optimizationStatus: { currentState: 'idle', currentSkillId: null, lastOptimizationAt: null, lastError: null, queueSize: 0 },
        },
        skills: [],
        traceStats: { total: 0, byRuntime: {}, byStatus: {}, byEventType: {} },
        recentTraces: [],
        decisionEvents: [
          {
            id: 'mapped-1',
            timestamp: '2026-04-10T01:00:00.000Z',
            tag: 'skill_mapped',
            skillId: 'summary-my-repo',
            runtime: 'codex',
            status: 'mapped',
            reason: 'tool_call',
          },
          {
            id: 'eval-1',
            timestamp: '2026-04-10T01:01:00.000Z',
            tag: 'evaluation_result',
            skillId: 'summary-my-repo',
            runtime: 'codex',
            status: 'needs_patch',
            ruleName: 'analysis_failed_output',
          },
          {
            id: 'skip-1',
            timestamp: '2026-04-10T01:02:00.000Z',
            tag: 'skill_feedback',
            skillId: 'summary-my-repo',
            runtime: 'codex',
            status: 'skipped',
            reason: 'low_confidence',
          },
          {
            id: 'patch-1',
            timestamp: '2026-04-10T01:03:00.000Z',
            tag: 'patch_applied',
            skillId: 'summary-my-repo',
            runtime: 'codex',
            status: 'success',
            changeType: 'add_fallback',
            linesAdded: 12,
            linesRemoved: 3,
          },
          {
            id: 'drift-1',
            timestamp: '2026-04-10T01:04:00.000Z',
            tag: 'analysis_failed',
            skillId: 'summary-my-repo',
            runtime: 'codex',
            status: 'failed',
            runtimeDrift: 'claude->codex',
          },
        ],
        agentUsage: {
          callCount: 0,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          durationMsTotal: 0,
          avgDurationMs: 0,
          lastCallAt: null,
          byModel: {},
          byScope: {},
          bySkill: {},
        },
      },
    };

    dashboard.renderMainPanel(projectPath);

    const html = getElement('mainPanel').innerHTML;
    expect(html).toContain('映射数');
    expect(html).toContain('跳过数');
    expect(html).toContain('变更行数');
    expect(html).toContain('宿主漂移');
    expect(html).toContain('+12/-3');
    expect(html).toContain('映射策略');
    expect(html).toContain('评估规则');
    expect(html).toContain('跳过原因');
    expect(html).toContain('修改类型');
    expect(html).toContain('tool_call');
    expect(html).toContain('analysis_failed_output');
    expect(html).toContain('low_confidence');
    expect(html).toContain('add_fallback');
  });

  it('renders agent usage overview cards and scope buckets', () => {
    const { dashboard, getElement } = loadDashboardTestHarness();
    const projectPath = '/tmp/ornn-project';

    getElement('mainPanel');
    dashboard.state.selectedMainTab = 'overview';
    dashboard.state.selectedProjectId = projectPath;
    dashboard.state.projectData = {
      [projectPath]: {
        daemon: {
          isRunning: true,
          startedAt: '2026-04-10T00:00:00.000Z',
          processedTraces: 10,
          lastCheckpointAt: null,
          retryQueueSize: 0,
          optimizationStatus: { currentState: 'idle', currentSkillId: null, lastOptimizationAt: null, lastError: null, queueSize: 0 },
        },
        skills: [],
        traceStats: { total: 0, byRuntime: {}, byStatus: {}, byEventType: {} },
        recentTraces: [],
        decisionEvents: [],
        agentUsage: {
          callCount: 1250,
          promptTokens: 2300000,
          completionTokens: 540000,
          totalTokens: 2840000,
          durationMsTotal: 4650000,
          avgDurationMs: 3720,
          lastCallAt: '2026-04-10T02:00:00.000Z',
          byModel: {
            'deepseek/deepseek-reasoner': {
              callCount: 1250,
              promptTokens: 2300000,
              completionTokens: 540000,
              totalTokens: 2840000,
              durationMsTotal: 4650000,
              avgDurationMs: 3720,
              lastCallAt: '2026-04-10T02:00:00.000Z',
            },
          },
          byScope: {
            decision_explainer: {
              callCount: 1000,
              promptTokens: 1800000,
              completionTokens: 420000,
              totalTokens: 2220000,
              durationMsTotal: 3600000,
              avgDurationMs: 3600,
              lastCallAt: '2026-04-10T02:00:00.000Z',
            },
            skill_call_analyzer: {
              callCount: 250,
              promptTokens: 500000,
              completionTokens: 120000,
              totalTokens: 620000,
              durationMsTotal: 1050000,
              avgDurationMs: 4200,
              lastCallAt: '2026-04-10T01:50:00.000Z',
            },
          },
          bySkill: {
            'summary-my-repo': {
              callCount: 1200,
              promptTokens: 2200000,
              completionTokens: 500000,
              totalTokens: 2700000,
              durationMsTotal: 4300000,
              avgDurationMs: 3583,
              lastCallAt: '2026-04-10T02:00:00.000Z',
            },
          },
        },
      },
    };

    dashboard.renderMainPanel(projectPath);

    const html = getElement('mainPanel').innerHTML;
    expect(html).toContain('Agent 调用');
    expect(html).toContain('调用范围');
    expect(html).toContain('探测 + 优化 + 解释');
    expect(html).toContain('skill_call_analyzer');
    expect(html).toContain('1.3K');
    expect(html).toContain('2.3M');
    expect(html).toContain('540K');
  });

  it('renders a richer cost tab with latency, skill breakdown, and LiteLLM metadata', () => {
    const { dashboard, getElement } = loadDashboardTestHarness();
    const projectPath = '/tmp/ornn-project';

    getElement('mainPanel');
    dashboard.state.selectedMainTab = 'cost';
    dashboard.state.selectedProjectId = projectPath;
    dashboard.state.providerCatalog = [{
      id: 'deepseek',
      name: 'deepseek',
      models: ['deepseek/deepseek-reasoner'],
      modelDetails: [{
        id: 'deepseek/deepseek-reasoner',
        mode: 'chat',
        maxInputTokens: 64000,
        maxOutputTokens: 8000,
        inputCostPerToken: 0.00000055,
        outputCostPerToken: 0.00000219,
        supportsReasoning: true,
        supportsFunctionCalling: true,
        supportsPromptCaching: false,
        supportsStructuredOutput: true,
        supportsVision: false,
        supportsWebSearch: false,
      }],
      defaultModel: 'deepseek/deepseek-reasoner',
      apiKeyEnvVar: 'DEEPSEEK_API_KEY',
    }];
    dashboard.state.projectData = {
      [projectPath]: {
        daemon: {},
        skills: [],
        traceStats: { total: 0, byRuntime: {}, byStatus: {}, byEventType: {} },
        recentTraces: [],
        decisionEvents: [],
        agentUsage: {
          callCount: 12,
          promptTokens: 120000,
          completionTokens: 30000,
          totalTokens: 150000,
          durationMsTotal: 24000,
          avgDurationMs: 2000,
          lastCallAt: '2026-04-10T05:23:00.000Z',
          byModel: {
            'deepseek/deepseek-reasoner': {
              callCount: 12,
              promptTokens: 120000,
              completionTokens: 30000,
              totalTokens: 150000,
              durationMsTotal: 24000,
              avgDurationMs: 2000,
              lastCallAt: '2026-04-10T05:23:00.000Z',
            },
          },
          byScope: {
            skill_call_analyzer: {
              callCount: 8,
              promptTokens: 100000,
              completionTokens: 24000,
              totalTokens: 124000,
              durationMsTotal: 18000,
              avgDurationMs: 2250,
              lastCallAt: '2026-04-10T05:23:00.000Z',
            },
            decision_explainer: {
              callCount: 4,
              promptTokens: 20000,
              completionTokens: 6000,
              totalTokens: 26000,
              durationMsTotal: 6000,
              avgDurationMs: 1500,
              lastCallAt: '2026-04-10T05:19:00.000Z',
            },
          },
          bySkill: {
            'summary-my-repo': {
              callCount: 7,
              promptTokens: 90000,
              completionTokens: 21000,
              totalTokens: 111000,
              durationMsTotal: 14000,
              avgDurationMs: 2000,
              lastCallAt: '2026-04-10T05:23:00.000Z',
            },
            'show-my-repo': {
              callCount: 5,
              promptTokens: 30000,
              completionTokens: 9000,
              totalTokens: 39000,
              durationMsTotal: 10000,
              avgDurationMs: 2000,
              lastCallAt: '2026-04-10T05:18:00.000Z',
            },
          },
        },
      },
    };

    dashboard.renderMainPanel(projectPath);
    const html = getElement('mainPanel').innerHTML;
    expect(html).toContain('成本');
    expect(html).toContain('估算成本');
    expect(html).toContain('平均时延');
    expect(html).toContain('单次平均 Token');
    expect(html).toContain('最近调用');
    expect(html).toContain('技能 Token 消耗 Top 5');
    expect(html).toContain('summary-my-repo');
    expect(html).toContain('LiteLLM 信号');
    expect(html).toContain('deepseek/deepseek-reasoner');
    expect(html).toContain('推理');
    expect(html).toContain('函数调用');
    expect(html).toContain('$0.13');
    expect(html).toContain('class="cost-shell"');
    expect(html).toContain('class="cost-hero"');
    expect(html).toContain('class="cost-rail"');
    expect(html).not.toContain('class="cost-hero-pill"');
  });

  it('prices cost rows even when usage model ids contain duplicated provider prefixes', () => {
    const { dashboard, getElement } = loadDashboardTestHarness();
    const projectPath = '/tmp/ornn-project';

    getElement('mainPanel');
    dashboard.state.selectedMainTab = 'cost';
    dashboard.state.selectedProjectId = projectPath;
    dashboard.state.providerCatalog = [{
      id: 'deepseek',
      name: 'deepseek',
      models: ['deepseek/deepseek-reasoner'],
      modelDetails: [{
        id: 'deepseek/deepseek-reasoner',
        mode: 'chat',
        maxInputTokens: 64000,
        maxOutputTokens: 8000,
        inputCostPerToken: 0.00000055,
        outputCostPerToken: 0.00000219,
        supportsReasoning: true,
        supportsFunctionCalling: true,
        supportsPromptCaching: false,
        supportsStructuredOutput: true,
        supportsVision: false,
        supportsWebSearch: false,
      }],
      defaultModel: 'deepseek/deepseek-reasoner',
      apiKeyEnvVar: 'DEEPSEEK_API_KEY',
    }];
    dashboard.state.projectData = {
      [projectPath]: {
        daemon: {},
        skills: [],
        traceStats: { total: 0, byRuntime: {}, byStatus: {}, byEventType: {} },
        recentTraces: [],
        decisionEvents: [],
        agentUsage: {
          callCount: 12,
          promptTokens: 120000,
          completionTokens: 30000,
          totalTokens: 150000,
          durationMsTotal: 24000,
          avgDurationMs: 2000,
          lastCallAt: '2026-04-10T05:23:00.000Z',
          byModel: {
            'deepseek/deepseek/deepseek-reasoner': {
              callCount: 12,
              promptTokens: 120000,
              completionTokens: 30000,
              totalTokens: 150000,
              durationMsTotal: 24000,
              avgDurationMs: 2000,
              lastCallAt: '2026-04-10T05:23:00.000Z',
            },
          },
          byScope: {},
          bySkill: {},
        },
      },
    };

    dashboard.renderMainPanel(projectPath);
    const html = getElement('mainPanel').innerHTML;
    expect(html).toContain('deepseek/deepseek-reasoner');
    expect(html).toContain('$0.13');
    expect(html).not.toContain('deepseek/deepseek/deepseek-reasoner');
  });

  it('renders the richer cost tab with fully localized English copy', () => {
    const { dashboard, getElement } = loadDashboardTestHarness({}, { lang: 'en' });
    const projectPath = '/tmp/ornn-project';

    getElement('mainPanel');
    dashboard.state.selectedMainTab = 'cost';
    dashboard.state.selectedProjectId = projectPath;
    dashboard.state.providerCatalog = [{
      id: 'deepseek',
      name: 'deepseek',
      models: ['deepseek/deepseek-reasoner'],
      modelDetails: [{
        id: 'deepseek/deepseek-reasoner',
        mode: 'chat',
        maxInputTokens: 64000,
        maxOutputTokens: 8000,
        inputCostPerToken: 0.00000055,
        outputCostPerToken: 0.00000219,
        supportsReasoning: true,
        supportsFunctionCalling: true,
        supportsPromptCaching: false,
        supportsStructuredOutput: true,
        supportsVision: false,
        supportsWebSearch: false,
      }],
      defaultModel: 'deepseek/deepseek-reasoner',
      apiKeyEnvVar: 'DEEPSEEK_API_KEY',
    }];
    dashboard.state.projectData = {
      [projectPath]: {
        daemon: {},
        skills: [],
        traceStats: { total: 0, byRuntime: {}, byStatus: {}, byEventType: {} },
        recentTraces: [],
        decisionEvents: [],
        agentUsage: {
          callCount: 12,
          promptTokens: 120000,
          completionTokens: 30000,
          totalTokens: 150000,
          durationMsTotal: 24000,
          avgDurationMs: 2000,
          lastCallAt: '2026-04-10T05:23:00.000Z',
          byModel: {
            'deepseek/deepseek-reasoner': {
              callCount: 12,
              promptTokens: 120000,
              completionTokens: 30000,
              totalTokens: 150000,
              durationMsTotal: 24000,
              avgDurationMs: 2000,
              lastCallAt: '2026-04-10T05:23:00.000Z',
            },
          },
          byScope: {
            skill_call_analyzer: {
              callCount: 8,
              promptTokens: 100000,
              completionTokens: 24000,
              totalTokens: 124000,
              durationMsTotal: 18000,
              avgDurationMs: 2250,
              lastCallAt: '2026-04-10T05:23:00.000Z',
            },
          },
          bySkill: {
            'summary-my-repo': {
              callCount: 7,
              promptTokens: 90000,
              completionTokens: 21000,
              totalTokens: 111000,
              durationMsTotal: 14000,
              avgDurationMs: 2000,
              lastCallAt: '2026-04-10T05:23:00.000Z',
            },
          },
        },
      },
    };

    dashboard.renderMainPanel(projectPath);
    const html = getElement('mainPanel').innerHTML;
    expect(html).toContain('Cost');
    expect(html).toContain('Estimated Cost');
    expect(html).toContain('Average Latency');
    expect(html).toContain('Average Tokens / Call');
    expect(html).toContain('Latest Call');
    expect(html).toContain('Top Skills by Token Spend');
    expect(html).toContain('LiteLLM Signals');
    expect(html).toContain('class="cost-shell"');
    expect(html).toContain('class="cost-hero"');
    expect(html).toContain('class="cost-rail"');
    expect(html).not.toContain('class="cost-hero-pill"');
    expect(html).toContain(
      'Calls, input tokens, output tokens, total tokens, average latency, latest call, and rollups by model, scope, and skill.'
    );
  });

  it('renders scope activity detail and copies readable scope timeline text', async () => {
    const projectPath = '/tmp/ornn-project';
    const encodedPath = encodeURIComponent(projectPath);
    const { dashboard, getElement, getCopiedText } = loadDashboardTestHarness({}, {
      fetchMap: {
        [`/api/projects/${encodedPath}/activity-scopes/${encodeURIComponent('scope-123')}`]: {
          detail: {
            scopeId: 'scope-123',
            createdAt: '2026-04-10T05:23:00.000Z',
            updatedAt: '2026-04-10T05:24:00.000Z',
            skillId: 'test-driven-development',
            runtime: 'codex',
            projectName: 'ornn-project',
            status: 'no_optimization',
            sessionId: 'session-zh',
            timeline: [
              {
                id: 'skill-called:1',
                type: 'skill_called',
                timestamp: '2026-04-10T05:23:00.000Z',
                summary: '助手输出: 开始执行测试驱动开发。',
              },
              {
                id: 'analysis-submitted:1',
                type: 'analysis_submitted',
                timestamp: '2026-04-10T05:23:08.000Z',
                summary: '当前窗口已提交分析。',
                model: 'deepseek/deepseek-reasoner',
                traceCount: 4,
                charCount: 128,
                traceText: '1. [2026-04-10T05:23:00.000Z] 助手输出: 开始执行测试驱动开发。',
              },
              {
                id: 'analysis-result:1',
                type: 'analysis_result',
                timestamp: '2026-04-10T05:23:10.000Z',
                summary: '系统已经完成本轮分析。',
                outcome: 'no_optimization',
              },
              {
                id: 'no-optimization:1',
                type: 'no_optimization',
                timestamp: '2026-04-10T05:23:10.000Z',
                summary: '无需优化，关闭本轮 scope。',
              },
            ],
          },
        },
      },
    });

    getElement('mainPanel');
    getElement('eventModalTitle');
    getElement('eventModalContent');
    getElement('eventModal');

    dashboard.state.selectedMainTab = 'activity';
    dashboard.state.selectedProjectId = projectPath;
    dashboard.state.projectData = {
      [projectPath]: {
        daemon: {},
        skills: [{ skillId: 'test-driven-development', runtime: 'codex' }],
        traceStats: { total: 0, byRuntime: {}, byStatus: {}, byEventType: {} },
        recentTraces: [],
        decisionEvents: [],
        activityScopes: [{
          scopeId: 'scope-123',
          createdAt: '2026-04-10T05:23:00.000Z',
          updatedAt: '2026-04-10T05:24:00.000Z',
          skillId: 'test-driven-development',
          runtime: 'codex',
          projectName: 'ornn-project',
          status: 'no_optimization',
          sessionId: 'session-zh',
        }],
        agentUsage: { callCount: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0, durationMsTotal: 0, avgDurationMs: 0, lastCallAt: null, byModel: {}, byScope: {}, bySkill: {} },
      },
    };

    dashboard.renderMainPanel(projectPath);
    const html = getElement('mainPanel').innerHTML;
    expect(html).toContain('>状态<');
    expect(html).toContain("startActivityColumnResize(event,'status')");
    expect(html).toContain('无需优化');
    expect(html).not.toContain('复制');
    expect(html).not.toContain('查看详情');

    await dashboard.copyActivityDetail(projectPath, 'scope:scope-123');
    expect(getCopiedText()).toContain('test-driven-development');
    expect(getCopiedText()).toContain('scope-123');
    expect(getCopiedText()).toContain('Scope 时间线');
    expect(getCopiedText()).toContain('系统已经完成本轮分析。');

    await dashboard.openActivityDetail(projectPath, 'scope:scope-123');
    expect(getElement('eventModalContent').textContent).toContain('系统已经完成本轮分析。');
  });

  it('limits expanded scope trace blocks with internal scrolling', () => {
    const html = getDashboardHtml(47432, 'zh', 'test-build-id');
    expect(html).toContain('.activity-scope-traces pre');
    expect(html).toContain('max-height: 320px;');
    expect(html).toContain('overflow: auto;');
  });

  it('allows the scope detail modal itself to scroll when expanded traces exceed the viewport', () => {
    const html = getDashboardHtml(47432, 'zh', 'test-build-id');
    expect(html).toContain('#eventModal .modal');
    expect(html).toContain('max-height: calc(100vh - 48px);');
    expect(html).toContain('#eventModal .modal-content');
    expect(html).toContain('overflow-y: auto;');
    expect(html).toContain('min-height: 0;');
  });

  it('renders clickable skill cells in scope activity rows that open the skill modal', () => {
    const { dashboard, getElement } = loadDashboardTestHarness({}, { lang: 'zh' });
    const projectPath = '/tmp/ornn-project';

    getElement('mainPanel');
    dashboard.state.selectedMainTab = 'activity';
    dashboard.state.selectedProjectId = projectPath;
    dashboard.state.projectData = {
      [projectPath]: {
        daemon: {},
        skills: [{ skillId: 'test-driven-development', runtime: 'codex' }],
        traceStats: { total: 0, byRuntime: {}, byStatus: {}, byEventType: {} },
        recentTraces: [],
        decisionEvents: [],
        activityScopes: [{
          scopeId: 'scope-click-skill-1',
          createdAt: '2026-04-10T05:23:00.000Z',
          updatedAt: '2026-04-10T05:24:00.000Z',
          skillId: 'test-driven-development',
          runtime: 'codex',
          projectName: 'ornn-project',
          status: 'observing',
          sessionId: 'session-click',
        }],
        agentUsage: { callCount: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0, durationMsTotal: 0, avgDurationMs: 0, lastCallAt: null, byModel: {}, byScope: {}, bySkill: {} },
      },
    };

    dashboard.renderMainPanel(projectPath);
    const html = getElement('mainPanel').innerHTML;
    expect(html).toContain("onclick=\"viewSkill('/tmp/ornn-project','test-driven-development','codex');event.stopPropagation()\"");
    expect(html).toContain('activity-skill-link');
  });

  it('renders one business row per activity scope when scope summaries are available', () => {
    const { dashboard, getElement } = loadDashboardTestHarness({}, { lang: 'zh' });
    const projectPath = '/tmp/ornn-project';

    getElement('mainPanel');
    dashboard.state.selectedMainTab = 'activity';
    dashboard.state.selectedProjectId = projectPath;
    dashboard.state.projectData = {
      [projectPath]: {
        daemon: {},
        skills: [{ skillId: 'systematic-debugging', runtime: 'codex' }],
        traceStats: { total: 0, byRuntime: {}, byStatus: {}, byEventType: {} },
        recentTraces: [],
        decisionEvents: [],
        activityScopes: [{
          scopeId: 'scope-ep-1',
          createdAt: '2026-04-10T05:23:00.000Z',
          updatedAt: '2026-04-10T05:24:00.000Z',
          skillId: 'systematic-debugging',
          runtime: 'codex',
          projectName: 'OrnnSkills',
          status: 'observing',
          sessionId: 'session-1',
        }],
        agentUsage: { callCount: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0, durationMsTotal: 0, avgDurationMs: 0, lastCallAt: null, byModel: {}, byScope: {}, bySkill: {} },
      },
    };
    const rows = dashboard.buildActivityRows(projectPath);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: 'scope:scope-ep-1',
      scopeId: 'scope-ep-1',
      runtime: 'codex',
      skillId: 'systematic-debugging',
      projectName: 'OrnnSkills',
      status: '观察中',
    });

    dashboard.renderMainPanel(projectPath);
    const html = getElement('mainPanel').innerHTML;
    expect(html).toContain('项目');
    expect(html).toContain('状态');
    expect(html).toContain('OrnnSkills');
    expect(html).toContain('观察中');
    expect(html).toContain("onclick=\"openActivityDetail('/tmp/ornn-project','scope:scope-ep-1')\"");
    expect(html).toContain("onclick=\"viewSkill('/tmp/ornn-project','systematic-debugging','codex');event.stopPropagation()\"");
    expect(html).not.toContain('查看详情');
    expect(html).not.toContain('复制');
  });

  it('keeps the new scope layout even when a project currently has no derived activity scopes', () => {
    const { dashboard, getElement } = loadDashboardTestHarness({}, { lang: 'zh' });
    const projectPath = '/tmp/ornn-project';

    getElement('mainPanel');
    dashboard.state.selectedMainTab = 'activity';
    dashboard.state.selectedProjectId = projectPath;
    dashboard.state.projectData = {
      [projectPath]: {
        daemon: {},
        skills: [{ skillId: 'systematic-debugging', runtime: 'codex' }],
        traceStats: { total: 0, byRuntime: {}, byStatus: {}, byEventType: {} },
        recentTraces: [],
        decisionEvents: [{
          id: 'evt-failed-1',
          timestamp: '2026-04-10T05:23:18.000Z',
          tag: 'analysis_failed',
          runtime: 'codex',
          skillId: 'systematic-debugging',
          status: 'failed',
          windowId: 'scope-failed-1',
          detail: '当前项目没有可用的模型服务配置，所以这轮分析没有开始。',
        }],
        activityScopes: [],
        agentUsage: { callCount: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0, durationMsTotal: 0, avgDurationMs: 0, lastCallAt: null, byModel: {}, byScope: {}, bySkill: {} },
      },
    };

    const rows = dashboard.buildActivityRows(projectPath);
    expect(rows).toEqual([]);

    dashboard.renderMainPanel(projectPath);
    const html = getElement('mainPanel').innerHTML;
    expect(html).toContain('暂无追踪活动。');
    expect(html).toContain('0</div>');
    expect(html).not.toContain('分析链路异常');
    expect(html).not.toContain('节点');
  });

  it('renders scope timeline detail from the activity scope endpoint', async () => {
    const projectPath = '/tmp/ornn-project';
    const encodedPath = encodeURIComponent(projectPath);
    const { dashboard, getElement } = loadDashboardTestHarness({}, {
      lang: 'zh',
      fetchMap: {
        [`/api/projects/${encodedPath}/activity-scopes/${encodeURIComponent('scope-ep-1')}`]: {
          detail: {
            scopeId: 'scope-ep-1',
            createdAt: '2026-04-10T05:23:00.000Z',
            updatedAt: '2026-04-10T05:24:00.000Z',
            skillId: 'systematic-debugging',
            runtime: 'codex',
            projectName: 'OrnnSkills',
            status: 'observing',
            sessionId: 'session-1',
            timeline: [
              {
                id: 'skill-called:trace-1',
                type: 'skill_called',
                timestamp: '2026-04-10T05:23:00.000Z',
                summary: '助手输出: 正在排查问题',
              },
              {
                id: 'analysis-submitted:req-1',
                type: 'analysis_submitted',
                timestamp: '2026-04-10T05:23:12.000Z',
                summary: '当前窗口达到首次分析条件，提交分析。',
                model: 'deepseek/deepseek-reasoner',
                traceCount: 3,
                charCount: 256,
                traceText: '1. [2026-04-10T05:23:00.000Z] 助手输出: 正在排查问题',
              },
              {
                id: 'analysis-result:evt-1',
                type: 'analysis_result',
                timestamp: '2026-04-10T05:23:18.000Z',
                summary: '当前窗口仍需更多上下文，暂不下结论。',
                outcome: 'need_more_context',
              },
            ],
          },
        },
      },
    });

    getElement('eventModal');
    getElement('eventModalTitle');
    getElement('eventModalContent');
    dashboard.state.selectedMainTab = 'activity';
    dashboard.state.selectedProjectId = projectPath;
    dashboard.state.projectData = {
      [projectPath]: {
        daemon: {},
        skills: [{ skillId: 'systematic-debugging', runtime: 'codex' }],
        traceStats: { total: 0, byRuntime: {}, byStatus: {}, byEventType: {} },
        recentTraces: [],
        decisionEvents: [],
        activityScopes: [{
          scopeId: 'scope-ep-1',
          createdAt: '2026-04-10T05:23:00.000Z',
          updatedAt: '2026-04-10T05:24:00.000Z',
          skillId: 'systematic-debugging',
          runtime: 'codex',
          projectName: 'OrnnSkills',
          status: 'observing',
          sessionId: 'session-1',
        }],
        agentUsage: { callCount: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0, durationMsTotal: 0, avgDurationMs: 0, lastCallAt: null, byModel: {}, byScope: {}, bySkill: {} },
      },
    };

    dashboard.buildActivityRows(projectPath);
    await dashboard.openActivityDetail(projectPath, 'scope:scope-ep-1');

    expect(getElement('eventModalTitle').textContent).toContain('systematic-debugging');
    const html = getElement('eventModalContent').innerHTML;
    expect(html).toContain('技能调用');
    expect(html).toContain('提交分析');
    expect(html).toContain('分析结果');
    expect(html).toContain('3 条 trace');
    expect(html).toContain('256 字符');
    expect(html).toContain('deepseek/deepseek-reasoner');
    expect(html).toContain('details');
    expect(html).toContain('1. [2026-04-10T05:23:00.000Z] 助手输出: 正在排查问题');
    expect(html).toContain('当前窗口仍需更多上下文，暂不下结论。');
  });

  it('preloads version metadata for every history card when opening the skill modal', async () => {
    const projectPath = '/tmp/ornn-project';
    const skillId = 'test-driven-development';
    const runtimeId = 'codex';
    const encodedProject = encodeURIComponent(projectPath);
    const encodedSkill = encodeURIComponent(skillId);
    const { dashboard, getElement, getFetchCalls } = loadDashboardTestHarness({}, {
      fetchMap: {
        [`/api/projects/${encodedProject}/skills/${encodedSkill}?runtime=${runtimeId}`]: {
          content: '# test-driven-development',
          versions: [1, 2, 3],
        },
        [`/api/projects/${encodedProject}/skills/${encodedSkill}/versions/1?runtime=${runtimeId}`]: {
          content: 'v1',
          metadata: {
            createdAt: '2026-04-06T00:00:00.000Z',
            reason: 'Bootstrap source sync (project -> project)',
          },
        },
        [`/api/projects/${encodedProject}/skills/${encodedSkill}/versions/2?runtime=${runtimeId}`]: {
          content: 'v2',
          metadata: {
            createdAt: '2026-04-06T00:00:00.000Z',
            reason: 'Manual edit from dashboard',
          },
        },
        [`/api/projects/${encodedProject}/skills/${encodedSkill}/versions/3?runtime=${runtimeId}`]: {
          content: 'v3',
          metadata: {
            createdAt: '2026-04-06T00:00:00.000Z',
            reason: 'Manual edit from dashboard',
          },
        },
      },
    });

    getElement('skillModal');
    getElement('modalSkillName');
    getElement('modalSkillStatus');
    getElement('modalSaveHint');
    getElement('modalSaveBtn');
    getElement('modalContent');
    getElement('versionList');

    await dashboard.viewSkill(projectPath, skillId, runtimeId);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(getFetchCalls()).toContain(`/api/projects/${encodedProject}/skills/${encodedSkill}/versions/1?runtime=${runtimeId}`);
    expect(getFetchCalls()).toContain(`/api/projects/${encodedProject}/skills/${encodedSkill}/versions/2?runtime=${runtimeId}`);
    expect(getFetchCalls()).toContain(`/api/projects/${encodedProject}/skills/${encodedSkill}/versions/3?runtime=${runtimeId}`);
    expect(getElement('vmeta_1').innerHTML).toContain('Bootstrap source sync');
    expect(getElement('vmeta_2').innerHTML).toContain('Manual edit from dashboard');
    expect(getElement('vmeta_3').innerHTML).toContain('Manual edit from dashboard');
  });

  it('moves the selected history state to the clicked version card', async () => {
    const projectPath = '/tmp/ornn-project';
    const skillId = 'test-driven-development';
    const runtimeId = 'codex';
    const encodedProject = encodeURIComponent(projectPath);
    const encodedSkill = encodeURIComponent(skillId);
    const { dashboard, getElement } = loadDashboardTestHarness({}, {
      lang: 'en',
      fetchMap: {
        [`/api/projects/${encodedProject}/skills/${encodedSkill}?runtime=${runtimeId}`]: {
          content: '# test-driven-development',
          versions: [1, 2, 3],
        },
        [`/api/projects/${encodedProject}/skills/${encodedSkill}/versions/1?runtime=${runtimeId}`]: {
          content: 'v1',
          metadata: {
            createdAt: '2026-04-06T00:00:00.000Z',
            reason: 'Bootstrap source sync (project -> project)',
          },
        },
        [`/api/projects/${encodedProject}/skills/${encodedSkill}/versions/2?runtime=${runtimeId}`]: {
          content: 'v2',
          metadata: {
            createdAt: '2026-04-06T00:00:00.000Z',
            reason: 'Manual edit from dashboard',
          },
        },
        [`/api/projects/${encodedProject}/skills/${encodedSkill}/versions/3?runtime=${runtimeId}`]: {
          content: 'v3',
          metadata: {
            createdAt: '2026-04-06T00:00:00.000Z',
            reason: 'Manual edit from dashboard',
          },
        },
      },
    });

    getElement('skillModal');
    getElement('modalSkillName');
    getElement('modalSkillStatus');
    getElement('modalSaveHint');
    getElement('modalSaveBtn');
    getElement('modalContent');
    getElement('versionList');

    await dashboard.viewSkill(projectPath, skillId, runtimeId);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(getElement('versionList').innerHTML).toContain(`version-item current `);
    expect(getElement('versionList').innerHTML).toContain(`onclick="loadVersion('${encodedProject}','${encodedSkill}','${runtimeId}',3)"`);

    await dashboard.loadVersion(encodedProject, encodedSkill, runtimeId, 2);

    expect(getElement('versionList').innerHTML).toContain(`version-item current `);
    expect(getElement('versionList').innerHTML).toContain(`onclick="loadVersion('${encodedProject}','${encodedSkill}','${runtimeId}',2)"`);
    expect(getElement('versionList').innerHTML).not.toContain(`version-item current " onclick="loadVersion('${encodedProject}','${encodedSkill}','${runtimeId}',3)"`);
  });

  it('renders invalidate or restore actions and effective status for each version card', async () => {
    const projectPath = '/tmp/ornn-project';
    const skillId = 'test-driven-development';
    const runtimeId = 'codex';
    const encodedProject = encodeURIComponent(projectPath);
    const encodedSkill = encodeURIComponent(skillId);
    const { dashboard, getElement } = loadDashboardTestHarness({}, {
      lang: 'en',
      fetchMap: {
        [`/api/projects/${encodedProject}/skills/${encodedSkill}?runtime=${runtimeId}`]: {
          content: 'v2 active content',
          versions: [1, 2, 3],
          effectiveVersion: 2,
        },
        [`/api/projects/${encodedProject}/skills/${encodedSkill}/versions/1?runtime=${runtimeId}`]: {
          content: 'v1',
          metadata: {
            createdAt: '2026-04-06T00:00:00.000Z',
            reason: 'Bootstrap source sync (project -> project)',
            isDisabled: false,
          },
        },
        [`/api/projects/${encodedProject}/skills/${encodedSkill}/versions/2?runtime=${runtimeId}`]: {
          content: 'v2',
          metadata: {
            createdAt: '2026-04-06T00:00:00.000Z',
            reason: 'Manual edit from dashboard',
            isDisabled: false,
          },
        },
        [`/api/projects/${encodedProject}/skills/${encodedSkill}/versions/3?runtime=${runtimeId}`]: {
          content: 'v3',
          metadata: {
            createdAt: '2026-04-06T00:00:00.000Z',
            reason: 'Manual edit from dashboard',
            isDisabled: true,
          },
        },
      },
    });

    getElement('skillModal');
    getElement('modalSkillName');
    getElement('modalSkillStatus');
    getElement('modalSaveHint');
    getElement('modalSaveBtn');
    getElement('modalContent');
    getElement('versionList');

    await dashboard.viewSkill(projectPath, skillId, runtimeId);
    await new Promise((resolve) => setTimeout(resolve, 0));

    const html = getElement('versionList').innerHTML;
    expect(html).toContain('Restore');
    expect(html).toContain('Invalidate');
    expect(html).toContain('effective');
    expect(html).toContain('invalid');
    expect(html).toContain(`version-item current `);
    expect(html).toContain(`onclick="loadVersion('${encodedProject}','${encodedSkill}','${runtimeId}',2)"`);
  });


  it('degrades to a project-level fallback when main panel rendering throws', () => {
    const { dashboard, getElement } = loadDashboardTestHarness({}, { lang: 'zh' });
    const projectPath = '/tmp/ornn-project';
    const badScope = new Proxy({}, {
      ownKeys() {
        throw new Error('scope breakdown exploded');
      },
      getOwnPropertyDescriptor() {
        return { enumerable: true, configurable: true };
      },
    });

    getElement('mainPanel');
    dashboard.state.selectedProjectId = projectPath;
    dashboard.state.selectedMainTab = 'overview';
    dashboard.state.projectData = {
      [projectPath]: {
        daemon: {
          isRunning: true,
          startedAt: '2026-04-10T00:00:00.000Z',
          processedTraces: 42,
          lastCheckpointAt: null,
          retryQueueSize: 0,
          optimizationStatus: { currentState: 'idle', currentSkillId: null, lastOptimizationAt: null, lastError: null, queueSize: 0 },
        },
        skills: [],
        traceStats: { total: 0, byRuntime: {}, byStatus: {}, byEventType: {} },
        recentTraces: [],
        decisionEvents: [],
        agentUsage: {
          callCount: 1,
          promptTokens: 10,
          completionTokens: 2,
          totalTokens: 12,
          durationMsTotal: 100,
          avgDurationMs: 100,
          lastCallAt: null,
          byModel: {},
          byScope: badScope,
          bySkill: {},
        },
      },
    };

    const ok = dashboard.safeRenderMainPanel(projectPath, 'test');
    expect(ok).toBe(false);
    const html = getElement('mainPanel').innerHTML;
    expect(html).toContain('项目数据已加载，但仪表板面板渲染失败');
    expect(html).toContain('/tmp/ornn-project');
    expect(html).toContain('test');
  });

  it('uses persisted activity column widths when rendering the scope table', () => {
    const { dashboard, getElement } = loadDashboardTestHarness({
      'ornn-dashboard-activity-columns': JSON.stringify({ skill: 640 }),
    });
    const projectPath = '/tmp/ornn-project';

    getElement('mainPanel');
    dashboard.state.selectedMainTab = 'activity';
    dashboard.state.selectedProjectId = projectPath;
    dashboard.state.projectData = {
      [projectPath]: {
        daemon: {},
        skills: [{ skillId: 'test-driven-development', runtime: 'codex' }],
        traceStats: { total: 1, byRuntime: { codex: 1 }, byStatus: { success: 1 }, byEventType: { tool_call: 1 } },
        recentTraces: [],
        decisionEvents: [],
        activityScopes: [{
          scopeId: 'scope-width-1',
          createdAt: '2026-04-10T05:23:01.000Z',
          updatedAt: '2026-04-10T05:24:00.000Z',
          skillId: 'test-driven-development',
          runtime: 'codex',
          projectName: 'ornn-project',
          status: 'no_optimization',
          sessionId: 'session-1',
        }],
        agentUsage: { callCount: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0, durationMsTotal: 0, avgDurationMs: 0, lastCallAt: null, byModel: {}, byScope: {}, bySkill: {} },
      },
    };

    dashboard.renderMainPanel(projectPath);
    expect(getElement('mainPanel').innerHTML).toContain('width:640px');
  });

  it('renders simplified config panel without mutable strategy controls', () => {
    const { dashboard, getElement } = loadDashboardTestHarness({}, { lang: 'en' });
    const projectPath = '/tmp/ornn-project';

    getElement('mainPanel');
    dashboard.state.selectedMainTab = 'config';
    dashboard.state.selectedProjectId = projectPath;
    dashboard.state.providerCatalog = [
      {
        id: 'openai',
        name: 'openai',
        models: ['openai/gpt-4o-mini'],
        defaultModel: 'openai/gpt-4o-mini',
        apiKeyEnvVar: 'OPENAI_API_KEY',
        modelDetails: [],
      },
      {
        id: 'deepseek',
        name: 'deepseek',
        models: ['deepseek/deepseek-chat'],
        defaultModel: 'deepseek/deepseek-chat',
        apiKeyEnvVar: 'DEEPSEEK_API_KEY',
        modelDetails: [],
      },
    ];
    dashboard.state.configByProject = {
      [projectPath]: {
        autoOptimize: true,
        userConfirm: false,
        runtimeSync: true,
        llmSafety: {
          enabled: true,
          windowMs: 45000,
          maxRequestsPerWindow: 7,
          maxConcurrentRequests: 1,
          maxEstimatedTokensPerWindow: 16000,
        },
        defaultProvider: 'deepseek',
        logLevel: 'debug',
        providers: [
          { provider: 'openai', modelName: 'openai/gpt-4o-mini', apiKeyEnvVar: 'OPENAI_API_KEY', hasApiKey: true },
          { provider: 'deepseek', modelName: 'deepseek/deepseek-chat', apiKeyEnvVar: 'DEEPSEEK_API_KEY', hasApiKey: false },
        ],
      },
    };
    dashboard.state.projectData = {
      [projectPath]: {
        daemon: {},
        skills: [],
        traceStats: { total: 0, byRuntime: {}, byStatus: {}, byEventType: {} },
        recentTraces: [],
        decisionEvents: [],
        agentUsage: {
          callCount: 0,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          durationMsTotal: 0,
          avgDurationMs: 0,
          lastCallAt: null,
          byModel: {},
          byScope: {},
          bySkill: {},
        },
      },
    };

    dashboard.renderMainPanel(projectPath);
    const html = getElement('mainPanel').innerHTML;
    expect(html).toContain('Add Provider');
    expect(html).toContain('Provider Connectivity');
    expect(html).toContain('~/.ornn/config/settings.toml');
    expect(html).not.toContain('.ornn/ornn.toml');
    expect(html).not.toContain('Save Config');
    expect(html).not.toContain('onclick="saveProjectConfig()"');
    expect(html).not.toContain('id="cfg_check_btn"');
    expect(html).not.toContain('id="cfg_default_provider"');
    expect(html).not.toContain('id="cfg_log_level"');
    expect(html).not.toContain('tracking.auto_optimize');
    expect(html).not.toContain('tracking.user_confirm');
    expect(html).not.toContain('tracking.runtime_sync');
    expect(html).not.toContain('class="config-input cfg_env"');
    expect(html).toContain('name="cfg_provider_active"');
    expect(html).toContain('value="1" checked');
    expect(html).toContain('class="provider-actions"');
    expect(html).toContain('onclick="checkProvidersConnectivity(0, this)"');
    expect(html).toContain('onclick="checkProvidersConnectivity(1, this)"');
    expect(html).toContain('scheduleProjectConfigSave(150)');
    expect(html).toContain('scheduleProjectConfigSave(500)');
    expect(html).not.toContain('Default Provider');
    expect(html).not.toContain('Log Level');
  });

  it('renders localized skill filters and raw trace headers in Chinese', () => {
    const { dashboard, getElement } = loadDashboardTestHarness({}, { lang: 'zh' });
    const projectPath = '/tmp/ornn-project';

    getElement('mainPanel');
    dashboard.state.selectedProjectId = projectPath;
    dashboard.state.projectData = {
      [projectPath]: {
        daemon: {},
        skills: [{
          skillId: 'test-driven-development',
          runtime: 'codex',
          status: 'active',
          traceCount: 2,
          current_revision: 3,
          updatedAt: '2026-04-10T05:23:00.000Z',
        }],
        traceStats: { total: 1, byRuntime: { codex: 1 }, byStatus: { success: 1 }, byEventType: { tool_call: 1 } },
        recentTraces: [{
          trace_id: 'trace-1',
          session_id: 'session-1',
          runtime: 'codex',
          timestamp: '2026-04-10T05:23:00.000Z',
          event_type: 'tool_call',
          skill_refs: ['test-driven-development'],
          status: 'success',
        }],
        decisionEvents: [],
        agentUsage: { callCount: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0, durationMsTotal: 0, avgDurationMs: 0, lastCallAt: null, byModel: {}, byScope: {}, bySkill: {} },
      },
    };

    dashboard.state.selectedMainTab = 'skills';
    dashboard.renderMainPanel(projectPath);
    let html = getElement('mainPanel').innerHTML;
    expect(html).toContain('全部');
    expect(html).toContain('搜索技能...');
    expect(html).toContain('排序：');
    expect(html).toContain('名称');
    expect(html).toContain('更新时间');
    expect(html).not.toContain('Search skills...');
    expect(html).not.toContain('Sort:');

    dashboard.state.selectedMainTab = 'activity';
    dashboard.state.activityLayer = 'raw';
    dashboard.renderMainPanel(projectPath);
    html = getElement('mainPanel').innerHTML;
    expect(html).toContain('追踪 ID');
    expect(html).toContain('范围');
    expect(html).toContain('详情');
    expect(html).toContain('操作');
    expect(html).not.toContain('<th>Trace ID</th>');
  });

  it('renders raw trace rows with scope and detail actions', async () => {
    const { dashboard, getElement, getCopiedText } = loadDashboardTestHarness({}, { lang: 'zh' });
    const projectPath = '/tmp/ornn-project';

    getElement('mainPanel');
    getElement('eventModalTitle');
    getElement('eventModalContent');
    getElement('eventModal');

    dashboard.state.selectedMainTab = 'activity';
    dashboard.state.activityLayer = 'raw';
    dashboard.state.selectedProjectId = projectPath;
    dashboard.state.projectData = {
      [projectPath]: {
        daemon: {},
        skills: [{ skillId: 'test-driven-development', runtime: 'codex' }],
        traceStats: { total: 1, byRuntime: { codex: 1 }, byStatus: { success: 1 }, byEventType: { tool_call: 1 } },
        recentTraces: [{
          trace_id: 'trace-raw-1',
          session_id: 'session-raw-1',
          runtime: 'codex',
          timestamp: '2026-04-10T05:23:00.000Z',
          event_type: 'tool_call',
          tool_name: 'exec_command',
          tool_args: { cmd: 'npm run build' },
          skill_refs: ['test-driven-development'],
          status: 'success',
        }],
        decisionEvents: [{
          id: 'evt-raw-1',
          timestamp: '2026-04-10T05:23:01.000Z',
          tag: 'evaluation_result',
          traceId: 'trace-raw-1',
          sessionId: 'session-raw-1',
          runtime: 'codex',
          skillId: 'test-driven-development',
          status: 'no_patch_needed',
          windowId: 'scope-raw-1',
          detail: 'same trace scope',
        }],
        agentUsage: { callCount: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0, durationMsTotal: 0, avgDurationMs: 0, lastCallAt: null, byModel: {}, byScope: {}, bySkill: {} },
      },
    };

    dashboard.renderMainPanel(projectPath);
    const html = getElement('mainPanel').innerHTML;
    expect(html).toContain('scope-raw-1');
    expect(html).toContain('复制');
    expect(html).toContain('查看详情');
    expect(html).toContain('exec_command');

    await dashboard.copyActivityDetail(projectPath, 'raw:trace-raw-1');
    expect(getCopiedText()).toContain('scope-raw-1');
    expect(getCopiedText()).toContain('exec_command');
    expect(getCopiedText()).toContain('trace-raw-1');

    await dashboard.openActivityDetail(projectPath, 'raw:trace-raw-1');
    const detail = getElement('eventModalContent').textContent;
    expect(detail).toContain('exec_command');
    expect(detail).toContain('npm run build');
  });

  it('renders provider editor rows and alerts with localized English copy', () => {
    const { dashboard, getElement } = loadDashboardTestHarness({}, { lang: 'en' });
    const projectPath = '/tmp/ornn-project';

    getElement('mainPanel');
    dashboard.state.selectedMainTab = 'config';
    dashboard.state.selectedProjectId = projectPath;
    dashboard.state.providerCatalog = [
      {
        id: 'openai',
        name: 'openai',
        models: ['openai/gpt-4o-mini'],
        defaultModel: 'openai/gpt-4o-mini',
        apiKeyEnvVar: 'OPENAI_API_KEY',
        modelDetails: [],
      },
    ];
    dashboard.state.providerHealthByProject = {
      [projectPath]: {
        level: 'warn',
        code: 'provider_connectivity_failed',
        message: '',
        checkedAt: '2026-04-10T05:23:00.000Z',
        results: [{ ok: false, provider: 'openai', modelName: 'openai/gpt-4o-mini' }],
      },
    };
    dashboard.state.configByProject = {
      [projectPath]: {
        autoOptimize: true,
        userConfirm: false,
        runtimeSync: true,
        defaultProvider: 'openai',
        logLevel: 'info',
        providers: [
          { provider: 'custom-provider', modelName: 'custom-model', apiKeyEnvVar: 'OPENAI_API_KEY', apiKey: 'plain-visible-key', hasApiKey: true },
        ],
      },
    };
    dashboard.state.projectData = {
      [projectPath]: {
        daemon: {},
        skills: [],
        traceStats: { total: 0, byRuntime: {}, byStatus: {}, byEventType: {} },
        recentTraces: [],
        decisionEvents: [],
        agentUsage: { callCount: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0, durationMsTotal: 0, avgDurationMs: 0, lastCallAt: null, byModel: {}, byScope: {}, bySkill: {} },
      },
    };

    dashboard.renderMainPanel(projectPath);
    const html = getElement('mainPanel').innerHTML;
    expect(html).toContain('Provider Connectivity Failed');
    expect(html).toContain('Failed provider connectivity: openai/openai/gpt-4o-mini');
    expect(html).toContain('Open the Config tab to set provider and re-run connectivity check.');
    expect(html).not.toContain('Save Config');
    expect(html).toContain('Custom provider id (e.g. xai)');
    expect(html).toContain('Custom model (e.g. grok-3)');
    expect(html).toContain('class="config-input cfg_api_key" type="password"');
    expect(html).toContain('value="plain-visible-key"');
    expect(html).toContain('cfg_api_key_toggle');
    expect(html).toContain('Show');
    expect(html).toContain('mark exactly one provider as active');
    expect(html).toContain('cfg_provider_active');
    expect(html).toContain('cfg_row_check_btn');
    expect(html).toContain('onclick="checkProvidersConnectivity(0, this)"');
    expect(html).toContain('scheduleProjectConfigSave(500)');
    expect(html).toContain('Use');
    expect(html).not.toContain('cfg_env');
    expect(html).toContain('Remove');
    expect(html).toContain('Custom...');
  });

  it('treats provider-native model ids as built-in models instead of custom models', () => {
    const { dashboard, getElement } = loadDashboardTestHarness({}, { lang: 'zh' });
    const projectPath = '/tmp/ornn-project';

    getElement('mainPanel');
    dashboard.state.selectedMainTab = 'config';
    dashboard.state.selectedProjectId = projectPath;
    dashboard.state.providerCatalog = [
      {
        id: 'deepseek',
        name: 'deepseek',
        models: ['deepseek/deepseek-reasoner', 'deepseek/deepseek-chat'],
        defaultModel: 'deepseek/deepseek-reasoner',
        apiKeyEnvVar: 'DEEPSEEK_API_KEY',
        modelDetails: [],
      },
    ];
    dashboard.state.configByProject = {
      [projectPath]: {
        autoOptimize: true,
        userConfirm: false,
        runtimeSync: true,
        defaultProvider: 'deepseek',
        logLevel: 'info',
        providers: [
          {
            provider: 'deepseek',
            modelName: 'deepseek-reasoner',
            apiKeyEnvVar: 'DEEPSEEK_API_KEY',
            apiKey: 'plain-visible-key',
            hasApiKey: true,
          },
        ],
      },
    };
    dashboard.state.projectData = {
      [projectPath]: {
        daemon: {},
        skills: [],
        traceStats: { total: 0, byRuntime: {}, byStatus: {}, byEventType: {} },
        recentTraces: [],
        decisionEvents: [],
        agentUsage: { callCount: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0, durationMsTotal: 0, avgDurationMs: 0, lastCallAt: null, byModel: {}, byScope: {}, bySkill: {} },
      },
    };

    dashboard.renderMainPanel(projectPath);
    const html = getElement('mainPanel').innerHTML;
    expect(html).toContain('<option value="deepseek/deepseek-reasoner" selected>');
    expect(html).not.toContain('<option value="__custom__" selected>');
    expect(html).toContain('class="config-input cfg_model_custom" value=""');
    expect(html).toContain('display:none;');
  });

});
