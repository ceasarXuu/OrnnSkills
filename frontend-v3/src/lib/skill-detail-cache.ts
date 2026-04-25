import type {
  DashboardSkillDetail,
  DashboardSkillVersionMetadata,
  SkillDomainRuntime,
} from '@/types/dashboard'
import { fetchDashboardSkillVersion } from './dashboard-api'

interface CachedSkillDetail {
  detail: DashboardSkillDetail
  draftContent: string
  selectedVersion: number | null
  versionMetadataByNumber: Record<number, DashboardSkillVersionMetadata>
}

const skillDetailCache = new Map<string, CachedSkillDetail>()

export function getCachedSkillDetail(instanceId: string) {
  return skillDetailCache.get(instanceId) ?? null
}

export function setCachedSkillDetail(instanceId: string, value: CachedSkillDetail) {
  skillDetailCache.set(instanceId, value)
}

export function mergeCachedVersionMetadata(
  instanceId: string,
  metadata: Record<number, DashboardSkillVersionMetadata>,
) {
  const current = skillDetailCache.get(instanceId)
  if (!current) {
    return
  }

  skillDetailCache.set(instanceId, {
    ...current,
    versionMetadataByNumber: {
      ...current.versionMetadataByNumber,
      ...metadata,
    },
  })
}

export function clearCachedSkillDetail(instanceId: string) {
  skillDetailCache.delete(instanceId)
}

export async function loadSkillVersionMetadata(input: {
  instanceId: string
  projectPath: string
  runtime: SkillDomainRuntime
  skillId: string
  versions: number[]
}) {
  const entries = await Promise.all(
    input.versions.map(async (version) => {
      const record = await fetchDashboardSkillVersion(
        input.projectPath,
        input.skillId,
        input.runtime,
        version,
        input.instanceId,
      )
      return [version, record.metadata] as const
    }),
  )

  return Object.fromEntries(entries)
}
