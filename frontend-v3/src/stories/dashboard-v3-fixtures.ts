import type { DashboardConfig, DashboardProviderCatalogEntry, DashboardProviderHealthResult } from '@/types/config'
import type {
  DashboardAgentUsage,
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

const storyProjectSkillSeeds = [
  { runtime: 'codex', skillId: 'systematic-debugging', status: 'active' },
  { runtime: 'claude', skillId: 'test-driven-development', status: 'pending' },
  { runtime: 'codex', skillId: 'frontend-design', status: 'pending' },
  { runtime: 'claude', skillId: 'trace-analysis', status: 'pending' },
  { runtime: 'codex', skillId: 'api-contract-check', status: 'active' },
  { runtime: 'claude', skillId: 'release-checklist', status: 'pending' },
  { runtime: 'codex', skillId: 'performance-triage', status: 'pending' },
  { runtime: 'claude', skillId: 'prompt-governance', status: 'pending' },
  { runtime: 'codex', skillId: 'regression-hunting', status: 'active' },
  { runtime: 'claude', skillId: 'design-token-sync', status: 'pending' },
  { runtime: 'codex', skillId: 'workspace-audit', status: 'pending' },
  { runtime: 'claude', skillId: 'story-map-curation', status: 'pending' },
  { runtime: 'codex', skillId: 'incident-postmortem', status: 'active' },
  { runtime: 'claude', skillId: 'visual-baseline-review', status: 'pending' },
  { runtime: 'codex', skillId: 'dependency-upgrade', status: 'pending' },
  { runtime: 'claude', skillId: 'accessibility-pass', status: 'pending' },
  { runtime: 'codex', skillId: 'ci-hardening', status: 'active' },
  { runtime: 'claude', skillId: 'docs-curation', status: 'pending' },
] as const satisfies Array<Pick<DashboardSkill, 'runtime' | 'skillId' | 'status'>>

export const storyProjectSkills: DashboardSkill[] = storyProjectSkillSeeds.map((seed, index) => ({
  current_revision: index % 4,
  effectiveVersion: index % 3 === 0 ? 2 : 1,
  runtime: seed.runtime,
  skillId: seed.skillId,
  status: seed.status,
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
    modelDetails: [
      {
        id: 'deepseek/deepseek-chat',
        inputCostPerToken: 0.00000027,
        maxInputTokens: 64000,
        maxOutputTokens: 8000,
        mode: 'chat',
        outputCostPerToken: 0.0000011,
        supportsFunctionCalling: true,
        supportsPromptCaching: true,
        supportsStructuredOutput: true,
      },
      {
        id: 'deepseek/deepseek-reasoner',
        inputCostPerToken: 0.00000055,
        maxInputTokens: 64000,
        maxOutputTokens: 8000,
        mode: 'chat',
        outputCostPerReasoningToken: 0.00000219,
        outputCostPerToken: 0.00000219,
        supportsReasoning: true,
      },
    ],
    models: ['deepseek-chat', 'deepseek-reasoner'],
    name: 'DeepSeek',
  },
  {
    apiKeyEnvVar: 'OPENAI_API_KEY',
    defaultModel: 'gpt-5.4',
    id: 'openai',
    modelDetails: [
      {
        id: 'openai/gpt-5.4',
        inputCostPerToken: 0.00000125,
        maxInputTokens: 128000,
        maxOutputTokens: 16000,
        mode: 'chat',
        outputCostPerToken: 0.00001,
        supportsFunctionCalling: true,
        supportsReasoning: true,
        supportsStructuredOutput: true,
      },
    ],
    models: ['gpt-5.4', 'gpt-5.4-mini'],
    name: 'OpenAI',
  },
]

export const storyAgentUsage: DashboardAgentUsage = {
  avgDurationMs: 8420,
  byModel: {
    'deepseek/deepseek-chat': {
      avgDurationMs: 6500,
      callCount: 38,
      completionTokens: 48200,
      lastCallAt: '2026-04-23T06:30:00.000Z',
      promptTokens: 182000,
      totalTokens: 230200,
    },
    'openai/gpt-5.4': {
      avgDurationMs: 12400,
      callCount: 7,
      completionTokens: 19100,
      lastCallAt: '2026-04-23T04:10:00.000Z',
      promptTokens: 72000,
      totalTokens: 91100,
    },
  },
  byScope: {
    skill_call_analyzer: {
      callCount: 29,
      totalTokens: 171000,
    },
    decision_explainer: {
      callCount: 12,
      totalTokens: 98200,
    },
    readiness_probe: {
      callCount: 4,
      totalTokens: 52100,
    },
  },
  bySkill: {
    'test-driven-development': {
      callCount: 13,
      totalTokens: 98000,
    },
    'systematic-debugging': {
      callCount: 9,
      totalTokens: 70200,
    },
    'astartes-coding-custodes': {
      callCount: 7,
      totalTokens: 64100,
    },
  },
  callCount: 45,
  completionTokens: 67300,
  durationMsTotal: 378900,
  lastCallAt: '2026-04-23T06:30:00.000Z',
  promptTokens: 254000,
  totalTokens: 321300,
}

export const storyConnectivityResults: DashboardProviderHealthResult[] = [
  {
    durationMs: 418,
    message: 'Connected',
    modelName: 'deepseek-chat',
    ok: true,
    provider: 'deepseek',
  },
]
