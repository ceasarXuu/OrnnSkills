import type { Decorator, Preview } from '@storybook/react-vite'
import { MemoryRouter } from 'react-router-dom'
import '../src/styles/globals.css'
import { DashboardStoryFrame } from '../src/stories/dashboard-story-frame'

interface DashboardFrameParameters {
  frameWidth?: string
}

interface DashboardRouterParameters {
  initialEntries?: string[]
}

const withDashboardEnvironment: Decorator = (Story, context) => {
  const dashboard = context.parameters.dashboard as DashboardFrameParameters | undefined
  const router = context.parameters.router as DashboardRouterParameters | undefined
  const frameWidth = dashboard?.frameWidth ?? '1120px'
  const initialEntries = router?.initialEntries ?? ['/skills']

  return (
    <MemoryRouter initialEntries={initialEntries} key={initialEntries.join('|')}>
      <DashboardStoryFrame width={frameWidth}>
        <Story />
      </DashboardStoryFrame>
    </MemoryRouter>
  )
}

const preview: Preview = {
  tags: ['autodocs'],
  parameters: {
    actions: { argTypesRegex: '^on[A-Z].*' },
    a11y: { test: 'error' },
    backgrounds: {
      default: 'dark',
      options: {
        dark: { name: 'Dashboard dark', value: 'oklch(0.153 0.006 107.1)' },
      },
    },
    controls: {
      expanded: true,
      sort: 'requiredFirst',
    },
    layout: 'padded',
    options: {
      storySort: {
        order: [
          'Dashboard V3',
          ['Shell', 'Skills', 'Project', 'Config', 'Overlay'],
        ],
      },
    },
  },
  decorators: [withDashboardEnvironment],
}

export default preview
