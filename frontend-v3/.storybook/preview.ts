import type { Preview } from '@storybook/react-vite'
import '../src/styles/globals.css'

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: 'dark',
      options: {
        dark: { name: 'Dashboard dark', value: 'oklch(0.153 0.006 107.1)' },
      },
    },
    layout: 'centered',
  },
}

export default preview
