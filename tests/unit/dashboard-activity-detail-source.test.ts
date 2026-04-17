import { describe, expect, it } from 'vitest';
import { renderDashboardActivityDetailSource } from '../../src/dashboard/web/activity/detail-view.js';

describe('renderDashboardActivityDetailSource', () => {
  it('returns scope detail rendering and modal helpers', () => {
    const source = renderDashboardActivityDetailSource();

    expect(source).toContain('function renderActivityScopeDetail');
    expect(source).toContain('function buildActivityDetail');
    expect(source).toContain('async function openActivityScopeDetail');
    expect(source).toContain('function setEventModalContentHtml');
  });
});
