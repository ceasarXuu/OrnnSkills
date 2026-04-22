import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useNavigate,
  useParams,
} from 'react-router-dom'
import { DashboardViewPanels } from '@/components/dashboard-view-panels'
import { ProjectOverviewHero } from '@/components/project-overview-hero'
import { ProjectSidebar } from '@/components/project-sidebar'
import { SkillDetailDialog } from '@/components/skill-detail-dialog'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useDashboardWorkspace } from '@/features/dashboard/use-dashboard-workspace'
import {
  DEFAULT_DASHBOARD_VIEW,
  normalizeDashboardView,
  type DashboardView,
} from '@/features/dashboard/workspace-state'
import { logDashboardUiEvent } from '@/lib/dashboard-client'
import type { DashboardSkill } from '@/types/dashboard'

function App() {
  return (
    <BrowserRouter basename="/v2">
      <Routes>
        <Route path="/" element={<Navigate replace to={`/${DEFAULT_DASHBOARD_VIEW}`} />} />
        <Route path="/:view/*" element={<DashboardWorkspacePage />} />
        <Route path="*" element={<Navigate replace to={`/${DEFAULT_DASHBOARD_VIEW}`} />} />
      </Routes>
    </BrowserRouter>
  )
}

function DashboardWorkspacePage() {
  const navigate = useNavigate()
  const { view } = useParams<{ view?: string }>()
  const currentView = normalizeDashboardView(view)
  const [selectedSkill, setSelectedSkill] = useState<DashboardSkill | null>(null)
  const {
    connectionState,
    isLoadingProjects,
    isLoadingSnapshot,
    lastSyncedAt,
    loadError,
    projects,
    refreshWorkspace,
    selectedProject,
    selectedProjectId,
    selectedSnapshot,
    setSelectedProjectId,
  } = useDashboardWorkspace()

  useEffect(() => {
    if (view !== currentView) {
      navigate(`/${currentView}`, { replace: true })
    }
  }, [currentView, navigate, view])

  useEffect(() => {
    logDashboardUiEvent('workspace.view_changed', { view: currentView })
  }, [currentView])

  useEffect(() => {
    setSelectedSkill(null)
  }, [selectedProjectId])

  const selectedSkillKey = useMemo(() => {
    if (!selectedSkill) {
      return ''
    }

    return `${selectedSkill.skillId}:${selectedSkill.runtime ?? 'unknown'}`
  }, [selectedSkill])

  const handleViewChange = useCallback(
    (nextView: string) => {
      navigate(`/${normalizeDashboardView(nextView)}`)
    },
    [navigate],
  )

  const handleSkillSelect = useCallback(
    (skill: DashboardSkill) => {
      setSelectedSkill(skill)
      logDashboardUiEvent('workspace.skill_dialog_opened', {
        skillId: skill.skillId,
        runtime: skill.runtime ?? 'unknown',
        view: currentView,
      })
    },
    [currentView],
  )

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto grid min-h-screen max-w-[1800px] grid-cols-1 xl:grid-cols-[300px_minmax(0,1fr)]">
        <ProjectSidebar
          connectionState={connectionState}
          isLoading={isLoadingProjects}
          onRefresh={refreshWorkspace}
          onSelect={setSelectedProjectId}
          projects={projects}
          selectedProjectId={selectedProjectId}
        />
        <main className="border-l border-border/70 bg-background">
          <div className="flex min-h-screen flex-col gap-6 px-5 py-6 sm:px-8 sm:py-8 lg:px-10">
            <Tabs className="gap-6" onValueChange={handleViewChange} value={currentView}>
              <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.32em] text-muted-foreground">
                    Dashboard V2 Workspace
                  </p>
                  <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                    独立前端工作台
                  </h1>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <TabsList className="h-auto flex-wrap rounded-xl bg-muted p-1" variant="default">
                    <ViewTrigger value="projects">项目</ViewTrigger>
                    <ViewTrigger value="skills">技能</ViewTrigger>
                    <ViewTrigger value="activity">活动</ViewTrigger>
                  </TabsList>
                  <Button onClick={() => void refreshWorkspace()} size="sm" variant="secondary">
                    <RefreshCw data-icon="inline-start" />
                    刷新
                  </Button>
                </div>
              </div>

              <ProjectOverviewHero
                connectionState={connectionState}
                isLoading={isLoadingSnapshot}
                lastSyncedAt={lastSyncedAt}
                project={selectedProject}
                snapshot={selectedSnapshot}
              />

              {loadError ? (
                <div className="rounded-xl border border-destructive/20 bg-destructive/10 px-5 py-4 text-sm text-destructive">
                  {loadError}
                </div>
              ) : null}

              <DashboardViewPanels
                isLoadingSnapshot={isLoadingSnapshot}
                onSelectSkill={handleSkillSelect}
                selectedSkillKey={selectedSkillKey}
                snapshot={selectedSnapshot}
              />
            </Tabs>
          </div>
        </main>
      </div>

      <SkillDetailDialog
        onOpenChange={(open) => {
          if (!open) {
            setSelectedSkill(null)
          }
        }}
        open={Boolean(selectedSkill)}
        skill={selectedSkill}
      />
    </div>
  )
}

interface ViewTriggerProps {
  children: string
  value: DashboardView
}

function ViewTrigger({ children, value }: ViewTriggerProps) {
  return <TabsTrigger value={value}>{children}</TabsTrigger>
}

export default App
