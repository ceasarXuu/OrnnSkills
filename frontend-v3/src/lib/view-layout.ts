import type { DashboardView } from '@/types/dashboard'

export interface DashboardViewLayout {
  showProjectRail: boolean
  showHero: boolean
  showMetrics: boolean
}

export function resolveDashboardViewLayout(view: DashboardView): DashboardViewLayout {
  switch (view) {
    case 'skills':
      return {
        showProjectRail: false,
        showHero: false,
        showMetrics: false,
      }
    case 'project':
      return {
        showProjectRail: true,
        showHero: false,
        showMetrics: false,
      }
    case 'cost':
      return {
        showProjectRail: true,
        showHero: false,
        showMetrics: false,
      }
    case 'config':
      return {
        showProjectRail: false,
        showHero: false,
        showMetrics: false,
      }
    default:
      return {
        showProjectRail: false,
        showHero: false,
        showMetrics: false,
      }
  }
}
