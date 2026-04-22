import { Clock01Icon, FolderLibraryIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { formatCompactNumber, formatRelativeTime } from '@/lib/format'
import type { DashboardProject } from '@/types/dashboard'

interface SkillsScopeSidebarProps {
  onSelect: (projectPath: string) => void
  projects: DashboardProject[]
  selectedProjectId: string
}

export function SkillsScopeSidebar({
  onSelect,
  projects,
  selectedProjectId,
}: SkillsScopeSidebarProps) {
  return (
    <Card className="sticky top-24 border-border/70 bg-card/86 backdrop-blur">
      <CardHeader className="gap-3">
        <div className="flex items-center gap-2">
          <HugeiconsIcon icon={FolderLibraryIcon} size={18} strokeWidth={1.8} />
          <CardTitle>项目</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[min(56vh,520px)] rounded-xl border border-border/70">
          <div className="space-y-2 p-2">
            {projects.map((project) => {
              const isActive = project.path === selectedProjectId
              return (
                <Button
                  className="h-auto w-full items-start justify-start rounded-xl px-3 py-3 text-left"
                  key={project.path}
                  onClick={() => onSelect(project.path)}
                  variant={isActive ? 'secondary' : 'ghost'}
                >
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate font-medium">{project.name}</span>
                      <Badge variant={isActive ? 'default' : 'outline'}>
                        {project.monitoringState === 'paused' ? 'Paused' : 'Active'}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-2">
                        <HugeiconsIcon icon={FolderLibraryIcon} size={12} strokeWidth={1.8} />
                        {formatCompactNumber(project.skillCount)} skills
                      </span>
                      {project.lastSeenAt ? (
                        <span className="flex items-center gap-1">
                          <HugeiconsIcon icon={Clock01Icon} size={12} strokeWidth={1.8} />
                          {formatRelativeTime(project.lastSeenAt)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </Button>
              )
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
