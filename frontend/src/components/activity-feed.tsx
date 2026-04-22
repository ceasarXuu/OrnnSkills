import { Activity, ArrowRightCircle, WandSparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatRelativeTime } from '@/lib/formatters'
import type { DashboardDecisionEvent, DashboardTrace, ProjectSnapshot } from '@/types/dashboard'

interface ActivityFeedProps {
  isLoading: boolean
  snapshot: ProjectSnapshot | null
}

type FeedItem =
  | { kind: 'decision'; timestamp: string; title: string; detail: string; tone: 'accent' | 'success' | 'warning' | 'neutral' }
  | { kind: 'trace'; timestamp: string; title: string; detail: string; tone: 'neutral' | 'success' | 'warning' }

function toDecisionItem(event: DashboardDecisionEvent): FeedItem | null {
  if (!event.timestamp) {
    return null
  }

  const tag = event.tag ?? 'event'
  const title = event.skillId ? `${event.skillId} · ${tag}` : tag
  const detail = [
    event.status,
    event.reason,
    event.ruleName,
    event.changeType,
    event.judgment,
    event.nextAction,
  ]
    .filter(Boolean)
    .join(' · ')

  return {
    kind: 'decision',
    timestamp: event.timestamp,
    title,
    detail: detail || '业务语义事件',
    tone:
      event.status === 'success'
        ? 'success'
        : event.status === 'failed' || event.status === 'needs_patch'
          ? 'warning'
          : tag === 'patch_applied'
            ? 'accent'
            : 'neutral',
  }
}

function toTraceItem(trace: DashboardTrace): FeedItem | null {
  if (!trace.timestamp) {
    return null
  }

  const skillLabel = trace.skill_refs?.[0] ?? 'unmapped'
  return {
    kind: 'trace',
    timestamp: trace.timestamp,
    title: `${skillLabel} · ${trace.event_type ?? 'trace'}`,
    detail: [trace.runtime, trace.status, trace.session_id].filter(Boolean).join(' · ') || 'trace',
    tone: trace.status === 'success' ? 'success' : trace.status === 'failed' ? 'warning' : 'neutral',
  }
}

function buildFeed(
  decisionEvents: DashboardDecisionEvent[],
  recentTraces: DashboardTrace[],
): FeedItem[] {
  return decisionEvents
    .map(toDecisionItem)
    .concat(recentTraces.map(toTraceItem))
    .filter((item): item is FeedItem => Boolean(item))
    .sort((left, right) => right.timestamp.localeCompare(left.timestamp))
    .slice(0, 10)
}

function getTone(tone: FeedItem['tone']) {
  switch (tone) {
    case 'accent':
      return 'default' as const
    case 'success':
      return 'default' as const
    case 'warning':
      return 'destructive' as const
    default:
      return 'secondary' as const
  }
}

function getIcon(kind: FeedItem['kind']) {
  if (kind === 'decision') {
    return WandSparkles
  }
  return Activity
}

export function ActivityFeed({ isLoading, snapshot }: ActivityFeedProps) {
  const feed = buildFeed(snapshot?.decisionEvents ?? [], snapshot?.recentTraces ?? [])

  return (
    <Card>
      <CardHeader>
        <CardTitle>活动时间线</CardTitle>
        <CardDescription>把 `decisionEvents + recentTraces` 统一收成业务可读的活动流。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="text-sm text-muted-foreground">正在同步活动事件...</div>
        ) : feed.length === 0 ? (
          <div className="text-sm text-muted-foreground">当前项目还没有新的 trace 或决策事件。</div>
        ) : (
          feed.map((item) => {
            const Icon = getIcon(item.kind)
            return (
              <div
                className="flex gap-4 rounded-xl border border-border bg-muted/30 px-4 py-4"
                key={`${item.kind}-${item.timestamp}-${item.title}`}
              >
                <div className="mt-1 flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-background">
                  <Icon className="size-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
                    <Badge variant={getTone(item.tone)}>{item.kind}</Badge>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.detail}</p>
                  <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <ArrowRightCircle className="size-3.5" />
                    <span>{formatRelativeTime(item.timestamp)}</span>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}
