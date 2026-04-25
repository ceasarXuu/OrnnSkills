import { DollarCircleIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  buildCostRows,
  buildModelDetailsIndex,
  createEmptyUsageBucket,
  formatContextWindow,
  formatUsageCompact,
  formatUsd,
  formatUsdPerMillion,
} from '@/lib/dashboard-cost'
import { formatDuration, formatRelativeTime } from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import type { DashboardAgentUsage, DashboardMetricBucket } from '@/types/dashboard'
import type { DashboardProviderCatalogEntry, DashboardProviderCatalogModel } from '@/types/config'

interface CostWorkspaceProps {
  agentUsage?: DashboardAgentUsage | null
  catalogError?: string | null
  isCatalogLoading: boolean
  isSnapshotLoading: boolean
  projectName?: string
  projectPath?: string
  providerCatalog: DashboardProviderCatalogEntry[]
}

export function CostWorkspace({
  agentUsage,
  catalogError,
  isCatalogLoading,
  isSnapshotLoading,
  projectName,
  projectPath,
  providerCatalog,
}: CostWorkspaceProps) {
  const { locale, t } = useI18n()
  const usage = agentUsage ?? createEmptyUsageBucket()
  const modelIndex = buildModelDetailsIndex(providerCatalog)
  const modelRows = buildCostRows(usage.byModel, modelIndex, { type: 'model' })
  const scopeRows = buildCostRows(usage.byScope, modelIndex)
  const skillRows = buildCostRows(usage.bySkill, modelIndex)
  const pricedModelCount = modelRows.filter((row) => typeof row.estimatedSpend === 'number').length
  const totalEstimatedSpend = modelRows.reduce(
    (sum, row) => sum + (typeof row.estimatedSpend === 'number' ? row.estimatedSpend : 0),
    0,
  )
  const avgTokensPerCall =
    (usage.callCount ?? 0) > 0 ? Math.round((usage.totalTokens ?? 0) / (usage.callCount ?? 1)) : 0

  if (isSnapshotLoading && !agentUsage) {
    return <CostWorkspaceSkeleton />
  }

  if (!usage.callCount) {
    return (
      <Card className="border-border/70 bg-card/92">
        <CardContent className="py-20 text-center text-sm text-muted-foreground">
          {t('costEmpty')}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card className="border-border/70 bg-card/92">
        <CardHeader className="border-b border-border/70">
          <div className="flex items-start justify-between gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <HugeiconsIcon icon={DollarCircleIcon} size={18} strokeWidth={1.8} />
                <CardTitle className="text-2xl">{t('cost')}</CardTitle>
              </div>
              <div className="text-sm text-muted-foreground">
                {projectName || projectPath || '—'}
              </div>
            </div>

            <div className="text-right">
              <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                {t('costEstimated')}
              </div>
              <div className="mt-2 text-3xl font-semibold">
                {pricedModelCount > 0 ? formatUsd(totalEstimatedSpend) : '—'}
              </div>
              <div className="mt-2 text-sm text-muted-foreground">
                {pricedModelCount > 0 ? t('costEstimatedSub') : t('costUnknownPricing')}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="grid grid-cols-6 gap-3 pt-6">
          <SummaryCard label={t('costCalls')} value={formatUsageCompact(usage.callCount)} />
          <SummaryCard label={t('costInputTokens')} value={formatUsageCompact(usage.promptTokens)} />
          <SummaryCard label={t('costOutputTokens')} value={formatUsageCompact(usage.completionTokens)} />
          <SummaryCard label={t('costTotalTokens')} value={formatUsageCompact(usage.totalTokens)} />
          <SummaryCard label={t('costAvgLatency')} value={formatDuration(usage.avgDurationMs)} />
          <SummaryCard label={t('costAvgTokensPerCall')} value={formatUsageCompact(avgTokensPerCall)} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-[minmax(0,1fr)_340px] gap-6">
        <Card className="border-border/70 bg-card/92">
          <CardHeader className="flex-row items-center justify-between border-b border-border/70">
            <CardTitle>{t('costModelSpend')}</CardTitle>
            <Badge variant="outline">
              {modelRows.length} {t('costModelCount')}
            </Badge>
          </CardHeader>
          <CardContent className="pt-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('costTableModel')}</TableHead>
                  <TableHead>{t('costEstimatedSpend')}</TableHead>
                  <TableHead>{t('costTableUsage')}</TableHead>
                  <TableHead>{t('costTableLatency')}</TableHead>
                  <TableHead>{t('costTableContextWindow')}</TableHead>
                  <TableHead>{t('costTablePricing')}</TableHead>
                  <TableHead>{t('costTableCapabilities')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {modelRows.map((row) => (
                  <TableRow key={row.key}>
                    <TableCell>
                      <div className="font-medium">{row.key}</div>
                      <div className="text-xs text-muted-foreground">
                        {(row.detail?.mode || 'chat')} · {formatUsageCompact(row.bucket.callCount)} {t('costTableCallsSuffix')}
                      </div>
                    </TableCell>
                    <TableCell>
                      {typeof row.estimatedSpend === 'number' ? formatUsd(row.estimatedSpend) : '—'}
                    </TableCell>
                    <TableCell>
                      <div>{formatUsageCompact(row.bucket.totalTokens)} {t('costTableTokensSuffix')}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatUsageCompact(row.bucket.promptTokens)} / {formatUsageCompact(row.bucket.completionTokens)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>{formatDuration(row.bucket.avgDurationMs)}</div>
                      <div className="text-xs text-muted-foreground">
                        {t('costTableLastSeen')} {formatRelativeTime(row.bucket.lastCallAt, locale, t('invalidDate'))}
                      </div>
                    </TableCell>
                    <TableCell>{formatContextWindow(row.detail)}</TableCell>
                    <TableCell>
                      <div>{formatUsdPerMillion(row.detail?.inputCostPerToken)} · {formatUsdPerMillion(row.detail?.outputCostPerToken)}</div>
                      <div className="text-xs text-muted-foreground">
                        {row.detail ? getPricingLabel(row.detail, t) : t('costUnknownPricing')}
                      </div>
                    </TableCell>
                    <TableCell>
                      <CapabilityBadges detail={row.detail} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <BreakdownCard rows={scopeRows} title={t('costScopeBreakdown')} />
          <BreakdownCard rows={skillRows} title={t('costSkillBreakdown')} />
          <Card className="border-border/70 bg-card/92">
            <CardHeader className="border-b border-border/70">
              <CardTitle>{t('costCatalogStatus')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-4 text-sm text-muted-foreground">
              <div>{isCatalogLoading ? t('catalogLoading') : `${pricedModelCount}/${modelRows.length} ${t('costMatchedModels')}`}</div>
              {catalogError ? <div className="text-destructive">{catalogError}</div> : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-background/40 px-4 py-4">
      <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className="mt-2 text-xl font-semibold">{value}</div>
    </div>
  )
}

function BreakdownCard({ rows, title }: { rows: Array<{ bucket: DashboardMetricBucket; key: string }>; title: string }) {
  const { t } = useI18n()
  const visibleRows = rows.slice(0, 5)

  return (
    <Card className="border-border/70 bg-card/92">
      <CardHeader className="border-b border-border/70">
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-4">
        {visibleRows.length > 0 ? (
          visibleRows.map((row) => (
            <div className="rounded-xl border border-border/70 bg-background/30 px-4 py-3" key={row.key}>
              <div className="flex items-center justify-between gap-3">
                <div className="truncate font-medium">{row.key}</div>
                <div>{formatUsageCompact(row.bucket.totalTokens)}</div>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                {formatUsageCompact(row.bucket.callCount)} {t('costTableCallsSuffix')} · {formatUsageCompact(row.bucket.totalTokens)} {t('costTableTokensSuffix')}
              </div>
            </div>
          ))
        ) : (
          <div className="py-10 text-center text-sm text-muted-foreground">{t('costEmpty')}</div>
        )}
      </CardContent>
    </Card>
  )
}

function CapabilityBadges({ detail }: { detail: DashboardProviderCatalogModel | null }) {
  const { t } = useI18n()
  if (!detail) {
    return <span className="text-xs text-muted-foreground">{t('costCapabilityNone')}</span>
  }

  const labels = [
    detail.supportsReasoning ? t('costCapabilityReasoning') : null,
    detail.supportsFunctionCalling ? t('costCapabilityFunctionCalling') : null,
    detail.supportsPromptCaching ? t('costCapabilityPromptCaching') : null,
    detail.supportsStructuredOutput ? t('costCapabilityStructuredOutput') : null,
  ].filter(Boolean)

  if (labels.length === 0) {
    return <span className="text-xs text-muted-foreground">{t('costCapabilityNone')}</span>
  }

  return (
    <div className="flex flex-wrap gap-1">
      {labels.map((label) => (
        <Badge key={label} variant="outline">{label}</Badge>
      ))}
    </div>
  )
}

function getPricingLabel(detail: DashboardProviderCatalogModel, t: ReturnType<typeof useI18n>['t']) {
  return Number(detail.outputCostPerReasoningToken) > 0
    ? t('costPricingReasoningSurcharge')
    : t('costPricingSource')
}

function CostWorkspaceSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-52 w-full" />
      <div className="grid grid-cols-[minmax(0,1fr)_340px] gap-6">
        <Skeleton className="h-[560px] w-full" />
        <Skeleton className="h-[560px] w-full" />
      </div>
    </div>
  )
}
