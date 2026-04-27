import { useCallback, useEffect, useState } from 'react'
import { fetchDashboardSkillVersion, logDashboardV3Event } from '@/lib/dashboard-api'
import type {
  DashboardSkillInstance,
  DashboardSkillVersionMetadata,
} from '@/types/dashboard'

interface UseSkillVersionCompareInput {
  baseVersion: number | null
  onActionMessage: (message: string | null) => void
  onMetadataLoaded: (version: number, metadata: DashboardSkillVersionMetadata) => void
  selectedFamilyId: string
  selectedInstance: DashboardSkillInstance | null
}

export function useSkillVersionCompare({
  baseVersion,
  onActionMessage,
  onMetadataLoaded,
  selectedFamilyId,
  selectedInstance,
}: UseSkillVersionCompareInput) {
  const [compareContent, setCompareContent] = useState<string | null>(null)
  const [compareVersion, setCompareVersion] = useState<number | null>(null)

  useEffect(() => {
    setCompareContent(null)
    setCompareVersion(null)
  }, [baseVersion, selectedInstance?.instanceId])

  const selectCompareVersion = useCallback(
    async (version: number | null) => {
      if (!selectedInstance || !baseVersion || version === null || version === baseVersion) {
        setCompareContent(null)
        setCompareVersion(null)
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
        setCompareContent(record.content)
        setCompareVersion(version)
        onMetadataLoaded(version, record.metadata)
        logDashboardV3Event('skill_library.version_diff_selected', {
          baseVersion,
          compareVersion: version,
          familyId: selectedFamilyId,
          instanceId: selectedInstance.instanceId,
        })
      } catch (error) {
        onActionMessage(error instanceof Error && error.message ? error.message : '加载对比版本失败。')
      }
    },
    [baseVersion, onActionMessage, onMetadataLoaded, selectedFamilyId, selectedInstance],
  )

  return {
    compareContent,
    compareVersion,
    selectCompareVersion,
  }
}
