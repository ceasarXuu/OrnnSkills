import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type DashboardLanguage = 'en' | 'zh'

type TranslationKey =
  | 'addProject'
  | 'addProvider'
  | 'apiKeyHide'
  | 'apiKeyPastePlaceholder'
  | 'apiKeyShow'
  | 'applyToFamily'
  | 'applying'
  | 'builtInPrompt'
  | 'catalogCustomOnly'
  | 'catalogErrorPrefix'
  | 'catalogLoading'
  | 'checkConnectivity'
  | 'config'
  | 'configLoading'
  | 'connectivityChecking'
  | 'connectivityDone'
  | 'connectivityEmpty'
  | 'connectivityFailed'
  | 'connectivityTitle'
  | 'customModelPlaceholder'
  | 'customOption'
  | 'customPrompt'
  | 'customProviderPlaceholder'
  | 'deactivate'
  | 'disabled'
  | 'calls'
  | 'effective'
  | 'effectiveVersion'
  | 'evolutionStrategy'
  | 'invalidDate'
  | 'instances'
  | 'language'
  | 'lastCalled'
  | 'lastUpdated'
  | 'llmSafetyConcurrent'
  | 'llmSafetyEnabled'
  | 'llmSafetyHelp'
  | 'llmSafetyLabel'
  | 'llmSafetyRequests'
  | 'llmSafetyTokens'
  | 'llmSafetyWindow'
  | 'loadErrorPrefix'
  | 'model'
  | 'navLabel'
  | 'noMatchedProjects'
  | 'noMatchedSkillFamilies'
  | 'noMatchedSkills'
  | 'noProjects'
  | 'noProviders'
  | 'noReason'
  | 'noSkillFamilySelected'
  | 'noSkillInstance'
  | 'noVersions'
  | 'previewPropagation'
  | 'project'
  | 'projectCount'
  | 'projects'
  | 'promptDecisionExplainerLabel'
  | 'promptDecisionExplainerPlaceholder'
  | 'promptHelp'
  | 'promptLabel'
  | 'promptReadinessProbeLabel'
  | 'promptReadinessProbePlaceholder'
  | 'promptSkillCallAnalyzerLabel'
  | 'promptSkillCallAnalyzerPlaceholder'
  | 'providerActiveLabel'
  | 'providersHelp'
  | 'providersLabel'
  | 'readOnlySkillDetail'
  | 'removeProvider'
  | 'restore'
  | 'retry'
  | 'revisions'
  | 'saveAuto'
  | 'saveFailed'
  | 'saveSaving'
  | 'saveSkillContent'
  | 'saving'
  | 'searchProjects'
  | 'searchSkillFamilies'
  | 'searchSkills'
  | 'selectPreferredProject'
  | 'skill'
  | 'skillContent'
  | 'skillContentAria'
  | 'skillFamilies'
  | 'skillFamilyLibrary'
  | 'skillList'
  | 'skills'
  | 'status'
  | 'switchRuntime'
  | 'toggleLanguage'
  | 'totalRows'
  | 'traces'
  | 'traceCount'
  | 'yes'
  | 'no'
  | 'version'
  | 'versionHistory'

const TRANSLATIONS: Record<DashboardLanguage, Record<TranslationKey, string>> = {
  zh: {
    addProject: '添加项目',
    addProvider: '新增模型服务',
    apiKeyHide: '隐藏',
    apiKeyPastePlaceholder: '直接粘贴 API Key',
    apiKeyShow: '显示',
    applyToFamily: '应用到同族实例',
    applying: '应用中',
    builtInPrompt: '内置系统提示词',
    catalogCustomOnly: 'LiteLLM 列表未就绪（仅可自定义）',
    catalogErrorPrefix: 'LiteLLM 列表错误：',
    catalogLoading: 'LiteLLM 列表加载中...',
    checkConnectivity: '检查连通性',
    config: '配置',
    configLoading: '配置加载中...',
    connectivityChecking: '检查中...',
    connectivityDone: '连通性检查完成',
    connectivityEmpty: '暂无模型服务',
    connectivityFailed: '连通性检查失败',
    connectivityTitle: '模型服务连通性',
    customModelPlaceholder: '自定义 model（例如：grok-3）',
    customOption: '自定义',
    customPrompt: '用户自定义提示词',
    customProviderPlaceholder: '自定义模型服务 ID（例如：xai）',
    deactivate: '停用',
    disabled: 'disabled',
    calls: '次调用',
    effective: 'effective',
    effectiveVersion: '生效版本',
    evolutionStrategy: '演进策略',
    invalidDate: '暂无',
    instances: 'instances',
    language: '中文',
    lastCalled: '最近调用',
    lastUpdated: '最近更新',
    llmSafetyConcurrent: '最大并发请求数',
    llmSafetyEnabled: '启用安全闸门',
    llmSafetyHelp: '在请求真正发到模型服务前，拦截异常突发或失控重试的调用。',
    llmSafetyLabel: 'LLM 安全闸门',
    llmSafetyRequests: '窗口内最大请求数',
    llmSafetyTokens: '窗口内最大预计 Tokens',
    llmSafetyWindow: '滚动窗口（毫秒）',
    loadErrorPrefix: '远端配置加载失败：',
    model: '模型',
    navLabel: '主导航',
    noMatchedProjects: '当前没有匹配的项目。',
    noMatchedSkillFamilies: '当前没有匹配的技能族。',
    noMatchedSkills: '当前项目没有匹配的技能。',
    noProjects: '当前没有可用项目。',
    noProviders: '暂无模型服务，请点击下方按钮添加。',
    noReason: '无原因',
    noSkillFamilySelected: '先从左侧选择一个 skill family。',
    noSkillInstance: '暂无实例',
    noVersions: '当前没有版本记录。',
    previewPropagation: '预览传播',
    project: '项目',
    projectCount: '个项目',
    projects: '项目',
    promptDecisionExplainerLabel: '决策解释器',
    promptDecisionExplainerPlaceholder: '补充 dashboard 文案风格、长度、语气等解释约束。',
    promptHelp: '为每个分析阶段选择使用内置系统提示词，还是使用你自定义的提示词。',
    promptLabel: '提示词配置',
    promptReadinessProbeLabel: 'Readiness Probe',
    promptReadinessProbePlaceholder: '补充何时继续等待、拆分窗口或启动深度分析的判断规则。',
    promptSkillCallAnalyzerLabel: 'Skill 调用分析器',
    promptSkillCallAnalyzerPlaceholder: '补充窗口分诊、归因判断、apply_optimization 触发阈值等规则。',
    providerActiveLabel: '启用',
    providersHelp: '通过下拉和输入框配置模型服务：选择模型服务，选择或输入模型，直接粘贴 API Key，并且只启用其中一个默认模型服务。',
    providersLabel: '模型服务列表',
    readOnlySkillDetail: '只读详情，确认版本、状态和最近更新时间。',
    removeProvider: '删除',
    restore: '恢复',
    retry: '重试',
    revisions: 'revisions',
    saveAuto: '已自动保存',
    saveFailed: '配置保存失败',
    saveSaving: '保存中...',
    saveSkillContent: '保存正文',
    saving: '保存中',
    searchProjects: '搜索 project / path / status',
    searchSkillFamilies: '搜索 family / runtime / status',
    searchSkills: '搜索 skill id / runtime / status',
    selectPreferredProject: '选择优先项目',
    skill: '技能',
    skillContent: '正文',
    skillContentAria: 'Skill 正文',
    skillFamilies: 'skill families',
    skillFamilyLibrary: '技能库',
    skillList: '技能列表',
    skills: '技能',
    status: '状态',
    switchRuntime: '切换 runtime',
    toggleLanguage: '切换语言',
    totalRows: '条',
    traces: 'Traces',
    traceCount: 'Trace 数',
    yes: '是',
    no: '否',
    version: '版本',
    versionHistory: '版本历史',
  },
  en: {
    addProject: 'Add project',
    addProvider: 'Add provider',
    apiKeyHide: 'Hide',
    apiKeyPastePlaceholder: 'Paste API Key',
    apiKeyShow: 'Show',
    applyToFamily: 'Apply to family instances',
    applying: 'Applying',
    builtInPrompt: 'Built-in system prompt',
    catalogCustomOnly: 'LiteLLM catalog unavailable; custom only',
    catalogErrorPrefix: 'LiteLLM catalog error:',
    catalogLoading: 'Loading LiteLLM catalog...',
    checkConnectivity: 'Check connectivity',
    config: 'Config',
    configLoading: 'Loading config...',
    connectivityChecking: 'Checking...',
    connectivityDone: 'Connectivity check complete',
    connectivityEmpty: 'No model providers yet',
    connectivityFailed: 'Connectivity check failed',
    connectivityTitle: 'Provider connectivity',
    customModelPlaceholder: 'Custom model, for example grok-3',
    customOption: 'Custom',
    customPrompt: 'Custom prompt',
    customProviderPlaceholder: 'Custom provider ID, for example xai',
    deactivate: 'Disable',
    disabled: 'disabled',
    calls: 'calls',
    effective: 'effective',
    effectiveVersion: 'Effective version',
    evolutionStrategy: 'Evolution strategy',
    invalidDate: 'N/A',
    instances: 'instances',
    language: 'EN',
    lastCalled: 'Last called',
    lastUpdated: 'Last updated',
    llmSafetyConcurrent: 'Max concurrent requests',
    llmSafetyEnabled: 'Enable safety gate',
    llmSafetyHelp: 'Blocks runaway bursts or retry loops before requests reach the model provider.',
    llmSafetyLabel: 'LLM safety gate',
    llmSafetyRequests: 'Max requests per window',
    llmSafetyTokens: 'Max estimated tokens per window',
    llmSafetyWindow: 'Rolling window (ms)',
    loadErrorPrefix: 'Failed to load remote config:',
    model: 'Model',
    navLabel: 'Primary navigation',
    noMatchedProjects: 'No matching projects.',
    noMatchedSkillFamilies: 'No matching skill families.',
    noMatchedSkills: 'No matching skills in this project.',
    noProjects: 'No projects available.',
    noProviders: 'No model providers yet. Add one below.',
    noReason: 'No reason',
    noSkillFamilySelected: 'Select a skill family from the left rail.',
    noSkillInstance: 'No instance',
    noVersions: 'No version records yet.',
    previewPropagation: 'Preview propagation',
    project: 'Project',
    projectCount: 'projects',
    projects: 'Projects',
    promptDecisionExplainerLabel: 'Decision explainer',
    promptDecisionExplainerPlaceholder: 'Add dashboard tone, length, or explanation constraints.',
    promptHelp: 'Choose whether each analysis stage uses the built-in system prompt or your custom prompt.',
    promptLabel: 'Prompt configuration',
    promptReadinessProbeLabel: 'Readiness Probe',
    promptReadinessProbePlaceholder: 'Add rules for waiting, splitting windows, or starting deeper analysis.',
    promptSkillCallAnalyzerLabel: 'Skill call analyzer',
    promptSkillCallAnalyzerPlaceholder: 'Add triage, attribution, and apply_optimization threshold rules.',
    providerActiveLabel: 'Active',
    providersHelp: 'Configure model providers with dropdowns and inputs. Pick a provider, choose or enter a model, paste an API key, and keep one provider active.',
    providersLabel: 'Model providers',
    readOnlySkillDetail: 'Read-only details for version, status, and recent updates.',
    removeProvider: 'Remove',
    restore: 'Restore',
    retry: 'Retry',
    revisions: 'revisions',
    saveAuto: 'Auto-saved',
    saveFailed: 'Config save failed',
    saveSaving: 'Saving...',
    saveSkillContent: 'Save content',
    saving: 'Saving',
    searchProjects: 'Search project / path / status',
    searchSkillFamilies: 'Search family / runtime / status',
    searchSkills: 'Search skill id / runtime / status',
    selectPreferredProject: 'Select preferred project',
    skill: 'Skill',
    skillContent: 'Content',
    skillContentAria: 'Skill content',
    skillFamilies: 'skill families',
    skillFamilyLibrary: 'Skill library',
    skillList: 'Skill list',
    skills: 'Skills',
    status: 'Status',
    switchRuntime: 'Switch runtime',
    toggleLanguage: 'Toggle language',
    totalRows: 'rows',
    traces: 'Traces',
    traceCount: 'Trace count',
    yes: 'Yes',
    no: 'No',
    version: 'Version',
    versionHistory: 'Version history',
  },
}

interface I18nContextValue {
  lang: DashboardLanguage
  locale: string
  setLanguage: (lang: DashboardLanguage) => void
  t: (key: TranslationKey) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)
const STORAGE_KEY = 'dashboard-v3.lang'

function normalizeLanguage(value: unknown): DashboardLanguage {
  return value === 'zh' ? 'zh' : 'en'
}

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

  useEffect(() => {
    if (initialLanguage) {
      return undefined
    }

    let cancelled = false
    fetch('/api/lang')
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { lang?: string } | null) => {
        if (!cancelled && payload?.lang) {
          setLang(normalizeLanguage(payload.lang))
        }
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

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
