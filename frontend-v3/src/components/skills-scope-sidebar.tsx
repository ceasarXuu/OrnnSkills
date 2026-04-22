import { Clock01Icon, FolderLibraryIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { formatCompactNumber, formatRelativeTime } from '@/lib/format'
import type { DashboardProject } from '@/types/dashboard'

interface SkillsScopeSidebarProps {
  onSelect: (projectPath: string) => void
  projects: DashboardProject[]
  selectedProject: DashboardProject | null
  selectedProjectId: string
}

export function SkillsScopeSidebar({
  onSelect,
  projects,
  selectedProject,
  selectedProjectId,
}: SkillsScopeSidebarProps) {
  return (
    <Card className="sticky top-24 border-border/70 bg-card/86 backdrop-blur">
      <CardHeader className="gap-3">
        <div className="flex items-center gap-2">
          <HugeiconsIcon icon={FolderLibraryIcon} size={18} strokeWidth={1.8} />
          <CardTitle>Scope</CardTitle>
        </div>
        <CardDescription>项目在这里是过滤范围，不是这页的主叙事对象。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-xl border border-border/70 bg-muted/20 px-4 py-4">
          <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">Current Scope</p>
          <p className="mt-2 text-lg font-medium">{selectedProject?.name ?? '未选择项目'}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge variant="outline">{formatCompactNumber(selectedProject?.skillCount)} skills</Badge>
            <Badge variant={selectedProject?.monitoringState === 'paused' ? 'secondary' : 'default'}>
              {selectedProject?.monitoringState === 'paused' ? 'Paused' : 'Active'}
            </Badge>
          </div>
          {selectedProject?.lastSeenAt ? (
            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <HugeiconsIcon icon={Clock01Icon} size={12} strokeWidth={1.8} />
              {formatRelativeTime(selectedProject.lastSeenAt)}
            </div>
          ) : null}
        </div>

        <ScrollArea className="h-[min(48vh,420px)] rounded-xl border border-border/70">
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
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <HugeiconsIcon icon={FolderLibraryIcon} size={12} strokeWidth={1.8} />
                      {formatCompactNumber(project.skillCount)} skills
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
