export type MonitoringState = 'active' | 'paused'
export type ConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'error'
export type DashboardView = 'skills' | 'projects' | 'activity' | 'config'

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

export interface DashboardSkill {
  skillId: string
  runtime?: string
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
  runtime?: string
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
  runtime?: string
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

export interface DashboardSsePayload {
  projects?: DashboardProject[]
  changedProjects?: string[]
}
