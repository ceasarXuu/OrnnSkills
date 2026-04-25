export type DashboardPromptKey =
  | 'skillCallAnalyzer'
  | 'decisionExplainer'
  | 'readinessProbe'

export type DashboardPromptSource = 'built_in' | 'custom'

export interface DashboardLlmSafetyConfig {
  enabled: boolean
  windowMs: number
  maxRequestsPerWindow: number
  maxConcurrentRequests: number
  maxEstimatedTokensPerWindow: number
}

export interface DashboardPromptSources {
  skillCallAnalyzer: DashboardPromptSource
  decisionExplainer: DashboardPromptSource
  readinessProbe: DashboardPromptSource
}

export interface DashboardPromptOverrides {
  skillCallAnalyzer: string
  decisionExplainer: string
  readinessProbe: string
}

export interface DashboardProviderConfig {
  provider: string
  modelName: string
  apiKeyEnvVar: string
  apiKey?: string
  hasApiKey?: boolean
}

export interface DashboardConfig {
  autoOptimize: boolean
  userConfirm: boolean
  runtimeSync: boolean
  llmSafety: DashboardLlmSafetyConfig
  promptSources: DashboardPromptSources
  promptOverrides: DashboardPromptOverrides
  defaultProvider: string
  logLevel: string
  providers: DashboardProviderConfig[]
}

export interface DashboardConfigResponse {
  config: DashboardConfig
}

export interface DashboardProviderCatalogModel {
  id: string
  mode?: string | null
  maxInputTokens?: number | null
  maxOutputTokens?: number | null
  inputCostPerToken?: number | null
  outputCostPerToken?: number | null
  outputCostPerReasoningToken?: number | null
  supportsReasoning?: boolean
  supportsFunctionCalling?: boolean
  supportsPromptCaching?: boolean
  supportsStructuredOutput?: boolean
  supportsVision?: boolean
  supportsWebSearch?: boolean
}

export interface DashboardProviderCatalogEntry {
  id: string
  name: string
  models: string[]
  modelDetails?: DashboardProviderCatalogModel[]
  defaultModel?: string
  apiKeyEnvVar?: string
}

export interface DashboardProviderCatalogResponse {
  providers: DashboardProviderCatalogEntry[]
  source?: string
}

export interface DashboardProviderHealthResult {
  provider: string
  modelName: string
  ok: boolean
  message: string
  durationMs: number
}

export interface DashboardProviderHealthSummary {
  level: 'ok' | 'warn'
  code: string
  message: string
  checkedAt: string
  results: DashboardProviderHealthResult[]
}

export interface DashboardProviderHealthResponse {
  health: DashboardProviderHealthSummary
}

export interface DashboardConnectivityResponse {
  results: DashboardProviderHealthResult[]
}
