import type { DashboardSkill } from '@/types/dashboard'

export interface SkillsOverview {
  evidenceSkillCount: number
  errorSkillCount: number
  runtimeCount: number
  totalSkills: number
  totalTraces: number
}

export interface SkillsPaginationResult<T> {
  currentPage: number
  hasNextPage: boolean
  hasPreviousPage: boolean
  pageItems: T[]
  pageSize: number
  totalItems: number
  totalPages: number
}

export function buildSkillsOverview(skills: DashboardSkill[]): SkillsOverview {
  const runtimeSet = new Set<string>()
  let evidenceSkillCount = 0
  let errorSkillCount = 0
  let totalTraces = 0

  for (const skill of skills) {
    if (skill.runtime) {
      runtimeSet.add(skill.runtime)
    }

    if ((skill.traceCount ?? 0) > 0 || skill.lastUsedAt) {
      evidenceSkillCount += 1
    }

    if (skill.status === 'error' || skill.status === 'failed') {
      errorSkillCount += 1
    }

    totalTraces += skill.traceCount ?? 0
  }

  return {
    evidenceSkillCount,
    errorSkillCount,
    runtimeCount: runtimeSet.size,
    totalSkills: skills.length,
    totalTraces,
  }
}

export function paginateSkills<T>(
  items: T[],
  page: number,
  pageSize: number,
): SkillsPaginationResult<T> {
  const normalizedPageSize = Math.max(1, Math.trunc(pageSize) || 1)
  const totalItems = items.length
  const totalPages = Math.max(1, Math.ceil(totalItems / normalizedPageSize))
  const currentPage = Math.min(totalPages, Math.max(1, Math.trunc(page) || 1))
  const startIndex = (currentPage - 1) * normalizedPageSize
  const endIndex = startIndex + normalizedPageSize

  return {
    currentPage,
    hasNextPage: currentPage < totalPages,
    hasPreviousPage: currentPage > 1,
    pageItems: items.slice(startIndex, endIndex),
    pageSize: normalizedPageSize,
    totalItems,
    totalPages,
  }
}

export function getVisiblePaginationPages(currentPage: number, totalPages: number) {
  const visiblePages = new Set<number>([1, totalPages, currentPage - 1, currentPage, currentPage + 1])

  return [...visiblePages]
    .filter((value) => value >= 1 && value <= totalPages)
    .sort((left, right) => left - right)
}
