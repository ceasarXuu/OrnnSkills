import type { Meta, StoryObj } from '@storybook/react-vite'
import { WorkspaceHeader } from '@/components/workspace-header'
import { dashboardStoryParameters } from '@/stories/dashboard-storybook'

const meta = {
  title: 'Dashboard V3/Shell/WorkspaceHeader',
  component: WorkspaceHeader,
  tags: ['stable', 'pattern'],
  parameters: dashboardStoryParameters({
    initialEntries: ['/skills'],
    layout: 'fullscreen',
    width: '100vw',
  }),
} satisfies Meta<typeof WorkspaceHeader>

export default meta

type Story = StoryObj<typeof meta>

export const Skills: Story = {
  args: {
    currentView: 'skills',
  },
}

export const Project: Story = {
  args: {
    currentView: 'project',
  },
}

export const Config: Story = {
  args: {
    currentView: 'config',
  },
}
