import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { SkillDetailDialog } from '@/components/skill-detail-dialog'
import { dashboardStoryParameters } from '@/stories/dashboard-storybook'
import { storyProjectSkills } from '@/stories/dashboard-v3-fixtures'

const meta = {
  title: 'Dashboard V3/Overlay/SkillDetailDialog',
  component: SkillDetailDialog,
  tags: ['stable', 'pattern'],
  parameters: dashboardStoryParameters({
    layout: 'centered',
    width: '720px',
  }),
  args: {
    onOpenChange: fn(),
  },
} satisfies Meta<typeof SkillDetailDialog>

export default meta

type Story = StoryObj<typeof meta>

export const Open: Story = {
  args: {
    open: true,
    skill: storyProjectSkills[0],
  },
}

export const Empty: Story = {
  args: {
    open: true,
    skill: null,
  },
}
