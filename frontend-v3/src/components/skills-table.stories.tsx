import type { Meta, StoryObj } from '@storybook/react-vite'
import { useMemo, useState, type ComponentProps } from 'react'
import { expect, fn } from 'storybook/test'
import { SkillsTable } from '@/components/skills-table'
import { sortSkills } from '@/lib/format'
import { dashboardStoryParameters } from '@/stories/dashboard-storybook'
import { storyProjectSkills } from '@/stories/dashboard-v3-fixtures'
import type { DashboardSkill } from '@/types/dashboard'

type SkillsTableStoryArgs = ComponentProps<typeof SkillsTable>

function filterProjectSkills(skills: DashboardSkill[], query: string) {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) {
    return sortSkills(skills)
  }

  return sortSkills(skills).filter((skill) => {
    return [skill.skillId, skill.runtime, skill.status]
      .filter((value) => typeof value === 'string')
      .some((value) => value!.toLowerCase().includes(normalizedQuery))
  })
}

function InteractiveSkillsTable(args: SkillsTableStoryArgs) {
  const [query, setQuery] = useState(args.query)
  const [selectedSkillKey, setSelectedSkillKey] = useState(args.selectedSkillKey)
  const visibleSkills = useMemo(
    () => filterProjectSkills(args.skills, query),
    [args.skills, query],
  )

  return (
    <SkillsTable
      {...args}
      onQueryChange={(value) => {
        setQuery(value)
        args.onQueryChange(value)
      }}
      onSelectSkill={(skill) => {
        setSelectedSkillKey(`${skill.skillId}:${skill.runtime ?? 'unknown'}`)
        args.onSelectSkill(skill)
      }}
      query={query}
      selectedSkillKey={selectedSkillKey}
      skills={visibleSkills}
    />
  )
}

const meta = {
  title: 'Dashboard V3/Project/SkillsTable',
  component: SkillsTable,
  tags: ['stable', 'pattern'],
  parameters: dashboardStoryParameters({
    width: '1040px',
  }),
  args: {
    isLoading: false,
    onQueryChange: fn(),
    onSelectSkill: fn(),
    query: '',
    selectedSkillKey: 'systematic-debugging:codex',
    skills: storyProjectSkills,
  },
} satisfies Meta<typeof SkillsTable>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args) => <InteractiveSkillsTable {...args} />,
}

export const SearchAndSelect: Story = {
  render: (args) => <InteractiveSkillsTable {...args} />,
  play: async ({ args, canvas, userEvent }) => {
    const search = canvas.getByPlaceholderText('搜索 skill id / runtime / status')
    await userEvent.clear(search)
    await userEvent.type(search, 'frontend-design')
    await expect(args.onQueryChange).toHaveBeenCalled()

    const skillCell = canvas.getAllByText('frontend-design')[0]
    const row = skillCell.closest('tr')
    expect(row).not.toBeNull()
    if (!row) {
      return
    }

    await userEvent.click(row)
    await expect(args.onSelectSkill).toHaveBeenCalled()
    await expect(row).toHaveAttribute('data-state', 'selected')
  },
}

export const Paginate: Story = {
  render: (args) => <InteractiveSkillsTable {...args} />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('link', { name: '2' }))
    await expect(canvas.getByText('显示第 13-18 条，共 18 条')).toBeInTheDocument()
  },
}

export const Loading: Story = {
  args: {
    isLoading: true,
    query: '',
    selectedSkillKey: '',
    skills: [],
  },
}

export const Empty: Story = {
  args: {
    query: '',
    selectedSkillKey: '',
    skills: [],
  },
}
