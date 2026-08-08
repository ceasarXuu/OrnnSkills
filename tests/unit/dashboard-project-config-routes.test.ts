import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  readDashboardConfig: vi.fn(),
  writeDashboardConfig: vi.fn(),
  checkProvidersConnectivity: vi.fn(),
  resolveDashboardPromptOverrides: vi.fn(),
  resolveDashboardPromptSources: vi.fn(),
  resolveLLMSafetyOptions: vi.fn(),
}));

vi.mock('../../src/config/manager.js', () => ({
  readDashboardConfig: mocks.readDashboardConfig,
  writeDashboardConfig: mocks.writeDashboardConfig,
  checkProvidersConnectivity: mocks.checkProvidersConnectivity,
  resolveDashboardPromptOverrides: mocks.resolveDashboardPromptOverrides,
  resolveDashboardPromptSources: mocks.resolveDashboardPromptSources,
}));

vi.mock('../../src/llm/request-guard.js', () => ({
  resolveLLMSafetyOptions: mocks.resolveLLMSafetyOptions,
}));

describe('dashboard project config routes', () => {
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

  it('returns false for unrelated project routes', async () => {
    const { handleProjectConfigRoutes } = await import('../../src/dashboard/routes/project-config-routes.js');

    const handled = await handleProjectConfigRoutes({
      subPath: '/snapshot',
      method: 'GET',
      projectPath: '/tmp/demo',
      json: vi.fn(),
      parseBody: vi.fn(),
      getProviderHealthSummary: vi.fn(),
      logger: { info: vi.fn(), error: vi.fn() },
    });

    expect(handled).toBe(false);
  });

  it('handles GET /api/projects/:id/config with the project path', async () => {
    const { handleProjectConfigRoutes } = await import('../../src/dashboard/routes/project-config-routes.js');
    const json = vi.fn();
    mocks.readDashboardConfig.mockResolvedValue({
      providers: [{ provider: 'openai', modelName: 'gpt-4.1', apiKeyEnvVar: 'OPENAI_API_KEY' }],
    });

    const handled = await handleProjectConfigRoutes({
      subPath: '/config',
      method: 'GET',
      projectPath: '/tmp/demo',
      json,
      parseBody: vi.fn(),
      getProviderHealthSummary: vi.fn(),
      logger: { info: vi.fn(), error: vi.fn() },
    });

    expect(handled).toBe(true);
    expect(mocks.readDashboardConfig).toHaveBeenCalledWith('/tmp/demo');
    expect(json).toHaveBeenCalledWith({
      config: {
        providers: [{ provider: 'openai', modelName: 'gpt-4.1', apiKeyEnvVar: 'OPENAI_API_KEY' }],
      },
    });
  });

  it('handles POST /api/projects/:id/config using the shared dashboard config writer', async () => {
    const { handleProjectConfigRoutes } = await import('../../src/dashboard/routes/project-config-routes.js');
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

    const handled = await handleProjectConfigRoutes({
      subPath: '/config',
      method: 'POST',
      projectPath: '/tmp/demo',
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

  it('handles POST /api/projects/:id/config/providers/connectivity using the shared connectivity checker', async () => {
    const { handleProjectConfigRoutes } = await import('../../src/dashboard/routes/project-config-routes.js');
    const json = vi.fn();
    const providers = [{ provider: 'openai', modelName: 'gpt-4.1', apiKeyEnvVar: 'OPENAI_API_KEY' }];
    const results = [{ provider: 'openai', ok: true }];
    mocks.checkProvidersConnectivity.mockResolvedValue(results);

    const handled = await handleProjectConfigRoutes({
      subPath: '/config/providers/connectivity',
      method: 'POST',
      projectPath: '/tmp/demo',
      json,
      parseBody: vi.fn().mockResolvedValue({ providers }),
      getProviderHealthSummary: vi.fn(),
      logger: { info: vi.fn(), error: vi.fn() },
    });

    expect(handled).toBe(true);
    expect(mocks.checkProvidersConnectivity).toHaveBeenCalledWith(undefined, providers);
    expect(json).toHaveBeenCalledWith({ results });
  });

  it('handles GET /api/projects/:id/provider-health using the shared provider health summary', async () => {
    const { handleProjectConfigRoutes } = await import('../../src/dashboard/routes/project-config-routes.js');
    const json = vi.fn();
    const health = {
      level: 'ok',
      code: 'ok',
      message: 'All providers are healthy',
      checkedAt: '2026-04-17T00:00:00.000Z',
      results: [],
    };
    const getProviderHealthSummary = vi.fn().mockResolvedValue(health);

    const handled = await handleProjectConfigRoutes({
      subPath: '/provider-health',
      method: 'GET',
      projectPath: '/tmp/demo',
      json,
      parseBody: vi.fn(),
      getProviderHealthSummary,
      logger: { info: vi.fn(), error: vi.fn() },
    });

    expect(handled).toBe(true);
    expect(getProviderHealthSummary).toHaveBeenCalledWith(undefined);
    expect(json).toHaveBeenCalledWith({ health });
  });
});
