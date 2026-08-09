import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  connectDashboardEvents,
  fetchDashboardProjects,
  fetchProjectSnapshot,
  logDashboardV3Event,
  pickDashboardProject,
  registerDashboardProject,
} from '@/lib/dashboard-api'
import type {
  ConnectionState,
  DashboardProject,
  DashboardProjectPickResponse,
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
  const [isPickingProject, setIsPickingProject] = useState(false)
  const [isManualPickOpen, setIsManualPickOpen] = useState(false)
  const [isSubmittingManualPick, setIsSubmittingManualPick] = useState(false)

  const isPickingProjectRef = useRef(isPickingProject)
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting')

  useEffect(() => {
    isPickingProjectRef.current = isPickingProject
  }, [isPickingProject])

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

  const applyProjectRegistration = useCallback(
    async (result: DashboardProjectPickResponse) => {
      if (!result.ok || !result.path) {
        const message = result.error ?? '项目选择失败。'
        setLoadError(message)
        logDashboardV3Event('project.pick_failed', { message })
        return
      }

      const nextProjects = Array.isArray(result.projects) ? result.projects : await fetchDashboardProjects()
      const nextSelection = nextProjects.some((project) => project.path === result.path)
        ? result.path
        : nextProjects[0]?.path ?? ''

      setProjects(nextProjects)
      setSelectedProjectId(nextSelection)
      setLoadError(null)

      if (nextSelection) {
        await loadSnapshotForProject(nextSelection, 'manual')
      } else {
        setSelectedSnapshot(null)
        setLastSyncedAt(new Date().toISOString())
      }

      logDashboardV3Event('project.pick_succeeded', {
        projectCount: nextProjects.length,
        selectedProjectId: nextSelection,
      })
    },
    [loadSnapshotForProject],
  )

  const pickProject = useCallback(async () => {
    if (isPickingProject) {
      return
    }

    setIsPickingProject(true)
    logDashboardV3Event('project.pick_started')

    try {
      const result = await pickDashboardProject()

      if (result.cancelled) {
        logDashboardV3Event('project.pick_cancelled')
        return
      }

      if (result.nativePickerUnavailable) {
        logDashboardV3Event('project.pick_native_unavailable')
        setIsManualPickOpen(true)
        return
      }

      await applyProjectRegistration(result)
    } catch (error) {
      const message = getErrorMessage(error)
      setLoadError(message)
      logDashboardV3Event('project.pick_failed', { message })
    } finally {
      setIsPickingProject(false)
    }
  }, [applyProjectRegistration, isPickingProject])

  const closeManualPick = useCallback(() => {
    if (!isSubmittingManualPick) {
      setIsManualPickOpen(false)
    }
  }, [isSubmittingManualPick])

  const submitManualProject = useCallback(
    async (path: string) => {
      const trimmedPath = path.trim()
      if (!trimmedPath) {
        return
      }
      setIsSubmittingManualPick(true)
      try {
        const result = await registerDashboardProject(trimmedPath)
        if (result.ok && result.path) {
          setIsManualPickOpen(false)
          await applyProjectRegistration(result)
        } else {
          setLoadError(result.error ?? '添加项目失败。')
          logDashboardV3Event('project.add_failed', { message: result.error ?? '' })
        }
      } catch (error) {
        const message = getErrorMessage(error)
        setLoadError(message)
        logDashboardV3Event('project.add_failed', { message })
      } finally {
        setIsSubmittingManualPick(false)
      }
    },
    [applyProjectRegistration],
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
        // 添加项目流程中不刷新列表，添加完成后由 applyProjectRegistration 主动刷新
        if (isPickingProjectRef.current) {
          return
        }
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
    closeManualPick,
    connectionState,
    isManualPickOpen,
    isPickingProject,
    isLoadingProjects,
    isLoadingSnapshot,
    isSubmittingManualPick,
    lastSyncedAt,
    loadError,
    pickProject,
    projects,
    refreshWorkspace,
    selectProject,
    selectedProject,
    selectedProjectId,
    selectedSnapshot,
    submitManualProject,
  }
}
