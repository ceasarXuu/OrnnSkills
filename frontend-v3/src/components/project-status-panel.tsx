import { Clock01Icon, DatabaseIcon, Settings02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCompactNumber, formatRelativeTime, getMonitoringBadgeVariant } from '@/lib/format'
import type { DashboardProject, ProjectSnapshot } from '@/types/dashboard'

interface ProjectStatusPanelProps {
  project: DashboardProject | null
  snapshot: ProjectSnapshot | null
}

export function ProjectStatusPanel({ project, snapshot }: ProjectStatusPanelProps) {
  const runtimeEntries = Object.entries(snapshot?.traceStats?.byRuntime ?? {})
  const statusEntries = Object.entries(snapshot?.traceStats?.byStatus ?? {})

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
      <Card className="border-border/70">
        <CardHeader>
          <div className="flex items-center gap-2">
            <HugeiconsIcon icon={Settings02Icon} size={18} strokeWidth={1.8} />
            <CardTitle>项目运行状态</CardTitle>
          </div>
          <CardDescription>保留项目视角，只展示这个项目自己的 daemon 和监控状态。</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <StatusTile
            label="Monitoring"
            value={project?.monitoringState === 'paused' ? 'paused' : 'active'}
          />
          <StatusTile
            label="Daemon"
            value={snapshot?.daemon?.isRunning ? 'running' : 'idle'}
          />
          <StatusTile
            label="Processed"
            value={formatCompactNumber(snapshot?.daemon?.processedTraces)}
          />
          <StatusTile
            label="Retry Queue"
            value={formatCompactNumber(snapshot?.daemon?.retryQueueSize)}
          />
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card className="border-border/70">
          <CardHeader>
            <div className="flex items-center gap-2">
              <HugeiconsIcon icon={DatabaseIcon} size={18} strokeWidth={1.8} />
              <CardTitle>Runtime 分布</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Badge variant={getMonitoringBadgeVariant(project?.monitoringState)}>
              {project?.monitoringState === 'paused' ? 'Paused' : 'Active'}
            </Badge>
            {runtimeEntries.length === 0 ? (
              <Empty label="当前没有 runtime 分布数据。" />
            ) : (
              runtimeEntries.map(([runtime, count]) => (
                <Line key={runtime} label={runtime} value={formatCompactNumber(count)} />
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70">
          <CardHeader>
            <div className="flex items-center gap-2">
              <HugeiconsIcon icon={Clock01Icon} size={18} strokeWidth={1.8} />
              <CardTitle>Snapshot 新鲜度</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Line label="Last seen" value={formatRelativeTime(project?.lastSeenAt)} />
            <Line label="Checkpoint" value={formatRelativeTime(snapshot?.daemon?.lastCheckpointAt)} />
            {statusEntries.map(([status, count]) => (
              <Line key={status} label={status} value={formatCompactNumber(count)} />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function StatusTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/70 bg-muted/35 px-4 py-4">
      <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-xl font-semibold">{value}</p>
    </div>
  )
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
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
