import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn } from 'storybook/test'
import { ConfigProviderStack } from '@/components/config-provider-stack'
import { CONFIG_TEXT } from '@/lib/config-workspace'
import { dashboardStoryParameters } from '@/stories/dashboard-storybook'
import {
  storyConnectivityResults,
  storyDashboardConfig,
  storyProviderCatalog,
} from '@/stories/dashboard-v3-fixtures'

const meta = {
  title: 'Dashboard V3/Config/ConfigProviderStack',
  component: ConfigProviderStack,
  tags: ['stable', 'pattern'],
  parameters: dashboardStoryParameters({
    width: '1280px',
  }),
  args: {
    onAddProvider: fn(),
    onCheckConnectivity: fn(),
    onRemoveProvider: fn(),
    onSetDefaultProvider: fn(),
    onSetSafetyField: fn(),
    onToggleApiKeyVisibility: fn(),
    onUpdateProvider: fn(),
  },
} satisfies Meta<typeof ConfigProviderStack>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    apiKeyVisibilityByRow: { '0': false },
    config: storyDashboardConfig,
    connectivityResults: storyConnectivityResults,
    isCatalogLoading: false,
    isCheckingConnectivity: false,
    providerCatalog: storyProviderCatalog,
  },
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('switch', { name: CONFIG_TEXT.llmSafetyEnabled }))

    await expect(args.onSetSafetyField).toHaveBeenCalledWith('enabled', false)
  },
}

export const LoadingCatalog: Story = {
  args: {
    ...Default.args,
    isCatalogLoading: true,
    providerCatalog: [],
  },
}

export const EmptyProviders: Story = {
  args: {
    ...Default.args,
    config: {
      ...storyDashboardConfig,
      defaultProvider: '',
      providers: [],
    },
    connectivityResults: [],
  },
}
