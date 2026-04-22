import { useEffect, useMemo, useState } from 'react'
import { Link, BrowserRouter, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import { ActivityStream } from '@/components/activity-stream'
import { DashboardHero } from '@/components/dashboard-hero'
import { InsightStack } from '@/components/insight-stack'
import { MetricGrid } from '@/components/metric-grid'
import { ProjectRail } from '@/components/project-rail'
import { ProjectStatusPanel } from '@/components/project-status-panel'
import { SkillDetailDialog } from '@/components/skill-detail-dialog'
import { SkillsTable } from '@/components/skills-table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useDashboardV3Workspace } from '@/features/dashboard/use-dashboard-v3-workspace'
import { logDashboardV3Event } from '@/lib/dashboard-api'
import { sortSkills } from '@/lib/format'
import type { DashboardSkill, DashboardView } from '@/types/dashboard'

const DASHBOARD_VIEWS: DashboardView[] = ['skills', 'projects', 'activity']

function normalizeDashboardView(view?: string): DashboardView {
  if (view && DASHBOARD_VIEWS.includes(view as DashboardView)) {
    return view as DashboardView
  }

  return 'skills'
}

function App() {
  return (
    <BrowserRouter basename="/v3">
      <Routes>
        <Route element={<Navigate replace to="/skills" />} path="/" />
        <Route element={<DashboardWorkspacePage />} path="/:view" />
        <Route element={<Navigate replace to="/skills" />} path="*" />
      </Routes>
    </BrowserRouter>
  )
}

function DashboardWorkspacePage() {
  const navigate = useNavigate()
  const { view } = useParams<{ view?: string }>()
  const currentView = normalizeDashboardView(view)
  const [query, setQuery] = useState('')
  const [selectedSkill, setSelectedSkill] = useState<DashboardSkill | null>(null)
  const {
    connectionState,
    isLoadingProjects,
    isLoadingSnapshot,
    lastSyncedAt,
    loadError,
    projects,
    refreshWorkspace,
    selectProject,
    selectedProject,
    selectedProjectId,
    selectedSnapshot,
  } = useDashboardV3Workspace()

  useEffect(() => {
    if (view !== currentView) {
      navigate(`/${currentView}`, { replace: true })
    }
  }, [currentView, navigate, view])

  useEffect(() => {
    setQuery('')
    setSelectedSkill(null)
  }, [selectedProjectId])

  const filteredSkills = useMemo(() => {
    const skills = sortSkills(selectedSnapshot?.skills ?? [])
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) {
      return skills
    }

    return skills.filter((skill) => {
      return [skill.skillId, skill.runtime, skill.status]
        .filter((value) => typeof value === 'string')
        .some((value) => value!.toLowerCase().includes(normalizedQuery))
    })
  }, [query, selectedSnapshot?.skills])

  const selectedSkillKey = selectedSkill
    ? `${selectedSkill.skillId}:${selectedSkill.runtime ?? 'unknown'}`
    : ''

  useEffect(() => {
    logDashboardV3Event('workspace.view_changed', { view: currentView })
  }, [currentView])

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <div className="mx-auto grid min-h-screen max-w-[1680px] gap-6 px-4 py-4 lg:grid-cols-[320px_minmax(0,1fr)] xl:px-6">
        <ProjectRail
          connectionState={connectionState}
          isLoading={isLoadingProjects}
          onRefresh={() => refreshWorkspace('manual')}
          onSelect={selectProject}
          projects={projects}
          selectedProjectId={selectedProjectId}
        />

        <main className="space-y-6 py-1">
          <DashboardHero
            currentView={currentView}
            isLoading={isLoadingSnapshot}
            lastSyncedAt={lastSyncedAt}
            onRefresh={() => refreshWorkspace('manual')}
            project={selectedProject}
            snapshot={selectedSnapshot}
          />

          <MetricGrid
            isLoading={isLoadingSnapshot}
            project={selectedProject}
            snapshot={selectedSnapshot}
          />

          <ViewTabs currentView={currentView} />

          {loadError ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {loadError}
            </div>
          ) : null}

          {currentView === 'skills' ? (
            <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.5fr)_360px]">
              <SkillsTable
                isLoading={isLoadingSnapshot}
                onQueryChange={setQuery}
                onSelectSkill={setSelectedSkill}
                query={query}
                selectedSkillKey={selectedSkillKey}
                skills={filteredSkills}
              />
              <InsightStack snapshot={selectedSnapshot} />
            </div>
          ) : null}

          {currentView === 'projects' ? (
            <ProjectStatusPanel project={selectedProject} snapshot={selectedSnapshot} />
          ) : null}

          {currentView === 'activity' ? (
            <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.35fr)_360px]">
              <ActivityStream isLoading={isLoadingSnapshot} snapshot={selectedSnapshot} />
              <InsightStack snapshot={selectedSnapshot} />
            </div>
          ) : null}
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

function ViewTabs({ currentView }: { currentView: DashboardView }) {
  return (
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
      </TabsList>
    </Tabs>
  )
}

export default App
