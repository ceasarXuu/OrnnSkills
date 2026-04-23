import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { ProjectWorkbench } from '@/components/project-workbench'
import { storyProjectSkills } from '@/stories/dashboard-v3-fixtures'
import type { DashboardSkill } from '@/types/dashboard'

function InteractiveProjectWorkbench({ isLoading = false, skills = storyProjectSkills }) {
  const [query, setQuery] = useState('')
  const [selectedSkillKey, setSelectedSkillKey] = useState('systematic-debugging:codex')

  return (
    <ProjectWorkbench
      isLoading={isLoading}
      onQueryChange={setQuery}
      onSelectSkill={(skill: DashboardSkill) =>
        setSelectedSkillKey(`${skill.skillId}:${skill.runtime ?? 'unknown'}`)
      }
      query={query}
      selectedSkillKey={selectedSkillKey}
      skills={skills}
    />
  )
}

const meta = {
  title: 'Dashboard V3/ProjectWorkbench',
  component: ProjectWorkbench,
  parameters: {
    layout: 'padded',
  },
  decorators: [
    (Story) => (
      <div className="dark min-h-screen w-[1040px] bg-background p-4 text-foreground">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ProjectWorkbench>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    isLoading: false,
    onQueryChange: () => undefined,
    onSelectSkill: () => undefined,
    query: '',
    selectedSkillKey: 'systematic-debugging:codex',
    skills: storyProjectSkills,
  },
  render: () => <InteractiveProjectWorkbench />,
}

export const Loading: Story = {
  args: {
    isLoading: true,
    onQueryChange: () => undefined,
    onSelectSkill: () => undefined,
    query: '',
    selectedSkillKey: '',
    skills: [],
  },
}

export const Empty: Story = {
  args: {
    isLoading: false,
    onQueryChange: () => undefined,
    onSelectSkill: () => undefined,
    query: '',
    selectedSkillKey: '',
    skills: [],
  },
}
