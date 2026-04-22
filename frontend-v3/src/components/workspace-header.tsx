import { Clock01Icon, SparklesIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Link } from 'react-router-dom'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatRelativeTime, getConnectionBadgeVariant } from '@/lib/format'
import type { ConnectionState, DashboardProject, DashboardView } from '@/types/dashboard'

interface WorkspaceHeaderProps {
  connectionState: ConnectionState
  currentView: DashboardView
  lastSyncedAt: string | null
  projectCount: number
  selectedProject: DashboardProject | null
}

export function WorkspaceHeader({
  connectionState,
  currentView,
  lastSyncedAt,
  projectCount,
  selectedProject,
}: WorkspaceHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1680px] flex-col gap-4 px-4 py-4 xl:flex-row xl:items-center xl:justify-between xl:px-6">
        <div className="flex items-center gap-4">
          <Link className="flex items-center gap-3" to="/skills">
            <Avatar size="lg">
              <AvatarFallback>
                <HugeiconsIcon icon={SparklesIcon} size={16} strokeWidth={1.8} />
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="font-medium tracking-tight">OrnnSkills</div>
              <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                Local Skills Dashboard
              </div>
            </div>
          </Link>

          <Tabs value={currentView}>
            <TabsList variant="line">
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

        <div className="flex flex-wrap gap-2 xl:justify-end">
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
          {selectedProject ? <Badge variant="outline">{selectedProject.name}</Badge> : null}
          <Badge variant="outline">
            <HugeiconsIcon icon={Clock01Icon} size={12} strokeWidth={1.8} />
            {formatRelativeTime(lastSyncedAt)}
          </Badge>
        </div>
      </div>
    </header>
  )
}
