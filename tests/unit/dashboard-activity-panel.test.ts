import { describe, expect, it } from 'vitest';

describe('dashboard activity panel', () => {
  it('renders business activity with layer tabs', async () => {
    const { renderDashboardActivityPanel } = await import('../../src/dashboard/web/panels/activity-panel.js');

    const html = renderDashboardActivityPanel({
      activityLayer: 'business',
      deps: {
        renderBusinessEvents: (projectPath: string) => `<section>${projectPath}:business</section>`,
        renderRecentTraces: () => '<table>raw</table>',
        renderTraceBars: (label: string) => `<div>${label}</div>`,
        t: (key: string) => key,
      },
      projectPath: '/tmp/ornn-project',
      traceStats: {
        total: 3,
        byRuntime: { codex: 3 },
        byStatus: { success: 3 },
        byEventType: {},
      },
    });

    expect(html).toContain('activity-tab active');
    expect(html).toContain('activityLayerBusiness');
    expect(html).toContain('activityLayerRaw');
    expect(html).toContain('<section>/tmp/ornn-project:business</section>');
    expect(html).not.toContain('<table>raw</table>');
  });

  it('renders raw activity traces and empty state fallback', async () => {
    const { renderDashboardActivityPanel } = await import('../../src/dashboard/web/panels/activity-panel.js');

    const rawHtml = renderDashboardActivityPanel({
      activityLayer: 'raw',
      deps: {
        renderBusinessEvents: () => '<section>business</section>',
        renderRecentTraces: () => '<table>raw</table>',
        renderTraceBars: (label: string) => `<div>${label}</div>`,
        t: (key: string) => key,
      },
      projectPath: '/tmp/ornn-project',
      traceStats: {
        total: 1,
        byRuntime: { codex: 1 },
        byStatus: { success: 1 },
        byEventType: {},
      },
    });

    expect(rawHtml).toContain('<table>raw</table>');
    expect(rawHtml).toContain('<div>traceRuntime</div>');
    expect(rawHtml).toContain('<div>traceStatus</div>');

    const emptyHtml = renderDashboardActivityPanel({
      activityLayer: 'raw',
      deps: {
        renderBusinessEvents: () => '<section>business</section>',
        renderRecentTraces: () => '<table>raw</table>',
        renderTraceBars: (label: string) => `<div>${label}</div>`,
        t: (key: string) => key,
      },
      projectPath: '/tmp/ornn-project',
      traceStats: {
        total: 0,
        byRuntime: {},
        byStatus: {},
        byEventType: {},
      },
    });

    expect(emptyHtml).toContain('<div class="empty-state">activityEmpty</div>');
  });
});
