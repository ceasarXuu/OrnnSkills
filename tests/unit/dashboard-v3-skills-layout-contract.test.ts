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

const skillContentEditorSource = readFileSync(
  new URL('../../frontend-v3/src/components/skill-content-editor.tsx', import.meta.url),
  'utf8',
)

const skillsWorkspaceSource = readFileSync(
  new URL('../../frontend-v3/src/components/skills-workspace.tsx', import.meta.url),
  'utf8',
)

const appSource = readFileSync(
  new URL('../../frontend-v3/src/App.tsx', import.meta.url),
  'utf8',
)

describe('dashboard v3 skills layout contract', () => {
  it('moves the preferred project selector out of the sidebar list and into the detail header', () => {
    expect(skillFamilyListSource).not.toContain('selectPreferredProject')
    expect(skillFamilyListSource).not.toContain('onPreferredProjectChange')
    expect(skillFamilyListSource).not.toContain('preferredProjectPath')

    expect(skillFamilyDetailSource).toContain("t('selectPreferredProject')")
    expect(skillFamilyDetailSource).toContain('onPreferredProjectChange')
    expect(skillFamilyDetailSource).toContain('preferredProjectPath')
  })

  it('removes the inline instances rail and keeps instance switching on the header selectors', () => {
    expect(skillFamilyDetailSource).not.toContain('Instances')
    expect(skillFamilyDetailSource).not.toContain('onSelectInstance')
    expect(skillFamilyDetailSource).toContain("t('switchRuntime')")
  })

  it('locks the skills workspace into a fixed two-column workbench instead of breakpoint reflow', () => {
    expect(appSource).not.toContain('space-y-8 overflow-x-auto')
    expect(skillsWorkspaceSource).toContain('min-w-[1540px]')
    expect(skillsWorkspaceSource).toContain('grid-cols-[340px_minmax(0,1fr)]')
    expect(skillsWorkspaceSource).toContain('aside className="sticky top-24 self-start"')
    expect(skillsWorkspaceSource).not.toContain('xl:grid-cols-[340px_minmax(0,1fr)]')
    expect(skillFamilyListSource).toContain('h-[calc(100vh-7rem)]')
    expect(skillFamilyListSource).toContain('ScrollArea className="h-full"')

    expect(skillFamilyDetailSource).not.toContain('grid-cols-4')
    expect(skillFamilyDetailSource).not.toContain("t('observedCalls')")
    expect(skillFamilyDetailSource).not.toContain("t('analyzedTouches')")
    expect(skillFamilyDetailSource).not.toContain("t('optimized')")
    expect(skillFamilyDetailSource).not.toContain("t('divergedContent')")
    expect(skillFamilyDetailSource).toContain('grid-cols-[minmax(0,1fr)_340px]')
    expect(skillFamilyDetailSource).not.toContain('2xl:grid-cols-[minmax(0,1fr)_340px]')

    expect(skillContentEditorSource).toContain('flex items-center justify-between')
    expect(skillContentEditorSource).not.toContain('xl:flex-row')
  })
})
