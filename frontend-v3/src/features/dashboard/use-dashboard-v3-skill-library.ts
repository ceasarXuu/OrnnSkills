import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  applyDashboardSkillToFamily,
  fetchDashboardSkillApplyPreview,
  fetchDashboardSkillDetail,
  fetchDashboardSkillFamilies,
  fetchDashboardSkillFamily,
  fetchDashboardSkillFamilyInstances,
  fetchDashboardSkillVersion,
  logDashboardV3Event,
  saveDashboardSkillDetail,
  toggleDashboardSkillVersionDisabled,
} from '@/lib/dashboard-api'
import {
  filterSkillFamilies,
  selectPreferredSkillInstance,
  sortSkillFamilies,
} from '@/lib/skill-library'
import {
  clearCachedSkillDetail,
  getCachedSkillDetail,
  loadSkillVersionMetadata,
  mergeCachedVersionMetadata,
  setCachedSkillDetail,
} from '@/lib/skill-detail-cache'
import { useSkillVersionCompare } from './use-skill-version-compare'
import type {
  DashboardSkillApplyPreview,
  DashboardSkillDetail,
  DashboardSkillFamily,
  DashboardSkillInstance,
  DashboardSkillVersionMetadata,
  SkillDomainRuntime,
} from '@/types/dashboard'
interface SkillLibraryCacheState {
  actionMessage: string | null
  applyPreview: DashboardSkillApplyPreview | null
  detail: DashboardSkillDetail | null
  detailError: string | null
  draftContent: string
  families: DashboardSkillFamily[]
  familiesError: string | null
  instances: DashboardSkillInstance[]
  preferredProjectPath: string
  preferredRuntime: SkillDomainRuntime
  query: string
  selectedFamily: DashboardSkillFamily | null
  selectedFamilyId: string
  selectedInstanceId: string
  selectedVersion: number | null
  versionMetadataByNumber: Record<number, DashboardSkillVersionMetadata>
}
let skillLibraryCache: SkillLibraryCacheState | null = null
function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }
  return fallback
}
function getInitialSkillLibraryState(preferredProjectPath: string) {
  return skillLibraryCache?.preferredProjectPath === preferredProjectPath ? skillLibraryCache : null
}
export function useDashboardV3SkillLibrary(preferredProjectPath: string) {
  const initialState = getInitialSkillLibraryState(preferredProjectPath)
  const hasInitialCacheRef = useRef(Boolean(initialState))
  const hasInitialCache = hasInitialCacheRef.current
  const [families, setFamilies] = useState<DashboardSkillFamily[]>(initialState?.families ?? [])
  const [selectedFamilyId, setSelectedFamilyId] = useState(initialState?.selectedFamilyId ?? '')
  const [selectedFamily, setSelectedFamily] = useState<DashboardSkillFamily | null>(initialState?.selectedFamily ?? null)
  const [instances, setInstances] = useState<DashboardSkillInstance[]>(initialState?.instances ?? [])
  const [selectedInstanceId, setSelectedInstanceId] = useState(initialState?.selectedInstanceId ?? '')
  const [detail, setDetail] = useState<DashboardSkillDetail | null>(initialState?.detail ?? null)
  const [draftContent, setDraftContent] = useState(initialState?.draftContent ?? '')
  const [selectedVersion, setSelectedVersion] = useState<number | null>(initialState?.selectedVersion ?? null)
  const [versionMetadataByNumber, setVersionMetadataByNumber] = useState<Record<number, DashboardSkillVersionMetadata>>(initialState?.versionMetadataByNumber ?? {})
  const [preferredRuntime, setPreferredRuntime] = useState<SkillDomainRuntime>(initialState?.preferredRuntime ?? 'codex')
  const [query, setQuery] = useState(initialState?.query ?? '')
  const [applyPreview, setApplyPreview] = useState<DashboardSkillApplyPreview | null>(initialState?.applyPreview ?? null)
  const [actionMessage, setActionMessage] = useState<string | null>(initialState?.actionMessage ?? null)
  const [familiesError, setFamiliesError] = useState<string | null>(initialState?.familiesError ?? null)
  const [detailError, setDetailError] = useState<string | null>(initialState?.detailError ?? null)
  const [isLoadingFamilies, setIsLoadingFamilies] = useState(!hasInitialCache)
  const [isLoadingFamilyDetail, setIsLoadingFamilyDetail] = useState(false)
  const [isLoadingSkillDetail, setIsLoadingSkillDetail] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isApplying, setIsApplying] = useState(false)
  const [refreshToken, setRefreshToken] = useState(0)
  const filteredFamilies = useMemo(() => {
    return sortSkillFamilies(filterSkillFamilies(families, query))
  }, [families, query])
  const selectedInstance = useMemo(() => {
    return instances.find((instance) => instance.instanceId === selectedInstanceId) ?? null
  }, [instances, selectedInstanceId])
  const versionCompare = useSkillVersionCompare({
    baseVersion: selectedVersion,
    onActionMessage: setActionMessage,
    onMetadataLoaded: (version, metadata) => {
      setVersionMetadataByNumber((current) => ({ ...current, [version]: metadata }))
    },
    selectedFamilyId,
    selectedInstance,
  })
  useEffect(() => {
    skillLibraryCache = {
      actionMessage,
      applyPreview,
      detail,
      detailError,
      draftContent,
      families,
      familiesError,
      instances,
      preferredProjectPath,
      preferredRuntime,
      query,
      selectedFamily,
      selectedFamilyId,
      selectedInstanceId,
      selectedVersion,
      versionMetadataByNumber,
    }
  }, [
    actionMessage,
    applyPreview,
    detail,
    detailError,
    draftContent,
    families,
    familiesError,
    instances,
    preferredProjectPath,
    preferredRuntime,
    query,
    selectedFamily,
    selectedFamilyId,
    selectedInstanceId,
    selectedVersion,
    versionMetadataByNumber,
  ])
  const reload = useCallback(() => {
    setRefreshToken((current) => current + 1)
  }, [])
  useEffect(() => {
    let cancelled = false
    async function loadFamilies() {
      if (!hasInitialCache || refreshToken > 0) {
        setIsLoadingFamilies(true)
      }
      setFamiliesError(null)
      try {
        const nextFamilies = await fetchDashboardSkillFamilies()
        if (cancelled) {
          return
        }
        setFamilies(nextFamilies)
        setSelectedFamilyId((current) => {
          if (current && nextFamilies.some((family) => family.familyId === current)) {
            return current
          }
          return nextFamilies[0]?.familyId ?? ''
        })
      } catch (error) {
        if (!cancelled) {
          setFamiliesError(getErrorMessage(error, '加载技能库失败。'))
        }
      } finally {
        if (!cancelled) {
          setIsLoadingFamilies(false)
        }
      }
    }
    void loadFamilies()
    return () => {
      cancelled = true
    }
  }, [hasInitialCache, refreshToken])
  useEffect(() => {
    if (!selectedFamilyId) {
      setSelectedFamily(null)
      setInstances([])
      setSelectedInstanceId('')
      return
    }
    let cancelled = false
    async function loadFamilyDetail() {
      if (!hasInitialCache || refreshToken > 0) {
        setIsLoadingFamilyDetail(true)
      }
      setDetailError(null)
      try {
        const [family, nextInstances] = await Promise.all([
          fetchDashboardSkillFamily(selectedFamilyId),
          fetchDashboardSkillFamilyInstances(selectedFamilyId),
        ])
        if (cancelled) {
          return
        }
        setSelectedFamily(family)
        setInstances(nextInstances)
        const preferredInstance = selectPreferredSkillInstance(nextInstances, {
          preferredProjectPath,
          preferredRuntime,
        })
        setSelectedInstanceId(preferredInstance?.instanceId ?? '')
      } catch (error) {
        if (!cancelled) {
          setDetailError(getErrorMessage(error, '加载技能族详情失败。'))
        }
      } finally {
        if (!cancelled) {
          setIsLoadingFamilyDetail(false)
        }
      }
    }
    void loadFamilyDetail()
    return () => {
      cancelled = true
    }
  }, [hasInitialCache, preferredProjectPath, preferredRuntime, selectedFamilyId, refreshToken])
  useEffect(() => {
    if (!selectedInstance) {
      setDetail(null)
      setDraftContent('')
      setVersionMetadataByNumber({})
      setSelectedVersion(null)
      setApplyPreview(null)
      return
    }
    const instance = selectedInstance
    let cancelled = false
    async function loadSkillDetail() {
      const cached = refreshToken === 0 ? getCachedSkillDetail(instance.instanceId) : null
      if (cached) {
        setDetail(cached.detail)
        setDraftContent(cached.draftContent)
        setSelectedVersion(cached.selectedVersion)
        setVersionMetadataByNumber(cached.versionMetadataByNumber)
        setPreferredRuntime(instance.runtime)
        setApplyPreview(null)
        setIsLoadingSkillDetail(false)
        return
      }
      if (!hasInitialCache || refreshToken > 0) {
        setIsLoadingSkillDetail(true)
      }
      setDetailError(null)
      try {
        const nextDetail = await fetchDashboardSkillDetail(
          instance.projectPath,
          instance.skillId,
          instance.runtime,
        )
        if (cancelled) {
          return
        }
        setDetail(nextDetail)
        setDraftContent(nextDetail.content ?? '')
        const nextSelectedVersion = nextDetail.effectiveVersion ?? nextDetail.versions[nextDetail.versions.length - 1] ?? null
        setSelectedVersion(nextSelectedVersion)
        setVersionMetadataByNumber({})
        setPreferredRuntime(instance.runtime)
        setApplyPreview(null)
        setCachedSkillDetail(instance.instanceId, {
          detail: nextDetail,
          draftContent: nextDetail.content ?? '',
          selectedVersion: nextSelectedVersion,
          versionMetadataByNumber: {},
        })
        setIsLoadingSkillDetail(false)
        logDashboardV3Event('skill_library.content_ready', {
          familyId: selectedFamilyId,
          instanceId: instance.instanceId,
          versionCount: nextDetail.versions.length,
        })
        void loadSkillVersionMetadata({
          instanceId: instance.instanceId,
          projectPath: instance.projectPath,
          runtime: instance.runtime,
          skillId: instance.skillId,
          versions: nextDetail.versions,
        })
          .then((metadata) => {
            if (!cancelled) {
              setVersionMetadataByNumber(metadata)
              mergeCachedVersionMetadata(instance.instanceId, metadata)
            }
          })
          .catch((error) => {
            if (!cancelled) {
              logDashboardV3Event('skill_library.version_metadata_failed', {
                instanceId: instance.instanceId,
                message: getErrorMessage(error, '加载版本历史失败。'),
              })
            }
          })
      } catch (error) {
        if (!cancelled) {
          setDetail(null)
          setDraftContent('')
          setVersionMetadataByNumber({})
          setSelectedVersion(null)
          setDetailError(getErrorMessage(error, '加载技能正文失败。'))
          setIsLoadingSkillDetail(false)
        }
      }
    }
    void loadSkillDetail()
    return () => {
      cancelled = true
    }
  }, [hasInitialCache, selectedInstance, refreshToken])
  const selectFamily = useCallback((familyId: string) => {
    setSelectedFamilyId(familyId)
    setActionMessage(null)
    logDashboardV3Event('skill_library.family_selected', { familyId })
  }, [])
  const switchRuntime = useCallback(
    (runtime: SkillDomainRuntime) => {
      setPreferredRuntime(runtime)
      const runtimeInstances = instances.filter((instance) => instance.runtime === runtime)
      const preferredInstance = selectPreferredSkillInstance(runtimeInstances, {
        preferredProjectPath,
        preferredRuntime: runtime,
      })
      if (preferredInstance) {
        setSelectedInstanceId(preferredInstance.instanceId)
      }
      logDashboardV3Event('skill_library.runtime_switched', {
        familyId: selectedFamilyId,
        runtime,
      })
    },
    [instances, preferredProjectPath, selectedFamilyId],
  )
  const loadVersion = useCallback(
    async (version: number) => {
      if (!selectedInstance || !detail) {
        return
      }
      try {
        const record = await fetchDashboardSkillVersion(
          selectedInstance.projectPath,
          selectedInstance.skillId,
          selectedInstance.runtime,
          version,
          selectedInstance.instanceId,
        )
        setDraftContent(record.content)
        setSelectedVersion(version)
        setVersionMetadataByNumber((current) => ({
          ...current,
          [version]: record.metadata,
        }))
        logDashboardV3Event('skill_library.version_selected', {
          familyId: selectedFamilyId,
          instanceId: selectedInstance.instanceId,
          version,
        })
      } catch (error) {
        setActionMessage(getErrorMessage(error, '加载版本失败。'))
      }
    },
    [detail, selectedFamilyId, selectedInstance],
  )
  const save = useCallback(async () => {
    if (!selectedInstance || !detail) {
      return
    }
    setIsSaving(true)
    setActionMessage('保存中')
    try {
      const result = await saveDashboardSkillDetail({
        content: draftContent,
        instanceId: selectedInstance.instanceId,
        projectPath: selectedInstance.projectPath,
        reason: 'Manual edit from dashboard v3',
        runtime: selectedInstance.runtime,
        skillId: selectedInstance.skillId,
      })
      setActionMessage(result.unchanged ? '没有正文变更' : `已保存 v${result.version ?? '--'}`)
      clearCachedSkillDetail(selectedInstance.instanceId)
      reload()
    } catch (error) {
      setActionMessage(getErrorMessage(error, '保存失败。'))
    } finally {
      setIsSaving(false)
    }
  }, [detail, draftContent, reload, selectedInstance])
  const toggleVersionDisabled = useCallback(
    async (version: number, disabled: boolean) => {
      if (!selectedInstance || !detail) {
        return
      }
      try {
        const result = await toggleDashboardSkillVersionDisabled({
          disabled,
          instanceId: selectedInstance.instanceId,
          projectPath: selectedInstance.projectPath,
          runtime: selectedInstance.runtime,
          skillId: selectedInstance.skillId,
          version,
        })
        setVersionMetadataByNumber((current) => ({
          ...current,
          [version]: result.metadata ?? current[version],
        }))
        setDetail((current) => {
          if (!current) {
            return current
          }
          return {
            ...current,
            effectiveVersion: result.effectiveVersion ?? current.effectiveVersion,
          }
        })
        setActionMessage(disabled ? `已停用 v${version}` : `已恢复 v${version}`)
        clearCachedSkillDetail(selectedInstance.instanceId)
        reload()
      } catch (error) {
        setActionMessage(getErrorMessage(error, '切换版本状态失败。'))
      }
    },
    [detail, reload, selectedInstance],
  )
  const loadApplyPreview = useCallback(async () => {
    if (!selectedInstance) {
      return
    }
    try {
      const preview = await fetchDashboardSkillApplyPreview(
        selectedInstance.projectPath,
        selectedInstance.instanceId,
      )
      setApplyPreview(preview)
    } catch (error) {
      setActionMessage(getErrorMessage(error, '加载传播预览失败。'))
    }
  }, [selectedInstance])
  const applyToFamily = useCallback(async () => {
    if (!selectedInstance) {
      return
    }
    setIsApplying(true)
    setActionMessage('正在应用到同族实例')
    try {
      const result = await applyDashboardSkillToFamily({
        content: draftContent,
        instanceId: selectedInstance.instanceId,
        projectPath: selectedInstance.projectPath,
        reason: 'Manual edit from dashboard v3',
      })
      setActionMessage(
        `已更新 ${result.updatedTargets ?? 0} 个，跳过 ${result.skippedTargets ?? 0} 个`,
      )
      reload()
    } catch (error) {
      setActionMessage(getErrorMessage(error, '应用到同族实例失败。'))
    } finally {
      setIsApplying(false)
    }
  }, [draftContent, reload, selectedInstance])
  return {
    actionMessage,
    applyToFamily,
    applyPreview,
    detail,
    detailError,
    diffContent: versionCompare.compareContent,
    diffVersion: versionCompare.compareVersion,
    draftContent,
    families: filteredFamilies,
    familiesError,
    instances,
    isApplying,
    isLoadingFamilies,
    isLoadingFamilyDetail,
    isLoadingSkillDetail,
    isSaving,
    loadApplyPreview,
    loadDiffVersion: versionCompare.selectCompareVersion,
    loadVersion,
    preferredRuntime,
    query,
    save,
    selectedFamily,
    selectedFamilyId,
    selectedInstance,
    selectedInstanceId,
    selectedVersion,
    selectFamily,
    setDraftContent,
    setQuery,
    switchRuntime,
    toggleVersionDisabled,
    versionMetadataByNumber,
  }
}
