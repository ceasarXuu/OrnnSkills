import { describe, expect, it } from 'vitest';

describe('dashboard trace bars render', () => {
  it('renders non-zero trace buckets with percentage widths', async () => {
    const { renderDashboardTraceBars } = await import('../../src/dashboard/web/render/trace-bars.js');

    const html = renderDashboardTraceBars({
      label: 'traceRuntime',
      data: {
        codex: 6,
        claude: 3,
        opencode: 0,
      },
      keys: ['codex', 'claude', 'opencode'],
    });

    expect(html).toContain('traceRuntime');
    expect(html).toContain('bar-fill bar-codex" style="width:67%"');
    expect(html).toContain('bar-fill bar-claude" style="width:33%"');
    expect(html).not.toContain('bar-opencode');
  });

  it('returns an empty string when there is no trace data to show', async () => {
    const { renderDashboardTraceBars } = await import('../../src/dashboard/web/render/trace-bars.js');

    expect(
      renderDashboardTraceBars({
        label: 'traceStatus',
        data: {
          success: 0,
          failure: 0,
        },
        keys: ['success', 'failure'],
      })
    ).toBe('');
  });

  it('exposes trace bar source for browser injection', async () => {
    const { renderDashboardTraceBarsSource } = await import('../../src/dashboard/web/render/trace-bars.js');

    expect(renderDashboardTraceBarsSource()).toContain('function renderDashboardTraceBars');
  });
});
