import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatRelativeTime } from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import type { DashboardEvolutionLifecycle, DashboardEvolutionRun } from '@/types/dashboard'

interface EvolutionWorkspaceProps {
  isLoading: boolean
  lifecycle?: DashboardEvolutionLifecycle | null
}

const statusLabels: Record<string, string> = {
  applied: '已应用',
  collecting: '收集中',
  analyzing: '分析中',
  proposed: '待处理',
  failed: '失败',
  regressed: '回退风险',
  verified: '已验证',
  skipped: '已跳过',
}

export function EvolutionWorkspace({ isLoading, lifecycle }: EvolutionWorkspaceProps) {
  const summary = lifecycle?.summary
  const runs = lifecycle?.runs ?? []

  if (isLoading && !lifecycle) {
    return <EvolutionWorkspaceSkeleton />
  }

  if (!summary || runs.length === 0) {
    return (
      <Card className="border-border/70 bg-card/92">
        <CardContent className="py-20 text-center text-sm text-muted-foreground">
          暂无演化记录
        </CardContent>
      </Card>
    )
  }

  const pendingProposals = runs.filter((run) => run.status === 'proposed')
  const failedRuns = runs.filter((run) => run.status === 'failed')
  const verifiedImprovements = runs.filter((run) => run.verification?.outcome === 'improved')
  const regressions = runs.filter((run) => run.verification?.outcome === 'regressed')

  return (
    <div className="space-y-6">
      <Card className="border-border/70 bg-card/92 py-3" size="sm">
        <CardContent className="grid grid-cols-6 gap-3 px-4">
          <SummaryMetric label="活动窗口" value={summary.activeEpisodes} />
          <SummaryMetric label="待处理建议" value={summary.pendingProposals} />
          <SummaryMetric label="已应用修订" value={summary.appliedRevisions} />
          <SummaryMetric label="失败运行" value={summary.failedRuns} />
          <SummaryMetric label="已验证改善" value={summary.verifiedImprovements} />
          <SummaryMetric label="回退风险" value={summary.regressions} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-[minmax(0,1fr)_340px] gap-6">
        <Card className="border-border/70 bg-card/92">
          <CardHeader className="flex-row items-center justify-between border-b border-border/70">
            <CardTitle>演化运行</CardTitle>
            <Badge variant="outline">{runs.length} 条</Badge>
          </CardHeader>
          <CardContent className="divide-y divide-border/70 p-0">
            {runs.slice(0, 8).map((run) => (
              <EvolutionRunRow key={run.runId} run={run} />
            ))}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <StatusGroup runs={pendingProposals} title="待处理建议" />
          <StatusGroup runs={failedRuns} title="失败运行" />
          <StatusGroup runs={verifiedImprovements} title="已验证改善" />
          <StatusGroup runs={regressions} title="回退风险" />
        </div>
      </div>
    </div>
  )
}

function SummaryMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0 border-l border-border/60 pl-3 first:border-l-0 first:pl-0">
      <div className="truncate text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold leading-none">{value}</div>
    </div>
  )
}

function EvolutionRunRow({ run }: { run: DashboardEvolutionRun }) {
  const { locale, t } = useI18n()
  const reason = run.proposal?.reason || run.verification?.reason || '—'

  return (
    <div className="grid grid-cols-[180px_minmax(0,1fr)_120px_120px] items-center gap-4 px-4 py-3 text-sm">
      <div className="min-w-0">
        <div className="truncate font-medium">{run.skillId}</div>
        <div className="text-xs text-muted-foreground">{run.runtime}</div>
      </div>
      <div className="min-w-0">
        <div className="truncate">{reason}</div>
        <div className="text-xs text-muted-foreground">{run.episodeId}</div>
      </div>
      <Badge variant={run.status === 'failed' || run.status === 'regressed' ? 'destructive' : 'outline'}>
        {statusLabels[run.status] ?? run.status}
      </Badge>
      <div className="text-xs text-muted-foreground">
        {formatRelativeTime(run.updatedAt, locale, t('invalidDate'))}
      </div>
    </div>
  )
}

function StatusGroup({ runs, title }: { runs: DashboardEvolutionRun[]; title: string }) {
  return (
    <Card className="border-border/70 bg-card/92">
      <CardHeader className="border-b border-border/70">
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-4">
        {runs.length > 0 ? (
          runs.slice(0, 4).map((run) => (
            <div className="rounded-xl border border-border/70 bg-background/30 px-3 py-2" key={run.runId}>
              <div className="truncate text-sm font-medium">{run.skillId}</div>
              <div className="mt-1 truncate text-xs text-muted-foreground">
                {run.proposal?.changeType ?? run.verification?.outcome ?? run.status}
              </div>
            </div>
          ))
        ) : (
          <div className="py-2 text-sm text-muted-foreground">暂无</div>
        )}
      </CardContent>
    </Card>
  )
}

function EvolutionWorkspaceSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-24 w-full" />
      <div className="grid grid-cols-[minmax(0,1fr)_340px] gap-6">
        <Skeleton className="h-96 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    </div>
  )
}
