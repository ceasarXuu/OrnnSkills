import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  buildProviderDraft,
  DEFAULT_DASHBOARD_CONFIG,
  getProviderCatalogEntry,
  getProviderModelOptions,
  normalizeDashboardConfig,
  normalizeProviderHealthSummary,
} from '@/lib/dashboard-config'
import {
  checkDashboardProvidersConnectivity,
  fetchDashboardConfig,
  fetchDashboardProviderCatalog,
  fetchDashboardProviderHealth,
  logDashboardV3Event,
  saveDashboardConfig,
} from '@/lib/dashboard-api'
import type {
  DashboardConfig,
  DashboardPromptKey,
  DashboardPromptSource,
  DashboardProviderCatalogEntry,
  DashboardProviderConfig,
  DashboardProviderHealthResult,
  DashboardProviderHealthSummary,
} from '@/types/config'

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message
  }

  return fallback
}

export function useDashboardV3Config() {
  const [config, setConfig] = useState<DashboardConfig>(DEFAULT_DASHBOARD_CONFIG)
  const [savedSnapshot, setSavedSnapshot] = useState(JSON.stringify(DEFAULT_DASHBOARD_CONFIG))
  const [providerCatalog, setProviderCatalog] = useState<DashboardProviderCatalogEntry[]>([])
  const [providerHealth, setProviderHealth] = useState<DashboardProviderHealthSummary>(
    normalizeProviderHealthSummary(null),
  )
  const [connectivityResults, setConnectivityResults] = useState<DashboardProviderHealthResult[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isCheckingConnectivity, setIsCheckingConnectivity] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [healthError, setHealthError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)
    setCatalogError(null)
    setHealthError(null)
    logDashboardV3Event('config.refresh_started')

    const [configResult, catalogResult, healthResult] = await Promise.allSettled([
      fetchDashboardConfig(),
      fetchDashboardProviderCatalog(),
      fetchDashboardProviderHealth(),
    ])

    if (configResult.status === 'fulfilled') {
      const normalized = normalizeDashboardConfig(configResult.value)
      setConfig(normalized)
      setSavedSnapshot(JSON.stringify(normalized))
      setSaveError(null)
    } else {
      setLoadError(getErrorMessage(configResult.reason, '加载配置失败。'))
    }

    if (catalogResult.status === 'fulfilled') {
      setProviderCatalog(catalogResult.value)
    } else {
      setCatalogError(getErrorMessage(catalogResult.reason, '加载 provider catalog 失败。'))
    }

    if (healthResult.status === 'fulfilled') {
      setProviderHealth(normalizeProviderHealthSummary(healthResult.value))
    } else {
      setHealthError(getErrorMessage(healthResult.reason, '加载 provider health 失败。'))
    }

    logDashboardV3Event('config.refresh_completed', {
      configLoaded: configResult.status === 'fulfilled',
      catalogLoaded: catalogResult.status === 'fulfilled',
      healthLoaded: healthResult.status === 'fulfilled',
    })
    setIsLoading(false)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const patchConfig = useCallback((updater: (current: DashboardConfig) => DashboardConfig) => {
    setConfig((current) => normalizeDashboardConfig(updater(current)))
    setSaveError(null)
  }, [])

  const setBooleanFlag = useCallback(
    (field: 'autoOptimize' | 'userConfirm' | 'runtimeSync', value: boolean) => {
      patchConfig((current) => ({ ...current, [field]: value }))
    },
    [patchConfig],
  )

  const setLogLevel = useCallback(
    (value: string) => {
      patchConfig((current) => ({ ...current, logLevel: value }))
    },
    [patchConfig],
  )

  const setDefaultProvider = useCallback(
    (value: string) => {
      patchConfig((current) => ({ ...current, defaultProvider: value }))
    },
    [patchConfig],
  )

  const addProvider = useCallback(() => {
    patchConfig((current) => {
      const draft = buildProviderDraft(providerCatalog)
      const providers = [...current.providers, draft]
      return {
        ...current,
        providers,
        defaultProvider: current.defaultProvider || draft.provider,
      }
    })
  }, [patchConfig, providerCatalog])

  const updateProvider = useCallback(
    (index: number, patch: Partial<DashboardProviderConfig>) => {
      patchConfig((current) => {
        const providers = current.providers.map((provider, providerIndex) => {
          if (providerIndex !== index) {
            return provider
          }

          const nextProvider = { ...provider, ...patch }
          if (typeof patch.provider === 'string') {
            const catalogEntry = getProviderCatalogEntry(providerCatalog, patch.provider)
            const modelOptions = getProviderModelOptions(providerCatalog, patch.provider)
            if (!modelOptions.includes(nextProvider.modelName)) {
              nextProvider.modelName = catalogEntry?.defaultModel || modelOptions[0] || ''
            }
            if (!patch.apiKeyEnvVar && catalogEntry?.apiKeyEnvVar) {
              nextProvider.apiKeyEnvVar = catalogEntry.apiKeyEnvVar
            }
          }

          return nextProvider
        })

        const nextDefaultProvider = providers.some(
          (provider) => provider.provider === current.defaultProvider,
        )
          ? current.defaultProvider
          : providers[0]?.provider || ''

        return {
          ...current,
          defaultProvider: nextDefaultProvider,
          providers,
        }
      })
    },
    [patchConfig, providerCatalog],
  )

  const removeProvider = useCallback(
    (index: number) => {
      patchConfig((current) => {
        const providers = current.providers.filter((_, providerIndex) => providerIndex !== index)
        const defaultProvider = providers.some(
          (provider) => provider.provider === current.defaultProvider,
        )
          ? current.defaultProvider
          : providers[0]?.provider || ''

        return {
          ...current,
          defaultProvider,
          providers,
        }
      })
    },
    [patchConfig],
  )

  const setPromptSource = useCallback(
    (key: DashboardPromptKey, value: DashboardPromptSource) => {
      patchConfig((current) => ({
        ...current,
        promptSources: {
          ...current.promptSources,
          [key]: value,
        },
      }))
    },
    [patchConfig],
  )

  const setPromptOverride = useCallback(
    (key: DashboardPromptKey, value: string) => {
      patchConfig((current) => ({
        ...current,
        promptOverrides: {
          ...current.promptOverrides,
          [key]: value,
        },
      }))
    },
    [patchConfig],
  )

  const setSafetyField = useCallback(
    (field: keyof DashboardConfig['llmSafety'], value: boolean | number) => {
      patchConfig((current) => ({
        ...current,
        llmSafety: {
          ...current.llmSafety,
          [field]: value,
        },
      }))
    },
    [patchConfig],
  )

  const reloadHealth = useCallback(async () => {
    try {
      const nextHealth = await fetchDashboardProviderHealth()
      setProviderHealth(normalizeProviderHealthSummary(nextHealth))
      setHealthError(null)
    } catch (error) {
      setHealthError(getErrorMessage(error, '刷新 provider health 失败。'))
    }
  }, [])

  const checkConnectivity = useCallback(async () => {
    setIsCheckingConnectivity(true)
    setSaveError(null)
    logDashboardV3Event('config.connectivity_started', {
      providerCount: config.providers.length,
    })

    try {
      const results = await checkDashboardProvidersConnectivity(config.providers)
      setConnectivityResults(results)
      await reloadHealth()
      logDashboardV3Event('config.connectivity_completed', {
        providerCount: results.length,
        failedCount: results.filter((result) => !result.ok).length,
      })
    } catch (error) {
      setSaveError(getErrorMessage(error, '检查 provider 连通性失败。'))
      logDashboardV3Event('config.connectivity_failed', {
        message: getErrorMessage(error, 'unknown'),
      })
    } finally {
      setIsCheckingConnectivity(false)
    }
  }, [config.providers, reloadHealth])

  const save = useCallback(async () => {
    setIsSaving(true)
    setSaveError(null)
    logDashboardV3Event('config.save_started', {
      providerCount: config.providers.length,
      defaultProvider: config.defaultProvider,
      autoOptimize: config.autoOptimize,
      runtimeSync: config.runtimeSync,
    })

    try {
      const normalized = normalizeDashboardConfig(config)
      await saveDashboardConfig(normalized)
      setConfig(normalized)
      setSavedSnapshot(JSON.stringify(normalized))
      await reloadHealth()
      logDashboardV3Event('config.save_completed', {
        providerCount: normalized.providers.length,
        defaultProvider: normalized.defaultProvider,
      })
    } catch (error) {
      setSaveError(getErrorMessage(error, '保存配置失败。'))
      logDashboardV3Event('config.save_failed', {
        message: getErrorMessage(error, 'unknown'),
      })
    } finally {
      setIsSaving(false)
    }
  }, [config, reloadHealth])

  const hasUnsavedChanges = useMemo(
    () => JSON.stringify(normalizeDashboardConfig(config)) !== savedSnapshot,
    [config, savedSnapshot],
  )

  return {
    addProvider,
    catalogError,
    checkConnectivity,
    config,
    connectivityResults,
    hasUnsavedChanges,
    healthError,
    isCheckingConnectivity,
    isLoading,
    isSaving,
    loadError,
    providerCatalog,
    providerHealth,
    refresh,
    removeProvider,
    save,
    saveError,
    setBooleanFlag,
    setDefaultProvider,
    setLogLevel,
    setPromptOverride,
    setPromptSource,
    setSafetyField,
    updateProvider,
  }
}
