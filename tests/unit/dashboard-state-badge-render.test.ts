import { describe, expect, it } from 'vitest';

describe('dashboard state badge render', () => {
  it('renders translated daemon states with the matching badge class', async () => {
    const { renderDashboardStateBadge } = await import('../../src/dashboard/web/render/state-badge.js');

    expect(renderDashboardStateBadge({
      state: 'idle',
      deps: {
        t: (key: string) => key,
      },
    })).toContain('class="state-badge state-idle"');

    expect(renderDashboardStateBadge({
      state: 'optimizing',
      deps: {
        t: (key: string) => key,
      },
    })).toContain('stateOptimizing');
  });

  it('falls back to the idle presentation for unknown states', async () => {
    const { renderDashboardStateBadge } = await import('../../src/dashboard/web/render/state-badge.js');

    const html = renderDashboardStateBadge({
      state: 'mystery',
      deps: {
        t: (key: string) => key,
      },
    });

    expect(html).toContain('class="state-badge state-idle"');
    expect(html).toContain('stateIdle');
  });

  it('exposes state badge source for browser injection', async () => {
    const { renderDashboardStateBadgeSource } = await import('../../src/dashboard/web/render/state-badge.js');

    expect(renderDashboardStateBadgeSource()).toContain('function renderDashboardStateBadge');
  });
});
