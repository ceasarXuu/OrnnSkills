export type MonitoringState = 'active' | 'paused'
export type ConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'error'
export type DashboardView = 'skills' | 'project' | 'cost' | 'config'
export type SkillDomainRuntime = 'codex' | 'claude' | 'opencode'
export type SkillUsageStatus = 'active' | 'idle' | 'unused' | 'partial'

export interface DashboardProject {
  path: string
  name: string
  registeredAt?: string
  lastSeenAt?: string
  monitoringState?: MonitoringState
  pausedAt?: string | null
  isRunning?: boolean
  isPaused?: boolean
  skillCount?: number
}

export interface DashboardSkillUsageSummary {
  observedCalls: number
  analyzedTouches: number
  optimizedCount: number
  firstSeenAt: string | null
  lastSeenAt: string | null
  lastUsedAt: string | null
  status: SkillUsageStatus
}

export interface DashboardSkillFamily {
  familyId: string
  familyName: string
  skillKey?: string
  normalizedName?: string
  projectCount: number
  instanceCount: number
  runtimeCount: number
  revisionCount: number
  projectPaths?: string[]
  runtimes: SkillDomainRuntime[]
  installedAt?: string | null
  firstSeenAt?: string | null
  lastSeenAt?: string | null
  lastUsedAt?: string | null
  status?: SkillUsageStatus
  hasDivergedContent?: boolean
  usage: DashboardSkillUsageSummary
}

export interface DashboardSkillInstance {
  instanceId: string
  familyId: string
  familyName: string
  projectPath: string
  skillId: string
  runtime: SkillDomainRuntime
  status: string
  lastUsedAt?: string | null
  updatedAt?: string | null
  effectiveVersion: number | null
  versionCount?: number
  usage: DashboardSkillUsageSummary
}

export interface DashboardSkillVersionMetadata {
  version: number
  createdAt: string
  reason: string
  traceIds: string[]
  previousVersion: number | null
  isDisabled?: boolean
  disabledAt?: string | null
  activityScopeId?: string
}

export interface DashboardSkillVersionRecord {
  content: string
  metadata: DashboardSkillVersionMetadata
}

export interface DashboardSkillDetail {
  skillId: string
  runtime: SkillDomainRuntime
  content: string
  versions: number[]
  effectiveVersion: number | null
  status?: string
}

export interface DashboardSkillApplyPreviewTarget {
  projectPath: string
  runtime: SkillDomainRuntime
}

export interface DashboardSkillApplyPreview {
  instanceId?: string
  totalTargets: number
  targets: DashboardSkillApplyPreviewTarget[]
}

export interface DashboardSkill {
  skillId: string
  runtime?: SkillDomainRuntime
  status?: string
  traceCount?: number
  current_revision?: number
  updatedAt?: string
  lastUsedAt?: string
  effectiveVersion?: number | null
  versionsAvailable?: number[]
}

export interface DashboardTrace {
  trace_id?: string
  session_id?: string
  runtime?: SkillDomainRuntime
  timestamp?: string
  event_type?: string
  skill_refs?: string[]
  status?: string
}

export interface DashboardDecisionEvent {
  id?: string
  timestamp?: string
  tag?: string
  skillId?: string
  runtime?: SkillDomainRuntime
  status?: string
  reason?: string
  ruleName?: string
  changeType?: string | null
  businessCategory?: string
  businessTag?: string
  inputSummary?: string
  judgment?: string
  nextAction?: string
  linesAdded?: number | null
  linesRemoved?: number | null
}

export interface DashboardMetricBucket {
  callCount?: number
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
  durationMsTotal?: number
  avgDurationMs?: number
  lastCallAt?: string | null
}

export interface DashboardAgentUsage extends DashboardMetricBucket {
  byModel?: Record<string, DashboardMetricBucket>
  byScope?: Record<string, DashboardMetricBucket>
  bySkill?: Record<string, DashboardMetricBucket>
}

export interface DashboardTraceStats {
  total?: number
  byRuntime?: Record<string, number>
  byStatus?: Record<string, number>
  byEventType?: Record<string, number>
}

export interface DashboardDaemonState {
  isRunning?: boolean
  pid?: number | null
  processedTraces?: number
  lastCheckpointAt?: string | null
  retryQueueSize?: number
  monitoringState?: MonitoringState
  pausedAt?: string | null
  isPaused?: boolean
  optimizationStatus?: {
    currentState?: string
    currentSkillId?: string | null
    lastOptimizationAt?: string | null
    lastError?: string | null
    queueSize?: number
  }
}

export interface ProjectSnapshot {
  daemon?: DashboardDaemonState
  skills?: DashboardSkill[]
  traceStats?: DashboardTraceStats
  recentTraces?: DashboardTrace[]
  decisionEvents?: DashboardDecisionEvent[]
  agentUsage?: DashboardAgentUsage
}

export interface DashboardProjectsResponse {
  projects: DashboardProject[]
}

export interface DashboardProjectPickResponse {
  cancelled?: boolean
  daemonRunning?: boolean
  daemonStarted?: boolean
  error?: string
  initialized?: boolean
  ok: boolean
  path?: string
  projects?: DashboardProject[]
}

export interface DashboardSkillFamiliesResponse {
  families: DashboardSkillFamily[]
}

export interface DashboardSkillFamilyResponse {
  family: DashboardSkillFamily
}

export interface DashboardSkillFamilyInstancesResponse {
  instances: DashboardSkillInstance[]
}

export interface DashboardSsePayload {
  projects?: DashboardProject[]
  changedProjects?: string[]
}
