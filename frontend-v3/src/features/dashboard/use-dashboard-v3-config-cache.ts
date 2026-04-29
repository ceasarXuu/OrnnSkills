import {
  DEFAULT_DASHBOARD_CONFIG,
  normalizeProviderHealthSummary,
} from '@/lib/dashboard-config'
import type {
  DashboardConfig,
  DashboardProviderCatalogEntry,
  DashboardProviderHealthSummary,
} from '@/types/config'

/**
 * Module-level cache for dashboard v3 config snapshot.
 *
 * Extracted from use-dashboard-v3-config.ts to keep that file under the
 * 500-line policy. Tests reset the cache via the helpers exported below.
 */

export interface DashboardV3ConfigCacheSnapshot {
  config: DashboardConfig
  providerCatalog: DashboardProviderCatalogEntry[]
  providerHealth: DashboardProviderHealthSummary
  savedSnapshot: string
}

export interface DashboardV3ConfigInitialState extends DashboardV3ConfigCacheSnapshot {
  isLoading: boolean
}

let dashboardV3ConfigCache: DashboardV3ConfigCacheSnapshot | null = null

export function getDashboardV3ConfigCache(): DashboardV3ConfigCacheSnapshot | null {
  return dashboardV3ConfigCache
}

export function setDashboardV3ConfigCache(snapshot: DashboardV3ConfigCacheSnapshot): void {
  dashboardV3ConfigCache = snapshot
}

export function getInitialDashboardV3ConfigState(): DashboardV3ConfigInitialState {
  if (dashboardV3ConfigCache) {
    return {
      ...dashboardV3ConfigCache,
      isLoading: false,
    }
  }

  return {
    config: DEFAULT_DASHBOARD_CONFIG,
    providerCatalog: [],
    providerHealth: normalizeProviderHealthSummary(null),
    savedSnapshot: JSON.stringify(DEFAULT_DASHBOARD_CONFIG),
    isLoading: true,
  }
}

export function __resetDashboardV3ConfigCacheForTests() {
  dashboardV3ConfigCache = null
}

export function __primeDashboardV3ConfigCacheForTests(cache: DashboardV3ConfigCacheSnapshot) {
  dashboardV3ConfigCache = cache
}
