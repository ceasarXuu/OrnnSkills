import { describe, expect, it } from 'vitest';

describe('dashboard metric rows render', () => {
  it('renders metric cards sorted by descending count', async () => {
    const { renderDashboardMetricRows } = await import('../../src/dashboard/web/render/metric-rows.js');

    const html = renderDashboardMetricRows({
      title: 'overviewAgentScopes',
      rows: {
        small: 2,
        largest: 12,
        medium: 7,
      },
      emptyText: 'empty',
      deps: {
        escHtml: (value: unknown) => String(value ?? '').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
        formatCompactNumber: (value: unknown) => `fmt:${String(value)}`,
      },
    });

    expect(html).toContain('<span>overviewAgentScopes</span>');
    expect(html).toContain('fmt:12');
    expect(html.indexOf('largest')).toBeLessThan(html.indexOf('medium'));
    expect(html.indexOf('medium')).toBeLessThan(html.indexOf('small'));
  });

  it('renders the empty helper when there are no metrics', async () => {
    const { renderDashboardMetricRows } = await import('../../src/dashboard/web/render/metric-rows.js');

    const html = renderDashboardMetricRows({
      title: 'overviewAgentScopes',
      rows: {},
      emptyText: 'overviewNoAgentScopes',
      deps: {
        escHtml: (value: unknown) => String(value ?? ''),
        formatCompactNumber: (value: unknown) => String(value ?? ''),
      },
    });

    expect(html).toContain('<div class="config-help">overviewNoAgentScopes</div>');
  });

  it('exposes metric row source for browser injection', async () => {
    const { renderDashboardMetricRowsSource } = await import('../../src/dashboard/web/render/metric-rows.js');

    expect(renderDashboardMetricRowsSource()).toContain('function renderDashboardMetricRows');
  });
});
