import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  buildProviderDraft,
  normalizeDashboardConfig,
  normalizeProviderHealthSummary,
} from '@/lib/dashboard-config'
import {
  CONFIG_TEXT,
  getConnectivityProviders,
  guessApiKeyEnvVar,
  resolveDefaultProvider,
} from '@/lib/config-workspace'
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
import {
  __primeDashboardV3ConfigCacheForTests,
  __resetDashboardV3ConfigCacheForTests,
  getDashboardV3ConfigCache,
  getInitialDashboardV3ConfigState,
  setDashboardV3ConfigCache,
} from './use-dashboard-v3-config-cache'

export {
  __primeDashboardV3ConfigCacheForTests,
  __resetDashboardV3ConfigCacheForTests,
  getInitialDashboardV3ConfigState,
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message
  }

  return fallback
}

export function useDashboardV3Config() {
  const initialState = getInitialDashboardV3ConfigState()
  const [config, setConfig] = useState<DashboardConfig>(initialState.config)
  const [savedSnapshot, setSavedSnapshot] = useState(initialState.savedSnapshot)
  const [providerCatalog, setProviderCatalog] = useState<DashboardProviderCatalogEntry[]>(
    initialState.providerCatalog,
  )
  const [providerHealth, setProviderHealth] = useState<DashboardProviderHealthSummary>(
    initialState.providerHealth,
  )
  const [connectivityResults, setConnectivityResults] = useState<DashboardProviderHealthResult[]>([])
  const [isLoading, setIsLoading] = useState(initialState.isLoading)
  const [isSaving, setIsSaving] = useState(false)
  const [isCheckingConnectivity, setIsCheckingConnectivity] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [healthError, setHealthError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveHint, setSaveHint] = useState('')
  const [apiKeyVisibilityByRow, setApiKeyVisibilityByRow] = useState<Record<string, boolean>>({})
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autoSaveInFlightRef = useRef(false)
  const autoSaveQueuedRef = useRef(false)
  const latestConfigRef = useRef(config)

  useEffect(() => {
    latestConfigRef.current = config
  }, [config])

  useEffect(() => {
    setDashboardV3ConfigCache({
      config,
      providerCatalog,
      providerHealth,
      savedSnapshot,
    })
  }, [config, providerCatalog, providerHealth, savedSnapshot])

  const runRefresh = useCallback(async (options?: { showLoading?: boolean }) => {
    if (options?.showLoading ?? true) {
      setIsLoading(true)
    }
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
      setSaveHint('')
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

  const refresh = useCallback(async () => {
    await runRefresh({ showLoading: true })
  }, [runRefresh])

  useEffect(() => {
    void runRefresh({ showLoading: getDashboardV3ConfigCache() === null })
  }, [runRefresh])

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
      patchConfig((current) => ({
        ...current,
        defaultProvider: resolveDefaultProvider(current.providers, value),
      }))
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
        defaultProvider: resolveDefaultProvider(providers, current.defaultProvider || draft.provider),
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

          const nextProvider = {
            ...provider,
            ...patch,
          }

          if (typeof patch.provider === 'string') {
            const catalogEntry = providerCatalog.find((entry) => entry.id === patch.provider) ?? null
            const modelOptions = catalogEntry?.models ?? []
            if (patch.provider.trim().length === 0) {
              nextProvider.modelName = nextProvider.modelName || ''
              nextProvider.apiKeyEnvVar = nextProvider.apiKeyEnvVar || ''
            } else {
              if (!modelOptions.includes(nextProvider.modelName)) {
                nextProvider.modelName = catalogEntry?.defaultModel || modelOptions[0] || ''
              }
              if (!patch.apiKeyEnvVar) {
                nextProvider.apiKeyEnvVar =
                  catalogEntry?.apiKeyEnvVar || guessApiKeyEnvVar(patch.provider)
              }
            }
          }

          return nextProvider
        })

        return {
          ...current,
          defaultProvider: resolveDefaultProvider(providers, current.defaultProvider),
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
        return {
          ...current,
          defaultProvider: resolveDefaultProvider(providers, current.defaultProvider),
          providers,
        }
      })
      setApiKeyVisibilityByRow((current) => {
        const nextEntries = Object.entries(current)
          .map(([key, visible]) => {
            const rowIndex = Number(key)
            if (!Number.isInteger(rowIndex) || rowIndex === index) {
              return null
            }

            return [String(rowIndex > index ? rowIndex - 1 : rowIndex), visible] as const
          })
          .filter((entry): entry is readonly [string, boolean] => entry !== null)

        return Object.fromEntries(nextEntries)
      })
    },
    [patchConfig],
  )

  const toggleApiKeyVisibility = useCallback((index: number) => {
    setApiKeyVisibilityByRow((current) => ({
      ...current,
      [String(index)]: !current[String(index)],
    }))
  }, [])

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

  const reloadProviderCatalog = useCallback(async () => {
    setCatalogError(null)

    try {
      const catalog = await fetchDashboardProviderCatalog()
      setProviderCatalog(catalog)
    } catch (error) {
      setCatalogError(getErrorMessage(error, '加载 provider catalog 失败。'))
    }
  }, [])

  const persistConfig = useCallback(
    async (mode: 'auto' | 'manual') => {
      if (mode === 'auto' && autoSaveInFlightRef.current) {
        autoSaveQueuedRef.current = true
        return
      }

      const normalized = normalizeDashboardConfig(latestConfigRef.current)
      if (JSON.stringify(normalized) === savedSnapshot) {
        return
      }

      if (mode === 'auto') {
        autoSaveInFlightRef.current = true
      }

      setIsSaving(true)
      setSaveError(null)
      setSaveHint(CONFIG_TEXT.saveSaving)
      logDashboardV3Event('config.save_started', {
        mode,
        providerCount: normalized.providers.length,
        defaultProvider: normalized.defaultProvider,
      })

      try {
        await saveDashboardConfig(normalized)
        setConfig(normalized)
        setSavedSnapshot(JSON.stringify(normalized))
        setSaveHint(mode === 'auto' ? CONFIG_TEXT.saveAuto : CONFIG_TEXT.saveAuto)
        await reloadHealth()
        logDashboardV3Event('config.save_completed', {
          mode,
          providerCount: normalized.providers.length,
          defaultProvider: normalized.defaultProvider,
        })
      } catch (error) {
        const message = getErrorMessage(error, '保存配置失败。')
        setSaveError(message)
        setSaveHint(`${CONFIG_TEXT.saveFailed}: ${message}`)
        logDashboardV3Event('config.save_failed', {
          mode,
          message,
        })
      } finally {
        setIsSaving(false)
        if (mode === 'auto') {
          autoSaveInFlightRef.current = false
          if (autoSaveQueuedRef.current) {
            autoSaveQueuedRef.current = false
            autoSaveTimerRef.current = setTimeout(() => {
              autoSaveTimerRef.current = null
              void persistConfig('auto')
            }, 150)
          }
        }
      }
    },
    [reloadHealth, savedSnapshot],
  )

  const checkConnectivity = useCallback(async (rowIndex?: number | null) => {
    setIsCheckingConnectivity(true)
    setSaveError(null)
    setSaveHint(CONFIG_TEXT.connectivityCheckingHint)
    const providersToCheck = getConnectivityProviders(config.providers, rowIndex)
    logDashboardV3Event('config.connectivity_started', {
      providerCount: providersToCheck.length,
      rowIndex: rowIndex ?? null,
    })

    try {
      const results = await checkDashboardProvidersConnectivity(providersToCheck)
      setConnectivityResults(results)
      setSaveHint(CONFIG_TEXT.connectivityDone)
      await reloadHealth()
      logDashboardV3Event('config.connectivity_completed', {
        providerCount: results.length,
        failedCount: results.filter((result) => !result.ok).length,
      })
    } catch (error) {
      const message = getErrorMessage(error, '检查 provider 连通性失败。')
      setSaveError(message)
      setSaveHint(`${CONFIG_TEXT.connectivityFailed}: ${message}`)
      logDashboardV3Event('config.connectivity_failed', {
        message,
      })
    } finally {
      setIsCheckingConnectivity(false)
    }
  }, [config.providers, reloadHealth])

  useEffect(() => {
    if (isLoading) {
      return
    }

    const normalizedSnapshot = JSON.stringify(normalizeDashboardConfig(config))
    if (normalizedSnapshot === savedSnapshot) {
      return
    }

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current)
    }
    setSaveHint(CONFIG_TEXT.saveSaving)
    autoSaveTimerRef.current = setTimeout(() => {
      autoSaveTimerRef.current = null
      void persistConfig('auto')
    }, 450)

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
        autoSaveTimerRef.current = null
      }
    }
  }, [config, isLoading, persistConfig, savedSnapshot])

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
    isApiKeyVisible: (index: number) => Boolean(apiKeyVisibilityByRow[String(index)]),
    isCheckingConnectivity,
    isLoading,
    isSaving,
    loadError,
    providerCatalog,
    providerHealth,
    refresh,
    reloadProviderCatalog,
    removeProvider,
    saveError,
    saveHint,
    setBooleanFlag,
    setDefaultProvider,
    setLogLevel,
    setPromptOverride,
    setPromptSource,
    setSafetyField,
    toggleApiKeyVisibility,
    updateProvider,
  }
}
