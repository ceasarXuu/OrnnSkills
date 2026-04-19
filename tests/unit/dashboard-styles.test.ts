import { describe, expect, it } from 'vitest';
import { renderDashboardStylesSource } from '../../src/dashboard/web/styles.js';

describe('renderDashboardStylesSource', () => {
  it('returns core dashboard layout and interaction styles', () => {
    const css = renderDashboardStylesSource();

    expect(css).toContain('.app { display: grid;');
    expect(css).toContain('.project-item.active');
    expect(css).toContain('.activity-table { width: 100%;');
    expect(css).toContain('.provider-row {');
    expect(css).toContain('.header-center');
    expect(css).toContain('.workspace-tabs { justify-content: center;');
    expect(css).toContain('.main-tab {');
    expect(css).toContain('border: none;');
    expect(css).toContain('background: transparent;');
    expect(css).not.toContain('.page-kicker');
    expect(css).not.toContain('.page-copy');
  });
});
