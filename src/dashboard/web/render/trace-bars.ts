type RenderDashboardTraceBarsInput = {
  data: Record<string, number>;
  keys: string[];
  label: string;
};

export function renderDashboardTraceBars(input: RenderDashboardTraceBarsInput): string {
  const { data, keys, label } = input;
  const total = Object.values(data).reduce((sum, count) => sum + count, 0);
  if (total === 0) {
    return '';
  }

  return `<div style="margin-bottom:10px">
    <div style="font-size:10px;color:var(--muted);margin-bottom:6px">${label}</div>
    ${keys.filter((key) => data[key]).map((key) => {
      const pct = Math.round((data[key] / total) * 100);
      return `<div class="bar-row">
        <span class="bar-label">${key}</span>
        <div class="bar-track"><div class="bar-fill bar-${key}" style="width:${pct}%"></div></div>
        <span class="bar-count">${data[key]}</span>
      </div>`;
    }).join('')}
  </div>`;
}

export function renderDashboardTraceBarsSource(): string {
  return renderDashboardTraceBars.toString();
}
