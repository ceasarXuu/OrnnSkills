import type { DashboardMetricBucket } from '@/types/dashboard'
import type { DashboardProviderCatalogEntry, DashboardProviderCatalogModel } from '@/types/config'

export interface DashboardCostRow {
  bucket: DashboardMetricBucket
  detail: DashboardProviderCatalogModel | null
  estimatedSpend: number | null
  key: string
}

export interface DashboardCostUsage extends Required<DashboardMetricBucket> {
  byModel: Record<string, DashboardMetricBucket>
  byScope: Record<string, DashboardMetricBucket>
  bySkill: Record<string, DashboardMetricBucket>
}

export function createEmptyUsageBucket(): DashboardCostUsage {
  return {
    avgDurationMs: 0,
    byModel: {},
    byScope: {},
    bySkill: {},
    callCount: 0,
    completionTokens: 0,
    durationMsTotal: 0,
    lastCallAt: null,
    promptTokens: 0,
    totalTokens: 0,
  }
}

export function normalizeCostModelKey(modelName: string) {
  const segments = String(modelName || '')
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean)

  if (segments.length === 0) {
    return ''
  }

  while (
    segments.length >= 3 &&
    segments[0].toLowerCase() === segments[1].toLowerCase()
  ) {
    segments.splice(1, 1)
  }

  return segments.join('/')
}

export function buildCostModelAliases(modelName: string) {
  const normalized = normalizeCostModelKey(modelName)
  if (!normalized) {
    return []
  }

  const segments = normalized.split('/').filter(Boolean)
  const aliases = new Set([normalized])
  if (segments.length > 1) {
    aliases.add(segments.slice(1).join('/'))
    aliases.add(segments[segments.length - 1])
  }

  return [...aliases]
}

export function buildModelDetailsIndex(catalog: DashboardProviderCatalogEntry[]) {
  const index: Record<string, DashboardProviderCatalogModel> = {}

  for (const provider of catalog) {
    const details = Array.isArray(provider.modelDetails) ? provider.modelDetails : []
    for (const detail of details) {
      if (!detail?.id) {
        continue
      }

      for (const alias of buildCostModelAliases(detail.id)) {
        if (!index[alias]) {
          index[alias] = detail
        }
      }
    }
  }

  return index
}

export function estimateModelSpend(
  bucket: DashboardMetricBucket,
  detail: DashboardProviderCatalogModel | null,
) {
  if (!detail) {
    return null
  }

  const inputRate = Number(detail.inputCostPerToken)
  const outputRate = Number(detail.outputCostPerToken)
  if (!Number.isFinite(inputRate) && !Number.isFinite(outputRate)) {
    return null
  }

  return (
    (bucket.promptTokens ?? 0) * (Number.isFinite(inputRate) ? inputRate : 0) +
    (bucket.completionTokens ?? 0) * (Number.isFinite(outputRate) ? outputRate : 0)
  )
}

export function buildCostRows(
  recordMap: Record<string, DashboardMetricBucket> | undefined,
  modelDetailsIndex: Record<string, DashboardProviderCatalogModel>,
  options: { type?: 'model' } = {},
): DashboardCostRow[] {
  return Object.entries(recordMap ?? {})
    .map(([key, bucket]) => {
      const rawKey = String(key || '')
      const normalizedKey = options.type === 'model' ? normalizeCostModelKey(rawKey) : rawKey
      const detail =
        options.type === 'model'
          ? buildCostModelAliases(normalizedKey)
            .map((alias) => modelDetailsIndex[alias] ?? null)
            .find(Boolean) ?? null
          : null
      const estimatedSpend = options.type === 'model' ? estimateModelSpend(bucket, detail) : null

      return {
        bucket: bucket ?? {},
        detail,
        estimatedSpend,
        key: normalizedKey,
      }
    })
    .sort((left, right) => {
      const leftSort = typeof left.estimatedSpend === 'number'
        ? left.estimatedSpend
        : Number(left.bucket.totalTokens ?? 0)
      const rightSort = typeof right.estimatedSpend === 'number'
        ? right.estimatedSpend
        : Number(right.bucket.totalTokens ?? 0)
      return rightSort - leftSort
    })
}

export function formatUsageCompact(value: number | null | undefined) {
  const num = Number(value ?? 0)
  if (!Number.isFinite(num)) {
    return '0'
  }

  const abs = Math.abs(num)
  if (abs >= 1_000_000) {
    return `${Number((num / 1_000_000).toFixed(1))}M`
  }

  if (abs >= 1_000) {
    return `${Number((num / 1_000).toFixed(1))}K`
  }

  return String(Math.round(num))
}

export function formatUsd(value: number | null | undefined) {
  const num = Number(value)
  if (!Number.isFinite(num)) {
    return '—'
  }

  return new Intl.NumberFormat('en-US', {
    currency: 'USD',
    maximumFractionDigits: num < 0.01 ? 4 : 2,
    minimumFractionDigits: num < 0.01 ? 4 : 2,
    style: 'currency',
  }).format(num)
}

export function formatUsdPerMillion(ratePerToken: number | null | undefined) {
  const num = Number(ratePerToken)
  if (!Number.isFinite(num)) {
    return '—'
  }

  return `${formatUsd(num * 1_000_000)}/M`
}

export function formatContextWindow(detail: DashboardProviderCatalogModel | null) {
  if (!detail) {
    return '—'
  }

  const input = typeof detail.maxInputTokens === 'number' ? formatUsageCompact(detail.maxInputTokens) : '—'
  const output = typeof detail.maxOutputTokens === 'number' ? formatUsageCompact(detail.maxOutputTokens) : '—'
  return `${input} / ${output}`
}
