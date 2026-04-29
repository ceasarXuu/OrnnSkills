import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const skillLibraryHookSource = readFileSync(
  new URL('../../frontend-v3/src/features/dashboard/use-dashboard-v3-skill-library.ts', import.meta.url),
  'utf8',
)

const skillLibraryCacheSource = readFileSync(
  new URL(
    '../../frontend-v3/src/features/dashboard/use-dashboard-v3-skill-library-cache.ts',
    import.meta.url,
  ),
  'utf8',
)

describe('dashboard v3 skills cache contract', () => {
  it('hydrates the skills workspace from a module cache before running background refreshes', () => {
    expect(skillLibraryCacheSource).toContain('let skillLibraryCache')
    expect(skillLibraryCacheSource).toContain('export function getInitialSkillLibraryState')
    expect(skillLibraryHookSource).toContain('getInitialSkillLibraryState')
    expect(skillLibraryHookSource).toContain('useRef(Boolean(initialState))')
    expect(skillLibraryHookSource).toContain('const [isLoadingFamilies, setIsLoadingFamilies] = useState(!hasInitialCache)')
  })

  it('does not force cached skills views back into list or detail loading on tab re-entry', () => {
    expect(skillLibraryHookSource).toContain('if (!hasInitialCache || refreshToken > 0)')
    expect(skillLibraryHookSource).toContain('setIsLoadingFamilyDetail(true)')
    expect(skillLibraryHookSource).toContain('setIsLoadingSkillDetail(true)')
  })
})
