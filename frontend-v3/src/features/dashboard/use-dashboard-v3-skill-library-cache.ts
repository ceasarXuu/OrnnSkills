import type {
  DashboardSkillDetail,
  DashboardSkillFamily,
  DashboardSkillInstance,
  SkillDomainRuntime,
} from '@/types/dashboard'

/**
 * Module-level cache for the dashboard v3 skill library hook.
 *
 * Extracted from use-dashboard-v3-skill-library.ts to keep that file under
 * the 500-line policy. Tests can reset state via the helpers below.
 */

export interface SkillLibraryCacheState {
  actionMessage: string | null
  detail: DashboardSkillDetail | null
  detailError: string | null
  draftContent: string
  families: DashboardSkillFamily[]
  familiesError: string | null
  instances: DashboardSkillInstance[]
  preferredProjectPath: string
  preferredRuntime: SkillDomainRuntime | null
  query: string
  selectedFamily: DashboardSkillFamily | null
  selectedFamilyId: string
  selectedInstanceId: string
}

let skillLibraryCache: SkillLibraryCacheState | null = null

export function getSkillLibraryCache(): SkillLibraryCacheState | null {
  return skillLibraryCache
}

export function setSkillLibraryCache(snapshot: SkillLibraryCacheState): void {
  skillLibraryCache = snapshot
}

export function getInitialSkillLibraryState(
  preferredProjectPath: string,
): SkillLibraryCacheState | null {
  return skillLibraryCache?.preferredProjectPath === preferredProjectPath ? skillLibraryCache : null
}

export function resetSkillLibraryCache(): void {
  skillLibraryCache = null
}
