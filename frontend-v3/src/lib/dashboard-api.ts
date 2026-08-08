import type {
  ConnectionState,
  DashboardSkillApplyPreview,
  DashboardSkillDetail,
  DashboardSkillFamiliesResponse,
  DashboardSkillFamilyInstancesResponse,
  DashboardSkillFamilyResponse,
  DashboardSkillVersionRecord,
  DashboardProjectPickResponse,
  DashboardProjectsResponse,
  DashboardSsePayload,
  ProjectSnapshot,
  SkillDomainRuntime,
} from '@/types/dashboard'
import type {
  DashboardConfig,
  DashboardConfigResponse,
  DashboardConnectivityResponse,
  DashboardProviderCatalogResponse,
  DashboardProviderHealthResponse,
} from '@/types/config'

declare global {
  interface Window {
    __dashboardV3ErrorReportingInstalled__?: boolean
  }
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(path, {
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }

  return (await response.json()) as T
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }

  return (await response.json()) as T
}

async function putJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: 'PUT',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }

  return (await response.json()) as T
}

async function patchJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: 'PATCH',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }

  return (await response.json()) as T
}

async function reportClientEvent(payload: Record<string, unknown>) {
  try {
    await fetch('/api/dashboard/client-errors', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...payload,
        buildId: 'dashboard-v3',
        timestamp: new Date().toISOString(),
        ua: navigator.userAgent,
        href: window.location.href,
      }),
    })
  } catch {
    // Ignore telemetry failures.
  }
}

function encodeProjectPath(projectPath: string): string {
  return encodeURIComponent(projectPath)
}

export function logDashboardV3Event(
  eventName: string,
  attributes: Record<string, unknown> = {},
) {
  console.info('[dashboard-v3]', eventName, attributes)
}

export async function fetchDashboardProjects() {
  const data = await fetchJson<DashboardProjectsResponse>('/api/projects')
  return Array.isArray(data.projects) ? data.projects : []
}

export async function pickDashboardProject() {
  return await postJson<DashboardProjectPickResponse>('/api/projects/pick', {})
}

export async function fetchProjectSnapshot(projectPath: string) {
  return await fetchJson<ProjectSnapshot>(
    `/api/projects/${encodeProjectPath(projectPath)}/snapshot`,
  )
}

export async function fetchDashboardSkillFamilies() {
  const data = await fetchJson<DashboardSkillFamiliesResponse>('/api/skills/families')
  return Array.isArray(data.families) ? data.families : []
}

export async function fetchDashboardSkillFamily(familyId: string) {
  const data = await fetchJson<DashboardSkillFamilyResponse>(
    `/api/skills/families/${encodeURIComponent(familyId)}`,
  )
  return data.family
}

export async function fetchDashboardSkillFamilyInstances(familyId: string) {
  const data = await fetchJson<DashboardSkillFamilyInstancesResponse>(
    `/api/skills/families/${encodeURIComponent(familyId)}/instances`,
  )
  return Array.isArray(data.instances) ? data.instances : []
}

export async function fetchDashboardSkillDetail(
  projectPath: string,
  skillId: string,
  runtime: SkillDomainRuntime,
) {
  return await fetchJson<DashboardSkillDetail>(
    `/api/projects/${encodeProjectPath(projectPath)}/skills/${encodeURIComponent(skillId)}?runtime=${encodeURIComponent(runtime)}`,
  )
}

export async function fetchDashboardSkillVersion(
  projectPath: string,
  skillId: string,
  runtime: SkillDomainRuntime,
  version: number,
  instanceId?: string | null,
) {
  const path = instanceId
    ? `/api/projects/${encodeProjectPath(projectPath)}/skill-instances/${encodeURIComponent(instanceId)}/versions/${version}`
    : `/api/projects/${encodeProjectPath(projectPath)}/skills/${encodeURIComponent(skillId)}/versions/${version}?runtime=${encodeURIComponent(runtime)}`

  return await fetchJson<DashboardSkillVersionRecord>(path)
}

interface SaveDashboardSkillDetailInput {
  content: string
  instanceId?: string | null
  projectPath: string
  reason: string
  runtime: SkillDomainRuntime
  skillId: string
}

export async function saveDashboardSkillDetail(input: SaveDashboardSkillDetailInput) {
  const path = input.instanceId
    ? `/api/projects/${encodeProjectPath(input.projectPath)}/skill-instances/${encodeURIComponent(input.instanceId)}`
    : `/api/projects/${encodeProjectPath(input.projectPath)}/skills/${encodeURIComponent(input.skillId)}?runtime=${encodeURIComponent(input.runtime)}`

  return await putJson<{
    ok: boolean
    unchanged?: boolean
    version?: number
  }>(path, {
    content: input.content,
    reason: input.reason,
    runtime: input.runtime,
  })
}

interface ToggleDashboardSkillVersionInput {
  disabled: boolean
  instanceId?: string | null
  projectPath: string
  runtime: SkillDomainRuntime
  skillId: string
  version: number
}

export async function toggleDashboardSkillVersionDisabled(
  input: ToggleDashboardSkillVersionInput,
) {
  const path = input.instanceId
    ? `/api/projects/${encodeProjectPath(input.projectPath)}/skill-instances/${encodeURIComponent(input.instanceId)}/versions/${input.version}`
    : `/api/projects/${encodeProjectPath(input.projectPath)}/skills/${encodeURIComponent(input.skillId)}/versions/${input.version}?runtime=${encodeURIComponent(input.runtime)}`

  return await patchJson<{
    effectiveVersion?: number | null
    metadata?: DashboardSkillVersionRecord['metadata']
    ok: boolean
  }>(path, {
    disabled: input.disabled,
  })
}

export async function fetchDashboardSkillApplyPreview(
  projectPath: string,
  instanceId: string,
) {
  return await fetchJson<DashboardSkillApplyPreview>(
    `/api/projects/${encodeProjectPath(projectPath)}/skill-instances/${encodeURIComponent(instanceId)}/apply-preview`,
  )
}

interface ApplyDashboardSkillToFamilyInput {
  content: string
  instanceId: string
  projectPath: string
  reason: string
}

export async function applyDashboardSkillToFamily(input: ApplyDashboardSkillToFamilyInput) {
  return await postJson<{
    failedTargets?: number
    ok: boolean
    skippedTargets?: number
    totalTargets?: number
    updatedTargets?: number
  }>(
    `/api/projects/${encodeProjectPath(input.projectPath)}/skill-instances/${encodeURIComponent(input.instanceId)}/apply-to-family`,
    {
      content: input.content,
      reason: input.reason,
    },
  )
}

export interface MarketplaceSkillResponse {
  found: boolean
  source?: { repo: string; skill: string; url: string }
  content?: string
}

export async function fetchMarketplaceSkill(
  projectPath: string,
  skillId: string,
): Promise<MarketplaceSkillResponse> {
  return await fetchJson<MarketplaceSkillResponse>(
    `/api/projects/${encodeProjectPath(projectPath)}/skills/${encodeURIComponent(skillId)}/marketplace`,
  )
}

export async function fetchDashboardConfig() {
  const data = await fetchJson<DashboardConfigResponse>('/api/config')
  return data.config
}

export async function saveDashboardConfig(config: DashboardConfig) {
  return await postJson<{ ok: boolean }>('/api/config', { config })
}

export async function fetchDashboardProviderCatalog() {
  const data = await fetchJson<DashboardProviderCatalogResponse>('/api/providers/catalog')
  return Array.isArray(data.providers) ? data.providers : []
}

export async function fetchDashboardProviderHealth() {
  const data = await fetchJson<DashboardProviderHealthResponse>('/api/provider-health')
  return data.health
}

export async function checkDashboardProvidersConnectivity(providers: DashboardConfig['providers']) {
  const data = await postJson<DashboardConnectivityResponse>(
    '/api/config/providers/connectivity',
    { providers },
  )

  return Array.isArray(data.results) ? data.results : []
}

export function connectDashboardEvents(
  onUpdate: (payload: DashboardSsePayload) => void | Promise<void>,
  onStateChange: (state: ConnectionState) => void,
) {
  const source = new EventSource('/events')
  onStateChange('connecting')

  source.addEventListener('open', () => {
    onStateChange('connected')
  })

  source.addEventListener('update', (event) => {
    void (async () => {
      try {
        const payload = JSON.parse((event as MessageEvent).data) as DashboardSsePayload
        await onUpdate(payload)
      } catch (error) {
        await reportClientEvent({
          message: 'dashboard-v3 failed to parse update payload',
          source: 'dashboard-v3.sse.update',
          stack: error instanceof Error ? error.stack : String(error),
        })
      }
    })()
  })

  source.addEventListener('error', () => {
    onStateChange('reconnecting')
  })

  return () => {
    source.close()
  }
}

export function installDashboardV3ErrorReporting() {
  if (window.__dashboardV3ErrorReportingInstalled__) {
    return
  }

  window.__dashboardV3ErrorReportingInstalled__ = true

  window.addEventListener('error', (event) => {
    void reportClientEvent({
      message: event.message,
      source: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error instanceof Error ? event.error.stack : '',
    })
  })

  window.addEventListener('unhandledrejection', (event) => {
    void reportClientEvent({
      message: `Unhandled promise rejection: ${String(event.reason)}`,
      source: 'dashboard-v3.unhandledrejection',
      stack: event.reason instanceof Error ? event.reason.stack : '',
    })
  })
}
