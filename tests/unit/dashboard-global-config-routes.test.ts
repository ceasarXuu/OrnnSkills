import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  readDashboardConfig: vi.fn(),
  writeDashboardConfig: vi.fn(),
  checkProvidersConnectivity: vi.fn(),
  resolveDashboardPromptOverrides: vi.fn(),
  resolveDashboardPromptSources: vi.fn(),
  getLiteLLMCatalog: vi.fn(),
  resolveLLMSafetyOptions: vi.fn(),
}));

vi.mock('../../src/config/manager.js', () => ({
  readDashboardConfig: mocks.readDashboardConfig,
  writeDashboardConfig: mocks.writeDashboardConfig,
  checkProvidersConnectivity: mocks.checkProvidersConnectivity,
  resolveDashboardPromptOverrides: mocks.resolveDashboardPromptOverrides,
  resolveDashboardPromptSources: mocks.resolveDashboardPromptSources,
}));

vi.mock('../../src/config/litellm-catalog.js', () => ({
  getLiteLLMCatalog: mocks.getLiteLLMCatalog,
}));

vi.mock('../../src/llm/request-guard.js', () => ({
  resolveLLMSafetyOptions: mocks.resolveLLMSafetyOptions,
}));

describe('dashboard global config routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveDashboardPromptOverrides.mockImplementation((value) => ({
      skillCallAnalyzer: typeof value?.skillCallAnalyzer === 'string' ? value.skillCallAnalyzer.trim() : '',
      decisionExplainer: typeof value?.decisionExplainer === 'string' ? value.decisionExplainer.trim() : '',
      readinessProbe: typeof value?.readinessProbe === 'string' ? value.readinessProbe.trim() : '',
    }));
    mocks.resolveDashboardPromptSources.mockImplementation((value) => ({
      skillCallAnalyzer: value?.skillCallAnalyzer === 'custom' ? 'custom' : 'built_in',
      decisionExplainer: value?.decisionExplainer === 'custom' ? 'custom' : 'built_in',
      readinessProbe: value?.readinessProbe === 'custom' ? 'custom' : 'built_in',
    }));
    mocks.resolveLLMSafetyOptions.mockImplementation((value) => ({
      enabled: value?.enabled ?? true,
      windowMs: value?.windowMs ?? 60000,
      maxRequestsPerWindow: value?.maxRequestsPerWindow ?? 12,
      maxConcurrentRequests: value?.maxConcurrentRequests ?? 2,
      maxEstimatedTokensPerWindow: value?.maxEstimatedTokensPerWindow ?? 24000,
    }));
  });

  it('returns false for unrelated routes', async () => {
    const { handleGlobalConfigRoutes } = await import('../../src/dashboard/routes/global-config-routes.js');

    const handled = await handleGlobalConfigRoutes({
      path: '/api/projects',
      method: 'GET',
      url: new URL('http://127.0.0.1/api/projects'),
      json: vi.fn(),
      parseBody: vi.fn(),
      getProviderHealthSummary: vi.fn(),
      logger: { info: vi.fn(), error: vi.fn() },
    });

    expect(handled).toBe(false);
  });

  it('handles GET /api/config as a global config endpoint', async () => {
    const { handleGlobalConfigRoutes } = await import('../../src/dashboard/routes/global-config-routes.js');
    const json = vi.fn();
    mocks.readDashboardConfig.mockResolvedValue({
      providers: [{ provider: 'openai', modelName: 'gpt-4.1', apiKeyEnvVar: 'OPENAI_API_KEY' }],
    });

    const handled = await handleGlobalConfigRoutes({
      path: '/api/config',
      method: 'GET',
      url: new URL('http://127.0.0.1/api/config?projectPath=%2Ftmp%2Fdemo'),
      json,
      parseBody: vi.fn(),
      getProviderHealthSummary: vi.fn(),
      logger: { info: vi.fn(), error: vi.fn() },
    });

    expect(handled).toBe(true);
    expect(mocks.readDashboardConfig).toHaveBeenCalledWith(undefined);
    expect(json).toHaveBeenCalledWith({
      config: {
        providers: [{ provider: 'openai', modelName: 'gpt-4.1', apiKeyEnvVar: 'OPENAI_API_KEY' }],
      },
    });
  });

  it('handles GET /api/providers/catalog', async () => {
    const { handleGlobalConfigRoutes } = await import('../../src/dashboard/routes/global-config-routes.js');
    const json = vi.fn();
    const providers = [{ provider: 'openai', models: ['gpt-4.1'] }];
    mocks.getLiteLLMCatalog.mockResolvedValue(providers);

    const handled = await handleGlobalConfigRoutes({
      path: '/api/providers/catalog',
      method: 'GET',
      url: new URL('http://127.0.0.1/api/providers/catalog'),
      json,
      parseBody: vi.fn(),
      getProviderHealthSummary: vi.fn(),
      logger: { info: vi.fn(), error: vi.fn() },
    });

    expect(handled).toBe(true);
    expect(mocks.getLiteLLMCatalog).toHaveBeenCalledTimes(1);
    expect(json).toHaveBeenCalledWith({ providers, source: 'litellm' });
  });

  it('handles POST /api/config and writes normalized settings', async () => {
    const { handleGlobalConfigRoutes } = await import('../../src/dashboard/routes/global-config-routes.js');
    const json = vi.fn();
    const normalizedSafety = {
      enabled: true,
      windowMs: 45000,
      maxRequestsPerWindow: 7,
      maxConcurrentRequests: 1,
      maxEstimatedTokensPerWindow: 16000,
    };
    const normalizedPromptOverrides = {
      skillCallAnalyzer: 'You are a strict analyzer.',
      decisionExplainer: 'You are a concise explainer.',
      readinessProbe: 'You are a cautious readiness probe.',
    };
    const normalizedPromptSources = {
      skillCallAnalyzer: 'built_in',
      decisionExplainer: 'custom',
      readinessProbe: 'custom',
    };
    mocks.resolveLLMSafetyOptions.mockReturnValue(normalizedSafety);
    mocks.resolveDashboardPromptOverrides.mockReturnValue(normalizedPromptOverrides);
    mocks.resolveDashboardPromptSources.mockReturnValue(normalizedPromptSources);

    const handled = await handleGlobalConfigRoutes({
      path: '/api/config',
      method: 'POST',
      url: new URL('http://127.0.0.1/api/config'),
      json,
      parseBody: vi.fn().mockResolvedValue({
        config: {
          autoOptimize: true,
          userConfirm: false,
          runtimeSync: true,
          defaultProvider: 'deepseek',
          logLevel: 'info',
          llmSafety: { enabled: true, windowMs: 45000 },
          promptSources: {
            skillCallAnalyzer: 'built_in',
            decisionExplainer: 'custom',
            readinessProbe: 'custom',
          },
          promptOverrides: {
            skillCallAnalyzer: ' You are a strict analyzer. ',
            decisionExplainer: 'You are a concise explainer.',
            readinessProbe: 'You are a cautious readiness probe.',
          },
          providers: [
            {
              provider: 'deepseek',
              modelName: 'deepseek/deepseek-chat',
              apiKeyEnvVar: 'DEEPSEEK_API_KEY',
            },
          ],
        },
      }),
      getProviderHealthSummary: vi.fn(),
      logger: { info: vi.fn(), error: vi.fn() },
    });

    expect(handled).toBe(true);
    expect(mocks.writeDashboardConfig).toHaveBeenCalledWith(undefined, {
      autoOptimize: true,
      userConfirm: false,
      runtimeSync: true,
      evolutionFrozen: true,
      llmSafety: normalizedSafety,
      promptSources: normalizedPromptSources,
      promptOverrides: normalizedPromptOverrides,
      defaultProvider: 'deepseek',
      logLevel: 'info',
      providers: [
        {
          provider: 'deepseek',
          modelName: 'deepseek/deepseek-chat',
          apiKeyEnvVar: 'DEEPSEEK_API_KEY',
        },
      ],
    });
    expect(json).toHaveBeenCalledWith({ ok: true });
  });

  it('handles POST /api/config/providers/connectivity', async () => {
    const { handleGlobalConfigRoutes } = await import('../../src/dashboard/routes/global-config-routes.js');
    const json = vi.fn();
    const providers = [{ provider: 'openai', modelName: 'gpt-4.1', apiKeyEnvVar: 'OPENAI_API_KEY' }];
    const results = [{ provider: 'openai', ok: true }];
    mocks.checkProvidersConnectivity.mockResolvedValue(results);

    const handled = await handleGlobalConfigRoutes({
      path: '/api/config/providers/connectivity',
      method: 'POST',
      url: new URL('http://127.0.0.1/api/config/providers/connectivity'),
      json,
      parseBody: vi.fn().mockResolvedValue({ providers }),
      getProviderHealthSummary: vi.fn(),
      logger: { info: vi.fn(), error: vi.fn() },
    });

    expect(handled).toBe(true);
    expect(mocks.checkProvidersConnectivity).toHaveBeenCalledWith(undefined, providers);
    expect(json).toHaveBeenCalledWith({ results });
  });

  it('handles GET /api/provider-health and forwards projectPath from the query string', async () => {
    const { handleGlobalConfigRoutes } = await import('../../src/dashboard/routes/global-config-routes.js');
    const json = vi.fn();
    const health = {
      level: 'ok',
      code: 'ok',
      message: 'All providers are healthy',
      checkedAt: '2026-04-17T00:00:00.000Z',
      results: [],
    };
    const getProviderHealthSummary = vi.fn().mockResolvedValue(health);

    const handled = await handleGlobalConfigRoutes({
      path: '/api/provider-health',
      method: 'GET',
      url: new URL('http://127.0.0.1/api/provider-health?projectPath=%2Ftmp%2Fdemo'),
      json,
      parseBody: vi.fn(),
      getProviderHealthSummary,
      logger: { info: vi.fn(), error: vi.fn() },
    });

    expect(handled).toBe(true);
    expect(getProviderHealthSummary).toHaveBeenCalledWith('/tmp/demo');
    expect(json).toHaveBeenCalledWith({ health });
  });
});
