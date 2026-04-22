import type { ComponentProps } from 'react'
import { AiBrain03Icon, Clock01Icon, RefreshIcon, Settings02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCompactNumber, formatRelativeTime, getMonitoringBadgeVariant, getViewCopy } from '@/lib/format'
import type { DashboardProject, DashboardView, ProjectSnapshot } from '@/types/dashboard'

interface DashboardHeroProps {
  currentView: DashboardView
  isLoading: boolean
  lastSyncedAt: string | null
  onRefresh: () => void | Promise<void>
  project: DashboardProject | null
  snapshot: ProjectSnapshot | null
}

export function DashboardHero({
  currentView,
  isLoading,
  lastSyncedAt,
  onRefresh,
  project,
  snapshot,
}: DashboardHeroProps) {
  const copy = getViewCopy(currentView)
  const queueSize = snapshot?.daemon?.optimizationStatus?.queueSize ?? 0
  const processedTraces = snapshot?.daemon?.processedTraces ?? 0
  const activeModels = Object.keys(snapshot?.agentUsage?.byModel ?? {}).length

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_320px]">
      <Card className="border-border/70">
        <CardHeader className="gap-3">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-3">
              <div className="text-[11px] font-medium uppercase tracking-[0.32em] text-muted-foreground">
                {copy.eyebrow}
              </div>
              {isLoading && !project ? (
                <div className="space-y-2">
                  <Skeleton className="h-9 w-48" />
                  <Skeleton className="h-4 w-72" />
                </div>
              ) : (
                <div className="space-y-2">
                  <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                    {project?.name ?? '选择项目'}
                  </h1>
                  <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                    {project?.path ?? copy.description}
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-col items-start gap-3 sm:items-end">
              <div className="flex flex-wrap gap-2">
                <Badge variant={getMonitoringBadgeVariant(project?.monitoringState)}>
                  {project?.monitoringState === 'paused' ? '监控暂停' : '监控开启'}
                </Badge>
                <Badge variant="outline">
                  <HugeiconsIcon icon={Clock01Icon} size={12} strokeWidth={2} />
                  {formatRelativeTime(lastSyncedAt)}
                </Badge>
              </div>
              <Button onClick={() => void onRefresh()} variant="outline">
                <HugeiconsIcon icon={RefreshIcon} size={16} strokeWidth={1.8} />
                刷新快照
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm leading-6 text-muted-foreground">{copy.description}</p>
          <Separator />
          <div className="grid gap-4 sm:grid-cols-3">
            <HeroStat
              icon={AiBrain03Icon}
              label="当前优化状态"
              value={snapshot?.daemon?.optimizationStatus?.currentState ?? 'idle'}
            />
            <HeroStat
              icon={Settings02Icon}
              label="待处理队列"
              value={`${formatCompactNumber(queueSize)} tasks`}
            />
            <HeroStat
              icon={Clock01Icon}
              label="已处理 traces"
              value={formatCompactNumber(processedTraces)}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70">
        <CardHeader>
          <CardTitle>运行摘要</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">活跃模型</p>
            <p className="text-3xl font-semibold">{formatCompactNumber(activeModels)}</p>
          </div>
          <Separator />
          <div className="space-y-3 text-sm text-muted-foreground">
            <Row label="Daemon" value={snapshot?.daemon?.isRunning ? 'running' : 'idle'} />
            <Row
              label="Checkpoint"
              value={formatRelativeTime(snapshot?.daemon?.lastCheckpointAt)}
            />
            <Row
              label="当前 Skill"
              value={snapshot?.daemon?.optimizationStatus?.currentSkillId ?? '暂无'}
            />
          </div>
        </CardContent>
      </Card>
    </section>
  )
}

function HeroStat({
  icon,
  label,
  value,
}: {
  icon: ComponentProps<typeof HugeiconsIcon>['icon']
  label: string
  value: string
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-muted/35 px-4 py-3">
      <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-muted-foreground">
        <HugeiconsIcon icon={icon} size={14} strokeWidth={1.8} />
        {label}
      </div>
      <p className="text-base font-medium">{value}</p>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span>{label}</span>
      <span className="text-right text-foreground">{value}</span>
    </div>
  )
}
