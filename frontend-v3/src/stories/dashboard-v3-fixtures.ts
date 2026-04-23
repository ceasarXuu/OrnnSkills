import type { DashboardConfig, DashboardProviderCatalogEntry, DashboardProviderHealthResult } from '@/types/config'
import type {
  DashboardProject,
  DashboardSkill,
  DashboardSkillApplyPreview,
  DashboardSkillDetail,
  DashboardSkillFamily,
  DashboardSkillInstance,
  DashboardSkillVersionMetadata,
} from '@/types/dashboard'

export const storyProjects: DashboardProject[] = [
  {
    name: 'OrnnSkills',
    path: '/Users/xuzhang/OrnnSkills',
    lastSeenAt: '2026-04-23T06:30:00.000Z',
    monitoringState: 'active',
    skillCount: 112,
  },
  {
    name: 'mili',
    path: '/Users/xuzhang/mili',
    lastSeenAt: '2026-04-23T06:12:00.000Z',
    monitoringState: 'active',
    skillCount: 118,
  },
  {
    name: 'NBComic',
    path: '/Users/xuzhang/NBComic',
    lastSeenAt: '2026-04-23T05:58:00.000Z',
    monitoringState: 'paused',
    skillCount: 112,
  },
]

export const storySkillFamilies: DashboardSkillFamily[] = [
  {
    familyId: 'family_f272dc983b621999',
    familyName: 'astartes-coding-custodes',
    hasDivergedContent: true,
    instanceCount: 9,
    projectCount: 3,
    revisionCount: 6,
    runtimeCount: 3,
    runtimes: ['claude', 'codex', 'opencode'],
    status: 'active',
    usage: {
      analyzedTouches: 10,
      firstSeenAt: '2026-04-20T03:00:00.000Z',
      lastSeenAt: '2026-04-23T05:00:00.000Z',
      lastUsedAt: '2026-04-22T16:00:00.000Z',
      observedCalls: 14,
      optimizedCount: 5,
      status: 'active',
    },
  },
  {
    familyId: 'family_00ee6585a4141e9a',
    familyName: 'test-driven-development',
    hasDivergedContent: false,
    instanceCount: 9,
    projectCount: 3,
    revisionCount: 4,
    runtimeCount: 3,
    runtimes: ['claude', 'codex', 'opencode'],
    status: 'active',
    usage: {
      analyzedTouches: 72,
      firstSeenAt: '2026-04-18T10:00:00.000Z',
      lastSeenAt: '2026-04-23T06:00:00.000Z',
      lastUsedAt: '2026-04-22T12:00:00.000Z',
      observedCalls: 123,
      optimizedCount: 8,
      status: 'active',
    },
  },
  {
    familyId: 'family_453475360991ce06',
    familyName: 'systematic-debugging',
    hasDivergedContent: false,
    instanceCount: 9,
    projectCount: 3,
    revisionCount: 5,
    runtimeCount: 3,
    runtimes: ['claude', 'codex', 'opencode'],
    status: 'active',
    usage: {
      analyzedTouches: 31,
      firstSeenAt: '2026-04-18T08:00:00.000Z',
      lastSeenAt: '2026-04-23T05:30:00.000Z',
      lastUsedAt: '2026-04-22T15:00:00.000Z',
      observedCalls: 62,
      optimizedCount: 6,
      status: 'active',
    },
  },
]

export const storySkillInstances: DashboardSkillInstance[] = [
  {
    effectiveVersion: 6,
    familyId: storySkillFamilies[0].familyId,
    familyName: storySkillFamilies[0].familyName,
    instanceId: 'instance:ornn:claude:astartes',
    lastUsedAt: '2026-04-22T16:00:00.000Z',
    projectPath: '/Users/xuzhang/OrnnSkills',
    runtime: 'claude',
    skillId: 'astartes-coding-custodes',
    status: 'active',
    updatedAt: '2026-04-23T06:00:00.000Z',
    usage: storySkillFamilies[0].usage,
    versionCount: 6,
  },
  {
    effectiveVersion: 5,
    familyId: storySkillFamilies[0].familyId,
    familyName: storySkillFamilies[0].familyName,
    instanceId: 'instance:mili:codex:astartes',
    lastUsedAt: '2026-04-22T12:00:00.000Z',
    projectPath: '/Users/xuzhang/mili',
    runtime: 'codex',
    skillId: 'astartes-coding-custodes',
    status: 'pending',
    updatedAt: '2026-04-22T18:00:00.000Z',
    usage: storySkillFamilies[0].usage,
    versionCount: 5,
  },
]

export const storySkillDetail: DashboardSkillDetail = {
  content:
    '---\nname: astartes-coding-custodes\ndescription: Use this skill when iterative AI-assisted coding starts to degrade code quality.\n---\n\n# Astartes Coding Custodes\n\nKeep implementation staged, scoped, and reviewable.',
  effectiveVersion: 6,
  runtime: 'claude',
  skillId: 'astartes-coding-custodes',
  status: 'active',
  versions: [4, 5, 6],
}

export const storySkillVersions: Record<number, DashboardSkillVersionMetadata> = {
  4: {
    createdAt: '2026-04-20T10:00:00.000Z',
    previousVersion: 3,
    reason: 'Initial dashboard alignment',
    traceIds: ['trace-4'],
    version: 4,
  },
  5: {
    createdAt: '2026-04-21T11:30:00.000Z',
    isDisabled: true,
    previousVersion: 4,
    reason: 'Disabled noisy revision',
    traceIds: ['trace-5'],
    version: 5,
  },
  6: {
    createdAt: '2026-04-22T14:15:00.000Z',
    previousVersion: 5,
    reason: 'Restore staged implementation guidance',
    traceIds: ['trace-6'],
    version: 6,
  },
}

export const storyApplyPreview: DashboardSkillApplyPreview = {
  totalTargets: 2,
  targets: [
    { projectPath: '/Users/xuzhang/OrnnSkills', runtime: 'claude' },
    { projectPath: '/Users/xuzhang/mili', runtime: 'codex' },
  ],
}

export const storyProjectSkills: DashboardSkill[] = Array.from({ length: 18 }, (_, index) => ({
  current_revision: index % 4,
  effectiveVersion: index % 3 === 0 ? 2 : 1,
  runtime: index % 2 === 0 ? 'codex' : 'claude',
  skillId: ['systematic-debugging', 'test-driven-development', 'frontend-design'][index % 3],
  status: index % 5 === 0 ? 'active' : 'pending',
  traceCount: 46 - index,
  updatedAt: `2026-04-${String(22 - (index % 4)).padStart(2, '0')}T08:00:00.000Z`,
  versionsAvailable: [1, 2, 3].slice(0, (index % 3) + 1),
}))

export const storyDashboardConfig: DashboardConfig = {
  autoOptimize: true,
  defaultProvider: 'deepseek',
  llmSafety: {
    enabled: true,
    maxConcurrentRequests: 2,
    maxEstimatedTokensPerWindow: 200000,
    maxRequestsPerWindow: 60,
    windowMs: 60000,
  },
  logLevel: 'info',
  promptOverrides: {
    decisionExplainer: '',
    readinessProbe: 'Prefer waiting when evidence is partial.',
    skillCallAnalyzer: '',
  },
  promptSources: {
    decisionExplainer: 'built_in',
    readinessProbe: 'custom',
    skillCallAnalyzer: 'built_in',
  },
  providers: [
    {
      apiKeyEnvVar: 'DEEPSEEK_API_KEY',
      hasApiKey: true,
      modelName: 'deepseek-chat',
      provider: 'deepseek',
    },
  ],
  runtimeSync: true,
  userConfirm: true,
}

export const storyProviderCatalog: DashboardProviderCatalogEntry[] = [
  {
    apiKeyEnvVar: 'DEEPSEEK_API_KEY',
    defaultModel: 'deepseek-chat',
    id: 'deepseek',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    name: 'DeepSeek',
  },
  {
    apiKeyEnvVar: 'OPENAI_API_KEY',
    defaultModel: 'gpt-5.4',
    id: 'openai',
    models: ['gpt-5.4', 'gpt-5.4-mini'],
    name: 'OpenAI',
  },
]

export const storyConnectivityResults: DashboardProviderHealthResult[] = [
  {
    durationMs: 418,
    message: 'Connected',
    modelName: 'deepseek-chat',
    ok: true,
    provider: 'deepseek',
  },
]
