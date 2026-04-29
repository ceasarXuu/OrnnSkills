import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { COST_TRANSLATIONS, type CostTranslationKey } from './i18n-cost'
import { TRANSLATIONS, type TranslationKey } from './i18n-translations'

export type DashboardLanguage = 'en' | 'zh'

export type { TranslationKey }

interface I18nContextValue {
  lang: DashboardLanguage
  locale: string
  setLanguage: (lang: DashboardLanguage) => void
  t: (key: TranslationKey) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)
const STORAGE_KEY = 'dashboard-v3.lang'

function detectBrowserLanguage(): DashboardLanguage {
  if (typeof navigator === 'undefined') return 'en'
  const candidates = Array.isArray(navigator.languages) ? navigator.languages : [navigator.language]
  return candidates.some((value) => String(value).toLowerCase().startsWith('zh')) ? 'zh' : 'en'
}

function loadInitialLanguage(): DashboardLanguage {
  if (typeof window === 'undefined') return 'en'
  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (stored === 'en' || stored === 'zh') return stored
  return detectBrowserLanguage()
}

export function I18nProvider({
  children,
  initialLanguage,
}: {
  children: ReactNode
  initialLanguage?: DashboardLanguage
}) {
  const [lang, setLang] = useState<DashboardLanguage>(() => initialLanguage ?? loadInitialLanguage())

  useEffect(() => {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en'
    window.localStorage.setItem(STORAGE_KEY, lang)
  }, [lang])

  // 初始语言由 loadInitialLanguage() 决定：
  // 优先 localStorage 中用户已切换过的偏好，否则读取浏览器语言，最终英文兜底。
  // 不再在初始化时向后端拉取 /api/lang 覆盖，避免后端默认 'en' 覆盖浏览器中文检测。

  const value = useMemo<I18nContextValue>(() => {
    const t = (key: TranslationKey) => TRANSLATIONS[lang][key]
    return {
      lang,
      locale: lang === 'zh' ? 'zh-CN' : 'en-US',
      setLanguage: (nextLang) => {
        setLang(nextLang)
        void fetch('/api/lang', {
          body: JSON.stringify({ lang: nextLang }),
          headers: { 'Content-Type': 'application/json' },
          method: 'POST',
        }).catch(() => undefined)
      },
      t,
    }
  }, [lang])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const value = useContext(I18nContext)
  if (!value) {
    throw new Error('useI18n must be used within I18nProvider')
  }
  return value
}

export function getTranslations(lang: DashboardLanguage) {
  return TRANSLATIONS[lang]
}
