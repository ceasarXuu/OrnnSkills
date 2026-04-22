import { describe, expect, it } from 'vitest'

import { resolveDashboardViewLayout } from '../../frontend-v3/src/lib/view-layout.ts'

describe('dashboard v3 view layout rules', () => {
  it('keeps the skills view focused on the skill workbench', () => {
    expect(resolveDashboardViewLayout('skills')).toEqual({
      showProjectRail: false,
      showHero: false,
      showMetrics: false,
    });
  });

  it('uses the singular project view for summary-heavy chrome', () => {
    expect(resolveDashboardViewLayout('project')).toEqual({
      showProjectRail: true,
      showHero: false,
      showMetrics: false,
    });
  });

  it('keeps config free of project chrome', () => {
    expect(resolveDashboardViewLayout('config')).toEqual({
      showProjectRail: false,
      showHero: false,
      showMetrics: false,
    })
  })
})
