import type { Parameters } from '@storybook/react-vite'

interface DashboardStoryOptions {
  initialEntries?: string[]
  layout?: 'centered' | 'fullscreen' | 'padded'
  width?: string
}

export function dashboardStoryParameters({
  initialEntries,
  layout = 'padded',
  width = '1120px',
}: DashboardStoryOptions = {}): Parameters {
  return {
    dashboard: {
      frameWidth: width,
    },
    layout,
    ...(initialEntries ? { router: { initialEntries } } : {}),
  }
}
