import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'
import { CostWorkspace } from '@/components/cost-workspace'
import { dashboardStoryParameters } from '@/stories/dashboard-storybook'
import { storyAgentUsage, storyProjects, storyProviderCatalog } from '@/stories/dashboard-v3-fixtures'

const meta = {
  title: 'Dashboard V3/Cost/CostWorkspace',
  component: CostWorkspace,
  tags: ['stable', 'screen'],
  parameters: dashboardStoryParameters({
    width: '1180px',
  }),
  args: {
    agentUsage: storyAgentUsage,
    catalogError: null,
    isCatalogLoading: false,
    isSnapshotLoading: false,
    projectName: storyProjects[0].name,
    projectPath: storyProjects[0].path,
    providerCatalog: storyProviderCatalog,
  },
} satisfies Meta<typeof CostWorkspace>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText('成本')).toBeInTheDocument()
    await expect(canvas.getByText('模型成本拆分')).toBeInTheDocument()
    await expect(canvas.getByText('deepseek/deepseek-chat')).toBeInTheDocument()
  },
}

export const Empty: Story = {
  args: {
    agentUsage: null,
  },
}

export const CatalogUnavailable: Story = {
  args: {
    catalogError: 'catalog failed',
    providerCatalog: [],
  },
}

export const Loading: Story = {
  args: {
    agentUsage: null,
    isSnapshotLoading: true,
  },
}

