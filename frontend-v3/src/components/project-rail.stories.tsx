import type { Meta, StoryObj } from '@storybook/react-vite'
import { ProjectRail } from '@/components/project-rail'
import type { DashboardProject } from '@/types/dashboard'

const projects: DashboardProject[] = [
  {
    name: 'OrnnSkills',
    path: '/Users/xuzhang/OrnnSkills',
    lastSeenAt: '2026-04-23T06:30:00.000Z',
    monitoringState: 'active',
    skillCount: 112,
  },
  {
    name: 'mili',
    path: '/Users/xuzhang/mili',
    lastSeenAt: '2026-04-23T06:12:00.000Z',
    monitoringState: 'active',
    skillCount: 118,
  },
  {
    name: 'NBComic',
    path: '/Users/xuzhang/NBComic',
    lastSeenAt: '2026-04-23T05:58:00.000Z',
    monitoringState: 'paused',
    skillCount: 112,
  },
]

const meta = {
  title: 'Dashboard V3/ProjectRail',
  component: ProjectRail,
  parameters: {
    layout: 'padded',
  },
  decorators: [
    (Story) => (
      <div className="dark min-h-screen w-[360px] bg-background p-4 text-foreground">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ProjectRail>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    isLoading: false,
    onSelect: () => undefined,
    projects,
    selectedProjectId: '/Users/xuzhang/OrnnSkills',
  },
}

export const Loading: Story = {
  args: {
    isLoading: true,
    onSelect: () => undefined,
    projects: [],
    selectedProjectId: '',
  },
}

export const Empty: Story = {
  args: {
    isLoading: false,
    onSelect: () => undefined,
    projects: [],
    selectedProjectId: '',
  },
}
