import type {
  DashboardConfig,
  DashboardLlmSafetyConfig,
  DashboardPromptKey,
  DashboardPromptOverrides,
  DashboardPromptSource,
  DashboardPromptSources,
  DashboardProviderCatalogEntry,
  DashboardProviderConfig,
  DashboardProviderHealthSummary,
} from '@/types/config'

export const DASHBOARD_PROMPT_KEYS: DashboardPromptKey[] = [
  'skillCallAnalyzer',
  'decisionExplainer',
  'readinessProbe',
]

export const DASHBOARD_LOG_LEVEL_OPTIONS = ['debug', 'info', 'warn', 'error'] as const

export const DEFAULT_LLM_SAFETY: DashboardLlmSafetyConfig = {
  enabled: true,
  windowMs: 60_000,
  maxRequestsPerWindow: 12,
  maxConcurrentRequests: 2,
  maxEstimatedTokensPerWindow: 48_000,
}

export const DEFAULT_PROMPT_SOURCES: DashboardPromptSources = {
  skillCallAnalyzer: 'built_in',
  decisionExplainer: 'built_in',
  readinessProbe: 'built_in',
}

export const DEFAULT_PROMPT_OVERRIDES: DashboardPromptOverrides = {
  skillCallAnalyzer: '',
  decisionExplainer: '',
  readinessProbe: '',
}

export const DEFAULT_DASHBOARD_CONFIG: DashboardConfig = {
  autoOptimize: true,
  userConfirm: false,
  runtimeSync: true,
  llmSafety: DEFAULT_LLM_SAFETY,
  promptSources: DEFAULT_PROMPT_SOURCES,
  promptOverrides: DEFAULT_PROMPT_OVERRIDES,
  defaultProvider: '',
  logLevel: 'info',
  providers: [],
}

const PROMPT_FIELD_META: Record<
  DashboardPromptKey,
  { label: string; description: string; placeholder: string }
> = {
  skillCallAnalyzer: {
    label: 'Skill Call Analyzer',
    description: '决定如何分析调用窗口并识别 skill 的真实使用证据。',
    placeholder: '输入自定义 analyzer system prompt',
  },
  decisionExplainer: {
    label: 'Decision Explainer',
    description: '解释为什么产生某个演进判断，影响 dashboard 里的决策可解释性。',
    placeholder: '输入自定义 explainer system prompt',
  },
  readinessProbe: {
    label: 'Readiness Probe',
    description: '判断某个 skill 是否达到可演进状态，用于 readiness 检查。',
    placeholder: '输入自定义 readiness probe system prompt',
  },
}

function normalizePromptSource(value: unknown): DashboardPromptSource {
  return value === 'custom' ? 'custom' : 'built_in'
}

function normalizeBoolean(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback
}

function normalizePositiveNumber(value: unknown, fallback: number) {
  if (typeof value !== 'number' || Number.isNaN(value) || value <= 0) {
    return fallback
  }

  return value
}

function normalizeString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback
}

function normalizeProvider(provider: Partial<DashboardProviderConfig> | null | undefined) {
  return {
    provider: normalizeString(provider?.provider),
    modelName: normalizeString(provider?.modelName),
    apiKeyEnvVar: normalizeString(provider?.apiKeyEnvVar),
    apiKey: normalizeString(provider?.apiKey),
    hasApiKey: Boolean(provider?.hasApiKey ?? provider?.apiKey),
  } satisfies DashboardProviderConfig
}

export function normalizeDashboardConfig(
  config: Partial<DashboardConfig> | null | undefined,
): DashboardConfig {
  const llmSafety = config?.llmSafety
  const promptSources = config?.promptSources
  const promptOverrides = config?.promptOverrides

  return {
    autoOptimize: normalizeBoolean(config?.autoOptimize, DEFAULT_DASHBOARD_CONFIG.autoOptimize),
    userConfirm: normalizeBoolean(config?.userConfirm, DEFAULT_DASHBOARD_CONFIG.userConfirm),
    runtimeSync: normalizeBoolean(config?.runtimeSync, DEFAULT_DASHBOARD_CONFIG.runtimeSync),
    llmSafety: {
      enabled: normalizeBoolean(llmSafety?.enabled, DEFAULT_LLM_SAFETY.enabled),
      windowMs: normalizePositiveNumber(llmSafety?.windowMs, DEFAULT_LLM_SAFETY.windowMs),
      maxRequestsPerWindow: normalizePositiveNumber(
        llmSafety?.maxRequestsPerWindow,
        DEFAULT_LLM_SAFETY.maxRequestsPerWindow,
      ),
      maxConcurrentRequests: normalizePositiveNumber(
        llmSafety?.maxConcurrentRequests,
        DEFAULT_LLM_SAFETY.maxConcurrentRequests,
      ),
      maxEstimatedTokensPerWindow: normalizePositiveNumber(
        llmSafety?.maxEstimatedTokensPerWindow,
        DEFAULT_LLM_SAFETY.maxEstimatedTokensPerWindow,
      ),
    },
    promptSources: {
      skillCallAnalyzer: normalizePromptSource(promptSources?.skillCallAnalyzer),
      decisionExplainer: normalizePromptSource(promptSources?.decisionExplainer),
      readinessProbe: normalizePromptSource(promptSources?.readinessProbe),
    },
    promptOverrides: {
      skillCallAnalyzer: normalizeString(promptOverrides?.skillCallAnalyzer),
      decisionExplainer: normalizeString(promptOverrides?.decisionExplainer),
      readinessProbe: normalizeString(promptOverrides?.readinessProbe),
    },
    defaultProvider: normalizeString(config?.defaultProvider),
    logLevel: normalizeString(config?.logLevel, DEFAULT_DASHBOARD_CONFIG.logLevel),
    providers: Array.isArray(config?.providers)
      ? config.providers.map((provider) => normalizeProvider(provider))
      : [],
  }
}

export function normalizeProviderHealthSummary(
  summary: Partial<DashboardProviderHealthSummary> | null | undefined,
): DashboardProviderHealthSummary {
  return {
    level: summary?.level === 'warn' ? 'warn' : 'ok',
    code: normalizeString(summary?.code, 'ok'),
    message: normalizeString(summary?.message, 'No provider health data'),
    checkedAt: normalizeString(summary?.checkedAt),
    results: Array.isArray(summary?.results)
      ? summary.results.map((result) => ({
          provider: normalizeString(result?.provider, 'unknown'),
          modelName: normalizeString(result?.modelName, 'unknown'),
          ok: Boolean(result?.ok),
          message: normalizeString(result?.message),
          durationMs: normalizePositiveNumber(result?.durationMs, 0),
        }))
      : [],
  }
}

export function getPromptFieldMeta(key: DashboardPromptKey) {
  return PROMPT_FIELD_META[key]
}

export function getProviderCatalogEntry(
  catalog: DashboardProviderCatalogEntry[],
  providerId: string,
) {
  return catalog.find((entry) => entry.id === providerId) ?? null
}

export function getProviderModelOptions(
  catalog: DashboardProviderCatalogEntry[],
  providerId: string,
) {
  return getProviderCatalogEntry(catalog, providerId)?.models ?? []
}

export function buildProviderDraft(
  catalog: DashboardProviderCatalogEntry[],
  providerId?: string,
): DashboardProviderConfig {
  const provider = providerId || catalog[0]?.id || ''
  const catalogEntry = getProviderCatalogEntry(catalog, provider)

  return {
    provider,
    modelName: catalogEntry?.defaultModel || catalogEntry?.models[0] || '',
    apiKeyEnvVar: catalogEntry?.apiKeyEnvVar || '',
    apiKey: '',
    hasApiKey: false,
  }
}

export function getConfiguredProviderOptions(config: DashboardConfig) {
  return config.providers
    .map((provider) => provider.provider.trim())
    .filter((provider, index, array) => provider.length > 0 && array.indexOf(provider) === index)
}

export function getProviderDisplayName(
  catalog: DashboardProviderCatalogEntry[],
  providerId: string,
) {
  return getProviderCatalogEntry(catalog, providerId)?.name || providerId || '未命名 provider'
}

export function maskApiKey(apiKey?: string) {
  const value = (apiKey || '').trim()
  if (value.length <= 8) {
    return value ? '••••••••' : ''
  }

  return `${value.slice(0, 4)}••••${value.slice(-4)}`
}
