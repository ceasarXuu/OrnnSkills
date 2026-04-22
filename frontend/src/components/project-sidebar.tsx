import { Circle, PauseCircle, RefreshCw, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ConnectionState, DashboardProject } from '@/types/dashboard'

interface ProjectSidebarProps {
  connectionState: ConnectionState
  isLoading: boolean
  onRefresh: () => void
  onSelect: (projectId: string) => void
  projects: DashboardProject[]
  selectedProjectId: string
}

function getConnectionCopy(state: ConnectionState) {
  switch (state) {
    case 'connected':
      return { label: 'SSE 已连接', variant: 'default' as const }
    case 'reconnecting':
      return { label: '正在重连', variant: 'outline' as const }
    case 'error':
      return { label: '连接异常', variant: 'destructive' as const }
    default:
      return { label: '正在连接', variant: 'secondary' as const }
  }
}

export function ProjectSidebar({
  connectionState,
  isLoading,
  onRefresh,
  onSelect,
  projects,
  selectedProjectId,
}: ProjectSidebarProps) {
  const connection = getConnectionCopy(connectionState)

  return (
    <aside className="border-b border-border/70 bg-sidebar text-sidebar-foreground xl:border-r xl:border-b-0">
      <div className="flex h-full flex-col gap-6 px-5 py-6 sm:px-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl border border-border bg-card text-primary">
                <Sparkles className="size-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">OrnnSkills</p>
                <p className="text-xs text-muted-foreground">独立 v2 入口</p>
              </div>
            </div>
          </div>
          <Button size="icon" variant="ghost" onClick={onRefresh}>
            <RefreshCw className="size-4" />
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Badge variant={connection.variant}>{connection.label}</Badge>
          <Badge variant="secondary">{projects.length} Projects</Badge>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.26em] text-muted-foreground">
            Boundary
          </p>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            新前端只消费现有 API 与 SSE，不复用旧 HTML 字符串、旧类名或旧样式层。
          </p>
        </div>

        <div className="flex-1 overflow-hidden">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[11px] font-medium uppercase tracking-[0.26em] text-muted-foreground">
              Projects
            </p>
            {isLoading ? (
              <span className="text-xs text-muted-foreground">loading</span>
            ) : null}
          </div>

          <div className="space-y-3 overflow-y-auto pr-1">
            {projects.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
                还没有已注册项目。
              </div>
            ) : null}
            {projects.map((project) => {
              const isActive = project.path === selectedProjectId
              const isPaused = project.monitoringState === 'paused' || project.isPaused

              return (
                <button
                  className={cn(
                    'w-full rounded-xl border px-4 py-4 text-left transition-colors',
                    isActive
                      ? 'border-primary/30 bg-primary/10'
                      : 'border-border bg-card hover:bg-muted/50',
                  )}
                  key={project.path}
                  onClick={() => onSelect(project.path)}
                  type="button"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{project.name}</p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">{project.path}</p>
                    </div>
                    {isPaused ? (
                      <PauseCircle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <Circle
                        className={cn(
                          'mt-0.5 size-4 shrink-0',
                          project.isRunning ? 'fill-primary text-primary' : 'text-muted-foreground',
                        )}
                      />
                    )}
                  </div>
                  <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{project.skillCount ?? 0} skills</span>
                    <span>{isPaused ? 'Paused' : project.isRunning ? 'Running' : 'Idle'}</span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </aside>
  )
}
