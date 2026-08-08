import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn } from 'storybook/test'
import { ProjectWorkbench } from '@/components/project-workbench'
import { dashboardStoryParameters } from '@/stories/dashboard-storybook'
import {
  storyAgentUsage,
  storyProjectSkills,
  storyProjects,
  storyProviderCatalog,
} from '@/stories/dashboard-v3-fixtures'

const meta = {
  title: 'Dashboard V3/Project/ProjectWorkbench',
  component: ProjectWorkbench,
  tags: ['stable', 'screen'],
  parameters: dashboardStoryParameters({
    width: '1180px',
  }),
  args: {
    agentUsage: storyAgentUsage,
    catalogError: null,
    isCatalogLoading: false,
    isLoading: false,
    onQueryChange: fn(),
    onSelectSkill: fn(),
    projectName: storyProjects[0].name,
    projectPath: storyProjects[0].path,
    providerCatalog: storyProviderCatalog,
    query: '',
    selectedSkillKey: '',
    skills: storyProjectSkills,
  },
} satisfies Meta<typeof ProjectWorkbench>

export default meta

type Story = StoryObj<typeof meta>

export const SkillsDefault: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('tab', { name: '技能' })).toBeInTheDocument()
    await expect(canvas.getByText('技能列表')).toBeInTheDocument()
  },
}

export const CostSelected: Story = {
  args: {
    defaultTab: 'cost',
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('tab', { name: '成本' })).toBeInTheDocument()
    await expect(canvas.getByText('模型成本拆分')).toBeInTheDocument()
  },
}

export const CostEmpty: Story = {
  args: {
    agentUsage: null,
    defaultTab: 'cost',
  },
}
