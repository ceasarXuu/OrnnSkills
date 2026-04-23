import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { ConfigProviderRow } from '@/components/config-provider-row'
import { dashboardStoryParameters } from '@/stories/dashboard-storybook'
import {
  storyConnectivityResults,
  storyDashboardConfig,
  storyProviderCatalog,
} from '@/stories/dashboard-v3-fixtures'

const provider = storyDashboardConfig.providers[0]

const meta = {
  title: 'Dashboard V3/Config/ConfigProviderRow',
  component: ConfigProviderRow,
  tags: ['stable', 'primitive'],
  parameters: dashboardStoryParameters({
    width: '1280px',
  }),
  args: {
    onCheckConnectivity: fn(),
    onRemove: fn(),
    onSetDefaultProvider: fn(),
    onToggleApiKeyVisibility: fn(),
    onUpdate: fn(),
  },
} satisfies Meta<typeof ConfigProviderRow>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    index: 0,
    isApiKeyVisible: false,
    isCheckingConnectivity: false,
    provider,
    providerCatalog: storyProviderCatalog,
    result: storyConnectivityResults[0],
    selectedDefaultProvider: provider.provider,
  },
}

export const ApiKeyVisible: Story = {
  args: {
    ...Default.args,
    isApiKeyVisible: true,
    provider: {
      ...provider,
      apiKey: 'sk-redacted-storybook',
    },
  },
}

export const Checking: Story = {
  args: {
    ...Default.args,
    isCheckingConnectivity: true,
  },
}
