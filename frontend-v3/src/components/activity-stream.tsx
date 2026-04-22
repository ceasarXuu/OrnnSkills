import type { ComponentProps, ReactNode } from 'react'
import { Activity02Icon, TaskDone02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDateTime, formatRelativeTime, getSkillStatusBadgeVariant } from '@/lib/format'
import type { DashboardDecisionEvent, DashboardTrace, ProjectSnapshot } from '@/types/dashboard'

interface ActivityStreamProps {
  isLoading: boolean
  snapshot: ProjectSnapshot | null
}

export function ActivityStream({ isLoading, snapshot }: ActivityStreamProps) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <ActivityCard<DashboardTrace>
        description="按照最近 trace 时间倒序查看原始活动。"
        emptyLabel="还没有 recent traces。"
        icon={Activity02Icon}
        isLoading={isLoading}
        items={snapshot?.recentTraces ?? []}
        title="Recent Traces"
        renderItem={(item: DashboardTrace) => (
          <TraceItem key={item.trace_id ?? item.timestamp} trace={item} />
        )}
      />
      <ActivityCard<DashboardDecisionEvent>
        description="聚合 decision event，方便判断哪里需要继续跟踪。"
        emptyLabel="最近没有 decision events。"
        icon={TaskDone02Icon}
        isLoading={isLoading}
        items={snapshot?.decisionEvents ?? []}
        title="Decision Events"
        renderItem={(item: DashboardDecisionEvent) => (
          <DecisionItem event={item} key={item.id ?? item.timestamp} />
        )}
      />
    </div>
  )
}

function ActivityCard<T,>({
  description,
  emptyLabel,
  icon,
  isLoading,
  items,
  renderItem,
  title,
}: {
  description: string
  emptyLabel: string
  icon: ComponentProps<typeof HugeiconsIcon>['icon']
  isLoading: boolean
  items: T[]
  renderItem: (item: T) => ReactNode
  title: string
}) {
  return (
    <Card className="border-border/70">
      <CardHeader>
        <div className="flex items-center gap-2">
          <HugeiconsIcon icon={icon} size={18} strokeWidth={1.8} />
          <CardTitle>{title}</CardTitle>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading && items.length === 0 ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-20 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
            {emptyLabel}
          </div>
        ) : (
          <div className="space-y-3">{items.map(renderItem)}</div>
        )}
      </CardContent>
    </Card>
  )
}

function TraceItem({ trace }: { trace: DashboardTrace }) {
  return (
    <div className="rounded-lg border border-border/70 bg-muted/35 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="font-medium">{trace.event_type ?? 'unknown event'}</p>
          <p className="text-sm text-muted-foreground">
            {trace.runtime ?? 'unknown'} · {trace.session_id ?? 'no-session'}
          </p>
        </div>
        <Badge variant={getSkillStatusBadgeVariant(trace.status)}>{trace.status ?? 'unknown'}</Badge>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span>{formatDateTime(trace.timestamp)}</span>
        <span>{formatRelativeTime(trace.timestamp)}</span>
        {Array.isArray(trace.skill_refs) && trace.skill_refs.length > 0 ? (
          <span>{trace.skill_refs.slice(0, 2).join(', ')}</span>
        ) : null}
      </div>
    </div>
  )
}

function DecisionItem({ event }: { event: DashboardDecisionEvent }) {
  return (
    <div className="rounded-lg border border-border/70 bg-muted/35 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="font-medium">{event.skillId ?? event.tag ?? 'decision event'}</p>
          <p className="text-sm text-muted-foreground">
            {event.ruleName ?? 'no rule'} · {event.businessTag ?? 'no business tag'}
          </p>
        </div>
        <Badge variant={getSkillStatusBadgeVariant(event.status)}>{event.status ?? 'unknown'}</Badge>
      </div>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        {event.judgment ?? event.nextAction ?? event.reason ?? '暂无详情'}
      </p>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span>{formatDateTime(event.timestamp)}</span>
        <span>{formatRelativeTime(event.timestamp)}</span>
      </div>
    </div>
  )
}
