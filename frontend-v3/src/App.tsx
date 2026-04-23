import { useEffect, useMemo, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import { ConfigWorkspace } from '@/components/config-workspace'
import { ProjectRail } from '@/components/project-rail'
import { ProjectWorkbench } from '@/components/project-workbench'
import { SkillDetailDialog } from '@/components/skill-detail-dialog'
import { SkillsWorkspace } from '@/components/skills-workspace'
import { WorkspaceHeader } from '@/components/workspace-header'
import { useDashboardV3Workspace } from '@/features/dashboard/use-dashboard-v3-workspace'
import { logDashboardV3Event } from '@/lib/dashboard-api'
import { sortSkills } from '@/lib/format'
import { resolveDashboardViewLayout } from '@/lib/view-layout'
import type {
  DashboardProject,
  DashboardSkill,
  DashboardView,
} from '@/types/dashboard'

const DASHBOARD_VIEWS: DashboardView[] = ['skills', 'project', 'config']

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
        <Route element={<Navigate replace to="/project" />} path="/projects" />
        <Route element={<Navigate replace to="/project" />} path="/activity" />
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
    isLoadingProjects,
    isLoadingSnapshot,
    loadError,
    projects,
    selectProject,
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
  const layout = resolveDashboardViewLayout(currentView)

  useEffect(() => {
    logDashboardV3Event('workspace.view_changed', { view: currentView })
  }, [currentView])

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[linear-gradient(180deg,color-mix(in_oklab,var(--background)_96%,transparent),color-mix(in_oklab,var(--background)_100%,transparent)),linear-gradient(0deg,color-mix(in_oklab,var(--foreground)_4%,transparent)_1px,transparent_1px),linear-gradient(90deg,color-mix(in_oklab,var(--foreground)_3%,transparent)_1px,transparent_1px)] bg-[size:auto,32px_32px,32px_32px]" />

      <WorkspaceHeader currentView={currentView} />

      <main className="mx-auto max-w-[1680px] space-y-8 overflow-x-auto px-4 py-8 xl:px-6">
        {loadError ? (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {loadError}
          </div>
        ) : null}

        {layout.showProjectRail ? (
          <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
            <ProjectRail
              isLoading={isLoadingProjects}
              onSelect={selectProject}
              projects={projects}
              selectedProjectId={selectedProjectId}
            />
            <div className="space-y-6">
              <ViewContent
                currentView={currentView}
                filteredSkills={filteredSkills}
                isLoadingSnapshot={isLoadingSnapshot}
                onQueryChange={setQuery}
                onSelectProject={selectProject}
                onSelectSkill={setSelectedSkill}
                projects={projects}
                query={query}
                selectedProjectId={selectedProjectId}
                selectedSkillKey={selectedSkillKey}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <ViewContent
              currentView={currentView}
              filteredSkills={filteredSkills}
              isLoadingSnapshot={isLoadingSnapshot}
              onQueryChange={setQuery}
              onSelectProject={selectProject}
              onSelectSkill={setSelectedSkill}
              projects={projects}
              query={query}
              selectedProjectId={selectedProjectId}
              selectedSkillKey={selectedSkillKey}
            />
          </div>
        )}
      </main>

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

interface ViewContentProps {
  currentView: DashboardView
  filteredSkills: DashboardSkill[]
  isLoadingSnapshot: boolean
  onQueryChange: (value: string) => void
  onSelectProject: (projectPath: string) => void
  onSelectSkill: (skill: DashboardSkill) => void
  projects: DashboardProject[]
  query: string
  selectedProjectId: string
  selectedSkillKey: string
}

function ViewContent({
  currentView,
  filteredSkills,
  isLoadingSnapshot,
  onQueryChange,
  onSelectProject,
  onSelectSkill,
  projects,
  query,
  selectedProjectId,
  selectedSkillKey,
}: ViewContentProps) {
  return (
    <>
      {currentView === 'skills' ? (
        <SkillsWorkspace
          onSelectProject={onSelectProject}
          projects={projects}
          selectedProjectId={selectedProjectId}
        />
      ) : null}

      {currentView === 'project' ? (
        <ProjectWorkbench
          isLoading={isLoadingSnapshot}
          onQueryChange={onQueryChange}
          onSelectSkill={onSelectSkill}
          query={query}
          selectedSkillKey={selectedSkillKey}
          skills={filteredSkills}
        />
      ) : null}

      {currentView === 'config' ? <ConfigWorkspace /> : null}
    </>
  )
}

export default App
