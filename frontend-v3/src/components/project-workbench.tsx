import { SkillsTable } from '@/components/skills-table'
import type { DashboardSkill } from '@/types/dashboard'

interface ProjectWorkbenchProps {
  isLoading: boolean
  onQueryChange: (value: string) => void
  onSelectSkill: (skill: DashboardSkill) => void
  query: string
  selectedSkillKey: string
  skills: DashboardSkill[]
}

export function ProjectWorkbench({
  isLoading,
  onQueryChange,
  onSelectSkill,
  query,
  selectedSkillKey,
  skills,
}: ProjectWorkbenchProps) {
  return (
    <SkillsTable
      isLoading={isLoading}
      onQueryChange={onQueryChange}
      onSelectSkill={onSelectSkill}
      query={query}
      selectedSkillKey={selectedSkillKey}
      skills={skills}
    />
  )
}
