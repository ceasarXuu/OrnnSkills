import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  connectDashboardEvents,
  fetchDashboardProjects,
  fetchProjectSnapshot,
  logDashboardV3Event,
} from '@/lib/dashboard-api'
import type {
  ConnectionState,
  DashboardProject,
  ProjectSnapshot,
} from '@/types/dashboard'

type RefreshReason = 'initial' | 'manual' | 'selection' | 'sse'

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message
  }

  return '加载 dashboard 数据时失败。'
}

export function useDashboardV3Workspace() {
  const [projects, setProjects] = useState<DashboardProject[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [selectedSnapshot, setSelectedSnapshot] = useState<ProjectSnapshot | null>(null)
  const [isLoadingProjects, setIsLoadingProjects] = useState(true)
  const [isLoadingSnapshot, setIsLoadingSnapshot] = useState(false)
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting')

  const selectedProjectIdRef = useRef(selectedProjectId)

  useEffect(() => {
    selectedProjectIdRef.current = selectedProjectId
  }, [selectedProjectId])

  const loadSnapshotForProject = useCallback(
    async (projectPath: string, reason: RefreshReason) => {
      setIsLoadingSnapshot(true)
      logDashboardV3Event('snapshot.load_started', { projectPath, reason })

      try {
        const snapshot = await fetchProjectSnapshot(projectPath)
        setSelectedSnapshot(snapshot)
        setLastSyncedAt(new Date().toISOString())
        setLoadError(null)
        logDashboardV3Event('snapshot.load_succeeded', {
          projectPath,
          reason,
          skillCount: snapshot.skills?.length ?? 0,
          traceCount: snapshot.traceStats?.total ?? 0,
        })
      } catch (error) {
        const message = getErrorMessage(error)
        setLoadError(message)
        logDashboardV3Event('snapshot.load_failed', { projectPath, reason, message })
      } finally {
        setIsLoadingSnapshot(false)
      }
    },
    [],
  )

  const refreshWorkspace = useCallback(
    async (reason: RefreshReason = 'manual') => {
      setIsLoadingProjects(true)
      logDashboardV3Event('workspace.refresh_started', { reason })

      try {
        const nextProjects = await fetchDashboardProjects()
        const currentSelection = selectedProjectIdRef.current
        const nextSelection = nextProjects.some((project) => project.path === currentSelection)
          ? currentSelection
          : nextProjects[0]?.path ?? ''

        setProjects(nextProjects)
        setSelectedProjectId(nextSelection)
        setLoadError(null)

        if (nextSelection) {
          await loadSnapshotForProject(nextSelection, reason)
        } else {
          setSelectedSnapshot(null)
          setLastSyncedAt(new Date().toISOString())
        }

        logDashboardV3Event('workspace.refresh_succeeded', {
          reason,
          projectCount: nextProjects.length,
          selectedProjectId: nextSelection,
        })
      } catch (error) {
        const message = getErrorMessage(error)
        setLoadError(message)
        logDashboardV3Event('workspace.refresh_failed', { reason, message })
      } finally {
        setIsLoadingProjects(false)
      }
    },
    [loadSnapshotForProject],
  )

  const selectProject = useCallback(
    (projectPath: string) => {
      if (!projectPath || projectPath === selectedProjectIdRef.current) {
        return
      }

      setSelectedProjectId(projectPath)
      setSelectedSnapshot(null)
      void loadSnapshotForProject(projectPath, 'selection')
    },
    [loadSnapshotForProject],
  )

  useEffect(() => {
    void refreshWorkspace('initial')
  }, [refreshWorkspace])

  useEffect(() => {
    return connectDashboardEvents(
      async (payload) => {
        logDashboardV3Event('sse.update_received', {
          changedProjects: payload.changedProjects ?? [],
          projectCount: payload.projects?.length ?? 0,
        })
        await refreshWorkspace('sse')
      },
      (state) => {
        setConnectionState(state)
        logDashboardV3Event('sse.state_changed', { state })
      },
    )
  }, [refreshWorkspace])

  const selectedProject = useMemo(
    () => projects.find((project) => project.path === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  )

  return {
    connectionState,
    isLoadingProjects,
    isLoadingSnapshot,
    lastSyncedAt,
    loadError,
    projects,
    refreshWorkspace,
    selectProject,
    selectedProject,
    selectedProjectId,
    selectedSnapshot,
  }
}
