import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, within } from 'storybook/test'
import { DashboardActionToast } from '@/components/dashboard-action-toast'
import { dashboardStoryParameters } from '@/stories/dashboard-storybook'

const meta = {
  title: 'Dashboard V3/Overlay/DashboardActionToast',
  component: DashboardActionToast,
  tags: ['stable', 'pattern'],
  parameters: dashboardStoryParameters({
    width: '840px',
  }),
  args: {
    message: {
      id: 1,
      message: '未在市场找到该技能',
    },
    onDismiss: fn(),
  },
} satisfies Meta<typeof DashboardActionToast>

export default meta

type Story = StoryObj<typeof meta>

export const MarketplaceSkillNotFound: Story = {
  play: async ({ canvasElement }) => {
    const documentScope = within(canvasElement.ownerDocument.body)

    await expect(documentScope.getByText('提示')).toBeInTheDocument()
    await expect(documentScope.getByText('未在市场找到该技能')).toBeInTheDocument()
    await expect(documentScope.getByRole('button', { name: '关闭提示' })).toBeInTheDocument()
  },
}
