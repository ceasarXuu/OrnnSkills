import type { Meta, StoryObj } from '@storybook/react-vite'
import { SkillDetailDialog } from '@/components/skill-detail-dialog'
import { storyProjectSkills } from '@/stories/dashboard-v3-fixtures'

const meta = {
  title: 'Dashboard V3/SkillDetailDialog',
  component: SkillDetailDialog,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <div className="dark min-h-screen w-[720px] bg-background p-12 text-foreground">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SkillDetailDialog>

export default meta

type Story = StoryObj<typeof meta>

export const Open: Story = {
  args: {
    onOpenChange: () => undefined,
    open: true,
    skill: storyProjectSkills[0],
  },
}

export const Empty: Story = {
  args: {
    onOpenChange: () => undefined,
    open: true,
    skill: null,
  },
}
