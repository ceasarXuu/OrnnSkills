import { SkillsHeroBand } from '@/components/skills-hero-band'
import { SkillsInsightRail } from '@/components/skills-insight-rail'
import { SkillsScopeSidebar } from '@/components/skills-scope-sidebar'
import { SkillsTable } from '@/components/skills-table'
import { buildSkillsOverview } from '@/lib/skills-workspace'
import type { DashboardProject, DashboardSkill, ProjectSnapshot } from '@/types/dashboard'

interface SkillsWorkspaceProps {
  filteredSkills: DashboardSkill[]
  isLoading: boolean
  onQueryChange: (value: string) => void
  onSelectProject: (projectPath: string) => void
  onSelectSkill: (skill: DashboardSkill) => void
  projects: DashboardProject[]
  query: string
  selectedProjectId: string
  selectedSkillKey: string
  snapshot: ProjectSnapshot | null
}

export function SkillsWorkspace({
  filteredSkills,
  isLoading,
  onQueryChange,
  onSelectProject,
  onSelectSkill,
  projects,
  query,
  selectedProjectId,
  selectedSkillKey,
  snapshot,
}: SkillsWorkspaceProps) {
  const allSkills = snapshot?.skills ?? []
  const overview = buildSkillsOverview(allSkills)

  return (
    <div className="space-y-8">
      <SkillsHeroBand overview={overview} />

      <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)] xl:items-start">
        <aside>
          <SkillsScopeSidebar
            onSelect={onSelectProject}
            projects={projects}
            selectedProjectId={selectedProjectId}
          />
        </aside>

        <section className="min-w-0">
          <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_320px] 2xl:items-start">
            <SkillsTable
              isLoading={isLoading}
              onQueryChange={onQueryChange}
              onSelectSkill={onSelectSkill}
              query={query}
              selectedSkillKey={selectedSkillKey}
              skills={filteredSkills}
            />
            <SkillsInsightRail snapshot={snapshot} />
          </div>
        </section>
      </div>
    </div>
  )
}
