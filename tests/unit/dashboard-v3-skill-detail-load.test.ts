import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  clearCachedSkillDetail,
  getCachedSkillDetail,
  setCachedSkillDetail,
} from '../../frontend-v3/src/lib/skill-detail-cache.ts'

const skillLibraryHookSource = readFileSync(
  new URL('../../frontend-v3/src/features/dashboard/use-dashboard-v3-skill-library.ts', import.meta.url),
  'utf8',
)

describe('dashboard v3 skill detail loading (host direct read)', () => {
  it('loads content without version metadata fan-out (D6)', () => {
    const contentReadyIndex = skillLibraryHookSource.indexOf("logDashboardV3Event('skill_library.content_ready'")

    expect(contentReadyIndex).toBeGreaterThan(0)
    expect(skillLibraryHookSource).not.toContain('loadSkillVersionMetadata({')
    expect(skillLibraryHookSource).not.toContain('useSkillVersionCompare')
  })

  it('caches loaded host detail for instant revisit', () => {
    clearCachedSkillDetail('instance-1')
    setCachedSkillDetail('instance-1', {
      detail: {
        content: 'content',
        effectiveVersion: null,
        runtime: null,
        skillId: 'demo',
        versions: [],
      },
      draftContent: 'content',
    })

    expect(getCachedSkillDetail('instance-1')?.draftContent).toBe('content')
    expect(getCachedSkillDetail('instance-1')?.detail.content).toBe('content')
  })
})
