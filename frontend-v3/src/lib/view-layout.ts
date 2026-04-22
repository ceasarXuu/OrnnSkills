import type { DashboardView } from '@/types/dashboard'

export interface DashboardViewLayout {
  showProjectRail: boolean
  showHero: boolean
  showMetrics: boolean
  showProjectScopeBar: boolean
}

export function resolveDashboardViewLayout(view: DashboardView): DashboardViewLayout {
  switch (view) {
    case 'skills':
      return {
        showProjectRail: false,
        showHero: false,
        showMetrics: false,
        showProjectScopeBar: true,
      }
    case 'projects':
      return {
        showProjectRail: true,
        showHero: true,
        showMetrics: true,
        showProjectScopeBar: false,
      }
    case 'activity':
      return {
        showProjectRail: true,
        showHero: false,
        showMetrics: false,
        showProjectScopeBar: false,
      }
    case 'config':
      return {
        showProjectRail: false,
        showHero: false,
        showMetrics: false,
        showProjectScopeBar: false,
      }
    default:
      return {
        showProjectRail: false,
        showHero: false,
        showMetrics: false,
        showProjectScopeBar: false,
      }
  }
}
