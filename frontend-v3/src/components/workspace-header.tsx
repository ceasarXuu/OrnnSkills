import { Clock01Icon, RefreshIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  formatRelativeTime,
  getConnectionBadgeVariant,
  getViewCopy,
} from '@/lib/format'
import type { ConnectionState, DashboardProject, DashboardView } from '@/types/dashboard'

interface WorkspaceHeaderProps {
  connectionState: ConnectionState
  currentView: DashboardView
  lastSyncedAt: string | null
  onRefresh: () => void | Promise<void>
  projectCount: number
  selectedProject: DashboardProject | null
}

export function WorkspaceHeader({
  connectionState,
  currentView,
  lastSyncedAt,
  onRefresh,
  projectCount,
  selectedProject,
}: WorkspaceHeaderProps) {
  const copy = getViewCopy(currentView)

  return (
    <Card className="border-border/70">
      <CardContent className="px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-3">
              <div className="text-[11px] font-medium uppercase tracking-[0.32em] text-muted-foreground">
                {copy.eyebrow}
              </div>
              <div className="space-y-2">
                <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                  {copy.title}
                </h1>
                <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                  {copy.description}
                </p>
              </div>
            </div>

            <div className="flex flex-col items-start gap-3 xl:items-end">
              <div className="flex flex-wrap gap-2">
                <Badge variant={getConnectionBadgeVariant(connectionState)}>
                  {connectionState === 'connected'
                    ? 'SSE 已连接'
                    : connectionState === 'reconnecting'
                      ? 'SSE 重连中'
                      : connectionState === 'error'
                        ? 'SSE 失败'
                        : 'SSE 连接中'}
                </Badge>
                <Badge variant="outline">{projectCount} Projects</Badge>
                {selectedProject ? (
                  <Badge variant="outline">{selectedProject.name}</Badge>
                ) : null}
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

          <Tabs value={currentView}>
            <TabsList variant="default">
              <TabsTrigger asChild value="skills">
                <Link to="/skills">技能</Link>
              </TabsTrigger>
              <TabsTrigger asChild value="projects">
                <Link to="/projects">项目</Link>
              </TabsTrigger>
              <TabsTrigger asChild value="activity">
                <Link to="/activity">活动</Link>
              </TabsTrigger>
              <TabsTrigger asChild value="config">
                <Link to="/config">配置</Link>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardContent>
    </Card>
  )
}
