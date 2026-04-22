import type { ComponentProps } from 'react'
import { AiBrain03Icon, ChartHistogramIcon, Layers01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  formatCompactNumber,
  formatDuration,
  formatRelativeTime,
  getBucketShare,
} from '@/lib/format'
import type { DashboardMetricBucket, ProjectSnapshot } from '@/types/dashboard'

interface SkillsInsightRailProps {
  snapshot: ProjectSnapshot | null
}

export function SkillsInsightRail({ snapshot }: SkillsInsightRailProps) {
  const scopeEntries = (Object.entries(
    snapshot?.agentUsage?.byScope ?? {},
  ) as Array<[string, DashboardMetricBucket]>)
    .sort(([, left], [, right]) => (right.callCount ?? 0) - (left.callCount ?? 0))
    .slice(0, 3)

  const skillEntries = (Object.entries(
    snapshot?.agentUsage?.bySkill ?? {},
  ) as Array<[string, DashboardMetricBucket]>)
    .sort(([, left], [, right]) => (right.callCount ?? 0) - (left.callCount ?? 0))
    .slice(0, 3)

  const eventEntries = (Object.entries(snapshot?.traceStats?.byEventType ?? {}) as Array<
    [string, number]
  >)
    .sort(([, left], [, right]) => right - left)
    .slice(0, 4)

  return (
    <Card className="sticky top-24 border-border/70 bg-card/86 backdrop-blur">
      <CardHeader className="gap-3">
        <div className="flex items-center gap-2">
          <HugeiconsIcon icon={AiBrain03Icon} size={18} strokeWidth={1.8} />
          <CardTitle>近期统计</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <Section entries={scopeEntries} icon={AiBrain03Icon} title="按 Scope 调用" total={snapshot?.agentUsage} />
        <Separator />
        <Section entries={skillEntries} icon={Layers01Icon} title="高频技能" total={snapshot?.agentUsage} />
        <Separator />
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <HugeiconsIcon icon={ChartHistogramIcon} size={16} strokeWidth={1.8} />
            <div>
              <p className="font-medium">事件分布</p>
              <p className="text-sm text-muted-foreground">
                最近 checkpoint {formatRelativeTime(snapshot?.daemon?.lastCheckpointAt)}
              </p>
            </div>
          </div>
          {eventEntries.length === 0 ? (
            <Empty label="当前窗口没有事件分布数据。" />
          ) : (
            <div className="space-y-3">
              {eventEntries.map(([eventType, count]) => (
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
                            10,
                            Math.round(
                              (count / Math.max(snapshot?.traceStats?.total ?? count, count)) * 100,
                            ),
                          ),
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function Section({
  entries,
  icon,
  title,
  total,
}: {
  entries: Array<[string, DashboardMetricBucket]>
  icon: ComponentProps<typeof HugeiconsIcon>['icon']
  title: string
  total: DashboardMetricBucket | undefined
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <HugeiconsIcon icon={icon} size={16} strokeWidth={1.8} />
        <p className="font-medium">{title}</p>
      </div>
      {entries.length === 0 ? (
        <Empty label="当前窗口没有可用统计。" />
      ) : (
        <div className="space-y-3">
          {entries.map(([label, bucket]) => (
            <div className="space-y-2" key={label}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatCompactNumber(bucket.callCount)} calls · avg {formatDuration(bucket.avgDurationMs)}
                  </p>
                </div>
                <Badge variant="outline">{getBucketShare(bucket, total)}%</Badge>
              </div>
              <div className="h-2 rounded-full bg-muted">
                <div
                  className="h-2 rounded-full bg-primary"
                  style={{ width: `${getBucketShare(bucket, total)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Empty({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
      {label}
    </div>
  )
}
