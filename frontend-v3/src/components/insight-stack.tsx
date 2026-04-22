import { AiBrain03Icon, ChartHistogramIcon, Layers01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCompactNumber, formatDuration, formatRelativeTime, getBucketShare } from '@/lib/format'
import type { DashboardMetricBucket, ProjectSnapshot } from '@/types/dashboard'

interface InsightStackProps {
  snapshot: ProjectSnapshot | null
}

export function InsightStack({ snapshot }: InsightStackProps) {
  const scopeEntries = (Object.entries(
    snapshot?.agentUsage?.byScope ?? {},
  ) as Array<[string, DashboardMetricBucket]>)
    .sort(([, left], [, right]) => (right.callCount ?? 0) - (left.callCount ?? 0))
    .slice(0, 4)

  const skillEntries = (Object.entries(
    snapshot?.agentUsage?.bySkill ?? {},
  ) as Array<[string, DashboardMetricBucket]>)
    .sort(([, left], [, right]) => (right.callCount ?? 0) - (left.callCount ?? 0))
    .slice(0, 4)

  const eventEntries = Object.entries(snapshot?.traceStats?.byEventType ?? {}) as Array<
    [string, number]
  >

  return (
    <div className="space-y-6">
      <Card className="border-border/70">
        <CardHeader>
          <div className="flex items-center gap-2">
            <HugeiconsIcon icon={AiBrain03Icon} size={18} strokeWidth={1.8} />
            <CardTitle>模型用量</CardTitle>
          </div>
          <CardDescription>按 scope 聚合的调用量和平均耗时。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {scopeEntries.length === 0 ? (
            <Empty label="当前窗口没有 agent usage 记录。" />
          ) : (
            scopeEntries.map(([scope, bucket]) => (
              <UsageRow
                bucket={bucket}
                key={scope}
                label={scope}
                total={snapshot?.agentUsage}
              />
            ))
          )}
        </CardContent>
      </Card>

      <Card className="border-border/70">
        <CardHeader>
          <div className="flex items-center gap-2">
            <HugeiconsIcon icon={Layers01Icon} size={18} strokeWidth={1.8} />
            <CardTitle>高频技能</CardTitle>
          </div>
          <CardDescription>最近窗口里被引用最多的技能。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {skillEntries.length === 0 ? (
            <Empty label="当前窗口没有技能调用统计。" />
          ) : (
            skillEntries.map(([skillId, bucket]) => (
              <UsageRow
                bucket={bucket}
                key={skillId}
                label={skillId}
                total={snapshot?.agentUsage}
              />
            ))
          )}
        </CardContent>
      </Card>

      <Card className="border-border/70">
        <CardHeader>
          <div className="flex items-center gap-2">
            <HugeiconsIcon icon={ChartHistogramIcon} size={18} strokeWidth={1.8} />
            <CardTitle>事件分布</CardTitle>
          </div>
          <CardDescription>帮助快速判断当前窗口偏向哪类行为。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {eventEntries.length === 0 ? (
            <Empty label="当前窗口没有可展示的事件分布。" />
          ) : (
            eventEntries
              .sort(([, left], [, right]) => right - left)
              .slice(0, 5)
              .map(([eventType, count]) => (
                <div className="space-y-2" key={eventType}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate">{eventType}</span>
                    <Badge variant="outline">{formatCompactNumber(count)}</Badge>
                  </div>
                  <div className="h-2 rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.max(
                            8,
                            Math.round(
                              (count / Math.max(snapshot?.traceStats?.total ?? count, count)) * 100,
                            ),
                          ),
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              ))
          )}
          <p className="text-xs text-muted-foreground">
            最近 checkpoint {formatRelativeTime(snapshot?.daemon?.lastCheckpointAt)}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

function UsageRow({
  bucket,
  label,
  total,
}: {
  bucket: DashboardMetricBucket
  label: string
  total: DashboardMetricBucket | undefined
}) {
  const share = getBucketShare(bucket, total)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">
            {formatCompactNumber(bucket.callCount)} calls · avg {formatDuration(bucket.avgDurationMs)}
          </p>
        </div>
        <Badge variant="outline">{share}%</Badge>
      </div>
      <div className="h-2 rounded-full bg-muted">
        <div className="h-2 rounded-full bg-primary" style={{ width: `${share}%` }} />
      </div>
    </div>
  )
}

function Empty({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
      {label}
    </div>
  )
}
