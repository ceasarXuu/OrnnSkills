import type { Meta, StoryObj } from '@storybook/react-vite'
import { ConfigGovernancePanel } from '@/components/config-governance-panel'
import { storyDashboardConfig } from '@/stories/dashboard-v3-fixtures'

const meta = {
  title: 'Dashboard V3/ConfigGovernancePanel',
  component: ConfigGovernancePanel,
  parameters: {
    layout: 'padded',
  },
  decorators: [
    (Story) => (
      <div className="dark min-h-screen w-[1120px] bg-background p-4 text-foreground">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ConfigGovernancePanel>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    config: storyDashboardConfig,
    onSetPromptOverride: () => undefined,
    onSetPromptSource: () => undefined,
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
