import { ActivityStream } from '@/components/activity-stream'
import { SkillsTable } from '@/components/skills-table'
import type { DashboardSkill, ProjectSnapshot } from '@/types/dashboard'

interface ProjectWorkbenchProps {
  isLoading: boolean
  onQueryChange: (value: string) => void
  onSelectSkill: (skill: DashboardSkill) => void
  query: string
  selectedSkillKey: string
  skills: DashboardSkill[]
  snapshot: ProjectSnapshot | null
}

export function ProjectWorkbench({
  isLoading,
  onQueryChange,
  onSelectSkill,
  query,
  selectedSkillKey,
  skills,
  snapshot,
}: ProjectWorkbenchProps) {
  return (
    <div className="space-y-6">
      <SkillsTable
        isLoading={isLoading}
        onQueryChange={onQueryChange}
        onSelectSkill={onSelectSkill}
        query={query}
        selectedSkillKey={selectedSkillKey}
        skills={skills}
      />

      <ActivityStream isLoading={isLoading} snapshot={snapshot} />
    </div>
  )
}
