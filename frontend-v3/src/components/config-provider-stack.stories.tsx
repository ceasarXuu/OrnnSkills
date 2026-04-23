import type { Meta, StoryObj } from '@storybook/react-vite'
import { ConfigProviderStack } from '@/components/config-provider-stack'
import {
  storyConnectivityResults,
  storyDashboardConfig,
  storyProviderCatalog,
} from '@/stories/dashboard-v3-fixtures'

const meta = {
  title: 'Dashboard V3/ConfigProviderStack',
  component: ConfigProviderStack,
  parameters: {
    layout: 'padded',
  },
  decorators: [
    (Story) => (
      <div className="dark min-h-screen w-[1280px] bg-background p-4 text-foreground">
        <Story />
      </div>
    ),
  ],
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
    onAddProvider: () => undefined,
    onCheckConnectivity: () => undefined,
    onRemoveProvider: () => undefined,
    onSetDefaultProvider: () => undefined,
    onSetSafetyField: () => undefined,
    onToggleApiKeyVisibility: () => undefined,
    onUpdateProvider: () => undefined,
    providerCatalog: storyProviderCatalog,
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
