type DashboardActivityPanelInput = {
  activityLayer: string;
  deps: {
    renderBusinessEvents: (projectPath: string) => string;
    renderRecentTraces: (recentTraces: unknown[]) => string;
    renderTraceBars: (label: string, data: Record<string, number>, keys: string[]) => string;
    t: (key: string) => string;
  };
  projectPath: string;
  recentTraces?: unknown[];
  traceStats: {
    total: number;
    byRuntime: Record<string, number>;
    byStatus: Record<string, number>;
    byEventType: Record<string, number>;
  };
};

export function renderDashboardActivityPanel(input: DashboardActivityPanelInput): string {
  const { deps } = input;

  return `
    <div class="card">
      <div class="card-header"><span>${deps.t('traceTitle')}</span><span style="color:var(--muted)">${input.traceStats.total} ${deps.t('traceTotal')}</span></div>
      <div class="card-body">
        <div class="activity-controls">
          <div class="activity-left">
            <button class="activity-tab ${input.activityLayer === 'business' ? 'active' : ''}" onclick="setActivityLayer('business')">${deps.t('activityLayerBusiness')}</button>
            <button class="activity-tab ${input.activityLayer === 'raw' ? 'active' : ''}" onclick="setActivityLayer('raw')">${deps.t('activityLayerRaw')}</button>
          </div>
        </div>
        ${input.activityLayer === 'business'
          ? deps.renderBusinessEvents(input.projectPath)
          : input.traceStats.total > 0
            ? `
          ${deps.renderTraceBars(deps.t('traceRuntime'), input.traceStats.byRuntime, ['codex', 'claude', 'opencode'])}
          ${deps.renderTraceBars(deps.t('traceStatus'), input.traceStats.byStatus, ['success', 'failure', 'retry', 'interrupted'])}
          <div style="margin-top:10px" class="trace-table-wrap">
            ${deps.renderRecentTraces((input.recentTraces || []).slice(0, 50))}
          </div>
        `
            : `<div class="empty-state">${deps.t('activityEmpty')}</div>`}
      </div>
    </div>
  `;
}

export function renderDashboardActivityPanelSource(): string {
  return renderDashboardActivityPanel.toString();
}
