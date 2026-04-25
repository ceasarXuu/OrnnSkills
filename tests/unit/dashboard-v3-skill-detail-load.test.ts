import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  clearCachedSkillDetail,
  getCachedSkillDetail,
  mergeCachedVersionMetadata,
  setCachedSkillDetail,
} from '../../frontend-v3/src/lib/skill-detail-cache.ts'

const skillLibraryHookSource = readFileSync(
  new URL('../../frontend-v3/src/features/dashboard/use-dashboard-v3-skill-library.ts', import.meta.url),
  'utf8',
)

describe('dashboard v3 skill detail loading', () => {
  it('does not block content rendering on version metadata fan-out', () => {
    const contentReadyIndex = skillLibraryHookSource.indexOf("logDashboardV3Event('skill_library.content_ready'")
    const metadataLoadIndex = skillLibraryHookSource.indexOf('loadSkillVersionMetadata({')

    expect(contentReadyIndex).toBeGreaterThan(0)
    expect(metadataLoadIndex).toBeGreaterThan(contentReadyIndex)
    expect(skillLibraryHookSource).not.toContain('const versionEntries = await Promise.all')
  })

  it('caches loaded detail separately from background version metadata', () => {
    clearCachedSkillDetail('instance-1')
    setCachedSkillDetail('instance-1', {
      detail: {
        content: 'content',
        effectiveVersion: 1,
        runtime: 'codex',
        skillId: 'demo',
        versions: [1, 2],
      },
      draftContent: 'content',
      selectedVersion: 1,
      versionMetadataByNumber: {},
    })

    expect(getCachedSkillDetail('instance-1')?.draftContent).toBe('content')
    mergeCachedVersionMetadata('instance-1', {
      2: {
        createdAt: '2026-04-26T00:00:00.000Z',
        previousVersion: 1,
        reason: 'test',
        traceIds: [],
        version: 2,
      },
    })

    expect(getCachedSkillDetail('instance-1')?.versionMetadataByNumber[2]?.reason).toBe('test')
  })
})

