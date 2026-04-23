import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn } from 'storybook/test'
import { ProjectRail } from '@/components/project-rail'
import { dashboardStoryParameters } from '@/stories/dashboard-storybook'
import { storyProjects } from '@/stories/dashboard-v3-fixtures'

const meta = {
  title: 'Dashboard V3/Project/ProjectRail',
  component: ProjectRail,
  tags: ['stable', 'pattern'],
  parameters: dashboardStoryParameters({
    width: '360px',
  }),
  args: {
    isLoading: false,
    onSelect: fn(),
    projects: storyProjects,
    selectedProjectId: '/Users/xuzhang/OrnnSkills',
  },
} satisfies Meta<typeof ProjectRail>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const SearchAndSelect: Story = {
  play: async ({ args, canvas, userEvent }) => {
    const search = canvas.getByPlaceholderText('搜索 project / path / status')
    await userEvent.clear(search)
    await userEvent.type(search, 'mili')

    const projectCard = canvas.getByText('mili').closest('button')
    expect(projectCard).not.toBeNull()
    if (!projectCard) {
      return
    }

    await userEvent.click(projectCard)
    await expect(args.onSelect).toHaveBeenCalledWith('/Users/xuzhang/mili')
  },
}

export const Loading: Story = {
  args: {
    isLoading: true,
    projects: [],
    selectedProjectId: '',
  },
}

export const Empty: Story = {
  args: {
    projects: [],
    selectedProjectId: '',
  },
}
