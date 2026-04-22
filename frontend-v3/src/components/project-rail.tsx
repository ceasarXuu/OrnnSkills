import { Activity02Icon, DashboardSquare01Icon, FolderLibraryIcon, RefreshIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import {
  formatCompactNumber,
  formatRelativeTime,
  getConnectionBadgeVariant,
  getMonitoringBadgeVariant,
} from '@/lib/format'
import type { ConnectionState, DashboardProject } from '@/types/dashboard'

interface ProjectRailProps {
  connectionState: ConnectionState
  isLoading: boolean
  onRefresh: () => void | Promise<void>
  onSelect: (projectPath: string) => void
  projects: DashboardProject[]
  selectedProjectId: string
}

export function ProjectRail({
  connectionState,
  isLoading,
  onRefresh,
  onSelect,
  projects,
  selectedProjectId,
}: ProjectRailProps) {
  return (
    <aside className="flex flex-col gap-4 lg:sticky lg:top-0 lg:h-screen lg:py-5">
      <div className="flex items-start justify-between gap-3 rounded-xl border border-border/70 bg-card px-4 py-4">
        <div className="flex items-start gap-3">
          <div className="flex size-11 items-center justify-center rounded-full border border-border/70 bg-primary/10 text-primary">
            <HugeiconsIcon icon={DashboardSquare01Icon} size={18} strokeWidth={1.8} />
          </div>
          <div className="space-y-2">
            <div>
              <p className="text-base font-semibold">OrnnSkills</p>
              <p className="text-sm text-muted-foreground">全新隔离的 v3 工作台</p>
            </div>
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
              <Badge variant="outline">{projects.length} Projects</Badge>
            </div>
          </div>
        </div>
        <Button onClick={() => void onRefresh()} size="icon-sm" variant="outline">
          <HugeiconsIcon icon={RefreshIcon} size={16} strokeWidth={1.8} />
          <span className="sr-only">刷新</span>
        </Button>
      </div>

      <div className="space-y-3">
        {isLoading && projects.length === 0 ? (
          Array.from({ length: 3 }).map((_, index) => (
            <Card key={index} className="border-border/70">
              <CardHeader>
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-40" />
              </CardHeader>
              <CardContent className="flex gap-2">
                <Skeleton className="h-5 w-18 rounded-full" />
                <Skeleton className="h-5 w-14 rounded-full" />
              </CardContent>
            </Card>
          ))
        ) : (
          projects.map((project) => {
            const isActive = project.path === selectedProjectId
            return (
              <button
                key={project.path}
                className="block w-full text-left"
                onClick={() => onSelect(project.path)}
                type="button"
              >
                <Card
                  className={cn(
                    'border-border/70 transition-colors hover:border-primary/40 hover:bg-muted/50',
                    isActive && 'border-primary/45 bg-primary/8',
                  )}
                  size="sm"
                >
                  <CardHeader className="gap-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <CardTitle className="truncate text-base">{project.name}</CardTitle>
                        <CardDescription className="truncate">{project.path}</CardDescription>
                      </div>
                      <Badge variant={getMonitoringBadgeVariant(project.monitoringState)}>
                        {project.monitoringState === 'paused' ? 'Paused' : 'Active'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">
                      <HugeiconsIcon icon={FolderLibraryIcon} size={12} strokeWidth={2} />
                      {formatCompactNumber(project.skillCount)} skills
                    </Badge>
                    <Badge variant="outline">
                      <HugeiconsIcon icon={Activity02Icon} size={12} strokeWidth={2} />
                      {formatRelativeTime(project.lastSeenAt)}
                    </Badge>
                  </CardContent>
                </Card>
              </button>
            )
          })
        )}
      </div>
    </aside>
  )
}
