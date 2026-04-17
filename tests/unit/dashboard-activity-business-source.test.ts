import { describe, expect, it } from 'vitest';
import { renderDashboardActivityBusinessSource } from '../../src/dashboard/web/activity/business-events.js';

describe('renderDashboardActivityBusinessSource', () => {
  it('returns activity business helpers and regex constants', () => {
    const source = renderDashboardActivityBusinessSource();

    expect(source).toContain('function businessEventLabel');
    expect(source).toContain('const ACTIVITY_CJK_CHAR_RE');
    expect(source).toContain('function describeAnalysisFailure');
    expect(source).toContain('function buildActivityInputText');
  });
});
