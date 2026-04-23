import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { ConfigGovernancePanel } from '@/components/config-governance-panel'
import { dashboardStoryParameters } from '@/stories/dashboard-storybook'
import { storyDashboardConfig } from '@/stories/dashboard-v3-fixtures'

const meta = {
  title: 'Dashboard V3/Config/ConfigGovernancePanel',
  component: ConfigGovernancePanel,
  tags: ['stable', 'pattern'],
  parameters: dashboardStoryParameters({
    width: '1120px',
  }),
  args: {
    onSetPromptOverride: fn(),
    onSetPromptSource: fn(),
  },
} satisfies Meta<typeof ConfigGovernancePanel>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    config: storyDashboardConfig,
  },
}

export const AllCustom: Story = {
  args: {
    ...Default.args,
    config: {
      ...storyDashboardConfig,
      promptOverrides: {
        decisionExplainer: 'Explain only with dashboard evidence.',
        readinessProbe: 'Wait when signal is partial.',
        skillCallAnalyzer: 'Classify calls by family, runtime, and outcome.',
      },
      promptSources: {
        decisionExplainer: 'custom',
        readinessProbe: 'custom',
        skillCallAnalyzer: 'custom',
      },
    },
  },
}
