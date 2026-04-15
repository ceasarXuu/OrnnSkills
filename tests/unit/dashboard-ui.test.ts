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
      '\n;globalThis.__dashboardTest = { state, init, switchLang, selectProject, selectMainTab, renderMainPanel, safeRenderMainPanel, buildActivityRows, copyActivityDetail, openActivityDetail, renderCostPanel };'
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
        buildActivityRows: (projectPath: string) => Array<Record<string, any>>;
        copyActivityDetail: (projectPath: string, rowId: string) => Promise<void>;
        openActivityDetail: (projectPath: string, rowId: string) => Promise<void>;
        renderCostPanel: (projectPath: string) => string;
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

    const enHtml = getDashboardHtml(47432, 'en', 'test-build-id');
    expect(enHtml).toContain('Host');
    expect(enHtml).not.toContain('client runtime errors');
    expect(enHtml).toContain('client errors have been queued for reporting');
  });

  it('does not prefetch config dependencies during initial overview bootstrap', async () => {
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
    expect(fetchCalls).not.toContain('/api/providers/catalog');
    expect(fetchCalls.some((url) => url.includes('/provider-health'))).toBe(false);
    expect(fetchCalls.some((url) => url.endsWith('/config'))).toBe(false);
  });

  it('loads config dependencies lazily after switching to the config tab', async () => {
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
    expect(fetchCalls).toContain('/api/providers/catalog');
    expect(fetchCalls).toContain(`/api/projects/${encodedPath}/provider-health`);
    expect(fetchCalls).toContain(`/api/projects/${encodedPath}/config`);
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
    expect(html).toContain(
      'Calls, input tokens, output tokens, total tokens, average latency, latest call, and rollups by model, scope, and skill.'
    );
  });

  it('renders copy and detail actions for activity rows and copies readable detail text', async () => {
    const { dashboard, getElement, getCopiedText } = loadDashboardTestHarness();
    const projectPath = '/tmp/ornn-project';

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
        decisionEvents: [{
          id: 'evt-1',
          timestamp: '2026-04-10T05:23:00.000Z',
          tag: 'evaluation_result',
          runtime: 'codex',
          skillId: 'test-driven-development',
          status: 'no_patch_needed',
          windowId: 'scope-123',
          detail: '系统已经完成本轮分析。',
        }],
        agentUsage: { callCount: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0, durationMsTotal: 0, avgDurationMs: 0, lastCallAt: null, byModel: {}, byScope: {}, bySkill: {} },
      },
    };

    dashboard.renderMainPanel(projectPath);
    const html = getElement('mainPanel').innerHTML;
    expect(html).toContain('复制');
    expect(html).toContain('查看详情');

    await dashboard.copyActivityDetail(projectPath, 'decision:evt-1');
    expect(getCopiedText()).toContain('test-driven-development');
    expect(getCopiedText()).toContain('scope-123');

    await dashboard.openActivityDetail(projectPath, 'decision:evt-1');
    expect(getElement('eventModalContent').textContent).toContain('系统已经完成本轮分析。');
  });

  it('renders clickable skill cells in activity rows that open the skill modal', () => {
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
        decisionEvents: [{
          id: 'evt-click-skill-1',
          timestamp: '2026-04-10T05:23:00.000Z',
          tag: 'evaluation_result',
          runtime: 'codex',
          skillId: 'test-driven-development',
          status: 'no_patch_needed',
          windowId: 'scope-click-skill-1',
          detail: 'done',
        }],
        agentUsage: { callCount: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0, durationMsTotal: 0, avgDurationMs: 0, lastCallAt: null, byModel: {}, byScope: {}, bySkill: {} },
      },
    };

    dashboard.renderMainPanel(projectPath);
    const html = getElement('mainPanel').innerHTML;
    expect(html).toContain("onclick=\"viewSkill('/tmp/ornn-project','test-driven-development','codex');event.stopPropagation()\"");
    expect(html).toContain('activity-skill-link');
  });

  it('backfills skill_called scope ids from related decision events on the same trace', () => {
    const { dashboard } = loadDashboardTestHarness();
    const projectPath = '/tmp/ornn-project';

    dashboard.state.projectData = {
      [projectPath]: {
        daemon: {},
        skills: [{ skillId: 'test-driven-development', runtime: 'codex' }],
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
        decisionEvents: [{
          id: 'evt-1',
          timestamp: '2026-04-10T05:23:01.000Z',
          tag: 'evaluation_result',
          traceId: 'trace-1',
          sessionId: 'session-1',
          runtime: 'codex',
          skillId: 'test-driven-development',
          status: 'no_patch_needed',
          windowId: 'scope-trace-1',
          detail: 'same trace scope',
        }],
        agentUsage: { callCount: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0, durationMsTotal: 0, avgDurationMs: 0, lastCallAt: null, byModel: {}, byScope: {}, bySkill: {} },
      },
    };

    const rows = dashboard.buildActivityRows(projectPath);
    const traceRow = rows.find((row) => row.tag === 'skill_observed');
    expect(traceRow?.scopeId).toBe('scope-trace-1');
  });

  it('renders user-friendly analysis failure detail while preserving technical info in the modal', async () => {
    const { dashboard, getElement } = loadDashboardTestHarness({}, { lang: 'zh' });
    const projectPath = '/tmp/ornn-project';

    dashboard.state.selectedMainTab = 'activity';
    dashboard.state.projectData = {
      [projectPath]: {
        daemon: {},
        skills: [{ skillId: 'vercel-react-best-practices', runtime: 'codex' }],
        traceStats: { total: 1, byRuntime: { codex: 1 }, byStatus: { failed: 1 }, byEventType: { status: 1 } },
        recentTraces: [],
        decisionEvents: [{
          id: 'evt-failure',
          timestamp: '2026-04-10T05:23:01.000Z',
          tag: 'analysis_failed',
          traceId: 'trace-failed-1',
          sessionId: 'session-failed-1',
          runtime: 'codex',
          skillId: 'vercel-react-best-practices',
          status: 'failed',
          windowId: 'scope-failed-1',
          detail: 'Empty content in LLM response',
          reason: 'invalid_analysis_json',
        }],
        agentUsage: { callCount: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0, durationMsTotal: 0, avgDurationMs: 0, lastCallAt: null, byModel: {}, byScope: {}, bySkill: {} },
      },
    };

    dashboard.state.activityTagFilter = 'stability_feedback';
    dashboard.renderMainPanel(projectPath);
    const html = getElement('mainPanel').innerHTML;
    expect(html).toContain('模型返回了内容，但格式不符合系统要求');
    expect(html).not.toContain('Empty content in LLM response');

    await dashboard.openActivityDetail(projectPath, 'decision:evt-failure');
    const detail = getElement('eventModalContent').textContent;
    expect(detail).toContain('失败原因: 模型返回了内容，但格式不符合系统要求');
    expect(detail).toContain('对结果的影响: 这更像是分析链路的输出格式异常');
    expect(detail).toContain('建议动作: 建议保留这次原始返回并继续观察');
    expect(detail).toContain('原始技术信息: invalid_analysis_json | Empty content in LLM response');
  });

  it('shows raw model response excerpts in analysis failure detail when parsing fails', async () => {
    const { dashboard, getElement } = loadDashboardTestHarness({}, { lang: 'zh' });
    const projectPath = '/tmp/ornn-project';

    dashboard.state.selectedMainTab = 'activity';
    dashboard.state.projectData = {
      [projectPath]: {
        daemon: {},
        skills: [{ skillId: 'systematic-debugging', runtime: 'codex' }],
        traceStats: { total: 1, byRuntime: { codex: 1 }, byStatus: { failed: 1 }, byEventType: { status: 1 } },
        recentTraces: [],
        decisionEvents: [{
          id: 'evt-failure-raw',
          timestamp: '2026-04-10T05:23:01.000Z',
          tag: 'analysis_failed',
          traceId: 'trace-failed-raw-1',
          sessionId: 'session-failed-raw-1',
          runtime: 'codex',
          skillId: 'systematic-debugging',
          status: 'failed',
          windowId: 'scope-failed-raw-1',
          detail: '模型返回了内容，但格式不符合系统要求，所以这轮分析结果无法解析。',
          reason: 'invalid_analysis_json',
          evidence: {
            rawEvidence: 'invalid_analysis_json\nRaw model response excerpt:\n先说明一下：{bad json}\n最终输出如下：not-json',
          },
        }],
        agentUsage: { callCount: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0, durationMsTotal: 0, avgDurationMs: 0, lastCallAt: null, byModel: {}, byScope: {}, bySkill: {} },
      },
    };

    dashboard.buildActivityRows(projectPath);
    await dashboard.openActivityDetail(projectPath, 'decision:evt-failure-raw');
    const detail = getElement('eventModalContent').textContent;
    expect(detail).toContain('Raw model response excerpt');
    expect(detail).toContain('先说明一下：{bad json}');
  });

  it('filters out unknown skill refs such as repo-x from the business activity table', () => {
    const { dashboard } = loadDashboardTestHarness();
    const projectPath = '/tmp/ornn-project';

    dashboard.state.projectData = {
      [projectPath]: {
        daemon: {},
        skills: [{ skillId: 'test-driven-development', runtime: 'codex' }],
        traceStats: { total: 1, byRuntime: { codex: 1 }, byStatus: { success: 1 }, byEventType: { tool_call: 1 } },
        recentTraces: [{
          trace_id: 'trace-1',
          session_id: 'session-1',
          runtime: 'codex',
          timestamp: '2026-04-10T05:23:00.000Z',
          event_type: 'tool_call',
          skill_refs: ['repo-x'],
          status: 'success',
        }],
        decisionEvents: [],
        agentUsage: { callCount: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0, durationMsTotal: 0, avgDurationMs: 0, lastCallAt: null, byModel: {}, byScope: {}, bySkill: {} },
      },
    };

    const rows = dashboard.buildActivityRows(projectPath);
    expect(rows.find((row) => row.skillId === 'repo-x')).toBeUndefined();
  });

  it('normalizes legacy skill_evaluation events into localized evaluation rows', () => {
    const { dashboard } = loadDashboardTestHarness({}, { lang: 'zh' });
    const projectPath = '/tmp/ornn-project';

    dashboard.state.projectData = {
      [projectPath]: {
        daemon: {},
        skills: [{ skillId: 'test-driven-development', runtime: 'codex' }],
        traceStats: { total: 0, byRuntime: {}, byStatus: {}, byEventType: {} },
        recentTraces: [],
        decisionEvents: [{
          id: 'legacy-eval-1',
          timestamp: '2026-04-10T05:23:00.000Z',
          tag: 'skill_evaluation',
          runtime: 'codex',
          skillId: 'test-driven-development',
          status: 'needs_patch',
          windowId: 'scope-legacy-1',
          detail: '需要补丁',
        }],
        agentUsage: { callCount: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0, durationMsTotal: 0, avgDurationMs: 0, lastCallAt: null, byModel: {}, byScope: {}, bySkill: {} },
      },
    };

    const rows = dashboard.buildActivityRows(projectPath);
    expect(rows[0]?.tag).toBe('analysis_concluded');
    expect(rows[0]?.detail).toContain('需要补丁');
  });

  it('renders localized patch_applied activity rows instead of raw event ids', () => {
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
        decisionEvents: [{
          id: 'patch-activity-1',
          timestamp: '2026-04-10T05:24:00.000Z',
          tag: 'patch_applied',
          runtime: 'codex',
          skillId: 'test-driven-development',
          status: 'success',
          windowId: 'scope-patch-1',
          changeType: 'add_fallback',
          linesAdded: 12,
          linesRemoved: 3,
        }],
        agentUsage: { callCount: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0, durationMsTotal: 0, avgDurationMs: 0, lastCallAt: null, byModel: {}, byScope: {}, bySkill: {} },
      },
    };

    dashboard.renderMainPanel(projectPath);
    const html = getElement('mainPanel').innerHTML;
    expect(html).toContain('优化已应用');
    expect(html).toContain('本轮优化已经写回');
    expect(html).toContain('add_fallback');
    expect(html).not.toContain('>patch_applied<');
  });

  it('renders activity timestamps as local full datetime instead of raw UTC slices', () => {
    const { dashboard, getElement } = loadDashboardTestHarness({}, { lang: 'zh' });
    const projectPath = '/tmp/ornn-project';
    const iso = '2026-04-10T00:05:06.000Z';
    const date = new Date(iso);
    const expectedLocalDatetime = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-') + ' ' + [
      String(date.getHours()).padStart(2, '0'),
      String(date.getMinutes()).padStart(2, '0'),
      String(date.getSeconds()).padStart(2, '0'),
    ].join(':');

    getElement('mainPanel');
    dashboard.state.selectedMainTab = 'activity';
    dashboard.state.selectedProjectId = projectPath;
    dashboard.state.projectData = {
      [projectPath]: {
        daemon: {},
        skills: [{ skillId: 'test-driven-development', runtime: 'codex' }],
        traceStats: { total: 0, byRuntime: {}, byStatus: {}, byEventType: {} },
        recentTraces: [],
        decisionEvents: [{
          id: 'evt-local-time-1',
          timestamp: iso,
          tag: 'evaluation_result',
          runtime: 'codex',
          skillId: 'test-driven-development',
          status: 'no_patch_needed',
          windowId: 'scope-local-time-1',
          detail: 'done',
        }],
        agentUsage: { callCount: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0, durationMsTotal: 0, avgDurationMs: 0, lastCallAt: null, byModel: {}, byScope: {}, bySkill: {} },
      },
    };

    dashboard.renderMainPanel(projectPath);
    const html = getElement('mainPanel').innerHTML;
    expect(html).toContain(expectedLocalDatetime);
    expect(html).not.toContain('>2026-04-10T00:05:06.000Z<');
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

  it('keeps explanation-only skill_feedback out of the main business timeline', () => {
    const { dashboard } = loadDashboardTestHarness({
      'ornn-dashboard-activity-columns': JSON.stringify({ detail: 640 }),
    });
    const projectPath = '/tmp/ornn-project';

    dashboard.state.projectData = {
      [projectPath]: {
        daemon: {},
        skills: [{ skillId: 'test-driven-development', runtime: 'codex' }],
        traceStats: { total: 0, byRuntime: {}, byStatus: {}, byEventType: {} },
        recentTraces: [],
        decisionEvents: [
          {
            id: 'evt-1',
            timestamp: '2026-04-10T05:23:00.000Z',
            tag: 'skill_feedback',
            runtime: 'codex',
            skillId: 'test-driven-development',
            status: 'no_patch_needed',
            windowId: 'scope-1',
            detail: 'same conclusion',
          },
          {
            id: 'evt-2',
            timestamp: '2026-04-10T05:23:05.000Z',
            tag: 'skill_feedback',
            runtime: 'codex',
            skillId: 'test-driven-development',
            status: 'no_patch_needed',
            windowId: 'scope-1',
            detail: 'same conclusion',
          },
          {
            id: 'evt-3',
            timestamp: '2026-04-10T05:23:25.000Z',
            tag: 'skill_feedback',
            runtime: 'codex',
            skillId: 'test-driven-development',
            status: 'no_patch_needed',
            windowId: 'scope-1',
            detail: 'same conclusion',
          },
        ],
        agentUsage: { callCount: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0, durationMsTotal: 0, avgDurationMs: 0, lastCallAt: null, byModel: {}, byScope: {}, bySkill: {} },
      },
    };

    const rows = dashboard.buildActivityRows(projectPath);
    expect(rows.filter((row) => row.tag === 'skill_feedback')).toHaveLength(0);
  });

  it('merges skill feedback into the analysis conclusion row instead of rendering it separately', () => {
    const { dashboard } = loadDashboardTestHarness({}, { lang: 'zh' });
    const projectPath = '/tmp/ornn-project';

    dashboard.state.projectData = {
      [projectPath]: {
        daemon: {},
        skills: [{ skillId: 'test-driven-development', runtime: 'codex' }],
        traceStats: { total: 0, byRuntime: {}, byStatus: {}, byEventType: {} },
        recentTraces: [],
        decisionEvents: [
          {
            id: 'evt-eval-1',
            timestamp: '2026-04-10T05:23:00.000Z',
            tag: 'evaluation_result',
            runtime: 'codex',
            skillId: 'test-driven-development',
            status: 'no_patch_needed',
            windowId: 'scope-merge-1',
            detail: '窗口分析结论：当前无需修改。',
          },
          {
            id: 'evt-feedback-1',
            timestamp: '2026-04-10T05:23:01.000Z',
            tag: 'skill_feedback',
            runtime: 'codex',
            skillId: 'test-driven-development',
            status: 'no_patch_needed',
            windowId: 'scope-merge-1',
            detail: '这次调用没有观察到稳定的设计缺陷。',
          },
        ],
        agentUsage: { callCount: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0, durationMsTotal: 0, avgDurationMs: 0, lastCallAt: null, byModel: {}, byScope: {}, bySkill: {} },
      },
    };

    const rows = dashboard.buildActivityRows(projectPath);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.tag).toBe('analysis_concluded');
    expect(rows[0]?.detail).toContain('窗口分析结论');
    expect(rows[0]?.detail).toContain('这次调用没有观察到稳定的设计缺陷');
  });

  it('shows a core-flow interruption row while keeping analysis_failed in stability feedback', () => {
    const { dashboard, getElement } = loadDashboardTestHarness({}, { lang: 'zh' });
    const projectPath = '/tmp/ornn-project';

    getElement('mainPanel');
    dashboard.state.selectedMainTab = 'activity';
    dashboard.state.selectedProjectId = projectPath;
    dashboard.state.projectData = {
      [projectPath]: {
        daemon: {},
        skills: [{ skillId: 'vercel-react-best-practices', runtime: 'codex' }],
        traceStats: { total: 0, byRuntime: {}, byStatus: {}, byEventType: {} },
        recentTraces: [],
        decisionEvents: [{
          id: 'evt-failure-core-filter',
          timestamp: '2026-04-10T05:23:01.000Z',
          tag: 'analysis_failed',
          traceId: 'trace-failed-1',
          sessionId: 'session-failed-1',
          runtime: 'codex',
          skillId: 'vercel-react-best-practices',
          status: 'failed',
          windowId: 'scope-failed-1',
          detail: 'invalid_analysis_json',
          reason: 'invalid_analysis_json',
        }],
        agentUsage: { callCount: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0, durationMsTotal: 0, avgDurationMs: 0, lastCallAt: null, byModel: {}, byScope: {}, bySkill: {} },
      },
    };

    dashboard.renderMainPanel(projectPath);
    const html = getElement('mainPanel').innerHTML;
    expect(html).toContain('核心流程');
    expect(html).toContain('分析中断');
    expect(html).toContain('格式不符合系统要求');
    expect(html).not.toContain('analysis_failed');

    dashboard.state.activityTagFilter = 'stability_feedback';
    dashboard.renderMainPanel(projectPath);
    const stabilityHtml = getElement('mainPanel').innerHTML;
    expect(stabilityHtml).toContain('分析链路异常');
  });

  it('uses localized business statuses instead of raw internal status enums in activity rows', () => {
    const { dashboard } = loadDashboardTestHarness({}, { lang: 'zh' });
    const projectPath = '/tmp/ornn-project';

    dashboard.state.projectData = {
      [projectPath]: {
        daemon: {},
        skills: [{ skillId: 'test-driven-development', runtime: 'codex' }],
        traceStats: { total: 0, byRuntime: {}, byStatus: {}, byEventType: {} },
        recentTraces: [],
        decisionEvents: [{
          id: 'evt-analysis-start-1',
          timestamp: '2026-04-10T05:23:00.000Z',
          tag: 'analysis_requested',
          runtime: 'codex',
          skillId: 'test-driven-development',
          status: 'episode_ready',
          windowId: 'scope-status-1',
          detail: '时机探测已通过，开始深度分析本次调用窗口。',
        }],
        agentUsage: { callCount: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0, durationMsTotal: 0, avgDurationMs: 0, lastCallAt: null, byModel: {}, byScope: {}, bySkill: {} },
      },
    };

    const rows = dashboard.buildActivityRows(projectPath);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.tag).toBe('analysis_started');
    expect(rows[0]?.status).toBe('分析中');
    expect(rows[0]?.status).not.toBe('episode_ready');
  });

  it('prefers canonical business fields from backend instead of inferring from raw event tags', () => {
    const { dashboard } = loadDashboardTestHarness({}, { lang: 'zh' });
    const projectPath = '/tmp/ornn-project';

    dashboard.state.projectData = {
      [projectPath]: {
        daemon: {},
        skills: [{ skillId: 'test-driven-development', runtime: 'codex' }],
        traceStats: { total: 0, byRuntime: {}, byStatus: {}, byEventType: {} },
        recentTraces: [],
        decisionEvents: [{
          id: 'evt-canonical-1',
          timestamp: '2026-04-10T05:23:00.000Z',
          tag: 'opaque_internal_event',
          runtime: 'codex',
          skillId: 'test-driven-development',
          status: 'completed',
          windowId: 'scope-canonical-1',
          detail: 'raw detail should not drive UI semantics',
          judgment: '后端已经直接给出业务结论。',
          nextAction: '继续观察后续调用窗口。',
          businessCategory: 'core_flow',
          businessTag: 'analysis_concluded',
        }],
        agentUsage: { callCount: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0, durationMsTotal: 0, avgDurationMs: 0, lastCallAt: null, byModel: {}, byScope: {}, bySkill: {} },
      },
    };

    const rows = dashboard.buildActivityRows(projectPath);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.tag).toBe('analysis_concluded');
    expect(rows[0]?.category).toBe('core_flow');
    expect(rows[0]?.detail).toContain('后端已经直接给出业务结论');
    expect(rows[0]?.nextAction).toContain('继续观察后续调用窗口');
  });

  it('uses persisted activity column widths when rendering the table', () => {
    const { dashboard, getElement } = loadDashboardTestHarness({
      'ornn-dashboard-activity-columns': JSON.stringify({ detail: 640 }),
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
    expect(html).toContain('.ornn/config/settings.toml');
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
    expect(html).toContain('type="text"');
    expect(html).toContain('value="plain-visible-key"');
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

  it('localizes activity detail labels and host sync help in Chinese', async () => {
    const { dashboard, getElement, getCopiedText } = loadDashboardTestHarness({}, { lang: 'zh' });
    const projectPath = '/tmp/ornn-project';

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
        decisionEvents: [{
          id: 'evt-zh-detail',
          timestamp: '2026-04-10T05:23:00.000Z',
          tag: 'evaluation_result',
          runtime: 'codex',
          skillId: 'test-driven-development',
          sessionId: 'session-zh',
          status: 'no_patch_needed',
          windowId: 'scope-zh',
          detail: '系统已经完成本轮分析。',
        }],
        agentUsage: { callCount: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0, durationMsTotal: 0, avgDurationMs: 0, lastCallAt: null, byModel: {}, byScope: {}, bySkill: {} },
      },
    };

    dashboard.renderMainPanel(projectPath);
    await dashboard.copyActivityDetail(projectPath, 'decision:evt-zh-detail');
    expect(getCopiedText()).toContain('技能: test-driven-development');
    expect(getCopiedText()).toContain('会话 ID: session-zh');

    dashboard.state.selectedMainTab = 'config';
    dashboard.state.configByProject = {
      [projectPath]: {
        autoOptimize: true,
        userConfirm: false,
        runtimeSync: true,
        defaultProvider: '',
        logLevel: 'info',
        providers: [],
      },
    };
    dashboard.renderMainPanel(projectPath);
    const html = getElement('mainPanel').innerHTML;
    expect(html).toContain('.ornn/config/settings.toml');
    expect(html).toContain('暂无模型服务');
    expect(html).toContain('只启用其中一个默认模型服务');
    expect(html).not.toContain('cfg_env');
    expect(html).not.toContain('tracking.auto_optimize');
    expect(html).not.toContain('tracking.user_confirm');
    expect(html).not.toContain('tracking.runtime_sync');
    expect(html).not.toContain('暂无 providers');
  });

  it('localizes daemon state activity summaries in both languages', () => {
    const projectPath = '/tmp/ornn-project';
    const zhHarness = loadDashboardTestHarness({}, { lang: 'zh' });
    zhHarness.dashboard.state.projectData = {
      [projectPath]: {
        daemon: {},
        skills: [],
        traceStats: { total: 0, byRuntime: {}, byStatus: {}, byEventType: {} },
        recentTraces: [],
        decisionEvents: [{
          id: 'daemon-zh',
          timestamp: '2026-04-10T05:23:00.000Z',
          tag: 'daemon_state',
          runtime: 'codex',
          status: 'started',
        }],
        agentUsage: { callCount: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0, durationMsTotal: 0, avgDurationMs: 0, lastCallAt: null, byModel: {}, byScope: {}, bySkill: {} },
      },
    };
    const zhRows = zhHarness.dashboard.buildActivityRows(projectPath);
    expect(zhRows[0]?.detail).toContain('守护进程已启动');

    const enHarness = loadDashboardTestHarness({}, { lang: 'en' });
    enHarness.dashboard.state.projectData = {
      [projectPath]: {
        daemon: {},
        skills: [],
        traceStats: { total: 0, byRuntime: {}, byStatus: {}, byEventType: {} },
        recentTraces: [],
        decisionEvents: [{
          id: 'daemon-en',
          timestamp: '2026-04-10T05:23:00.000Z',
          tag: 'daemon_state',
          runtime: 'codex',
          status: 'stopped',
        }],
        agentUsage: { callCount: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0, durationMsTotal: 0, avgDurationMs: 0, lastCallAt: null, byModel: {}, byScope: {}, bySkill: {} },
      },
    };
    const enRows = enHarness.dashboard.buildActivityRows(projectPath);
    expect(enRows[0]?.detail).toContain('Daemon stopped');
  });

  it('falls back to localized zh activity detail when a historical analysis conclusion contains a long english explanation', () => {
    const { dashboard } = loadDashboardTestHarness({}, { lang: 'zh' });
    const projectPath = '/tmp/ornn-project';

    dashboard.state.projectData = {
      [projectPath]: {
        daemon: {},
        skills: [{ skillId: 'systematic-debugging', runtime: 'codex' }],
        traceStats: { total: 0, byRuntime: {}, byStatus: {}, byEventType: {} },
        recentTraces: [],
        decisionEvents: [{
          id: 'evt-english-history',
          timestamp: '2026-04-15T12:28:28.360Z',
          tag: 'evaluation_result',
          runtime: 'codex',
          skillId: 'systematic-debugging',
          sessionId: 'session-history',
          status: 'no_patch_needed',
          windowId: 'scope-history',
          detail: "窗口分析结论：The skill was correctly invoked and followed, with the assistant performing root cause investigation as per the skill's guidelines, showing no design flaws or optimization needs.",
        }],
        agentUsage: { callCount: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0, durationMsTotal: 0, avgDurationMs: 0, lastCallAt: null, byModel: {}, byScope: {}, bySkill: {} },
      },
    };

    const rows = dashboard.buildActivityRows(projectPath);
    expect(rows[0]?.detail).toContain('窗口分析认为当前技能调用符合预期，暂时无需修改。');
    expect(rows[0]?.detail).not.toContain('The skill was correctly invoked');
  });
});
