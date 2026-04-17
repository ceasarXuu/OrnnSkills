type DashboardOverviewMetricMap = Record<string, number>;

type DashboardOverviewDecisionSummary = {
  mappingByStrategy: DashboardOverviewMetricMap;
  evaluationByRule: DashboardOverviewMetricMap;
  skippedByReason: DashboardOverviewMetricMap;
  patchByType: DashboardOverviewMetricMap;
  patchVolume: {
    linesAdded: number;
    linesRemoved: number;
  };
  runtimeDriftCount: number;
};

type DashboardOverviewTraceStats = {
  total: number;
  byRuntime: Record<string, number>;
  byStatus: Record<string, number>;
  byEventType: Record<string, number>;
};

type DashboardOverviewAgentUsageBucket = {
  callCount?: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  durationMsTotal?: number;
  avgDurationMs?: number;
  lastCallAt?: string | null;
};

type DashboardOverviewAgentUsage = {
  callCount?: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  durationMsTotal?: number;
  avgDurationMs?: number;
  lastCallAt?: string | null;
  byModel?: Record<string, DashboardOverviewAgentUsageBucket>;
  byScope?: Record<string, DashboardOverviewAgentUsageBucket>;
  bySkill?: Record<string, DashboardOverviewAgentUsageBucket>;
};

type DashboardOverviewDaemon = {
  isRunning?: boolean;
  isPaused?: boolean;
  monitoringState?: string | null;
  startedAt?: string | null;
  processedTraces?: number;
  lastCheckpointAt?: string | null;
  retryQueueSize?: number;
  optimizationStatus?: {
    currentState?: string | null;
    currentSkillId?: string | null;
    lastOptimizationAt?: string | null;
    lastError?: string | null;
    queueSize?: number;
  };
};

type DashboardOverviewPanelDeps = {
  escHtml: (value: unknown) => string;
  formatUptime: (startedAt: string) => string;
  formatUsageCompact: (value: unknown) => string;
  renderMetricRows: (title: string, rows: Record<string, number>, emptyText: string) => string;
  renderStateBadge: (state: string) => string;
  renderTraceBars: (label: string, data: Record<string, number>, keys: string[]) => string;
  t: (key: string) => string;
  timeAgo: (value: string) => string;
};

type RenderDashboardOverviewPanelInput = {
  agentUsage?: DashboardOverviewAgentUsage | null;
  daemon?: DashboardOverviewDaemon | null;
  decisionSummary: DashboardOverviewDecisionSummary;
  deps: DashboardOverviewPanelDeps;
  hasDecisionEvents?: boolean;
  skillsCount: number;
  traceStats?: DashboardOverviewTraceStats | null;
};

export function renderDashboardOverviewPanel(input: RenderDashboardOverviewPanelInput): string {
  const { deps } = input;
  const daemon = input.daemon || {
    isRunning: false,
    processedTraces: 0,
    optimizationStatus: { queueSize: 0 },
    retryQueueSize: 0,
  };
  const traceStats = input.traceStats || { total: 0, byRuntime: {}, byStatus: {}, byEventType: {} };
  const decisionSummary = input.decisionSummary;
  const agentUsage = input.agentUsage || {
    callCount: 0,
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    durationMsTotal: 0,
    avgDurationMs: 0,
    lastCallAt: null,
    byModel: {},
    byScope: {},
    bySkill: {},
  };

  const monitoringPaused = daemon.isPaused === true || daemon.monitoringState === 'paused';
  const daemonRunning = !monitoringPaused && !!daemon.isRunning;
  const daemonStatusText = monitoringPaused
    ? deps.t('daemonPaused')
    : daemonRunning
      ? deps.t('daemonRunning')
      : deps.t('daemonStopped');
  const daemonStatusDot = monitoringPaused
    ? 'dot dot-yellow'
    : daemonRunning
      ? 'dot dot-green'
      : 'dot dot-gray';
  const uptime = daemonRunning && daemon.startedAt ? deps.formatUptime(daemon.startedAt) : '—';
  const optimizationQueueSize = monitoringPaused ? 0 : (daemon.optimizationStatus?.queueSize ?? 0);
  const renderedDaemonState = deps.renderStateBadge(
    monitoringPaused ? 'idle' : (daemon.optimizationStatus?.currentState || 'idle')
  );
  const mappedCount = Object.values(decisionSummary.mappingByStrategy).reduce((sum, count) => sum + count, 0);
  const skippedCount = Object.values(decisionSummary.skippedByReason).reduce((sum, count) => sum + count, 0);
  const agentScopeCounts = Object.fromEntries(
    Object.entries(agentUsage.byScope || {}).map(([scope, item]) => [scope, item.callCount || 0])
  );

  return `
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-label">${deps.t('statShadowSkills')}</div>
        <div class="stat-value">${input.skillsCount}</div>
        <div class="stat-sub">${deps.t('statShadowSkillsSub')}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">${deps.t('statTraces')}</div>
        <div class="stat-value">${daemon.processedTraces ?? 0}</div>
        <div class="stat-sub">${deps.t('statTracesSub')}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">${deps.t('statUptime')}</div>
        <div class="stat-value" style="font-size:15px">${uptime}</div>
        <div class="stat-sub">${daemonStatusText}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">${deps.t('statQueue')}</div>
        <div class="stat-value">${optimizationQueueSize}</div>
        <div class="stat-sub">${deps.t('statQueueSub')}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">${deps.t('costCalls')}</div>
        <div class="stat-value">${agentUsage.callCount ?? 0}</div>
        <div class="stat-sub">${deps.t('costCallsSub')}</div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <span>${deps.t('daemonStatus')}</span>
        <span><span class="${daemonStatusDot}"></span> ${daemonStatusText}</span>
      </div>
      <div class="card-body">
        <div class="daemon-grid">
          <div>
            <div class="daemon-row"><span class="daemon-key">${deps.t('daemonState')}</span><span class="daemon-val">${renderedDaemonState}</span></div>
            <div class="daemon-row"><span class="daemon-key">${deps.t('daemonCurrentSkill')}</span><span class="daemon-val">${monitoringPaused ? '—' : (daemon.optimizationStatus?.currentSkillId ?? '—')}</span></div>
            <div class="daemon-row"><span class="daemon-key">${deps.t('daemonRetryQueue')}</span><span class="daemon-val">${monitoringPaused ? 0 : (daemon.retryQueueSize ?? 0)}</span></div>
          </div>
          <div>
            <div class="daemon-row"><span class="daemon-key">${deps.t('daemonLastCheckpoint')}</span><span class="daemon-val">${daemon.lastCheckpointAt ? deps.timeAgo(daemon.lastCheckpointAt) : '—'}</span></div>
            <div class="daemon-row"><span class="daemon-key">${deps.t('daemonLastOptimization')}</span><span class="daemon-val">${daemon.optimizationStatus?.lastOptimizationAt ? deps.timeAgo(daemon.optimizationStatus.lastOptimizationAt) : '—'}</span></div>
            ${!monitoringPaused && daemon.optimizationStatus?.lastError ? `<div class="daemon-row"><span class="daemon-key" style="color:var(--red)">${deps.t('daemonLastError')}</span><span class="daemon-val" style="color:var(--red);font-size:10px">${deps.escHtml(daemon.optimizationStatus.lastError)}</span></div>` : ''}
          </div>
        </div>
      </div>
    </div>
    ${input.hasDecisionEvents ? `
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-label">${deps.t('overviewMapped')}</div>
        <div class="stat-value">${mappedCount}</div>
        <div class="stat-sub">${deps.t('overviewMappedSub')}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">${deps.t('overviewSkipped')}</div>
        <div class="stat-value">${skippedCount}</div>
        <div class="stat-sub">${deps.t('overviewSkippedSub')}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">${deps.t('overviewPatchDelta')}</div>
        <div class="stat-value" style="font-size:15px">+${decisionSummary.patchVolume.linesAdded}/-${decisionSummary.patchVolume.linesRemoved}</div>
        <div class="stat-sub">${deps.t('overviewPatchDeltaSub')}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">${deps.t('overviewHostDrift')}</div>
        <div class="stat-value">${decisionSummary.runtimeDriftCount}</div>
        <div class="stat-sub">${deps.t('overviewHostDriftSub')}</div>
      </div>
    </div>

    <div class="skills-list" style="grid-template-columns:repeat(2,1fr)">
      ${deps.renderMetricRows(deps.t('overviewMappingStrategy'), decisionSummary.mappingByStrategy, deps.t('overviewNoMappingData'))}
      ${deps.renderMetricRows(deps.t('overviewEvaluationRules'), decisionSummary.evaluationByRule, deps.t('overviewNoEvaluationData'))}
      ${deps.renderMetricRows(deps.t('overviewSkipReasons'), decisionSummary.skippedByReason, deps.t('overviewNoSkipData'))}
      ${deps.renderMetricRows(deps.t('overviewPatchTypes'), decisionSummary.patchByType, deps.t('overviewNoPatchData'))}
    </div>
    ` : ''}
    ${agentUsage.callCount ? `
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-label">${deps.t('costCalls')}</div>
        <div class="stat-value">${deps.formatUsageCompact(agentUsage.callCount)}</div>
        <div class="stat-sub">${deps.t('overviewAgentUsageSub')}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">${deps.t('costInputTokens')}</div>
        <div class="stat-value">${deps.formatUsageCompact(agentUsage.promptTokens)}</div>
        <div class="stat-sub">${deps.t('overviewAgentUsageSub')}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">${deps.t('costOutputTokens')}</div>
        <div class="stat-value">${deps.formatUsageCompact(agentUsage.completionTokens)}</div>
        <div class="stat-sub">${deps.t('overviewAgentUsageSub')}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">${deps.t('costTotalTokens')}</div>
        <div class="stat-value">${deps.formatUsageCompact(agentUsage.totalTokens)}</div>
        <div class="stat-sub">${deps.t('overviewAgentUsageSub')}</div>
      </div>
    </div>

    <div class="skills-list" style="grid-template-columns:repeat(1,1fr)">
      ${deps.renderMetricRows(deps.t('overviewAgentScopes'), agentScopeCounts, deps.t('overviewNoAgentScopes'))}
    </div>
    ` : ''}
    ${traceStats.total > 0 ? `
    <div class="card">
      <div class="card-header"><span>${deps.t('traceTitle')}</span><span style="color:var(--muted)">${traceStats.total} ${deps.t('traceTotal')}</span></div>
      <div class="card-body">
        ${deps.renderTraceBars(deps.t('traceRuntime'), traceStats.byRuntime, ['codex', 'claude', 'opencode'])}
        ${deps.renderTraceBars(deps.t('traceStatus'), traceStats.byStatus, ['success', 'failure', 'retry', 'interrupted'])}
      </div>
    </div>` : ''}
  `;
}

export function renderDashboardOverviewPanelSource(): string {
  return renderDashboardOverviewPanel.toString();
}
