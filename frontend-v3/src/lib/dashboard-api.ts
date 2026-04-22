import type {
  ConnectionState,
  DashboardProjectsResponse,
  DashboardSsePayload,
  ProjectSnapshot,
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

export async function fetchProjectSnapshot(projectPath: string) {
  return await fetchJson<ProjectSnapshot>(
    `/api/projects/${encodeProjectPath(projectPath)}/snapshot`,
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
