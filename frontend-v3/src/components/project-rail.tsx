import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCompactNumber, formatRelativeTime, getMonitoringBadgeVariant } from '@/lib/format'
import type { DashboardProject } from '@/types/dashboard'

interface ProjectRailProps {
  isLoading: boolean
  onSelect: (projectPath: string) => void
  projects: DashboardProject[]
  selectedProjectId: string
}

export function ProjectRail({
  isLoading,
  onSelect,
  projects,
  selectedProjectId,
}: ProjectRailProps) {
  return (
    <aside className="lg:sticky lg:top-24 lg:self-start">
      <Card className="border-border/70 bg-card/92">
        <CardHeader className="gap-4 border-b border-border/70">
          <div className="space-y-1">
            <CardTitle className="text-xl">项目</CardTitle>
            <div className="text-sm text-muted-foreground">
              {formatCompactNumber(projects.length)} 个项目
            </div>
          </div>
        </CardHeader>

        <CardContent className="px-0">
          {isLoading && projects.length === 0 ? (
            <div className="space-y-3 px-6 py-6">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton className="h-24 w-full rounded-xl" key={index} />
              ))}
            </div>
          ) : projects.length === 0 ? (
            <div className="px-6 py-16 text-center text-sm text-muted-foreground">
              当前没有可用项目。
            </div>
          ) : (
            <ScrollArea className="h-[min(72vh,920px)]">
              <div className="space-y-2 px-4 py-4">
                {projects.map((project) => {
                  const isActive = project.path === selectedProjectId
                  return (
                    <button
                      className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                        isActive
                          ? 'border-primary/50 bg-primary/8'
                          : 'border-border/70 bg-background/30 hover:border-primary/30 hover:bg-muted/40'
                      }`}
                      key={project.path}
                      onClick={() => onSelect(project.path)}
                      type="button"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                          <div className="truncate font-medium">{project.name}</div>
                          <div className="truncate text-xs text-muted-foreground">{project.path}</div>
                        </div>
                        <Badge variant={getMonitoringBadgeVariant(project.monitoringState)}>
                          {project.monitoringState === 'paused' ? 'Paused' : 'Active'}
                        </Badge>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span>{formatCompactNumber(project.skillCount)} skills</span>
                        <span>{formatRelativeTime(project.lastSeenAt)}</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </aside>
  )
}
