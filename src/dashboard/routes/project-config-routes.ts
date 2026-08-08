import {
  checkProvidersConnectivity,
  readDashboardConfig,
  resolveDashboardPromptSources,
  resolveDashboardPromptOverrides,
  writeDashboardConfig,
} from '../../config/manager.js';
import { resolveLLMSafetyOptions } from '../../llm/request-guard.js';

interface RouteLogger {
  info(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

interface ProviderHealthSummary {
  level: 'ok' | 'warn';
  code: 'ok' | 'provider_not_configured' | 'provider_connectivity_failed';
  message: string;
  checkedAt: string;
  results: Awaited<ReturnType<typeof checkProvidersConnectivity>>;
}

interface ProjectConfigRouteContext {
  subPath: string;
  method: string;
  projectPath: string;
  json: (data: unknown, status?: number) => void;
  parseBody: () => Promise<unknown>;
  getProviderHealthSummary: (projectPath?: string) => Promise<ProviderHealthSummary>;
  logger: RouteLogger;
}

export async function handleProjectConfigRoutes(
  context: ProjectConfigRouteContext
): Promise<boolean> {
  const { subPath, method, projectPath, json, parseBody, getProviderHealthSummary, logger } = context;

  if (subPath === '/config' && method === 'GET') {
    const started = Date.now();
    const config = await readDashboardConfig(projectPath);
    logger.info('Dashboard config loaded', {
      projectPath,
      providerCount: config.providers.length,
      durationMs: Date.now() - started,
    });
    json({ config });
    return true;
  }

  if (subPath === '/config' && method === 'POST') {
    const started = Date.now();
    const body = (await parseBody()) as {
      config?: {
        autoOptimize?: boolean;
        userConfirm?: boolean;
        runtimeSync?: boolean;
        evolutionFrozen?: boolean;
        llmSafety?: {
          enabled?: boolean;
          windowMs?: number;
          maxRequestsPerWindow?: number;
          maxConcurrentRequests?: number;
          maxEstimatedTokensPerWindow?: number;
        };
        promptSources?: {
          skillCallAnalyzer?: 'built_in' | 'custom';
          decisionExplainer?: 'built_in' | 'custom';
          readinessProbe?: 'built_in' | 'custom';
        };
        promptOverrides?: {
          skillCallAnalyzer?: string;
          decisionExplainer?: string;
          readinessProbe?: string;
        };
        defaultProvider?: string;
        logLevel?: string;
        providers?: Array<{
          provider: string;
          modelName: string;
          apiKeyEnvVar: string;
          apiKey?: string;
        }>;
      };
    };

    if (!body.config) {
      json({ ok: false, error: 'config is required' }, 400);
      return true;
    }

    const normalizedSafety = resolveLLMSafetyOptions(body.config.llmSafety);
    const normalizedPromptSources = resolveDashboardPromptSources(body.config.promptSources);
    const normalizedPromptOverrides = resolveDashboardPromptOverrides(body.config.promptOverrides);
    await writeDashboardConfig(undefined, {
      autoOptimize: body.config.autoOptimize ?? true,
      userConfirm: body.config.userConfirm ?? false,
      runtimeSync: body.config.runtimeSync ?? true,
      evolutionFrozen: body.config.evolutionFrozen ?? true,
      llmSafety: normalizedSafety,
      promptSources: normalizedPromptSources,
      promptOverrides: normalizedPromptOverrides,
      defaultProvider: body.config.defaultProvider ?? '',
      logLevel: body.config.logLevel ?? 'info',
      providers: body.config.providers ?? [],
    });
    logger.info('Dashboard config saved', {
      projectPath,
      providerCount: (body.config.providers ?? []).length,
      autoOptimize: body.config.autoOptimize ?? true,
      userConfirm: body.config.userConfirm ?? false,
      runtimeSync: body.config.runtimeSync ?? true,
      llmSafety: normalizedSafety,
      promptSources: normalizedPromptSources,
      promptOverrideCount: Object.values(normalizedPromptOverrides).filter((value) => value.length > 0).length,
      defaultProvider: body.config.defaultProvider ?? '',
      logLevel: body.config.logLevel ?? 'info',
      durationMs: Date.now() - started,
    });
    json({ ok: true });
    return true;
  }

  if (subPath === '/config/providers/connectivity' && method === 'POST') {
    const started = Date.now();
    const body = (await parseBody()) as {
      providers?: Array<{
        provider: string;
        modelName: string;
        apiKeyEnvVar: string;
        apiKey?: string;
      }>;
    };
    const results = await checkProvidersConnectivity(undefined, body.providers);
    const failedCount = results.filter((item) => !item.ok).length;
    logger.info('Dashboard provider connectivity checked', {
      projectPath,
      providerCount: results.length,
      failedCount,
      durationMs: Date.now() - started,
    });
    json({ results });
    return true;
  }

  if (subPath === '/provider-health' && method === 'GET') {
    const started = Date.now();
    const health = await getProviderHealthSummary(undefined);
    logger.info('Dashboard provider health fetched', {
      projectPath,
      level: health.level,
      code: health.code,
      durationMs: Date.now() - started,
    });
    json({ health });
    return true;
  }

  return false;
}
