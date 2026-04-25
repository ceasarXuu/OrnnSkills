import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const appSource = readFileSync(
  new URL('../../frontend-v3/src/App.tsx', import.meta.url),
  'utf8',
)
const headerSource = readFileSync(
  new URL('../../frontend-v3/src/components/workspace-header.tsx', import.meta.url),
  'utf8',
)
const costWorkspaceSource = readFileSync(
  new URL('../../frontend-v3/src/components/cost-workspace.tsx', import.meta.url),
  'utf8',
)
const costStorySource = readFileSync(
  new URL('../../frontend-v3/src/components/cost-workspace.stories.tsx', import.meta.url),
  'utf8',
)
const costHookSource = readFileSync(
  new URL('../../frontend-v3/src/features/dashboard/use-dashboard-v3-cost.ts', import.meta.url),
  'utf8',
)

describe('dashboard v3 cost workspace contract', () => {
  it('adds cost as a first-class v3 tab backed by project snapshot usage', () => {
    expect(appSource).toContain("'cost'")
    expect(headerSource).toContain('to="/cost"')
    expect(headerSource).toContain("label={t('cost')}")
    expect(appSource).toContain("currentView === 'cost'")
    expect(appSource).toContain('agentUsage={selectedSnapshot?.agentUsage}')
  })

  it('keeps cost stories offline and state-focused', () => {
    expect(costStorySource).toContain("title: 'Dashboard V3/Cost/CostWorkspace'")
    expect(costStorySource).toContain('Default')
    expect(costStorySource).toContain('Empty')
    expect(costStorySource).toContain('CatalogUnavailable')
    expect(costStorySource).toContain('Loading')
    expect(costStorySource).not.toContain('fetch(')
  })

  it('uses v3 shadcn shell pieces instead of legacy html strings', () => {
    expect(costWorkspaceSource).toContain('@/components/ui/card')
    expect(costWorkspaceSource).toContain('@/components/ui/table')
    expect(costWorkspaceSource).toContain('@/components/ui/badge')
    expect(costWorkspaceSource).not.toContain('cost-shell')
    expect(costWorkspaceSource).not.toContain('dangerouslySetInnerHTML')
  })

  it('loads LiteLLM catalog through a dedicated observable hook', () => {
    expect(costHookSource).toContain('fetchDashboardProviderCatalog')
    expect(costHookSource).toContain("logDashboardV3Event('cost.catalog_load_started')")
    expect(costHookSource).toContain("logDashboardV3Event('cost.catalog_load_succeeded'")
  })
})
