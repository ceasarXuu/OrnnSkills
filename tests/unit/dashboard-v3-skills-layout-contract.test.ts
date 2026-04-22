import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const skillFamilyListSource = readFileSync(
  new URL('../../frontend-v3/src/components/skill-family-list.tsx', import.meta.url),
  'utf8',
)

const skillFamilyDetailSource = readFileSync(
  new URL('../../frontend-v3/src/components/skill-family-detail.tsx', import.meta.url),
  'utf8',
)

describe('dashboard v3 skills layout contract', () => {
  it('moves the preferred project selector out of the sidebar list and into the detail header', () => {
    expect(skillFamilyListSource).not.toContain('选择优先项目')
    expect(skillFamilyListSource).not.toContain('onPreferredProjectChange')
    expect(skillFamilyListSource).not.toContain('preferredProjectPath')

    expect(skillFamilyDetailSource).toContain('选择优先项目')
    expect(skillFamilyDetailSource).toContain('onPreferredProjectChange')
    expect(skillFamilyDetailSource).toContain('preferredProjectPath')
  })
})
