import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  fetchDashboardSkillDetail,
  fetchDashboardSkillFamilies,
  fetchDashboardSkillFamily,
  fetchDashboardSkillFamilyInstances,
  logDashboardV3Event,
  saveDashboardSkillDetail,
} from '@/lib/dashboard-api'
import { filterSkillFamilies, selectPreferredSkillInstance, sortSkillFamilies } from '@/lib/skill-library'
import {
  clearCachedSkillDetail,
  getCachedSkillDetail,
  setCachedSkillDetail,
} from '@/lib/skill-detail-cache'
import { getInitialSkillLibraryState, setSkillLibraryCache } from './use-dashboard-v3-skill-library-cache'
import { useDashboardV3SkillMarketplace } from './use-dashboard-v3-skill-marketplace'
import type { DashboardActionToastMessage } from '@/components/dashboard-action-toast'
import type {
  DashboardSkillDetail,
  DashboardSkillFamily,
  DashboardSkillInstance,
  SkillDomainRuntime,
} from '@/types/dashboard'

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }
  return fallback
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
  const preferredRuntime = useState<SkillDomainRuntime | null>(initialState?.preferredRuntime ?? 'codex')[0]
  const [query, setQuery] = useState(initialState?.query ?? '')
  const [actionMessage, setActionMessage] = useState<string | null>(initialState?.actionMessage ?? null)
  const toastSequenceRef = useRef(0)
  const [toastMessage, setToastMessage] = useState<DashboardActionToastMessage | null>(null)
  const [familiesError, setFamiliesError] = useState<string | null>(initialState?.familiesError ?? null)
  const [detailError, setDetailError] = useState<string | null>(initialState?.detailError ?? null)
  const [isLoadingFamilies, setIsLoadingFamilies] = useState(!hasInitialCache)
  const [isLoadingFamilyDetail, setIsLoadingFamilyDetail] = useState(false)
  const [isLoadingSkillDetail, setIsLoadingSkillDetail] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [refreshToken, setRefreshToken] = useState(0)
  const filteredFamilies = useMemo(() => {
    return sortSkillFamilies(filterSkillFamilies(families, query))
  }, [families, query])
  const selectedInstance = useMemo(() => {
    return instances.find((instance) => instance.instanceId === selectedInstanceId) ?? null
  }, [instances, selectedInstanceId])
  const marketplace = useDashboardV3SkillMarketplace({
    draftContent,
    onActionMessage: setActionMessage,
    onDraftContent: setDraftContent,
    onToastMessage: (message) => setToastMessage({ id: ++toastSequenceRef.current, message }),
    selectedInstance,
  })
  useEffect(() => {
    setSkillLibraryCache({
      actionMessage,
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
    })
  }, [
    actionMessage,
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
  ])
  const reload = useCallback(() => {
    setRefreshToken((current) => current + 1)
  }, [])
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
      setActionMessage(result.ok ? '已保存到宿主 skills 目录' : '保存失败。')
      clearCachedSkillDetail(selectedInstance.instanceId)
      reload()
    } catch (error) {
      setActionMessage(getErrorMessage(error, '保存失败。'))
    } finally {
      setIsSaving(false)
    }
  }, [detail, draftContent, reload, selectedInstance])
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
      return
    }
    const instance = selectedInstance
    let cancelled = false
    async function loadSkillDetail() {
      const cached = refreshToken === 0 ? getCachedSkillDetail(instance.instanceId) : null
      if (cached) {
        setDetail(cached.detail)
        setDraftContent(cached.draftContent)
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
          instance.instanceId,
        )
        if (cancelled) {
          return
        }
        setDetail(nextDetail)
        setDraftContent(nextDetail.content ?? '')
        setCachedSkillDetail(instance.instanceId, {
          detail: nextDetail,
          draftContent: nextDetail.content ?? '',
        })
        setIsLoadingSkillDetail(false)
        logDashboardV3Event('skill_library.content_ready', {
          familyId: selectedFamilyId,
          instanceId: instance.instanceId,
          versionCount: nextDetail.versions.length,
        })
      } catch (error) {
        if (!cancelled) {
          setDetail(null)
          setDraftContent('')
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
  return {
    actionMessage,
    applyMarketplaceChanges: marketplace.applyMarketplaceChanges,
    checkMarketplace: marketplace.checkMarketplace,
    clearToastMessage: () => setToastMessage(null),
    closeMarketplaceReview: marketplace.closeMarketplaceReview,
    detail,
    detailError,
    draftContent,
    families: filteredFamilies,
    familiesError,
    instances,
    isCheckingMarketplace: marketplace.isCheckingMarketplace,
    isLoadingFamilies,
    isLoadingFamilyDetail,
    isLoadingSkillDetail,
    isSaving,
    marketplaceReview: marketplace.marketplaceReview,
    query,
    save,
    selectedFamily,
    selectedFamilyId,
    selectedInstance,
    selectedInstanceId,
    selectFamily,
    setDraftContent,
    setQuery,
    toastMessage,
  }
}
