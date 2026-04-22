import { Bot, Gauge, Timer } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCompactNumber, formatDuration, formatRelativeTime } from '@/lib/formatters'
import type { DashboardMetricBucket, ProjectSnapshot } from '@/types/dashboard'

interface ModelUsagePanelProps {
  isLoading: boolean
  snapshot: ProjectSnapshot | null
}

function sortModelEntries(entries: Array<[string, DashboardMetricBucket]>) {
  return [...entries].sort((left, right) => {
    return Number(right[1].totalTokens ?? 0) - Number(left[1].totalTokens ?? 0)
  })
}

export function ModelUsagePanel({ isLoading, snapshot }: ModelUsagePanelProps) {
  const modelEntries = sortModelEntries(
    Object.entries(snapshot?.agentUsage?.byModel ?? {}),
  ).slice(0, 5)

  return (
    <Card>
      <CardHeader>
        <CardTitle>模型负载</CardTitle>
        <CardDescription>先把 usage 看板做成稳定侧栏，再迁成本、配额与策略控制。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
          <div className="rounded-xl border border-border bg-muted/35 p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              <Bot className="size-3.5 text-primary" />
              Calls
            </div>
            <p className="mt-3 text-2xl font-semibold text-foreground">
              {formatCompactNumber(snapshot?.agentUsage?.callCount ?? 0)}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-muted/35 p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              <Gauge className="size-3.5 text-primary" />
              Tokens
            </div>
            <p className="mt-3 text-2xl font-semibold text-foreground">
              {formatCompactNumber(snapshot?.agentUsage?.totalTokens ?? 0)}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-muted/35 p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              <Timer className="size-3.5 text-primary" />
              Avg
            </div>
            <p className="mt-3 text-2xl font-semibold text-foreground">
              {formatDuration(snapshot?.agentUsage?.avgDurationMs)}
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="text-sm text-muted-foreground">正在拉取模型 usage...</div>
        ) : modelEntries.length === 0 ? (
          <div className="text-sm text-muted-foreground">当前项目还没有模型使用记录。</div>
        ) : (
          <div className="space-y-3">
            {modelEntries.map(([modelName, bucket]) => (
              <div
                className="rounded-xl border border-border bg-muted/20 px-4 py-4"
                key={modelName}
              >
                <p className="truncate text-sm font-medium text-foreground">{modelName}</p>
                <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                  <span>{formatCompactNumber(bucket.callCount ?? 0)} calls</span>
                  <span>{formatCompactNumber(bucket.totalTokens ?? 0)} tokens</span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                  <span>{formatDuration(bucket.avgDurationMs)}</span>
                  <span>{formatRelativeTime(bucket.lastCallAt ?? undefined)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
