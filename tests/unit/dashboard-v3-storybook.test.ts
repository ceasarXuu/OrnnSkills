import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const root = new URL('../..', import.meta.url)
const rootPackage = JSON.parse(readFileSync(new URL('package.json', root), 'utf8')) as {
  scripts?: Record<string, string>
}
const frontendPackage = JSON.parse(
  readFileSync(new URL('frontend-v3/package.json', root), 'utf8'),
) as {
  scripts?: Record<string, string>
  devDependencies?: Record<string, string>
}

function readWorkspaceFile(path: string) {
  return readFileSync(new URL(path, root), 'utf8')
}

describe('dashboard v3 Storybook setup', () => {
  it('exposes isolated Storybook scripts for frontend-v3 only', () => {
    expect(frontendPackage.scripts?.storybook).toBe('storybook dev -p 6006')
    expect(frontendPackage.scripts?.['build-storybook']).toBe('storybook build')
    expect(frontendPackage.scripts?.['test-storybook']).toBe(
      'vitest --config vitest.config.ts --project=storybook --run',
    )
    expect(frontendPackage.scripts?.chromatic).toBe('chromatic')
    expect(rootPackage.scripts?.['storybook:dashboard-v3']).toBe(
      'npm --prefix frontend-v3 run storybook',
    )
    expect(rootPackage.scripts?.['build:storybook:dashboard-v3']).toBe(
      'npm --prefix frontend-v3 run build-storybook',
    )
    expect(rootPackage.scripts?.['test:storybook:dashboard-v3']).toBe(
      'npm --prefix frontend-v3 run test-storybook',
    )
    expect(rootPackage.scripts?.['chromatic:dashboard-v3']).toBe(
      'npm --prefix frontend-v3 run chromatic',
    )
  })

  it('uses the React Vite Storybook framework', () => {
    expect(frontendPackage.devDependencies?.storybook).toBeTruthy()
    expect(frontendPackage.devDependencies?.['@storybook/react-vite']).toBeTruthy()
    expect(frontendPackage.devDependencies?.['@storybook/addon-a11y']).toBeTruthy()
    expect(frontendPackage.devDependencies?.['@storybook/addon-vitest']).toBeTruthy()
    expect(frontendPackage.devDependencies?.['@chromatic-com/storybook']).toBeTruthy()
    expect(frontendPackage.devDependencies?.chromatic).toBeTruthy()
    expect(frontendPackage.devDependencies?.playwright).toBeTruthy()
    expect(frontendPackage.devDependencies?.['@vitest/browser-playwright']).toBeTruthy()

    const mainConfig = readWorkspaceFile('frontend-v3/.storybook/main.ts')
    expect(mainConfig).toContain("framework: {")
    expect(mainConfig).toContain("name: '@storybook/react-vite'")
    expect(mainConfig).toContain("../src/**/*.stories.@(ts|tsx)")
    expect(mainConfig).toContain("'@storybook/addon-a11y'")
    expect(mainConfig).toContain("'@storybook/addon-vitest'")
    expect(mainConfig).toContain("'@chromatic-com/storybook'")
  })

  it('loads the dashboard v3 theme styles and global story policies in previews', () => {
    const previewConfig = readWorkspaceFile('frontend-v3/.storybook/preview.tsx')
    expect(previewConfig).toContain("import '../src/styles/globals.css'")
    expect(previewConfig).toContain("import { MemoryRouter } from 'react-router-dom'")
    expect(previewConfig).toContain("import { DashboardStoryFrame } from '../src/stories/dashboard-story-frame'")
    expect(previewConfig).toContain("tags: ['autodocs']")
    expect(previewConfig).toContain("a11y: { test: 'error' }")
    expect(previewConfig).toContain("actions: { argTypesRegex: '^on[A-Z].*' }")
    expect(previewConfig).toContain('controls: {')
    expect(previewConfig).toContain('expanded: true')
  })

  it('uses preview-level decorators and shared story frame instead of per-story page chrome', () => {
    expect(existsSync(new URL('frontend-v3/src/stories/dashboard-story-frame.tsx', root))).toBe(true)

    const storySources = [
      'frontend-v3/src/components/workspace-header.stories.tsx',
      'frontend-v3/src/components/project-rail.stories.tsx',
      'frontend-v3/src/components/project-workbench.stories.tsx',
      'frontend-v3/src/components/skill-family-list.stories.tsx',
      'frontend-v3/src/components/skill-family-detail.stories.tsx',
      'frontend-v3/src/components/skill-detail-dialog.stories.tsx',
      'frontend-v3/src/components/config-provider-stack.stories.tsx',
      'frontend-v3/src/components/config-governance-panel.stories.tsx',
    ]

    for (const storySourcePath of storySources) {
      const storySource = readWorkspaceFile(storySourcePath)
      expect(storySource).not.toContain('DashboardStoryFrame')
      expect(storySource).not.toContain('dark min-h-screen')
    }
  })

  it('contains contract stories for dashboard v3 core workbench components', () => {
    const storyFiles = [
      'frontend-v3/src/components/workspace-header.stories.tsx',
      'frontend-v3/src/components/project-rail.stories.tsx',
      'frontend-v3/src/components/skill-family-list.stories.tsx',
      'frontend-v3/src/components/skill-family-detail.stories.tsx',
      'frontend-v3/src/components/skills-table.stories.tsx',
      'frontend-v3/src/components/skill-detail-dialog.stories.tsx',
      'frontend-v3/src/components/skill-content-editor.stories.tsx',
      'frontend-v3/src/components/skill-version-history.stories.tsx',
      'frontend-v3/src/components/config-provider-row.stories.tsx',
      'frontend-v3/src/components/config-provider-stack.stories.tsx',
      'frontend-v3/src/components/config-prompt-editor.stories.tsx',
      'frontend-v3/src/components/config-governance-panel.stories.tsx',
    ]

    for (const storyFile of storyFiles) {
      expect(existsSync(new URL(storyFile, root)), storyFile).toBe(true)
    }
  })

  it('only publishes project workbench stories once it owns real screen structure', () => {
    const source = readWorkspaceFile('frontend-v3/src/components/project-workbench.tsx')
    expect(source).toContain('TabsTrigger value="skills"')
    expect(source).toContain('TabsTrigger value="cost"')
    expect(readWorkspaceFile('frontend-v3/src/components/project-workbench.stories.tsx')).toContain(
      'CostSelected',
    )
  })

  it('documents the dashboard v3 story map and quality gates', () => {
    expect(existsSync(new URL('docs/dashboard-v3-storybook.md', root))).toBe(true)
  })

  it('adds interaction coverage to critical pattern stories', () => {
    expect(readWorkspaceFile('frontend-v3/src/components/project-rail.stories.tsx')).toContain('play:')
    expect(readWorkspaceFile('frontend-v3/src/components/skill-family-list.stories.tsx')).toContain(
      'play:',
    )
    expect(readWorkspaceFile('frontend-v3/src/components/skills-table.stories.tsx')).toContain(
      'play:',
    )
    expect(readWorkspaceFile('frontend-v3/src/components/config-prompt-editor.stories.tsx')).toContain(
      'play:',
    )
    expect(readWorkspaceFile('frontend-v3/src/components/config-provider-row.stories.tsx')).toContain(
      'play:',
    )
    expect(readWorkspaceFile('frontend-v3/src/components/config-provider-stack.stories.tsx')).toContain(
      'play:',
    )
  })

  it('keeps dashboard v3 config choices on shadcn controls instead of native inputs', () => {
    const providerRow = readWorkspaceFile('frontend-v3/src/components/config-provider-row.tsx')
    const providerStack = readWorkspaceFile('frontend-v3/src/components/config-provider-stack.tsx')
    const promptEditor = readWorkspaceFile('frontend-v3/src/components/config-prompt-editor.tsx')

    expect(providerRow).toContain("import { Switch } from '@/components/ui/switch'")
    expect(providerStack).toContain("import { Switch } from '@/components/ui/switch'")
    expect(promptEditor).toContain("import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'")
    expect(providerRow).not.toContain('type="radio"')
    expect(providerStack).not.toContain('type="checkbox"')
    expect(promptEditor).not.toContain('type="radio"')
  })

  it('configures Storybook tests to run stable stories in Vitest browser mode', () => {
    const vitestConfig = readWorkspaceFile('frontend-v3/vitest.config.ts')
    expect(vitestConfig).toContain("import { storybookTest } from '@storybook/addon-vitest/vitest-plugin'")
    expect(vitestConfig).toContain("import { playwright } from '@vitest/browser-playwright'")
    expect(vitestConfig).toContain("name: 'storybook'")
    expect(vitestConfig).toContain("storybookUrl: 'http://127.0.0.1:6006'")
    expect(vitestConfig).toContain("storybookScript: 'npm run storybook -- --ci --no-open'")
    expect(vitestConfig).toContain("include: ['stable']")
    expect(vitestConfig).toContain("provider: playwright({})")
    expect(vitestConfig).toContain("instances: [{ browser: 'chromium' }]")
  })

  it('wires Storybook accessibility tests and Chromatic into CI', () => {
    const ciWorkflow = readWorkspaceFile('.github/workflows/ci.yml')
    expect(ciWorkflow).toContain('Storybook component and accessibility tests')
    expect(ciWorkflow).toContain('npm run test:storybook:dashboard-v3')
    expect(ciWorkflow).toContain('playwright install --with-deps chromium')

    const chromaticWorkflow = readWorkspaceFile('.github/workflows/chromatic.yml')
    expect(chromaticWorkflow).toContain('CHROMATIC_PROJECT_TOKEN')
    expect(chromaticWorkflow).toContain('chromaui/action@latest')
    expect(chromaticWorkflow).toContain('workingDir: frontend-v3')
  })
})
