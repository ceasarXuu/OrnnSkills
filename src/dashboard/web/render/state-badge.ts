type RenderDashboardStateBadgeInput = {
  deps: {
    t: (key: string) => string;
  };
  state: string;
};

export function renderDashboardStateBadge(input: RenderDashboardStateBadgeInput): string {
  const { deps, state } = input;
  const stateMap: Record<string, string> = {
    idle: 'state-idle',
    analyzing: 'state-analyzing',
    optimizing: 'state-optimizing',
    error: 'state-error',
  };
  const stateTextMap: Record<string, string> = {
    idle: deps.t('stateIdle'),
    analyzing: deps.t('stateAnalyzing'),
    optimizing: deps.t('stateOptimizing'),
    error: deps.t('stateError'),
  };
  const cls = stateMap[state] || 'state-idle';
  const stateText = stateTextMap[state] || deps.t('stateIdle');
  return `<span class="state-badge ${cls}">${stateText}</span>`;
}

export function renderDashboardStateBadgeSource(): string {
  return renderDashboardStateBadge.toString();
}
