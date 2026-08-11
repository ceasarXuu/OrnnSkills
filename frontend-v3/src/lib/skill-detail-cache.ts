import type { DashboardSkillDetail } from '@/types/dashboard'

interface CachedSkillDetail {
  detail: DashboardSkillDetail
  draftContent: string
}

const skillDetailCache = new Map<string, CachedSkillDetail>()

export function getCachedSkillDetail(instanceId: string) {
  return skillDetailCache.get(instanceId) ?? null
}

export function setCachedSkillDetail(instanceId: string, value: CachedSkillDetail) {
  skillDetailCache.set(instanceId, value)
}

export function clearCachedSkillDetail(instanceId: string) {
  skillDetailCache.delete(instanceId)
}
