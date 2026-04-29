/**
 * Dashboard server — Provider health summary
 *
 * Extracted from server.ts to keep individual files under the 500-line policy.
 */
import { checkProvidersConnectivity, readDashboardConfig } from '../config/manager.js';
import { createChildLogger } from '../utils/logger.js';

const logger = createChildLogger('dashboard');

export interface ProviderHealthSummary {
  level: 'ok' | 'warn';
  code: 'ok' | 'provider_not_configured' | 'provider_connectivity_failed';
  message: string;
  checkedAt: string;
  results: Awaited<ReturnType<typeof checkProvidersConnectivity>>;
}

export async function getProviderHealthSummary(
  projectPath?: string,
): Promise<ProviderHealthSummary> {
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
