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
    expect(rootPackage.scripts?.['storybook:dashboard-v3']).toBe(
      'npm --prefix frontend-v3 run storybook',
    )
    expect(rootPackage.scripts?.['build:storybook:dashboard-v3']).toBe(
      'npm --prefix frontend-v3 run build-storybook',
    )
  })

  it('uses the React Vite Storybook framework', () => {
    expect(frontendPackage.devDependencies?.storybook).toBeTruthy()
    expect(frontendPackage.devDependencies?.['@storybook/react-vite']).toBeTruthy()

    const mainConfig = readWorkspaceFile('frontend-v3/.storybook/main.ts')
    expect(mainConfig).toContain("framework: {")
    expect(mainConfig).toContain("name: '@storybook/react-vite'")
    expect(mainConfig).toContain("../src/**/*.stories.@(ts|tsx)")
  })

  it('loads the dashboard v3 theme styles in previews', () => {
    const previewConfig = readWorkspaceFile('frontend-v3/.storybook/preview.ts')
    expect(previewConfig).toContain("import '../src/styles/globals.css'")
  })

  it('uses a shared dashboard story frame instead of per-story page chrome', () => {
    expect(existsSync(new URL('frontend-v3/src/stories/dashboard-story-frame.tsx', root))).toBe(true)

    const storySources = [
      'frontend-v3/src/components/workspace-header.stories.tsx',
      'frontend-v3/src/components/project-rail.stories.tsx',
      'frontend-v3/src/components/skill-family-list.stories.tsx',
      'frontend-v3/src/components/skill-family-detail.stories.tsx',
      'frontend-v3/src/components/skill-detail-dialog.stories.tsx',
      'frontend-v3/src/components/config-provider-stack.stories.tsx',
      'frontend-v3/src/components/config-governance-panel.stories.tsx',
    ]

    for (const storySourcePath of storySources) {
      const storySource = readWorkspaceFile(storySourcePath)
      expect(storySource).toContain('DashboardStoryFrame')
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

  it('does not publish duplicate stories for pass-through route wrappers', () => {
    expect(existsSync(new URL('frontend-v3/src/components/project-workbench.stories.tsx', root))).toBe(
      false,
    )
  })
})
