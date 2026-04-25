import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { getTranslations } from '../../frontend-v3/src/lib/i18n.tsx'

const workspaceHeaderSource = readFileSync(
  new URL('../../frontend-v3/src/components/workspace-header.tsx', import.meta.url),
  'utf8',
)

const appSource = readFileSync(
  new URL('../../frontend-v3/src/App.tsx', import.meta.url),
  'utf8',
)

describe('dashboard v3 i18n contract', () => {
  it('mounts a v3 language provider and exposes a header language switch', () => {
    expect(appSource).toContain('<I18nProvider>')
    expect(workspaceHeaderSource).toContain("aria-label={t('toggleLanguage')}")
    expect(workspaceHeaderSource).toContain('setLanguage')
  })

  it('keeps zh and en dictionaries complete for every v3 translation key', () => {
    const zhKeys = Object.keys(getTranslations('zh')).sort()
    const enKeys = Object.keys(getTranslations('en')).sort()

    expect(enKeys).toEqual(zhKeys)
    expect(getTranslations('zh').skillFamilyLibrary).toBe('技能库')
    expect(getTranslations('en').skillFamilyLibrary).toBe('Skill library')
    expect(getTranslations('en').configLoading).toBe('Loading config...')
    expect(getTranslations('zh').cost).toBe('成本')
    expect(getTranslations('en').cost).toBe('Cost')
  })
})
