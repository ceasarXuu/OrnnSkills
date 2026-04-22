import { describe, expect, it } from 'vitest';

import { getViewCopy } from '../../frontend-v3/src/lib/format.ts';
import { resolveDashboardViewLayout } from '../../frontend-v3/src/lib/view-layout.ts';

describe('dashboard v3 view layout rules', () => {
  it('keeps the skills view focused on the skill workbench', () => {
    expect(resolveDashboardViewLayout('skills')).toEqual({
      showProjectRail: false,
      showHero: false,
      showMetrics: false,
    });
  });

  it('uses the project view for summary-heavy chrome', () => {
    expect(resolveDashboardViewLayout('projects')).toEqual({
      showProjectRail: true,
      showHero: true,
      showMetrics: true,
    });
  });

  it('keeps the activity view focused on the event stream', () => {
    expect(resolveDashboardViewLayout('activity')).toEqual({
      showProjectRail: true,
      showHero: false,
      showMetrics: false,
    });
  });

  it('keeps config as a first-class workspace with its own copy', () => {
    expect(getViewCopy('config' as never)).toEqual({
      eyebrow: 'Config Workspace',
      title: '配置工作区',
      description: '集中管理 provider、默认模型、LLM 安全阈值和演进提示词来源。',
    });
  });
});
