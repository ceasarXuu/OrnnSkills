type RenderDashboardMetricRowsInput = {
  deps: {
    escHtml: (value: unknown) => string;
    formatCompactNumber: (value: unknown) => string;
  };
  emptyText: string;
  rows: Record<string, number>;
  title: string;
};

export function renderDashboardMetricRows(input: RenderDashboardMetricRowsInput): string {
  const { deps, emptyText, rows, title } = input;
  const entries = Object.entries(rows || {}).sort(
    (a, b) => Number(b[1] || 0) - Number(a[1] || 0)
  );

  const body = entries.length > 0
    ? entries
      .map(
        ([label, count]) =>
          '<div class="scope-item">' +
            '<div class="scope-item-top">' +
              '<div class="scope-item-name">' + deps.escHtml(label) + '</div>' +
              '<div class="scope-item-value">' + deps.formatCompactNumber(count) + '</div>' +
            '</div>' +
          '</div>'
      )
      .join('')
    : '<div class="config-help">' + deps.escHtml(emptyText) + '</div>';

  return (
    '<div class="card">' +
      '<div class="card-header"><span>' +
        deps.escHtml(title) +
        '</span><span style="color:var(--muted)">' +
        entries.length +
        '</span></div>' +
      '<div class="card-body">' +
        '<div class="scope-list">' + body + '</div>' +
      '</div>' +
    '</div>'
  );
}

export function renderDashboardMetricRowsSource(): string {
  return renderDashboardMetricRows.toString();
}
