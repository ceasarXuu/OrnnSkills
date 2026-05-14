import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const root = new URL('../..', import.meta.url)

function readWorkspaceFile(path: string) {
  return readFileSync(new URL(path, root), 'utf8')
}

describe('dashboard v3 evolution workspace contract', () => {
  it('fetches project evolution lifecycle through the project API', () => {
    const apiSource = readWorkspaceFile('frontend-v3/src/lib/dashboard-api.ts')

    expect(apiSource).toContain('fetchProjectEvolutionLifecycle')
    expect(apiSource).toContain('/evolution')
  })

  it('loads evolution lifecycle alongside the selected project snapshot', () => {
    const hookSource = readWorkspaceFile('frontend-v3/src/features/dashboard/use-dashboard-v3-workspace.ts')

    expect(hookSource).toContain('fetchProjectEvolutionLifecycle')
    expect(hookSource).toContain('selectedEvolutionLifecycle')
    expect(hookSource).toContain('isLoadingEvolution')
  })

  it('shows the required project-level evolution status groups', () => {
    const componentSource = readWorkspaceFile('frontend-v3/src/components/evolution-workspace.tsx')

    expect(componentSource).toContain('pendingProposals')
    expect(componentSource).toContain('failedRuns')
    expect(componentSource).toContain('verifiedImprovements')
    expect(componentSource).toContain('regressions')
  })
})
