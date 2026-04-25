import { useCallback, useEffect, useState } from 'react'
import { fetchDashboardProviderCatalog, logDashboardV3Event } from '@/lib/dashboard-api'
import type { DashboardProviderCatalogEntry } from '@/types/config'

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message
  }

  return '加载 LiteLLM 模型目录失败。'
}

export function useDashboardV3Cost(enabled: boolean) {
  const [providerCatalog, setProviderCatalog] = useState<DashboardProviderCatalogEntry[]>([])
  const [isCatalogLoading, setIsCatalogLoading] = useState(false)
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [hasLoadedCatalog, setHasLoadedCatalog] = useState(false)

  const loadProviderCatalog = useCallback(async () => {
    setIsCatalogLoading(true)
    logDashboardV3Event('cost.catalog_load_started')

    try {
      const catalog = await fetchDashboardProviderCatalog()
      setProviderCatalog(catalog)
      setCatalogError(null)
      setHasLoadedCatalog(true)
      logDashboardV3Event('cost.catalog_load_succeeded', {
        providerCount: catalog.length,
      })
    } catch (error) {
      const message = getErrorMessage(error)
      setCatalogError(message)
      logDashboardV3Event('cost.catalog_load_failed', { message })
    } finally {
      setIsCatalogLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!enabled || hasLoadedCatalog || isCatalogLoading) {
      return
    }

    void loadProviderCatalog()
  }, [enabled, hasLoadedCatalog, isCatalogLoading, loadProviderCatalog])

  return {
    catalogError,
    isCatalogLoading,
    loadProviderCatalog,
    providerCatalog,
  }
}

