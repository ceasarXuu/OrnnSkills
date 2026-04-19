export function renderDashboardStylesSource(): string {
  return /* css */ `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg0: #0d1117;
    --bg1: #161b22;
    --bg2: #21262d;
    --bg3: #30363d;
    --border: #30363d;
    --text: #c9d1d9;
    --muted: #8b949e;
    --green: #3fb950;
    --red: #f85149;
    --yellow: #d29922;
    --blue: #58a6ff;
    --purple: #bc8cff;
    --orange: #ffa657;
    --cyan: #39d353;
    --font: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  }
  html, body { height: 100%; background: var(--bg0); color: var(--text); font-family: var(--font); font-size: 13px; }

  /* ─── Layout ─────────────────────────────────────── */
  .app { display: grid; grid-template-rows: auto 1fr; height: 100vh; }
  .header {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
    align-items: center;
    gap: 20px;
    min-height: 56px;
    padding: 0 16px;
    background: var(--bg1);
    border-bottom: 1px solid var(--border);
    grid-row: 1;
  }
  .header-left { display: flex; align-items: center; gap: 12px; }
  .header-center {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 0;
  }
  .header-right { display: flex; align-items: center; justify-self: end; gap: 16px; }
  .header-logo { font-size: 15px; font-weight: 600; color: var(--blue); }
  .header-version { color: var(--muted); font-size: 11px; }
  .header-status { display: flex; align-items: center; gap: 6px; font-size: 11px; }
  .dot { width: 7px; height: 7px; border-radius: 50%; display: inline-block; }
  .dot-green { background: var(--green); box-shadow: 0 0 6px var(--green); }
  .dot-red { background: var(--red); }
  .dot-yellow { background: var(--yellow); animation: pulse 1.5s infinite; }
  .dot-gray { background: var(--muted); }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }

  .workspace-tabs { justify-content: center; display: flex; align-items: center; min-width: 0; }

  .main { display: grid; grid-template-columns: minmax(0, 1fr); height: 100%; overflow: hidden; grid-row: 2; }
  .main.project-nav-visible { grid-template-columns: 200px minmax(0, 1fr); }

  /* ─── Sidebar ─────────────────────────────────────── */
  .sidebar {
    background: var(--bg1); border-right: 1px solid var(--border);
    display: none; flex-direction: column; overflow: hidden;
  }
  .main.project-nav-visible .sidebar { display: flex; }
  .sidebar-title {
    padding: 10px 12px; font-size: 10px; letter-spacing: .08em;
    text-transform: uppercase; color: var(--muted); border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  .sidebar-list { flex: 1; overflow-y: auto; }
  .project-item {
    padding: 8px 12px; cursor: pointer; display: flex; flex-direction: column; gap: 3px;
    border-left: 2px solid transparent; transition: background .1s;
  }
  .project-item:hover { background: var(--bg2); }
  .project-item.active { background: var(--bg2); border-left-color: var(--blue); }
  .project-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .project-name { font-size: 12px; font-weight: 500; display: flex; align-items: center; gap: 6px; min-width: 0; flex: 1; }
  .project-name span:last-child { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .project-path { font-size: 10px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .project-meta { font-size: 10px; color: var(--muted); }
  .project-monitor-btn {
    font-family: var(--font); font-size: 10px; line-height: 1;
    padding: 4px 8px; border-radius: 999px;
    border: 1px solid rgba(88,166,255,.35); background: rgba(88,166,255,.08); color: var(--blue);
    cursor: pointer; transition: border-color .15s, color .15s, background .15s;
    flex-shrink: 0;
  }
  .project-monitor-btn:hover { border-color: var(--blue); background: rgba(88,166,255,.14); }
  .project-monitor-btn.resume {
    border-color: rgba(63,185,80,.35);
    background: rgba(63,185,80,.08);
    color: var(--green);
  }
  .project-monitor-btn.resume:hover { border-color: var(--green); background: rgba(63,185,80,.14); }
  .project-monitor-btn:disabled { opacity: .6; cursor: not-allowed; }
  .sidebar-add {
    padding: 8px 12px; border-top: 1px solid var(--border);
    display: flex; align-items: center; gap: 6px; cursor: pointer; color: var(--muted);
    font-size: 11px; transition: color .1s; flex-shrink: 0;
  }
  .sidebar-add:hover { color: var(--blue); }
  .add-form { display: none; padding: 8px 12px; border-top: 1px solid var(--border); flex-shrink: 0; }
  .add-form.visible { display: block; }
  .add-form input {
    width: 100%; background: var(--bg0); border: 1px solid var(--border); border-radius: 4px;
    color: var(--text); font-family: var(--font); font-size: 11px; padding: 4px 6px;
    outline: none;
  }
  .add-form input:focus { border-color: var(--blue); }
  .add-form-hint { font-size: 10px; color: var(--muted); margin-top: 4px; }

  /* ─── Main Panel ─────────────────────────────────── */
  .panel { overflow-y: auto; background: var(--bg0); }
  .panel-inner { padding: 16px; display: flex; flex-direction: column; gap: 14px; min-height: 100%; }
  .main-tabs { display: flex; gap: 24px; align-items: center; }
  .main-tab {
    position: relative;
    font-family: var(--font);
    font-size: 11px;
    padding: 12px 0;
    border: none;
    border-radius: 0;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    transition: color .15s, opacity .15s;
  }
  .main-tab::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    bottom: 3px;
    height: 2px;
    border-radius: 999px;
    background: transparent;
    transition: background .15s;
  }
  .main-tab:hover { color: var(--text); }
  .main-tab.active { color: var(--text); }
  .main-tab.active::after { background: var(--blue); }
  .page-shell { display: flex; flex-direction: column; gap: 14px; }
  .page-hero {
    display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap;
    padding: 14px 16px; border: 1px solid var(--border); border-radius: 8px;
    background:
      radial-gradient(circle at top right, rgba(88,166,255,.14), transparent 34%),
      linear-gradient(180deg, rgba(22,27,34,.96), rgba(13,17,23,.92));
  }
  .page-title { font-size: 22px; font-weight: 700; color: var(--text); }
  .page-meta {
    display: inline-flex; align-items: center; gap: 8px; padding: 6px 10px;
    border: 1px solid rgba(88,166,255,.25); border-radius: 999px;
    background: rgba(88,166,255,.08); color: var(--blue); font-size: 10px;
  }
  .sub-tabs { display: flex; gap: 8px; flex-wrap: wrap; }
  .sub-tab {
    font-family: var(--font); font-size: 11px; padding: 6px 12px; border-radius: 999px;
    border: 1px solid var(--border); background: var(--bg1); color: var(--muted);
    cursor: pointer; transition: all .15s;
  }
  .sub-tab:hover { border-color: var(--blue); color: var(--text); }
  .sub-tab.active {
    border-color: rgba(88,166,255,.38);
    background: rgba(88,166,255,.1);
    color: var(--blue);
  }
  .home-grid { display: grid; grid-template-columns: minmax(0, 1.7fr) minmax(280px, 1fr); gap: 14px; align-items: start; }
  .home-primary, .home-secondary { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
  .project-summary-list { display: flex; flex-direction: column; gap: 10px; }
  .project-summary-row {
    display: flex; justify-content: space-between; align-items: flex-start; gap: 14px;
    padding: 10px 0; border-bottom: 1px solid rgba(48,54,61,.7);
  }
  .project-summary-row:last-child { border-bottom: none; padding-bottom: 0; }
  .project-summary-main { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .project-summary-name { font-size: 12px; font-weight: 600; color: var(--text); }
  .project-summary-path {
    font-size: 10px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    max-width: 52ch;
  }
  .project-summary-meta { display: inline-flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 10px; color: var(--muted); }
  .project-summary-badge {
    display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 999px;
    border: 1px solid var(--border); background: rgba(88,166,255,.08); color: var(--blue); font-size: 10px;
  }
  .project-shell { display: flex; flex-direction: column; gap: 14px; }
  @media (max-width: 1180px) { .home-grid { grid-template-columns: 1fr; } }
  @media (max-width: 980px) {
    .header {
      grid-template-columns: 1fr;
      justify-items: center;
      gap: 12px;
      padding: 12px 16px;
    }
    .header-left, .header-right {
      justify-self: center;
      justify-content: center;
      flex-wrap: wrap;
    }
    .workspace-tabs {
      width: 100%;
      overflow-x: auto;
      scrollbar-width: none;
    }
    .workspace-tabs::-webkit-scrollbar { display: none; }
    .main-tabs {
      min-width: max-content;
      margin: 0 auto;
    }
  }

  .no-project {
    display: flex; align-items: center; justify-content: center;
    height: 100%; color: var(--muted); font-size: 13px;
  }
  .provider-alert {
    display: flex; align-items: flex-start; gap: 10px;
    padding: 10px 12px;
    border: 1px solid rgba(210,153,34,.45);
    border-left: 3px solid var(--yellow);
    border-radius: 6px;
    background: rgba(210,153,34,.12);
  }
  .provider-alert-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--yellow);
    box-shadow: 0 0 8px rgba(210,153,34,.8);
    margin-top: 2px;
    flex-shrink: 0;
  }
  .provider-alert-title { font-size: 12px; color: var(--yellow); font-weight: 600; }
  .provider-alert-message { font-size: 11px; color: var(--text); margin-top: 3px; }
  .provider-alert-hint { font-size: 10px; color: var(--muted); margin-top: 4px; }

  /* ─── Cards ──────────────────────────────────────── */
  .card { background: var(--bg1); border: 1px solid var(--border); border-radius: 6px; }
  .card-header {
    padding: 8px 12px; border-bottom: 1px solid var(--border);
    font-size: 10px; letter-spacing: .08em; text-transform: uppercase; color: var(--muted);
    display: flex; align-items: center; justify-content: space-between;
  }
  .card-body { padding: 12px; }

  /* Stats row */
  .stats-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px; }
  .stat-card {
    background: var(--bg1); border: 1px solid var(--border); border-radius: 6px;
    padding: 10px 12px; display: flex; flex-direction: column; gap: 4px;
  }
  .stat-label { font-size: 10px; color: var(--muted); }
  .stat-value { font-size: 20px; font-weight: 600; color: var(--text); }
  .stat-sub { font-size: 10px; color: var(--muted); }

  /* Daemon status */
  .daemon-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .daemon-row { display: flex; justify-content: space-between; align-items: center; padding: 4px 0; }
  .daemon-key { color: var(--muted); font-size: 11px; }
  .daemon-val { font-size: 11px; }

  .state-badge {
    display: inline-flex; align-items: center; gap: 5px; padding: 2px 7px;
    border-radius: 10px; font-size: 10px; font-weight: 500;
  }
  .state-idle { background: rgba(59,185,80,.15); color: var(--green); }
  .state-analyzing { background: rgba(88,166,255,.15); color: var(--blue); }
  .state-optimizing { background: rgba(210,153,34,.15); color: var(--yellow); }
  .state-error { background: rgba(248,81,73,.15); color: var(--red); }

  /* Skills */
  .skills-list { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
  @media (max-width: 1200px) { .skills-list { grid-template-columns: repeat(2, 1fr); } }
  @media (max-width: 800px) { .skills-list { grid-template-columns: 1fr; } }
  .skill-card {
    background: var(--bg2); border: 1px solid var(--border); border-radius: 5px;
    padding: 12px; cursor: pointer; transition: border-color .15s;
    display: flex; flex-direction: column; min-height: 100px;
  }
  .skill-card:hover { border-color: var(--blue); }
  .skill-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
  .skill-name { font-size: 12px; font-weight: 500; color: var(--text); display: flex; align-items: center; gap: 6px; flex: 1; min-width: 0; }
  .skill-name span:last-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .skill-actions { display: flex; gap: 6px; flex-shrink: 0; }
  .btn-sm {
    font-family: var(--font); font-size: 10px; padding: 2px 7px; border-radius: 4px;
    border: 1px solid var(--border); background: var(--bg3); color: var(--text);
    cursor: pointer; transition: border-color .1s, color .1s;
  }
  .btn-sm:hover { border-color: var(--blue); color: var(--blue); }
  .skill-meta { font-size: 10px; color: var(--muted); display: flex; gap: 12px; flex-wrap: wrap; margin-top: auto; }
  .skill-meta span { display: flex; align-items: center; gap: 3px; }
  .skill-runtime-list { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 10px; }
  .skill-runtime-pill {
    display: inline-flex; align-items: center; padding: 2px 8px;
    border-radius: 999px; border: 1px solid var(--border);
    font-size: 9px; color: var(--muted); background: rgba(139,148,158,.08);
  }
  .skill-runtime-pill.active {
    border-color: rgba(88,166,255,.45);
    color: var(--blue);
    background: rgba(88,166,255,.12);
  }
  .highlight { background: rgba(88,166,255,.3); padding: 0 2px; border-radius: 2px; }

  /* Search and Sort Controls */
  .skills-controls { display: flex; gap: 12px; margin-bottom: 12px; align-items: center; flex-wrap: wrap; }
  .search-box { flex: 1; min-width: 200px; position: relative; }
  .search-input {
    width: 100%; background: var(--bg0); border: 1px solid var(--border); border-radius: 4px;
    color: var(--text); font-family: var(--font); font-size: 11px; padding: 6px 10px 6px 28px;
    outline: none;
  }
  .search-input:focus { border-color: var(--blue); }
  .search-icon { position: absolute; left: 8px; top: 50%; transform: translateY(-50%); color: var(--muted); font-size: 12px; pointer-events: none; }
  .sort-controls { display: flex; gap: 6px; align-items: center; }
  .sort-label { font-size: 10px; color: var(--muted); }
  .sort-btn {
    font-family: var(--font); font-size: 10px; padding: 4px 10px; border-radius: 4px;
    border: 1px solid var(--border); background: var(--bg2); color: var(--muted);
    cursor: pointer; transition: all .15s; display: flex; align-items: center; gap: 4px;
  }
  .sort-btn:hover { border-color: var(--blue); color: var(--text); }
  .sort-btn.active { background: var(--blue); color: #fff; border-color: var(--blue); }
  .sort-btn .arrow { font-size: 8px; }

  .status-badge {
    font-size: 9px; padding: 1px 5px; border-radius: 8px; font-weight: 500;
  }
  .status-active { background: rgba(59,185,80,.15); color: var(--green); }
  .status-pending { background: rgba(139,148,158,.15); color: var(--muted); }
  .status-analyzing { background: rgba(88,166,255,.15); color: var(--blue); }
  .status-optimized { background: rgba(188,140,255,.15); color: var(--purple); }
  .status-frozen { background: rgba(255,166,87,.15); color: var(--orange); }
  .status-deployed { background: rgba(57,211,83,.2); color: var(--cyan); }
  .status-discarded { background: rgba(248,81,73,.1); color: var(--red); }

  /* Trace stats bar */
  .bar-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
  .bar-label { width: 70px; font-size: 10px; color: var(--muted); flex-shrink: 0; }
  .bar-track { flex: 1; height: 8px; background: var(--bg2); border-radius: 4px; overflow: hidden; }
  .bar-fill { height: 100%; border-radius: 4px; transition: width .3s; }
  .bar-codex { background: var(--blue); }
  .bar-claude { background: var(--purple); }
  .bar-opencode { background: var(--orange); }
  .bar-success { background: var(--green); }
  .bar-failure { background: var(--red); }
  .bar-retry { background: var(--yellow); }
  .bar-count { font-size: 10px; color: var(--muted); width: 28px; text-align: right; flex-shrink: 0; }

  /* Recent traces */
  .trace-table { width: 100%; border-collapse: collapse; }
  .trace-table th { font-size: 9px; text-transform: uppercase; color: var(--muted); text-align: left; padding: 4px 6px; border-bottom: 1px solid var(--border); }
  .trace-table td { font-size: 10px; padding: 3px 6px; border-bottom: 1px solid rgba(48,54,61,.5); }
  .trace-table tr:last-child td { border-bottom: none; }
  .badge { display: inline-flex; align-items: center; gap: 3px; }
  .trace-table-wrap { max-height: 520px; overflow: auto; border: 1px solid var(--border); border-radius: 6px; }
  .activity-controls { display: flex; gap: 8px; align-items: center; justify-content: space-between; flex-wrap: wrap; margin-bottom: 10px; }
  .activity-left { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
  .activity-tab {
    font-family: var(--font); font-size: 10px; padding: 3px 10px; border-radius: 4px;
    border: 1px solid var(--border); background: var(--bg2); color: var(--muted);
    cursor: pointer; transition: all .15s;
  }
  .activity-tab.active { background: var(--blue); color: #fff; border-color: var(--blue); }
  .tag-chip {
    font-family: var(--font); font-size: 10px; padding: 2px 8px; border-radius: 999px;
    border: 1px solid var(--border); background: var(--bg0); color: var(--muted);
    cursor: pointer;
  }
  .tag-chip.active { color: #fff; border-color: var(--blue); background: var(--blue); }
  .activity-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  .activity-table th {
    position: relative;
    font-size: 9px;
    text-transform: uppercase;
    color: var(--muted);
    text-align: left;
    padding: 4px 18px 4px 6px;
    border-bottom: 1px solid var(--border);
    user-select: none;
    white-space: nowrap;
  }
  .activity-table td {
    font-size: 10px;
    padding: 6px;
    border-bottom: 1px solid rgba(48,54,61,.5);
    vertical-align: top;
    word-break: break-word;
  }
  .activity-table tr:last-child td { border-bottom: none; }
  .activity-scope-row { cursor: pointer; }
  .activity-scope-row:hover td { background: rgba(88,166,255,.06); }
  .column-resizer {
    position: absolute;
    top: 0;
    right: 0;
    width: 8px;
    height: 100%;
    cursor: col-resize;
  }
  .column-resizer::after {
    content: '';
    position: absolute;
    top: 20%;
    bottom: 20%;
    left: 3px;
    width: 1px;
    background: rgba(139,148,158,.45);
  }
  .business-detail-preview {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
    line-height: 1.55;
  }
  .business-detail-actions {
    display: flex;
    gap: 8px;
    margin-top: 6px;
    align-items: center;
    flex-wrap: wrap;
  }
  .activity-skill-link {
    border: none;
    background: transparent;
    color: var(--blue);
    cursor: pointer;
    font-family: var(--font);
    font-size: 10px;
    padding: 0;
    text-align: left;
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .activity-skill-link:hover { color: #7bb7ff; }
  .detail-copy-btn, .detail-view-btn {
    border: none;
    background: transparent;
    color: var(--blue);
    cursor: pointer;
    font-family: var(--font);
    font-size: 10px;
    padding: 0;
  }
  .detail-copy-btn:hover, .detail-view-btn:hover { text-decoration: underline; }
  .activity-scope-status {
    display: inline-flex;
    align-items: center;
    padding: 2px 8px;
    border-radius: 999px;
    font-size: 10px;
    line-height: 1.4;
    border: 1px solid transparent;
    white-space: nowrap;
  }
  .activity-scope-status-observing {
    color: #7bb7ff;
    background: rgba(88,166,255,.14);
    border-color: rgba(88,166,255,.25);
  }
  .activity-scope-status-optimized {
    color: var(--green);
    background: rgba(57,211,83,.12);
    border-color: rgba(57,211,83,.22);
  }
  .activity-scope-status-no_optimization {
    color: #d2a8ff;
    background: rgba(188,140,255,.12);
    border-color: rgba(188,140,255,.22);
  }
  .activity-scope-detail {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .activity-scope-summary {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 10px;
    padding: 12px;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: rgba(17,24,39,.55);
  }
  .activity-scope-summary-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .activity-scope-summary-label {
    font-size: 10px;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: .04em;
  }
  .activity-scope-summary-value {
    font-size: 12px;
    color: var(--text);
    line-height: 1.5;
    word-break: break-word;
  }
  .activity-scope-timeline {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .activity-scope-node {
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 12px;
    background: rgba(13,17,23,.88);
  }
  .activity-scope-node-head {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: flex-start;
    margin-bottom: 8px;
  }
  .activity-scope-node-title {
    font-size: 12px;
    color: var(--text);
    font-weight: 600;
  }
  .activity-scope-node-time {
    font-size: 10px;
    color: var(--muted);
    white-space: nowrap;
  }
  .activity-scope-node-summary {
    font-size: 11px;
    color: var(--text);
    line-height: 1.65;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .activity-scope-metrics {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 10px;
  }
  .activity-scope-metric {
    display: inline-flex;
    gap: 6px;
    align-items: center;
    padding: 4px 8px;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: rgba(17,24,39,.6);
    font-size: 10px;
  }
  .activity-scope-metric-label { color: var(--muted); }
  .activity-scope-metric-value { color: var(--text); }
  .activity-scope-traces {
    margin-top: 10px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: rgba(17,24,39,.45);
  }
  .activity-scope-traces summary {
    cursor: pointer;
    padding: 10px 12px;
    color: var(--blue);
    font-size: 11px;
    user-select: none;
  }
  .activity-scope-traces pre,
  .activity-detail-text {
    margin: 0;
    padding: 0 12px 12px;
    font-family: var(--font);
    font-size: 11px;
    line-height: 1.65;
    color: var(--text);
    white-space: pre-wrap;
    word-break: break-word;
  }
  .activity-scope-traces pre {
    display: block;
    max-height: 320px;
    overflow: auto;
    overscroll-behavior: contain;
  }
  .activity-detail-text { padding: 0; }
  .activity-node-cell {
    display: flex;
    flex-direction: column;
    gap: 2px;
    line-height: 1.45;
  }
  .activity-node-title { color: var(--text); }
  .activity-node-status { color: var(--muted); }

  /* Cost tab */
  .cost-shell { display: flex; flex-direction: column; gap: 14px; }
  .cost-hero {
    display: grid;
    grid-template-columns: minmax(280px, 1.05fr) minmax(0, 1.95fr);
    gap: 12px;
    align-items: stretch;
  }
  .cost-hero-main {
    position: relative;
    overflow: hidden;
    border: 1px solid rgba(88,166,255,.2);
    border-radius: 12px;
    padding: 16px;
    background:
      radial-gradient(circle at top left, rgba(57,211,83,.18), transparent 42%),
      radial-gradient(circle at bottom right, rgba(88,166,255,.16), transparent 46%),
      linear-gradient(145deg, rgba(20,31,37,.98), rgba(16,23,32,.96));
    box-shadow: inset 0 1px 0 rgba(255,255,255,.04);
  }
  .cost-hero-main::after {
    content: '';
    position: absolute;
    inset: auto -40px -40px auto;
    width: 140px;
    height: 140px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(88,166,255,.15), transparent 68%);
    pointer-events: none;
  }
  .cost-eyebrow {
    font-size: 10px;
    letter-spacing: .14em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .cost-hero-value {
    margin-top: 10px;
    font-size: 34px;
    line-height: 1;
    font-weight: 700;
    color: var(--green);
    letter-spacing: -.03em;
  }
  .cost-hero-copy {
    margin-top: 10px;
    max-width: 100%;
    font-size: 11px;
    line-height: 1.6;
    color: var(--text);
  }
  .cost-summary-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
  }
  @media (max-width: 1180px) {
    .cost-hero { grid-template-columns: 1fr; }
    .cost-summary-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
  @media (max-width: 720px) {
    .cost-summary-grid { grid-template-columns: 1fr; }
  }
  .cost-summary-card {
    min-height: 92px;
    padding: 12px 14px;
    border-radius: 10px;
    border: 1px solid rgba(48,54,61,.88);
    background: linear-gradient(180deg, rgba(23,28,37,.96), rgba(19,23,31,.96));
    box-shadow: inset 0 1px 0 rgba(255,255,255,.03);
  }
  .cost-summary-label { font-size: 10px; color: var(--muted); letter-spacing: .06em; text-transform: uppercase; }
  .cost-summary-value { margin-top: 8px; font-size: 18px; font-weight: 650; color: var(--text); letter-spacing: -.02em; }
  .cost-summary-sub { margin-top: 5px; font-size: 10px; color: var(--muted); line-height: 1.5; }
  .cost-board {
    display: grid;
    grid-template-columns: minmax(0, 1.55fr) minmax(300px, .82fr);
    gap: 12px;
    align-items: start;
  }
  @media (max-width: 1080px) { .cost-board { grid-template-columns: 1fr; } }
  .cost-main, .cost-rail { display: flex; flex-direction: column; gap: 12px; }
  .cost-model-card {
    border-radius: 12px;
    overflow: hidden;
  }
  .cost-model-summary {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
    margin-bottom: 12px;
  }
  @media (max-width: 820px) { .cost-model-summary { grid-template-columns: 1fr; } }
  .cost-model-stat {
    padding: 10px 12px;
    border: 1px solid rgba(48,54,61,.78);
    border-radius: 8px;
    background: rgba(13,17,23,.52);
  }
  .cost-model-stat-label { font-size: 9px; color: var(--muted); letter-spacing: .08em; text-transform: uppercase; }
  .cost-model-stat-value { margin-top: 6px; font-size: 16px; font-weight: 650; color: var(--text); }
  .cost-model-stat-sub { margin-top: 4px; font-size: 10px; color: var(--muted); }
  .cost-rail .card { border-radius: 10px; }

  .cost-stats-row { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; }
  @media (max-width: 1100px) { .cost-stats-row { grid-template-columns: repeat(2, 1fr); } }
  @media (max-width: 720px) { .cost-stats-row { grid-template-columns: 1fr; } }
  .stat-value.cost-accent { color: var(--green); }
  .cost-layout {
    display: grid;
    grid-template-columns: minmax(0, 1.7fr) minmax(280px, .9fr);
    gap: 12px;
  }
  @media (max-width: 1080px) { .cost-layout { grid-template-columns: 1fr; } }
  .cost-stack { display: flex; flex-direction: column; gap: 12px; }
  .cost-spotlight {
    background: linear-gradient(135deg, rgba(57,211,83,.12), rgba(88,166,255,.08));
    border: 1px solid rgba(57,211,83,.25);
    border-radius: 6px;
    padding: 12px;
  }
  .cost-spotlight-title { font-size: 10px; color: var(--muted); text-transform: uppercase; letter-spacing: .08em; }
  .cost-spotlight-value { font-size: 28px; color: var(--green); font-weight: 700; margin-top: 8px; }
  .cost-spotlight-sub { font-size: 11px; color: var(--muted); margin-top: 6px; line-height: 1.5; }
  .scope-list { display: flex; flex-direction: column; gap: 8px; margin-top: 12px; }
  .scope-item {
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg2);
    padding: 8px;
  }
  .scope-item-top { display: flex; justify-content: space-between; gap: 8px; }
  .scope-item-name { color: var(--text); font-size: 11px; }
  .scope-item-value { color: var(--muted); font-size: 10px; }
  .scope-item-sub { color: var(--muted); font-size: 10px; margin-top: 4px; }
  .cost-primary { font-size: 12px; color: var(--text); font-weight: 600; }
  .cost-secondary { font-size: 10px; color: var(--muted); margin-top: 3px; }
  .cost-note { font-size: 10px; color: var(--muted); line-height: 1.5; }
  .cost-note strong { color: var(--text); font-weight: 600; }
  .cost-chip-row { display: flex; flex-wrap: wrap; gap: 6px; }
  .cost-chip {
    display: inline-flex;
    align-items: center;
    padding: 2px 8px;
    border-radius: 999px;
    background: rgba(88,166,255,.08);
    border: 1px solid rgba(88,166,255,.18);
    color: var(--text);
    font-size: 9px;
  }
  .cost-table-wrap { border: 1px solid var(--border); border-radius: 6px; overflow: auto; }
  .cost-table { width: 100%; border-collapse: collapse; }
  .cost-table th, .cost-table td {
    font-size: 10px;
    padding: 10px 12px;
    border-bottom: 1px solid rgba(48,54,61,.5);
    vertical-align: top;
    text-align: left;
  }
  .cost-table th {
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: .06em;
    white-space: nowrap;
    background: rgba(13,17,23,.75);
  }
  .cost-table tbody tr:hover { background: rgba(88,166,255,.04); }
  .cost-table tr:last-child td { border-bottom: none; }
  .capability-pills { display: flex; flex-wrap: wrap; gap: 6px; }
  .capability-pill {
    display: inline-flex;
    align-items: center;
    padding: 2px 8px;
    border-radius: 999px;
    background: rgba(88,166,255,.12);
    border: 1px solid rgba(88,166,255,.2);
    color: var(--blue);
    font-size: 9px;
    white-space: nowrap;
  }
  .mono-compact { font-size: 10px; color: var(--muted); }

  /* ─── Skill Detail Modal ─────────────────────────── */
  .modal-overlay {
    display: none; position: fixed; inset: 0; background: rgba(0,0,0,.7);
    z-index: 100; align-items: center; justify-content: center;
  }
  .modal-overlay.visible { display: flex; }
  .modal {
    background: var(--bg1); border: 1px solid var(--border); border-radius: 8px;
    width: 90vw; max-width: 1100px; height: 80vh; display: flex; flex-direction: column;
    overflow: hidden;
  }
  .modal-header {
    padding: 12px 16px; border-bottom: 1px solid var(--border);
    display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;
  }
  .modal-title { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 500; }
  .modal-header-actions { display: flex; align-items: center; gap: 10px; }
  .modal-runtime-select {
    display: inline-flex; align-items: center; gap: 6px;
    font-size: 10px; color: var(--muted);
  }
  .modal-runtime-select select {
    min-width: 120px;
    font-family: var(--font);
    font-size: 11px;
    padding: 4px 8px;
    border-radius: 4px;
    border: 1px solid var(--border);
    background: var(--bg0);
    color: var(--text);
    outline: none;
  }
  .modal-runtime-select select:focus { border-color: var(--blue); }
  .modal-runtime-select select:disabled { opacity: .7; cursor: not-allowed; }
  .modal-close {
    font-family: var(--font); font-size: 12px; padding: 3px 10px; border-radius: 4px;
    border: 1px solid var(--border); background: none; color: var(--muted);
    cursor: pointer; transition: color .1s;
  }
  .modal-close:hover { color: var(--red); border-color: var(--red); }
  .modal-body { display: grid; grid-template-columns: 1fr 240px; flex: 1; overflow: hidden; }
  .modal-content {
    padding: 12px; border-right: 1px solid var(--border);
    display: flex; flex-direction: column; gap: 10px; min-height: 0;
  }
  .modal-content pre {
    font-family: var(--font); font-size: 12px; line-height: 1.6; color: var(--text);
    white-space: pre-wrap; word-break: break-word;
  }
  .modal-editor {
    width: 100%; flex: 1; min-height: 0;
    font-family: var(--font); font-size: 12px; line-height: 1.6;
    border: 1px solid var(--border); border-radius: 6px;
    background: var(--bg0); color: var(--text); padding: 10px;
    resize: none; outline: none;
  }
  .modal-editor:focus { border-color: var(--blue); }
  .modal-actions { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-shrink: 0; }
  .modal-action-group { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
  .modal-save-hint { font-size: 10px; color: var(--muted); }
  .btn-primary {
    font-family: var(--font); font-size: 11px; padding: 5px 12px; border-radius: 4px;
    border: 1px solid var(--blue); background: var(--blue); color: #fff;
    cursor: pointer; transition: opacity .1s;
  }
  .btn-primary:disabled { opacity: .6; cursor: not-allowed; }
  .confirm-copy { display: flex; flex-direction: column; gap: 8px; font-size: 11px; line-height: 1.6; color: var(--text); }
  .confirm-copy strong { color: var(--text); font-weight: 600; }
  .confirm-copy p { margin: 0; }
  .confirm-copy-note {
    font-size: 10px;
    color: var(--muted);
    border: 1px solid rgba(88,166,255,.24);
    background: rgba(88,166,255,.08);
    border-radius: 6px;
    padding: 8px 10px;
  }
  #applyAllSkillModal .modal {
    width: min(640px, calc(100vw - 32px));
    height: auto;
    max-height: calc(100vh - 48px);
  }
  #applyAllSkillModal .modal-body {
    grid-template-columns: 1fr;
  }
  #applyAllSkillModal .modal-content {
    border-right: none;
  }
  .modal-history { padding: 12px; overflow-y: auto; }
  .modal-history h4 { font-size: 10px; text-transform: uppercase; color: var(--muted); margin-bottom: 10px; letter-spacing: .06em; }
  .version-item {
    padding: 8px; border-radius: 4px; margin-bottom: 6px; cursor: pointer;
    border: 1px solid var(--border); transition: border-color .1s;
  }
  .version-item:hover { border-color: var(--blue); }
  .version-item.current { border-color: var(--green); }
  .version-item.invalid { opacity: .72; }
  .version-num { font-size: 11px; font-weight: 500; }
  .version-meta { font-size: 10px; color: var(--muted); margin-top: 3px; }
  .version-change { display: inline-block; font-size: 9px; padding: 1px 5px; border-radius: 8px; margin-top: 3px; background: rgba(88,166,255,.1); color: var(--blue); }
  .version-scope-link { border: 0; cursor: pointer; font-family: inherit; line-height: 1.35; }
  .version-scope-link:hover { background: rgba(88,166,255,.16); color: #79c0ff; }
  .version-flags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 5px; }
  .version-flag {
    display: inline-flex; align-items: center; font-size: 9px; line-height: 1;
    padding: 2px 6px; border-radius: 999px; border: 1px solid var(--border); color: var(--muted);
  }
  .version-flag.effective { border-color: rgba(63,185,80,.55); color: var(--green); background: rgba(63,185,80,.12); }
  .version-flag.invalid { border-color: rgba(248,81,73,.5); color: var(--red); background: rgba(248,81,73,.12); }
  .version-actions { display: flex; justify-content: flex-end; margin-top: 8px; }
  .version-actions .btn-secondary { font-size: 10px; padding: 3px 8px; }
  #eventModal .modal {
    height: auto;
    max-height: calc(100vh - 48px);
  }
  #eventModal .modal-body {
    grid-template-columns: 1fr;
    min-height: 0;
    overflow: hidden;
  }
  #eventModal .modal-content {
    border-right: none;
    min-height: 0;
    overflow-y: auto;
  }
  #eventModalContent {
    min-height: 0;
  }

  /* ─── Logs Card ───────────────────────────────────── */
  .log-panel {
    background: var(--bg1); border: 1px solid var(--border); border-radius: 6px;
    display: flex; flex-direction: column; overflow: hidden; min-height: 520px;
  }
  .log-header {
    padding: 8px 12px; border-bottom: 1px solid var(--border); flex-shrink: 0;
    display: flex; align-items: center; justify-content: space-between;
  }
  .log-title { font-size: 10px; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
  .log-filter {
    font-family: var(--font); font-size: 10px; padding: 2px 6px; border-radius: 4px;
    border: 1px solid var(--border); background: var(--bg0); color: var(--text);
    outline: none; cursor: pointer;
  }
  .log-list { flex: 1; overflow-y: auto; padding: 8px 0; max-height: 560px; }
  .log-entry { padding: 2px 10px; display: flex; gap: 6px; font-size: 10px; line-height: 1.5; }
  .log-entry:hover { background: var(--bg2); }
  .log-ts { color: var(--muted); flex-shrink: 0; white-space: nowrap; }
  .log-level { flex-shrink: 0; width: 36px; font-weight: 500; }
  .log-ctx { color: var(--blue); flex-shrink: 0; max-width: 80px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .log-msg { color: var(--text); word-break: break-word; }
  .level-INFO { color: var(--muted); }
  .level-DEBUG { color: var(--muted); opacity:.6; }
  .level-WARN { color: var(--yellow); }
  .level-ERROR { color: var(--red); }

  /* Language Switcher */
  .lang-switcher {
    display: flex; align-items: center; gap: 4px;
  }
  .lang-btn {
    font-family: var(--font); font-size: 10px; padding: 2px 8px; border-radius: 4px;
    border: 1px solid var(--border); background: var(--bg2); color: var(--muted);
    cursor: pointer; transition: all .15s;
  }
  .lang-btn:hover { border-color: var(--blue); color: var(--text); }
  .lang-btn.active { background: var(--blue); color: #fff; border-color: var(--blue); }

  /* scrollbar */
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--bg3); border-radius: 3px; }
  ::-webkit-scrollbar-thumb:hover { background: var(--muted); }

  .empty-state { padding: 24px; text-align: center; color: var(--muted); font-size: 12px; }

  /* Runtime Tabs */
  .runtime-tabs { display: flex; gap: 4px; }
  .runtime-tab {
    font-family: var(--font); font-size: 10px; padding: 3px 10px; border-radius: 4px;
    border: 1px solid var(--border); background: var(--bg2); color: var(--muted);
    cursor: pointer; transition: all .15s;
  }
  .runtime-tab:hover { border-color: var(--blue); color: var(--text); }
  .runtime-tab.active { background: var(--blue); color: #fff; border-color: var(--blue); }
  .runtime-tab.tab-codex.active { background: var(--blue); border-color: var(--blue); }
  .runtime-tab.tab-claude.active { background: var(--purple); border-color: var(--purple); }
  .runtime-tab.tab-opencode.active { background: var(--orange); border-color: var(--orange); }

  /* Config */
  .config-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  @media (max-width: 900px) { .config-grid { grid-template-columns: 1fr; } }
  .config-field { display: flex; flex-direction: column; gap: 6px; }
  .config-label { font-size: 11px; color: var(--muted); }
  .config-help { font-size: 11px; color: var(--muted); line-height: 1.45; }
  .config-help code { color: var(--text); background: var(--bg3); padding: 1px 5px; border-radius: 4px; }
  .config-example {
    margin-top: 6px; background: var(--bg0); border: 1px dashed var(--border); border-radius: 6px;
    padding: 8px; white-space: pre-wrap; word-break: break-all;
    font-family: var(--font); font-size: 10px; color: var(--muted);
  }
  .config-connectivity {
    margin-top: 10px; border: 1px solid var(--border); border-radius: 6px;
    background: var(--bg0); padding: 8px; font-size: 11px;
  }
  .config-connectivity-title { color: var(--muted); margin-bottom: 6px; }
  .config-connectivity-item { padding: 4px 0; border-top: 1px dashed rgba(240,246,252,.08); }
  .config-connectivity-item:first-of-type { border-top: none; }
  .conn-ok { color: var(--green); }
  .conn-fail { color: var(--red); }
  .config-input, .config-select, .config-textarea {
    width: 100%; background: var(--bg0); border: 1px solid var(--border); border-radius: 6px;
    color: var(--text); font-family: var(--font); font-size: 11px; padding: 8px;
    outline: none;
  }
  .config-input:focus, .config-select:focus, .config-textarea:focus { border-color: var(--blue); }
  .config-textarea { min-height: 220px; resize: vertical; }
  .config-prompt-editor { display: flex; flex-direction: column; gap: 8px; }
  .config-prompt-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    align-items: start;
  }
  @media (max-width: 900px) {
    .config-prompt-grid {
      grid-template-columns: 1fr;
    }
  }
  .config-prompt-column {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
  }
  .config-prompt-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .config-prompt-preview {
    padding: 10px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg0);
    color: var(--text);
    font-family: var(--font);
    font-size: 10px;
    line-height: 1.45;
    white-space: pre-wrap;
    word-break: break-word;
    max-height: 240px;
    min-height: 220px;
    overflow: auto;
  }
  .config-check { display: flex; align-items: center; gap: 8px; font-size: 11px; }
  .config-actions { margin-top: 12px; display: flex; align-items: center; justify-content: flex-start; }
  .providers-editor { display: flex; flex-direction: column; gap: 8px; }
  .provider-row {
    display: grid;
    grid-template-columns: minmax(140px,1fr) minmax(160px,1fr) minmax(220px,1.8fr) minmax(260px,auto);
    gap: 8px;
    align-items: start;
    background: var(--bg0);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 8px;
  }
  @media (max-width: 1100px) {
    .provider-row {
      grid-template-columns: 1fr;
    }
  }
  .provider-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    justify-content: flex-start;
    flex-wrap: nowrap;
    min-height: 36px;
  }
  .provider-actions .config-check {
    margin: 0;
    white-space: nowrap;
  }
  .config-secret-field {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .config-secret-field .cfg_api_key {
    flex: 1 1 auto;
    min-width: 0;
  }
  .config-secret-toggle {
    flex: 0 0 auto;
    white-space: nowrap;
  }
  .btn-danger {
    font-family: var(--font); font-size: 10px; padding: 4px 8px; border-radius: 4px;
    border: 1px solid rgba(248,81,73,.6); background: rgba(248,81,73,.1); color: var(--red);
    cursor: pointer;
  }
  .btn-secondary {
    font-family: var(--font); font-size: 10px; padding: 4px 8px; border-radius: 4px;
    border: 1px solid var(--border); background: var(--bg2); color: var(--text);
    cursor: pointer;
  }
`;
}
