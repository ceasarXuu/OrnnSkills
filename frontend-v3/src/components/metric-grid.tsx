import {
  Activity02Icon,
  AiBrain03Icon,
  ChartHistogramIcon,
  WorkflowCircle01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCompactNumber, formatTokenCount } from '@/lib/format'
import type { DashboardProject, ProjectSnapshot } from '@/types/dashboard'

interface MetricGridProps {
  isLoading: boolean
  project: DashboardProject | null
  snapshot: ProjectSnapshot | null
}

export function MetricGrid({ isLoading, project, snapshot }: MetricGridProps) {
  const metrics = [
    {
      label: '技能总数',
      value: formatCompactNumber(snapshot?.skills?.length ?? project?.skillCount ?? 0),
      hint: '当前项目下已索引的技能实例',
      icon: WorkflowCircle01Icon,
    },
    {
      label: '最近 traces',
      value: formatCompactNumber(snapshot?.traceStats?.total ?? 0),
      hint: '最近窗口里的事件样本量',
      icon: Activity02Icon,
    },
    {
      label: '模型调用',
      value: formatCompactNumber(snapshot?.agentUsage?.callCount ?? 0),
      hint: `${formatTokenCount(snapshot?.agentUsage?.totalTokens ?? 0)} tokens`,
      icon: AiBrain03Icon,
    },
    {
      label: '事件类型',
      value: formatCompactNumber(Object.keys(snapshot?.traceStats?.byEventType ?? {}).length),
      hint: '当前窗口可解释的行为种类',
      icon: ChartHistogramIcon,
    },
  ]

  return (
    <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
      {metrics.map((metric) => (
        <Card key={metric.label} className="border-border/70">
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
            <CardTitle className="text-sm text-muted-foreground">{metric.label}</CardTitle>
            <HugeiconsIcon icon={metric.icon} size={18} strokeWidth={1.8} />
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading && !snapshot ? (
              <>
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-4 w-36" />
              </>
            ) : (
              <>
                <p className="text-3xl font-semibold tracking-tight">{metric.value}</p>
                <p className="text-sm text-muted-foreground">{metric.hint}</p>
              </>
            )}
          </CardContent>
        </Card>
      ))}
    </section>
  )
}
