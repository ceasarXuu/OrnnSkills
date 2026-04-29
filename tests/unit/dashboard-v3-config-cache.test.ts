import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const configHookSource = readFileSync(
  new URL('../../frontend-v3/src/features/dashboard/use-dashboard-v3-config.ts', import.meta.url),
  'utf8',
)

const configCacheSource = readFileSync(
  new URL('../../frontend-v3/src/features/dashboard/use-dashboard-v3-config-cache.ts', import.meta.url),
  'utf8',
)

describe('dashboard v3 config cache contract', () => {
  it('hydrates the config workspace from a module cache before running a background refresh', () => {
    expect(configCacheSource).toContain('let dashboardV3ConfigCache')
    expect(configCacheSource).toContain('getInitialDashboardV3ConfigState')
    expect(configCacheSource).toContain('isLoading: false')
    expect(configHookSource).toContain('getInitialDashboardV3ConfigState')
    expect(configHookSource).toContain('getDashboardV3ConfigCache() === null')
  })
})

