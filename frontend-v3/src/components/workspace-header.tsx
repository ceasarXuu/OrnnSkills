import { SparklesIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Link } from 'react-router-dom'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { DashboardView } from '@/types/dashboard'

interface WorkspaceHeaderProps {
  currentView: DashboardView
}

export function WorkspaceHeader({ currentView }: WorkspaceHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1680px] px-4 py-4 xl:px-6">
        <div className="flex items-center gap-4">
          <Link className="flex items-center gap-3" to="/skills">
            <Avatar size="lg">
              <AvatarFallback>
                <HugeiconsIcon icon={SparklesIcon} size={16} strokeWidth={1.8} />
              </AvatarFallback>
            </Avatar>
            <div className="font-medium tracking-tight">OrnnSkills</div>
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
      </div>
    </header>
  )
}
