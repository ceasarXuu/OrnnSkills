/**
 * Dashboard UI
 *
 * 返回完整的单页 HTML Dashboard，内嵌 CSS + JS，无外部依赖。
 * 深色主题，双栏布局：项目列表 / 主面板（含子 Tab）。
 * 支持多语言切换（中英文）。
 */

import { getI18n, type Language } from './i18n.js';

export function getDashboardHtml(_port: number, lang: Language = 'en', buildId = 'dev'): string {
  const t = getI18n(lang);
  const shortBuildId = buildId.slice(-8);

  return /* html */ `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>OrnnSkills Dashboard</title>
<style>
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
  .app { display: grid; grid-template-rows: 44px 1fr; height: 100vh; }
  .header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 0 16px; background: var(--bg1); border-bottom: 1px solid var(--border);
    grid-row: 1;
  }
  .header-left { display: flex; align-items: center; gap: 12px; }
  .header-logo { font-size: 15px; font-weight: 600; color: var(--blue); }
  .header-version { color: var(--muted); font-size: 11px; }
  .header-status { display: flex; align-items: center; gap: 6px; font-size: 11px; }
  .dot { width: 7px; height: 7px; border-radius: 50%; display: inline-block; }
  .dot-green { background: var(--green); box-shadow: 0 0 6px var(--green); }
  .dot-red { background: var(--red); }
  .dot-yellow { background: var(--yellow); animation: pulse 1.5s infinite; }
  .dot-gray { background: var(--muted); }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }

  .main { display: grid; grid-template-columns: 200px 1fr; height: 100%; overflow: hidden; grid-row: 2; }

  /* ─── Sidebar ─────────────────────────────────────── */
  .sidebar {
    background: var(--bg1); border-right: 1px solid var(--border);
    display: flex; flex-direction: column; overflow: hidden;
  }
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
  .project-name { font-size: 12px; font-weight: 500; display: flex; align-items: center; gap: 6px; }
  .project-path { font-size: 10px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .project-meta { font-size: 10px; color: var(--muted); }
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
  .main-tabs { display: flex; gap: 8px; }
  .main-tab {
    font-family: var(--font); font-size: 11px; padding: 6px 12px; border-radius: 6px;
    border: 1px solid var(--border); background: var(--bg1); color: var(--muted);
    cursor: pointer; transition: all .15s;
  }
  .main-tab:hover { border-color: var(--blue); color: var(--text); }
  .main-tab.active { background: var(--blue); color: #fff; border-color: var(--blue); }

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
  .stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
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
  .modal-actions { display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; }
  .modal-save-hint { font-size: 10px; color: var(--muted); }
  .btn-primary {
    font-family: var(--font); font-size: 11px; padding: 5px 12px; border-radius: 4px;
    border: 1px solid var(--blue); background: var(--blue); color: #fff;
    cursor: pointer; transition: opacity .1s;
  }
  .btn-primary:disabled { opacity: .6; cursor: not-allowed; }
  .modal-history { padding: 12px; overflow-y: auto; }
  .modal-history h4 { font-size: 10px; text-transform: uppercase; color: var(--muted); margin-bottom: 10px; letter-spacing: .06em; }
  .version-item {
    padding: 8px; border-radius: 4px; margin-bottom: 6px; cursor: pointer;
    border: 1px solid var(--border); transition: border-color .1s;
  }
  .version-item:hover { border-color: var(--blue); }
  .version-item.current { border-color: var(--green); }
  .version-num { font-size: 11px; font-weight: 500; }
  .version-meta { font-size: 10px; color: var(--muted); margin-top: 3px; }
  .version-change { display: inline-block; font-size: 9px; padding: 1px 5px; border-radius: 8px; margin-top: 3px; background: rgba(88,166,255,.1); color: var(--blue); }

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
  .config-intro, .config-help { font-size: 11px; color: var(--muted); line-height: 1.45; }
  .config-intro { margin-bottom: 12px; }
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
  .config-check { display: flex; align-items: center; gap: 8px; font-size: 11px; }
  .config-actions { margin-top: 12px; display: flex; align-items: center; justify-content: space-between; }
  .providers-editor { display: flex; flex-direction: column; gap: 8px; }
  .provider-row {
    display: grid;
    grid-template-columns: minmax(140px,1fr) minmax(160px,1fr) minmax(220px,1.8fr) minmax(180px,1.2fr) auto;
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
</style>
</head>
<body>
<div class="app">

  <!-- Header -->
  <header class="header">
    <div class="header-left">
      <span class="header-logo">🔧 OrnnSkills</span>
      <span class="header-version" id="appVersion">${t.headerVersion}</span>
      <span class="header-version" id="appBuild">build #${shortBuildId}</span>
    </div>
    <div style="display:flex;align-items:center;gap:16px;">
      <div class="lang-switcher">
        <button class="lang-btn ${lang === 'en' ? 'active' : ''}" onclick="switchLang('en')">EN</button>
        <button class="lang-btn ${lang === 'zh' ? 'active' : ''}" onclick="switchLang('zh')">中文</button>
      </div>
      <div class="header-status" id="headerStatus">
        <span class="dot dot-gray"></span>
        <span>${t.headerConnecting}</span>
      </div>
    </div>
  </header>

  <div class="main">
    <!-- Sidebar: Project List -->
    <aside class="sidebar">
      <div class="sidebar-title">${t.sidebarProjects}</div>
      <div class="sidebar-list" id="projectList"></div>
      <div class="sidebar-add" onclick="toggleAddForm()">
        <span>＋</span><span>${t.sidebarAddProject}</span>
      </div>
      <div class="add-form" id="addForm">
        <input type="text" id="addPathInput" placeholder="${t.sidebarAddPlaceholder}" />
        <div class="add-form-hint">${t.sidebarAddHint}</div>
      </div>
    </aside>

    <!-- Main Panel -->
    <main class="panel" id="mainPanel">
      <div class="no-project">${t.mainSelectProject}</div>
    </main>
  </div>
</div>

<!-- Skill Detail Modal -->
<div class="modal-overlay" id="skillModal">
  <div class="modal">
    <div class="modal-header">
      <div class="modal-title">
        <span id="modalSkillName"></span>
        <span id="modalSkillStatus"></span>
      </div>
      <button class="modal-close" onclick="closeModal()">✕ ${t.modalClose}</button>
    </div>
    <div class="modal-body">
      <div class="modal-content">
        <textarea id="modalContent" class="modal-editor" spellcheck="false">${t.modalLoading}</textarea>
        <div class="modal-actions">
          <span id="modalSaveHint" class="modal-save-hint"></span>
          <button id="modalSaveBtn" class="btn-primary" onclick="saveCurrentSkill()">${lang === 'zh' ? '保存' : 'Save'}</button>
        </div>
      </div>
      <div class="modal-history">
        <h4>${t.modalVersionHistory}</h4>
        <div id="versionList"></div>
      </div>
    </div>
  </div>
</div>

<script>
// ─── i18n ─────────────────────────────────────────────────────────────────────
const I18N = ${JSON.stringify({ en: getI18n('en'), zh: getI18n('zh') })};
let currentLang = '${lang}';
const DASHBOARD_BUILD_ID = '${buildId}';
const DASHBOARD_BUILD_SHORT = DASHBOARD_BUILD_ID.slice(-8);

function t(key) {
  return (I18N[currentLang] && I18N[currentLang][key]) || (I18N.en && I18N.en[key]) || key;
}

function detectBrowserLang() {
  const candidates = Array.isArray(navigator.languages) && navigator.languages.length > 0
    ? navigator.languages
    : [navigator.language];
  for (const raw of candidates) {
    const tag = String(raw || '').toLowerCase();
    if (tag === 'zh' || tag.startsWith('zh-')) return 'zh';
    if (tag === 'en' || tag.startsWith('en-')) return 'en';
  }
  return 'en';
}

function switchLang(lang) {
  currentLang = lang === 'zh' ? 'zh' : 'en';
  document.documentElement.lang = currentLang;
  // Update active button
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.textContent.trim() === (currentLang === 'en' ? 'EN' : '中文'));
  });
  // Update static text
  const appVersionEl = document.getElementById('appVersion');
  if (appVersionEl) appVersionEl.textContent = t('headerVersion');
  const sidebarTitleEl = document.querySelector('.sidebar-title');
  if (sidebarTitleEl) sidebarTitleEl.textContent = t('sidebarProjects');
  const sidebarAddTextEl = document.querySelector('.sidebar-add span:last-child');
  if (sidebarAddTextEl) sidebarAddTextEl.textContent = t('sidebarAddProject');
  const addPathInputEl = document.getElementById('addPathInput');
  if (addPathInputEl) addPathInputEl.placeholder = t('sidebarAddPlaceholder');
  const addFormHintEl = document.querySelector('.add-form-hint');
  if (addFormHintEl) addFormHintEl.textContent = t('sidebarAddHint');
  const logTitleEl = document.querySelector('.log-title');
  if (logTitleEl) logTitleEl.textContent = t('logTitle');
  const modalCloseEl = document.querySelector('.modal-close');
  if (modalCloseEl) modalCloseEl.textContent = '✕ ' + t('modalClose');
  const modalHistoryTitleEl = document.querySelector('.modal-history h4');
  if (modalHistoryTitleEl) modalHistoryTitleEl.textContent = t('modalVersionHistory');
  // Re-render dynamic content
  renderSidebar();
  if (state.selectedProjectId) renderMainPanel(state.selectedProjectId);
  renderLogs();
}

// ─── State ───────────────────────────────────────────────────────────────────
const state = {
  projects: [],
  selectedProjectId: null,
  projectData: {},
  allLogs: [],
  logFilter: 'ALL',
  configByProject: {},
  currentSkillId: null,
  selectedRuntimeTab: 'all',
  searchQuery: '',
  sortBy: 'name',
  sortOrder: 'asc',
  selectedMainTab: 'overview',
  currentSkillRuntime: 'codex',
  activityLayer: 'business',
  activityTagFilter: 'all',
  businessEventsByProject: {},
  seenTraceIdsByProject: {},
  providerHealthByProject: {},
  providerCatalog: [],
  providerCatalogLoading: false,
  providerCatalogError: '',
  configUiByProject: {},
  configLoadingByProject: {},
  configLoadErrorByProject: {},
};

// ─── Browser Runtime Error Reporting ─────────────────────────────────────────
const clientErrorQueue = [];
let clientErrorFlushTimer = null;
let clientErrorFlushing = false;
let hasRequestedHardReload = false;
let bootstrapRecoveryTimer = null;

function toErrorMessage(value) {
  if (value instanceof Error) return value.message || String(value);
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function enqueueClientError(event) {
  const item = {
    message: String(event.message || '').slice(0, 1000),
    stack: String(event.stack || '').slice(0, 4000),
    source: String(event.source || '').slice(0, 1000),
    lineno: Number(event.lineno || 0) || undefined,
    colno: Number(event.colno || 0) || undefined,
    href: String(location.href || '').slice(0, 1000),
    ua: String(navigator.userAgent || '').slice(0, 500),
    timestamp: new Date().toISOString(),
    buildId: DASHBOARD_BUILD_ID,
  };
  clientErrorQueue.push(item);
  if (clientErrorQueue.length > 100) {
    clientErrorQueue.splice(0, clientErrorQueue.length - 100);
  }
  scheduleClientErrorFlush();
}

function scheduleClientErrorFlush() {
  if (clientErrorFlushTimer !== null) return;
  clientErrorFlushTimer = setTimeout(() => {
    clientErrorFlushTimer = null;
    void flushClientErrors();
  }, 250);
}

async function flushClientErrors() {
  if (clientErrorFlushing) return;
  if (clientErrorQueue.length === 0) return;
  clientErrorFlushing = true;
  const batch = clientErrorQueue.splice(0, 20);
  try {
    await fetch('/api/dashboard/client-errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: batch }),
    });
  } catch (err) {
    console.warn('[dashboard] failed to report client errors', { error: String(err) });
    const rollback = batch.slice(0, 20);
    clientErrorQueue.unshift(...rollback);
    if (clientErrorQueue.length > 100) {
      clientErrorQueue.splice(0, clientErrorQueue.length - 100);
    }
  } finally {
    clientErrorFlushing = false;
    if (clientErrorQueue.length > 0) scheduleClientErrorFlush();
  }
}

window.addEventListener('error', (event) => {
  enqueueClientError({
    message: event.message || 'window error',
    stack: event.error && event.error.stack ? event.error.stack : '',
    source: event.filename || '',
    lineno: event.lineno || 0,
    colno: event.colno || 0,
  });
});

window.addEventListener('unhandledrejection', (event) => {
  enqueueClientError({
    message: 'Unhandled promise rejection: ' + toErrorMessage(event.reason),
    stack: event.reason && event.reason.stack ? event.reason.stack : '',
    source: 'unhandledrejection',
  });
});

async function loadRuntimeInfo() {
  const el = document.getElementById('appBuild');
  if (!el) return;
  el.textContent = 'build #' + DASHBOARD_BUILD_SHORT;
  try {
    const runtime = await fetchJsonWithTimeout('/api/dashboard/runtime', 3000);
    const runtimeBuildId = String(runtime.buildId || '');
    const runtimeBuildShort = runtimeBuildId ? runtimeBuildId.slice(-8) : 'unknown';
    if (runtimeBuildId && runtimeBuildId !== DASHBOARD_BUILD_ID) {
      el.style.color = 'var(--yellow)';
      el.textContent = currentLang === 'zh'
        ? ('版本不一致 ui#' + DASHBOARD_BUILD_SHORT + ' / svr#' + runtimeBuildShort)
        : ('build mismatch ui#' + DASHBOARD_BUILD_SHORT + ' / svr#' + runtimeBuildShort);
      if (!hasRequestedHardReload) {
        hasRequestedHardReload = true;
        console.warn('[dashboard] build mismatch detected, forcing reload', {
          uiBuildId: DASHBOARD_BUILD_ID,
          runtimeBuildId,
        });
        setTimeout(() => location.reload(), 150);
      }
      return;
    }
    const pidSuffix = runtime.pid ? (' pid:' + runtime.pid) : '';
    el.style.color = 'var(--muted)';
    el.textContent = 'build #' + runtimeBuildShort + pidSuffix;
  } catch (err) {
    el.style.color = 'var(--yellow)';
    el.textContent = currentLang === 'zh' ? ('build #' + DASHBOARD_BUILD_SHORT + ' (运行信息不可用)') : ('build #' + DASHBOARD_BUILD_SHORT + ' (runtime unavailable)');
    console.warn('[dashboard] runtime info unavailable', { error: String(err) });
  }
}

// ─── SSE Connection ──────────────────────────────────────────────────────────
function connectSSE() {
  const src = new EventSource('/events');
  src.addEventListener('update', (e) => {
    const data = JSON.parse(e.data);
    handleUpdate(data);
  });
  src.addEventListener('open', () => setHeaderStatus('connected'));
  src.onerror = () => {
    setHeaderStatus('error');
    setTimeout(connectSSE, 3000);
  };
}

function handleUpdate(data) {
  let shouldRerenderMain = false;

  if (data.projects) {
    state.projects = data.projects;
    renderSidebar();
    if (!state.selectedProjectId && state.projects.length > 0) {
      void selectProject(state.projects[0].path);
    } else if (
      state.selectedProjectId &&
      !state.projects.some((project) => project.path === state.selectedProjectId) &&
      state.projects.length > 0
    ) {
      void selectProject(state.projects[0].path);
    }
  }
  if (data.projectData) {
    for (const [projectPath, nextPd] of Object.entries(data.projectData)) {
      const prevPd = state.projectData[projectPath];
      updateBusinessEvents(projectPath, prevPd, nextPd);
    }
    state.projectData = { ...state.projectData, ...data.projectData };
    if (state.selectedProjectId && Object.prototype.hasOwnProperty.call(data.projectData, state.selectedProjectId)) {
      shouldRerenderMain = true;
    }
  }
  if (data.logs) {
    state.allLogs = [...state.allLogs, ...data.logs].slice(-1000);
    if (state.selectedMainTab === 'logs') {
      renderLogs();
    }
  }
  if (state.selectedProjectId && shouldRerenderMain) {
    const activeEl = document.activeElement;
    const isSearchFocused = activeEl && activeEl.id === 'skillSearchInput';
    if (isSearchFocused) {
      // 用户正在输入时只刷新技能列表，避免整面板重绘导致焦点抖动
      updateSkillsList();
    } else if (state.selectedMainTab === 'config') {
      // Config 页由用户操作驱动刷新，避免 SSE 覆盖用户输入/操作反馈
    } else {
      renderMainPanel(state.selectedProjectId);
    }
  }
}

function setHeaderStatus(status) {
  const el = document.getElementById('headerStatus');
  if (status === 'connected') {
    el.innerHTML = '<span class="dot dot-green"></span><span>' + t('headerConnected') + '</span>';
  } else if (status === 'error') {
    el.innerHTML = '<span class="dot dot-red"></span><span>' + t('headerDisconnected') + ' — ' + t('headerRetrying') + '</span>';
  }
}

async function fetchJsonWithTimeout(url, timeoutMs = 8000, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    if (!response.ok) {
      throw new Error('HTTP ' + response.status + ': ' + response.statusText);
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function getErrorStack(error) {
  if (error && typeof error === 'object' && 'stack' in error) {
    return String(error.stack || '');
  }
  return '';
}

function sanitizeProvidersForState(providers) {
  return (Array.isArray(providers) ? providers : []).map((provider) => ({
    provider: provider.provider,
    modelName: provider.modelName,
    apiKeyEnvVar: provider.apiKeyEnvVar,
    apiKey: '',
    hasApiKey: Boolean(provider.hasApiKey || (provider.apiKey && provider.apiKey.trim())),
  }));
}

function scheduleBootstrapRecovery() {
  if (bootstrapRecoveryTimer !== null) {
    clearTimeout(bootstrapRecoveryTimer);
  }
  bootstrapRecoveryTimer = setTimeout(() => {
    bootstrapRecoveryTimer = null;
    void recoverDashboardBootstrap();
  }, 4000);
}

async function recoverDashboardBootstrap() {
  if (state.selectedProjectId && state.projectData[state.selectedProjectId]) return;
  try {
    const data = await fetchJsonWithTimeout('/api/projects', 6000);
    const projects = Array.isArray(data.projects) ? data.projects : [];
    if (projects.length === 0) return;
    state.projects = projects;
    renderSidebar();
    if (!state.selectedProjectId || !state.projectData[state.selectedProjectId]) {
      console.warn('[dashboard] bootstrap recovery activated', {
        projectCount: projects.length,
      });
      await selectProject(projects[0].path);
    }
  } catch (err) {
    console.warn('[dashboard] bootstrap recovery failed', { error: String(err) });
  }
}

// ─── Initial Load ────────────────────────────────────────────────────────────
async function init() {
  scheduleBootstrapRecovery();
  try {
    const browserLang = detectBrowserLang();
    if (browserLang !== currentLang) {
      try {
        switchLang(browserLang);
      } catch (switchErr) {
        console.error('[dashboard] language switch failed', { error: String(switchErr) });
        enqueueClientError({
          message: 'language switch failed: ' + String(switchErr),
          source: 'init.switchLang',
          stack: getErrorStack(switchErr),
        });
      }
    }

    let data = null;
    const timeouts = [5000, 9000, 14000];
    for (let i = 0; i < timeouts.length; i++) {
      try {
        data = await fetchJsonWithTimeout('/api/projects', timeouts[i]);
        break;
      } catch (fetchErr) {
        console.warn('[dashboard] init projects fetch failed', {
          attempt: i + 1,
          totalAttempts: timeouts.length,
          error: String(fetchErr),
        });
        if (i === timeouts.length - 1) {
          throw fetchErr;
        }
      }
    }

    state.projects = data?.projects || [];
    renderSidebar();
    void loadRuntimeInfo();

    void loadProviderCatalog();

    // 日志异步加载，不阻塞主页面渲染，避免 dashboard 卡在 loading
    fetchJsonWithTimeout('/api/logs', 5000)
      .then((logData) => {
        state.allLogs = logData.lines || [];
        if (state.selectedMainTab === 'logs') {
          renderLogs();
        }
      })
      .catch((e) => {
        console.warn('[dashboard] initial logs fetch skipped', { error: String(e) });
      });

    // Auto-select first project
    if (state.projects.length > 0) {
      await selectProject(state.projects[0].path);
    } else {
      // No projects - show empty state in main panel
      document.getElementById('mainPanel').innerHTML = '<div class="panel-inner"><div class="no-project">' + t('sidebarNoProjects') + '</div></div>';
    }
  } catch (e) {
    console.error('Init failed', e);
    enqueueClientError({
      message: 'init failed: ' + String(e),
      source: 'init',
      stack: getErrorStack(e),
    });
    // Show error state in sidebar and main panel
    const projectListEl = document.getElementById('projectList');
    if (projectListEl) {
      projectListEl.innerHTML = '<div class="empty-state" style="color:var(--red)">Failed to load projects</div>';
    }
    const mainPanelEl = document.getElementById('mainPanel');
    if (mainPanelEl) {
      mainPanelEl.innerHTML = '<div class="panel-inner"><div class="no-project" style="color:var(--yellow)">' +
        (currentLang === 'zh'
          ? '初始化失败，正在等待后台数据自动恢复...'
          : 'Initialization failed. Waiting for backend data to recover...') +
        '</div></div>';
    }
  }
  connectSSE();
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────
function renderSidebar() {
  const list = document.getElementById('projectList');
  if (state.projects.length === 0) {
    list.innerHTML = '<div class="empty-state">' + t('sidebarNoProjects') + '</div>';
    return;
  }
  list.innerHTML = state.projects.map(p => {
    const pd = state.projectData[p.path];
    const running = pd?.daemon?.isRunning;
    const skills = pd?.skills?.length ?? 0;
    const dotClass = running === undefined ? 'dot-gray' : running ? 'dot-green' : 'dot-red';
    const statusText = running === undefined ? '' : running ? '● ' + t('sidebarRunning') : '○ ' + t('sidebarStopped');
    const statusColor = running === undefined ? 'color:var(--muted)' : running ? 'color:var(--green)' : 'color:var(--muted)';
    const active = state.selectedProjectId === p.path ? 'active' : '';
    const skillsText = skills > 0 ? ' · ' + skills + ' ' + t('sidebarSkills') : '';
    return \`<div class="project-item \${active}" onclick="selectProject('\${escJsStr(p.path)}')">
      <div class="project-name">
        <span class="dot \${dotClass}"></span>
        <span>\${escHtml(p.name)}</span>
      </div>
      <div class="project-path" title="\${escHtml(p.path)}">\${escHtml(p.path)}</div>
      <div class="project-meta" style="\${statusColor}">\${statusText}\${skillsText}</div>
    </div>\`;
  }).join('');
}

async function selectProject(path) {
  state.selectedProjectId = path;
  renderSidebar();
  // Fetch project data if not cached
  if (!state.projectData[path]) {
    document.getElementById('mainPanel').innerHTML = '<div class="panel-inner"><div class="no-project">' + t('mainLoading') + '</div></div>';
    try {
      const enc = encodeURIComponent(path);
      let data = null;
      try {
        data = await fetchJsonWithTimeout(\`/api/projects/\${enc}/snapshot\`, 8000);
      } catch (firstErr) {
        console.warn('[dashboard] first snapshot fetch failed, retrying', { path, error: String(firstErr) });
        data = await fetchJsonWithTimeout(\`/api/projects/\${enc}/snapshot\`, 12000);
      }
      try {
        updateBusinessEvents(path, state.projectData[path], data);
      } catch (evtErr) {
        console.error('[dashboard] updateBusinessEvents failed; continuing with snapshot', {
          path,
          error: String(evtErr),
        });
      }
      state.projectData[path] = data;
    } catch (e) {
      console.error('[dashboard] failed to load project snapshot', { path, error: String(e) });
      state.projectData[path] = {
        daemon: {
          isRunning: false,
          pid: null,
          startedAt: null,
          processedTraces: 0,
          lastCheckpointAt: null,
          retryQueueSize: 0,
          optimizationStatus: {
            currentState: 'idle',
            currentSkillId: null,
            lastOptimizationAt: null,
            lastError: null,
            queueSize: 0,
          },
        },
        skills: [],
        traceStats: { total: 0, byRuntime: {}, byStatus: {}, byEventType: {} },
        recentTraces: [],
      };
    }
  }
  renderMainPanel(path);
  renderSidebar();
  void ensureProviderHealth(path)
    .then(() => {
      if (state.selectedProjectId === path) {
        renderMainPanel(path);
      }
    })
    .catch(() => {
      // ensureProviderHealth already degrades internally
    });
}

async function ensureProviderHealth(projectPath, force = false) {
  if (!force && state.providerHealthByProject[projectPath]) return;
  try {
    const enc = encodeURIComponent(projectPath);
    const data = await fetchJsonWithTimeout('/api/projects/' + enc + '/provider-health', 20000);
    state.providerHealthByProject[projectPath] = data.health || null;
  } catch (e) {
    console.warn('[dashboard] failed to load provider health', { projectPath, error: String(e) });
    state.providerHealthByProject[projectPath] = {
      level: 'warn',
      code: 'provider_connectivity_failed',
      message: String(e),
      checkedAt: new Date().toISOString(),
      results: [],
    };
  }
}

function providerAlertTitle(code) {
  if (code === 'provider_not_configured') {
    return currentLang === 'zh' ? 'Provider 未配置' : 'Provider Not Configured';
  }
  if (code === 'provider_connectivity_failed') {
    return currentLang === 'zh' ? 'Provider 无法连通' : 'Provider Connectivity Failed';
  }
  return currentLang === 'zh' ? 'Provider 检查异常' : 'Provider Health Warning';
}

function renderProviderAlert(projectPath) {
  const health = state.providerHealthByProject[projectPath];
  if (!health || health.level !== 'warn') return '';

  let message = health.message || '';
  if (health.code === 'provider_not_configured') {
    message = currentLang === 'zh'
      ? '当前项目尚未配置任何 provider。'
      : 'No provider is configured for this project.';
  } else if (health.code === 'provider_connectivity_failed' && Array.isArray(health.results) && health.results.length > 0) {
    const failed = health.results.filter((item) => !item.ok);
    const failedText = failed.slice(0, 3).map((item) => item.provider + '/' + item.modelName).join(', ');
    message = currentLang === 'zh'
      ? '检测到 provider 连通失败：' + failedText
      : 'Failed provider connectivity: ' + failedText;
  }

  return '<div class="provider-alert">' +
    '<span class="provider-alert-dot"></span>' +
    '<div>' +
      '<div class="provider-alert-title">⚠ ' + escHtml(providerAlertTitle(health.code)) + '</div>' +
      '<div class="provider-alert-message">' + escHtml(message) + '</div>' +
      '<div class="provider-alert-hint">' +
        (currentLang === 'zh'
          ? '请在 Config 页补充 provider 配置并完成连通性检查。'
          : 'Open the Config tab to set provider and re-run connectivity check.') +
      '</div>' +
    '</div>' +
  '</div>';
}

function skillKey(skill) {
  return (skill.skillId || '') + '@' + (skill.runtime || 'codex');
}

function maxVersion(skill) {
  const versions = Array.isArray(skill.versionsAvailable) ? skill.versionsAvailable : [];
  return versions.length > 0 ? Math.max(...versions) : (skill.current_revision || skill.version || 1);
}

function pushBusinessEvent(projectPath, event) {
  const list = state.businessEventsByProject[projectPath] || [];
  const id = event.id || (event.timestamp + ':' + event.tag + ':' + (event.skillId || '') + ':' + Math.random().toString(36).slice(2, 8));
  list.unshift({ ...event, id });
  state.businessEventsByProject[projectPath] = list.slice(0, 300);
  console.debug('[dashboard] ornn business event', {
    projectPath,
    tag: event.tag,
    skillId: event.skillId || null,
    runtime: event.runtime || null,
    status: event.status || null,
  });
}

function updateBusinessEvents(projectPath, prevPd, nextPd) {
  if (!nextPd) return;
  const nowIso = new Date().toISOString();

  const prevDaemon = prevPd?.daemon || null;
  const nextDaemon = nextPd.daemon || null;
  if (prevDaemon && nextDaemon) {
    if (!!prevDaemon.isRunning !== !!nextDaemon.isRunning) {
      pushBusinessEvent(projectPath, {
        timestamp: nowIso,
        tag: 'daemon_state',
        status: nextDaemon.isRunning ? 'started' : 'stopped',
      });
    }
    if (
      (prevDaemon.optimizationStatus?.currentState || 'idle') !==
      (nextDaemon.optimizationStatus?.currentState || 'idle')
    ) {
      pushBusinessEvent(projectPath, {
        timestamp: nowIso,
        tag: 'optimization_state',
        status: nextDaemon.optimizationStatus?.currentState || 'idle',
        skillId: nextDaemon.optimizationStatus?.currentSkillId || null,
      });
    }
    if (
      prevDaemon.optimizationStatus?.lastOptimizationAt &&
      nextDaemon.optimizationStatus?.lastOptimizationAt &&
      prevDaemon.optimizationStatus.lastOptimizationAt !== nextDaemon.optimizationStatus.lastOptimizationAt
    ) {
      pushBusinessEvent(projectPath, {
        timestamp: nextDaemon.optimizationStatus.lastOptimizationAt,
        tag: 'skill_version_iterated',
        skillId: nextDaemon.optimizationStatus?.currentSkillId || null,
      });
    }
  }

  const prevSkills = Array.isArray(prevPd?.skills) ? prevPd.skills : [];
  const nextSkills = Array.isArray(nextPd.skills) ? nextPd.skills : [];
  const prevMap = new Map(prevSkills.map((s) => [skillKey(s), s]));
  const nextMap = new Map(nextSkills.map((s) => [skillKey(s), s]));

  for (const [key, skill] of nextMap.entries()) {
    if (!prevMap.has(key)) {
      pushBusinessEvent(projectPath, {
        timestamp: nowIso,
        tag: 'skill_monitoring_started',
        skillId: skill.skillId,
        runtime: skill.runtime || 'codex',
      });
      continue;
    }
    const prev = prevMap.get(key);
    const prevMaxV = maxVersion(prev);
    const nextMaxV = maxVersion(skill);
    if (nextMaxV > prevMaxV) {
      pushBusinessEvent(projectPath, {
        timestamp: nowIso,
        tag: 'skill_version_iterated',
        skillId: skill.skillId,
        runtime: skill.runtime || 'codex',
        detail: 'v' + prevMaxV + ' -> v' + nextMaxV,
      });
    }
    const prevRev = prev.current_revision || prev.version || 1;
    const nextRev = skill.current_revision || skill.version || 1;
    if (nextRev !== prevRev) {
      pushBusinessEvent(projectPath, {
        timestamp: nowIso,
        tag: 'skill_edited',
        skillId: skill.skillId,
        runtime: skill.runtime || 'codex',
        detail: 'rev ' + prevRev + ' -> ' + nextRev,
      });
    }
  }
  for (const [key, skill] of prevMap.entries()) {
    if (!nextMap.has(key)) {
      pushBusinessEvent(projectPath, {
        timestamp: nowIso,
        tag: 'skill_removed',
        skillId: skill.skillId,
        runtime: skill.runtime || 'codex',
      });
    }
  }

  const seen = state.seenTraceIdsByProject[projectPath] || {};
  const recentTraces = Array.isArray(nextPd.recentTraces) ? nextPd.recentTraces : [];
  for (const trace of recentTraces) {
    const traceId = trace.trace_id;
    if (!traceId || seen[traceId]) continue;
    seen[traceId] = true;
    if (Array.isArray(trace.skill_refs) && trace.skill_refs.length > 0) {
      for (const skillRef of trace.skill_refs) {
        pushBusinessEvent(projectPath, {
          id: 'trace:' + traceId + ':' + skillRef,
          timestamp: trace.timestamp || nowIso,
          tag: 'skill_called',
          skillId: skillRef,
          runtime: trace.runtime || 'unknown',
          status: trace.status || 'success',
          detail: trace.event_type || '',
        });
      }
    }
  }
  state.seenTraceIdsByProject[projectPath] = seen;
}

function businessEventLabel(tag) {
  const map = {
    all: t('activityTagAll'),
    skill_called: t('activityTagSkillCalled'),
    skill_monitoring_started: t('activityTagSkillAdded'),
    skill_removed: t('activityTagSkillRemoved'),
    skill_edited: t('activityTagSkillEdited'),
    skill_version_iterated: t('activityTagSkillVersion'),
    daemon_state: t('activityTagDaemon'),
    optimization_state: t('activityTagOptimization'),
  };
  return map[tag] || tag;
}

function formatBusinessEvent(e) {
  switch (e.tag) {
    case 'skill_called':
      return (currentLang === 'zh' ? '调用技能' : 'Skill called') + ': ' + (e.skillId || 'unknown');
    case 'skill_monitoring_started':
      return (currentLang === 'zh' ? '开始监控技能' : 'Started monitoring skill') + ': ' + (e.skillId || 'unknown');
    case 'skill_removed':
      return (currentLang === 'zh' ? '移除技能监控' : 'Stopped monitoring skill') + ': ' + (e.skillId || 'unknown');
    case 'skill_edited':
      return (currentLang === 'zh' ? '技能被编辑' : 'Skill edited') + ': ' + (e.skillId || 'unknown');
    case 'skill_version_iterated':
      return (currentLang === 'zh' ? '技能版本迭代' : 'Skill version iterated') + (e.skillId ? ': ' + e.skillId : '');
    case 'daemon_state':
      return currentLang === 'zh'
        ? ('守护进程' + (e.status === 'started' ? '已启动' : '已停止'))
        : ('Daemon ' + (e.status === 'started' ? 'started' : 'stopped'));
    case 'optimization_state':
      return (currentLang === 'zh' ? '优化状态变化' : 'Optimization state changed') + ': ' + (e.status || 'idle');
    default:
      return e.tag;
  }
}

function renderBusinessEvents(projectPath) {
  const events = (state.businessEventsByProject[projectPath] || []).slice(0, 150);
  const allTags = ['all', ...Array.from(new Set(events.map((e) => e.tag)))];
  const filtered = state.activityTagFilter === 'all'
    ? events
    : events.filter((e) => e.tag === state.activityTagFilter);

  if (events.length === 0) return '<div class="empty-state">' + t('activityEmpty') + '</div>';

  return \`
    <div class="activity-controls">
      <div class="activity-left">
        \${allTags.map((tag) =>
          \`<button class="tag-chip \${state.activityTagFilter === tag ? 'active' : ''}" onclick="setActivityTagFilter('\${escJsStr(tag)}')">\${businessEventLabel(tag)}</button>\`
        ).join('')}
      </div>
      <div style="font-size:10px;color:var(--muted)">\${filtered.length} / \${events.length}</div>
    </div>
    <div class="trace-table-wrap">
      <table class="trace-table">
        <thead><tr><th>\${t('traceTime')}</th><th>\${t('traceRuntime')}</th><th>\${t('traceEvent')}</th><th>Skill</th><th>\${t('traceStatus')}</th><th>Detail</th></tr></thead>
        <tbody>
          \${filtered.slice(0, 80).map((e) => \`<tr>
            <td style="color:var(--muted)">\${e.timestamp ? e.timestamp.slice(11,19) : '—'}</td>
            <td>\${escHtml(e.runtime || '—')}</td>
            <td>\${escHtml(businessEventLabel(e.tag))}</td>
            <td>\${escHtml(e.skillId || '—')}</td>
            <td style="color:var(--muted)">\${escHtml(e.status || '—')}</td>
            <td style="color:var(--muted)">\${escHtml(e.detail || formatBusinessEvent(e))}</td>
          </tr>\`).join('')}
        </tbody>
      </table>
    </div>
  \`;
}

// ─── Main Panel ───────────────────────────────────────────────────────────────
function renderMainPanel(projectPath) {
  const active = document.activeElement;
  const shouldRestoreSearchFocus = active && active.id === 'skillSearchInput';
  const prevSearchSelectionStart = shouldRestoreSearchFocus ? active.selectionStart : null;
  const prevSearchSelectionEnd = shouldRestoreSearchFocus ? active.selectionEnd : null;

  const el = document.getElementById('mainPanel');
  const pd = state.projectData[projectPath];
  if (!pd) { el.innerHTML = '<div class="panel-inner"><div class="no-project">' + t('mainNoData') + '</div></div>'; return; }

  // Ensure all required properties exist with defaults
  const daemon = pd.daemon || { isRunning: false, processedTraces: 0, optimizationStatus: { queueSize: 0 }, retryQueueSize: 0 };
  const skills = pd.skills || [];
  const traceStats = pd.traceStats || { total: 0, byRuntime: {}, byStatus: {}, byEventType: {} };
  const recentTraces = pd.recentTraces || [];

  const uptime = daemon.isRunning && daemon.startedAt ? formatUptime(daemon.startedAt) : '—';

  el.innerHTML = \`<div class="panel-inner">
    <div class="main-tabs">
      <button class="main-tab \${state.selectedMainTab === 'overview' ? 'active' : ''}" onclick="selectMainTab('overview')">\${t('mainTabOverview')}</button>
      <button class="main-tab \${state.selectedMainTab === 'skills' ? 'active' : ''}" onclick="selectMainTab('skills')">\${t('mainTabSkills')}</button>
      <button class="main-tab \${state.selectedMainTab === 'activity' ? 'active' : ''}" onclick="selectMainTab('activity')">\${t('mainTabActivity')}</button>
      <button class="main-tab \${state.selectedMainTab === 'logs' ? 'active' : ''}" onclick="selectMainTab('logs')">\${t('mainTabLogs')}</button>
      <button class="main-tab \${state.selectedMainTab === 'config' ? 'active' : ''}" onclick="selectMainTab('config')">\${t('mainTabConfig')}</button>
    </div>

    \${renderProviderAlert(projectPath)}

    \${state.selectedMainTab === 'overview' ? \`
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-label">\${t('statShadowSkills')}</div>
        <div class="stat-value">\${skills.length}</div>
        <div class="stat-sub">\${t('statShadowSkillsSub')}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">\${t('statTraces')}</div>
        <div class="stat-value">\${daemon.processedTraces ?? 0}</div>
        <div class="stat-sub">\${t('statTracesSub')}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">\${t('statUptime')}</div>
        <div class="stat-value" style="font-size:15px">\${uptime}</div>
        <div class="stat-sub">\${daemon.isRunning ? t('daemonRunning') : t('daemonStopped')}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">\${t('statQueue')}</div>
        <div class="stat-value">\${daemon.optimizationStatus?.queueSize ?? 0}</div>
        <div class="stat-sub">\${t('statQueueSub')}</div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <span>\${t('daemonStatus')}</span>
        <span>\${daemon.isRunning ? '<span class="dot dot-green"></span> ' + t('daemonRunning') : '<span class="dot dot-gray"></span> ' + t('daemonStopped')}</span>
      </div>
      <div class="card-body">
        <div class="daemon-grid">
          <div>
            <div class="daemon-row"><span class="daemon-key">\${t('daemonState')}</span><span class="daemon-val">\${renderStateBadge(daemon.optimizationStatus?.currentState)}</span></div>
            <div class="daemon-row"><span class="daemon-key">\${t('daemonCurrentSkill')}</span><span class="daemon-val">\${daemon.optimizationStatus?.currentSkillId ?? '—'}</span></div>
            <div class="daemon-row"><span class="daemon-key">\${t('daemonRetryQueue')}</span><span class="daemon-val">\${daemon.retryQueueSize ?? 0}</span></div>
          </div>
          <div>
            <div class="daemon-row"><span class="daemon-key">\${t('daemonLastCheckpoint')}</span><span class="daemon-val">\${daemon.lastCheckpointAt ? timeAgo(daemon.lastCheckpointAt) : '—'}</span></div>
            <div class="daemon-row"><span class="daemon-key">\${t('daemonLastOptimization')}</span><span class="daemon-val">\${daemon.optimizationStatus?.lastOptimizationAt ? timeAgo(daemon.optimizationStatus.lastOptimizationAt) : '—'}</span></div>
            \${daemon.optimizationStatus?.lastError ? \`<div class="daemon-row"><span class="daemon-key" style="color:var(--red)">\${t('daemonLastError')}</span><span class="daemon-val" style="color:var(--red);font-size:10px">\${escHtml(daemon.optimizationStatus.lastError)}</span></div>\` : ''}
          </div>
        </div>
      </div>
    </div>
    \${traceStats.total > 0 ? \`
    <div class="card">
      <div class="card-header"><span>\${t('traceTitle')}</span><span style="color:var(--muted)">\${traceStats.total} \${t('traceTotal')}</span></div>
      <div class="card-body">
        \${renderTraceBars(t('traceRuntime'), traceStats.byRuntime, ['codex','claude','opencode'])}
        \${renderTraceBars(t('traceStatus'), traceStats.byStatus, ['success','failure','retry','interrupted'])}
      </div>
    </div>\` : ''}
    \` : ''}

    \${state.selectedMainTab === 'skills' ? \`
    <div class="card">
      <div class="card-header">
        <span>\${t('skillsTitle')}</span>
        <div style="display:flex;align-items:center;gap:12px;">
          <div class="runtime-tabs">
            <button class="runtime-tab \${state.selectedRuntimeTab === 'all' ? 'active' : ''}" onclick="selectRuntimeTab('all')">All</button>
            <button class="runtime-tab tab-codex \${state.selectedRuntimeTab === 'codex' ? 'active' : ''}" onclick="selectRuntimeTab('codex')">Codex</button>
            <button class="runtime-tab tab-claude \${state.selectedRuntimeTab === 'claude' ? 'active' : ''}" onclick="selectRuntimeTab('claude')">Claude</button>
            <button class="runtime-tab tab-opencode \${state.selectedRuntimeTab === 'opencode' ? 'active' : ''}" onclick="selectRuntimeTab('opencode')">OpenCode</button>
          </div>
          <span style="color:var(--muted)" id="skillsCount">\${getFilteredAndSortedSkills(skills).length} \${t('skillsCount')}</span>
        </div>
      </div>
      <div class="card-body">
        <!-- Search and Sort Controls -->
        <div class="skills-controls">
          <div class="search-box">
            <span class="search-icon">🔍</span>
            <input type="text" class="search-input" id="skillSearchInput" placeholder="Search skills..." value="\${state.searchQuery}" oninput="handleSearch(this.value)" />
          </div>
          <div class="sort-controls">
            <span class="sort-label">Sort:</span>
            <button class="sort-btn \${state.sortBy === 'name' ? 'active' : ''}" onclick="toggleSort('name')">
              Name <span class="arrow">\${state.sortBy === 'name' ? (state.sortOrder === 'asc' ? '↑' : '↓') : ''}</span>
            </button>
            <button class="sort-btn \${state.sortBy === 'updated' ? 'active' : ''}" onclick="toggleSort('updated')">
              Updated <span class="arrow">\${state.sortBy === 'updated' ? (state.sortOrder === 'asc' ? '↑' : '↓') : ''}</span>
            </button>
          </div>
        </div>
        
        <div id="skillsListContainer">
          \${getFilteredAndSortedSkills(skills).length === 0
            ? '<div class="empty-state">' + (state.searchQuery ? 'No skills found matching "' + escHtml(state.searchQuery) + '"' : t('skillsEmpty')) + '</div>'
            : '<div class="skills-list">' + getFilteredAndSortedSkills(skills).map(s => renderSkillCard(s, projectPath)).join('') + '</div>'
          }
        </div>
      </div>
    </div>
    \` : ''}

    \${state.selectedMainTab === 'activity' ? \`
    <div class="card">
      <div class="card-header"><span>\${t('traceTitle')}</span><span style="color:var(--muted)">\${traceStats.total} \${t('traceTotal')}</span></div>
      <div class="card-body">
        <div class="activity-controls">
          <div class="activity-left">
            <button class="activity-tab \${state.activityLayer === 'business' ? 'active' : ''}" onclick="setActivityLayer('business')">\${t('activityLayerBusiness')}</button>
            <button class="activity-tab \${state.activityLayer === 'raw' ? 'active' : ''}" onclick="setActivityLayer('raw')">\${t('activityLayerRaw')}</button>
          </div>
        </div>
        \${state.activityLayer === 'business' ? \`
          \${renderBusinessEvents(projectPath)}
        \` : traceStats.total > 0 ? \`
          \${renderTraceBars(t('traceRuntime'), traceStats.byRuntime, ['codex','claude','opencode'])}
          \${renderTraceBars(t('traceStatus'), traceStats.byStatus, ['success','failure','retry','interrupted'])}
          <div style="margin-top:10px" class="trace-table-wrap">
            \${renderRecentTraces(recentTraces.slice(0,50))}
          </div>
        \` : \`<div class="empty-state">\${t('activityEmpty')}</div>\`}
      </div>
    </div>
    \` : ''}

    \${state.selectedMainTab === 'logs' ? \`
    <div class="log-panel">
      <div class="log-header">
        <span class="log-title">\${t('logTitle')}</span>
        <select class="log-filter" id="logFilter" onchange="filterLogs()">
          <option value="ALL" \${state.logFilter === 'ALL' ? 'selected' : ''}>\${t('logFilterAll')}</option>
          <option value="INFO" \${state.logFilter === 'INFO' ? 'selected' : ''}>INFO</option>
          <option value="WARN" \${state.logFilter === 'WARN' ? 'selected' : ''}>WARN</option>
          <option value="ERROR" \${state.logFilter === 'ERROR' ? 'selected' : ''}>ERROR</option>
        </select>
      </div>
      <div class="log-list" id="logList"></div>
    </div>
    \` : ''}

    \${state.selectedMainTab === 'config' ? \`
    <div class="card">
      <div class="card-header"><span>\${t('configTitle')}</span></div>
      <div class="card-body">
        \${renderConfigPanel(projectPath)}
      </div>
    </div>
    \` : ''}

  </div>\`;

  if (shouldRestoreSearchFocus) {
    const nextInput = document.getElementById('skillSearchInput');
    if (nextInput) {
      nextInput.focus();
      if (prevSearchSelectionStart !== null && prevSearchSelectionEnd !== null) {
        nextInput.setSelectionRange(prevSearchSelectionStart, prevSearchSelectionEnd);
      }
    }
  }

  if (state.selectedMainTab === 'logs') {
    renderLogs();
  }
  if (state.selectedMainTab === 'config') {
    void ensureProjectConfig(projectPath);
  }
}

function selectMainTab(tab) {
  state.selectedMainTab = tab;
  if (tab === 'config' && state.providerCatalog.length === 0) {
    void loadProviderCatalog(true);
  }
  if (state.selectedProjectId) {
    renderMainPanel(state.selectedProjectId);
  }
  // 前端日志：记录 dashboard 主 tab 切换
  console.debug('[dashboard] switched main tab', { tab });
}

function setActivityLayer(layer) {
  state.activityLayer = layer === 'raw' ? 'raw' : 'business';
  if (state.selectedProjectId) renderMainPanel(state.selectedProjectId);
}

function setActivityTagFilter(tag) {
  state.activityTagFilter = tag || 'all';
  if (state.selectedProjectId) renderMainPanel(state.selectedProjectId);
}

function renderConfigPanel(projectPath) {
  const config = state.configByProject[projectPath] || {
    autoOptimize: true,
    userConfirm: false,
    runtimeSync: true,
    providers: [],
  };
  const loading = !!state.configLoadingByProject[projectPath];
  const loadError = state.configLoadErrorByProject[projectPath] || '';
  const configUi = state.configUiByProject[projectPath] || {};

  const providers = Array.isArray(config.providers) ? config.providers : [];
  const rowsHtml = providers.length > 0
    ? providers.map((row, index) => renderProviderRow(row, index)).join('')
    : \`<div class="config-help">\${currentLang === 'zh' ? '暂无 provider，请点击下方按钮添加。' : 'No provider yet. Use the button below to add one.'}</div>\`;

  return \`
    \${state.providerCatalogLoading ? \`<div class="config-help" style="margin-bottom:8px">\${currentLang === 'zh' ? 'LiteLLM 列表加载中...' : 'Loading LiteLLM catalog...'}</div>\` : ''}
    \${state.providerCatalogError ? \`<div class="config-help" style="margin-bottom:8px;color:var(--red)">LiteLLM catalog error: \${escHtml(state.providerCatalogError)} <button class="btn-secondary" type="button" onclick="reloadProviderCatalog()">\${currentLang === 'zh' ? '重试' : 'Retry'}</button></div>\` : ''}
    \${loading ? \`<div class="config-help" style="margin-bottom:8px">\${t('configLoading')}</div>\` : ''}
    \${loadError ? \`<div class="config-help" style="margin-bottom:8px;color:var(--red)">Failed to load remote config: \${escHtml(loadError)}</div>\` : ''}
    <div class="config-intro">\${t('configIntro')}</div>
    <div class="config-grid">
      <div class="config-field">
        <label class="config-check"><input type="checkbox" id="cfg_auto_optimize" \${config.autoOptimize ? 'checked' : ''}/> tracking.auto_optimize</label>
        <div class="config-help">\${t('configAutoOptimizeHelp')}</div>
      </div>
      <div class="config-field">
        <label class="config-check"><input type="checkbox" id="cfg_user_confirm" \${config.userConfirm ? 'checked' : ''}/> tracking.user_confirm</label>
        <div class="config-help">\${t('configUserConfirmHelp')}</div>
      </div>
      <div class="config-field">
        <label class="config-check"><input type="checkbox" id="cfg_runtime_sync" \${config.runtimeSync ? 'checked' : ''}/> tracking.runtime_sync</label>
        <div class="config-help">\${t('configRuntimeSyncHelp')}</div>
      </div>
    </div>
    <div class="config-field" style="margin-top:10px">
      <label class="config-label">providers</label>
      <div class="providers-editor" id="cfg_providers_rows">\${rowsHtml}</div>
      <div style="margin-top:8px;display:flex;gap:8px">
        <button class="btn-secondary" type="button" onclick="addProviderRow()">\${currentLang === 'zh' ? '新增 Provider' : 'Add Provider'}</button>
      </div>
      <div class="config-help">\${t('configProvidersHelp')}</div>
      <div class="config-connectivity" id="cfg_connectivity">
        \${renderConnectivityResultsHtml(configUi.connectivityResults)}
      </div>
    </div>
    <div class="config-actions">
      <span id="cfg_save_hint" class="config-label">\${escHtml(configUi.saveHint || '')}</span>
      <div style="display:flex;gap:8px;">
        <button class="btn-primary" id="cfg_check_btn" onclick="checkProvidersConnectivity()">\${t('configCheckConnectivity')}</button>
        <button class="btn-primary" onclick="saveProjectConfig()">\${t('configSave')}</button>
      </div>
    </div>
  \`;
}

function retryLoadConfig() {
  if (!state.selectedProjectId) return;
  delete state.configByProject[state.selectedProjectId];
  state.configLoadErrorByProject[state.selectedProjectId] = '';
  void ensureProjectConfig(state.selectedProjectId);
  renderMainPanel(state.selectedProjectId);
}

async function loadProviderCatalog(force = false) {
  if (state.providerCatalogLoading) return;
  if (!force && state.providerCatalog.length > 0) return;
  state.providerCatalogLoading = true;
  state.providerCatalogError = '';
  if (state.selectedMainTab === 'config' && state.selectedProjectId) {
    renderMainPanel(state.selectedProjectId);
  }
  try {
    let data = null;
    try {
      data = await fetchJsonWithTimeout('/api/providers/catalog', 20000);
    } catch (firstErr) {
      console.warn('[dashboard] first provider catalog fetch failed, retrying', { error: String(firstErr) });
      data = await fetchJsonWithTimeout('/api/providers/catalog', 30000);
    }
    const providers = Array.isArray(data.providers) ? data.providers : [];
    if (providers.length === 0) {
      throw new Error('empty provider catalog');
    }
    state.providerCatalog = providers;
    state.providerCatalogError = '';
  } catch (e) {
    state.providerCatalogError = String(e);
    console.error('[dashboard] provider catalog fetch failed', { error: String(e) });
  } finally {
    state.providerCatalogLoading = false;
    if (state.selectedMainTab === 'config' && state.selectedProjectId) {
      renderMainPanel(state.selectedProjectId);
    }
  }
}

function reloadProviderCatalog() {
  void loadProviderCatalog(true);
}

function setConfigUi(projectPath, patch) {
  const prev = state.configUiByProject[projectPath] || {};
  state.configUiByProject[projectPath] = { ...prev, ...patch };
}

function renderProviderRow(row, index) {
  const normalizedProvider = String(row.provider || '');
  const knownProvider = isKnownProvider(normalizedProvider);
  const providerOptions = getProviderOptionsHtml(knownProvider ? normalizedProvider : '__custom__');
  const normalizedModel = String(row.modelName || '');
  const modelOptions = getModelOptionsHtml(normalizedProvider, normalizedModel);
  const modelIsCustom = !isKnownModel(normalizedProvider, normalizedModel);
  const hasApiKey = !!row.hasApiKey;
  return \`
    <div class="provider-row" data-row-index="\${index}" data-has-api-key="\${hasApiKey ? 'true' : 'false'}">
      <select class="config-select cfg_provider" onchange="handleProviderChange(this)">
        \${providerOptions}
      </select>
      <input class="config-input cfg_provider_custom" value="\${knownProvider ? '' : escHtml(normalizedProvider)}" placeholder="\${currentLang === 'zh' ? '自定义 provider id（例如：xai）' : 'Custom provider id (e.g. xai)'}" style="\${knownProvider ? 'display:none;' : ''}" />
      <div>
        <select class="config-select cfg_model" onchange="handleModelChange(this)">
          \${modelOptions}
        </select>
        <input class="config-input cfg_model_custom" value="\${modelIsCustom ? escHtml(normalizedModel) : ''}" placeholder="\${currentLang === 'zh' ? '自定义 model（例如：grok-3）' : 'Custom model (e.g. grok-3)'}" style="margin-top:6px;\${modelIsCustom ? '' : 'display:none;'}" />
      </div>
      <div>
        <input class="config-input cfg_api_key" type="password" value="" placeholder="\${hasApiKey ? (currentLang === 'zh' ? 'API Key 已保存；留空表示不修改' : 'API key stored; leave blank to keep') : (currentLang === 'zh' ? '直接粘贴 API Key' : 'Paste API key')}" />
        <input class="config-input cfg_env" value="\${escHtml(row.apiKeyEnvVar || '')}" placeholder="OPENAI_API_KEY" style="margin-top:6px" />
      </div>
      <button class="btn-danger" type="button" onclick="removeProviderRow(this)">\${currentLang === 'zh' ? '删除' : 'Remove'}</button>
    </div>
  \`;
}

function getProviderOptionsHtml(selectedProvider) {
  const catalog = Array.isArray(state.providerCatalog) ? state.providerCatalog : [];
  if (catalog.length === 0) {
    return '<option value="__custom__">' + escHtml(currentLang === 'zh' ? 'LiteLLM 列表未就绪（仅可自定义）' : 'LiteLLM catalog not ready (custom only)') + '</option>';
  }
  return catalog
    .map((item) => {
      const selected = item.id === selectedProvider ? 'selected' : '';
      return '<option value="' + escHtml(item.id) + '" ' + selected + '>' + escHtml(item.id) + '</option>';
    })
    .join('') + '<option value="__custom__" ' + (selectedProvider === '__custom__' ? 'selected' : '') + '>' + escHtml(currentLang === 'zh' ? '自定义' : 'Custom...') + '</option>';
}

function isKnownProvider(providerId) {
  if (!providerId) return false;
  const catalog = Array.isArray(state.providerCatalog) ? state.providerCatalog : [];
  return catalog.some((item) => item.id === providerId);
}

function getModelsByProvider(providerId) {
  const catalog = Array.isArray(state.providerCatalog) ? state.providerCatalog : [];
  const item = catalog.find((p) => p.id === providerId);
  return Array.isArray(item?.models) ? item.models : [];
}

function getModelOptionsHtml(providerId, selectedModel) {
  const models = getModelsByProvider(providerId);
  const options = models
    .map((model) => {
      const selected = model === selectedModel ? 'selected' : '';
      return '<option value="' + escHtml(model) + '" ' + selected + '>' + escHtml(model) + '</option>';
    })
    .join('');
  const customSelected = isKnownModel(providerId, selectedModel) ? '' : 'selected';
  return options + '<option value="__custom__" ' + customSelected + '>' + escHtml(currentLang === 'zh' ? '自定义' : 'Custom...') + '</option>';
}

function isKnownModel(providerId, modelName) {
  if (!modelName) return false;
  return getModelsByProvider(providerId).includes(modelName);
}

function guessApiKeyEnvVar(providerId) {
  const catalog = Array.isArray(state.providerCatalog) ? state.providerCatalog : [];
  const item = catalog.find((p) => p.id === providerId);
  if (item && item.apiKeyEnvVar) return item.apiKeyEnvVar;
  const normalized = String(providerId || '').toUpperCase().replace(/[^A-Z0-9]/g, '_');
  return normalized ? (normalized + '_API_KEY') : '';
}

function collectProvidersFromConfigEditor() {
  const rows = Array.from(document.querySelectorAll('#cfg_providers_rows .provider-row'));
  const providers = rows.map((row) => {
    const providerSelect = row.querySelector('.cfg_provider')?.value?.trim() || '';
    const providerCustom = row.querySelector('.cfg_provider_custom')?.value?.trim() || '';
    const provider = providerSelect === '__custom__' ? providerCustom : providerSelect;
    const modelSelect = row.querySelector('.cfg_model')?.value?.trim() || '';
    const modelCustom = row.querySelector('.cfg_model_custom')?.value?.trim() || '';
    const modelName = modelSelect === '__custom__' ? modelCustom : modelSelect;
    const apiKey = row.querySelector('.cfg_api_key')?.value || '';
    const apiKeyEnvVar = row.querySelector('.cfg_env')?.value?.trim() || '';
    const hasApiKey = row.getAttribute('data-has-api-key') === 'true';
    return { provider, modelName, apiKeyEnvVar, apiKey, hasApiKey };
  }).filter((item) => item.provider || item.modelName || item.apiKeyEnvVar || item.apiKey);

  for (let i = 0; i < providers.length; i++) {
    const item = providers[i];
    if (!item.provider || !item.modelName || !item.apiKeyEnvVar) {
      throw new Error(\`providers[\${i}] must include non-empty provider/modelName/apiKeyEnvVar\`);
    }
    if (!item.apiKey && !item.hasApiKey) {
      throw new Error(\`providers[\${i}] must include API key or keep an existing saved key\`);
    }
  }
  return providers;
}

function handleProviderChange(selectEl) {
  const row = selectEl.closest('.provider-row');
  if (!row) return;
  const providerId = selectEl.value;
  const customInput = row.querySelector('.cfg_provider_custom');
  const envInput = row.querySelector('.cfg_env');
  const modelSelect = row.querySelector('.cfg_model');
  const modelCustomInput = row.querySelector('.cfg_model_custom');
  if (customInput) {
    customInput.style.display = providerId === '__custom__' ? '' : 'none';
  }
  if (providerId === '__custom__') {
    if (modelSelect) {
      modelSelect.innerHTML = '<option value="__custom__" selected>' + escHtml(currentLang === 'zh' ? '自定义' : 'Custom...') + '</option>';
    }
    if (modelCustomInput) {
      modelCustomInput.style.display = '';
    }
    return;
  }
  if (envInput && !envInput.value.trim()) {
    envInput.value = guessApiKeyEnvVar(providerId);
  }
  if (modelSelect) {
    const prevValue = modelSelect.value || '';
    modelSelect.innerHTML = getModelOptionsHtml(providerId, prevValue);
    if (modelSelect.value === '__custom__' || !modelSelect.value) {
      const models = getModelsByProvider(providerId);
      if (models.length > 0) modelSelect.value = models[0];
    }
  }
  if (modelCustomInput) {
    modelCustomInput.style.display = 'none';
  }
}

function handleModelChange(selectEl) {
  const row = selectEl.closest('.provider-row');
  if (!row) return;
  const customInput = row.querySelector('.cfg_model_custom');
  if (!customInput) return;
  customInput.style.display = selectEl.value === '__custom__' ? '' : 'none';
}

function addProviderRow() {
  if (!state.selectedProjectId) return;
  const config = state.configByProject[state.selectedProjectId] || {};
  const rows = document.getElementById('cfg_providers_rows')
    ? collectProvidersFromConfigEditor()
    : (Array.isArray(config.providers) ? config.providers.slice() : []);
  const firstCatalog = Array.isArray(state.providerCatalog) && state.providerCatalog.length > 0 ? state.providerCatalog[0] : null;
  rows.push({
    provider: firstCatalog?.id || '',
    modelName: firstCatalog?.defaultModel || '',
    apiKeyEnvVar: firstCatalog?.apiKeyEnvVar || guessApiKeyEnvVar(firstCatalog?.id || ''),
    apiKey: '',
    hasApiKey: false,
  });
  state.configByProject[state.selectedProjectId] = { ...config, providers: rows };
  renderMainPanel(state.selectedProjectId);
}

function removeProviderRow(btn) {
  if (!state.selectedProjectId) return;
  const row = btn.closest('.provider-row');
  if (!row) return;
  const index = Number(row.getAttribute('data-row-index'));
  const config = state.configByProject[state.selectedProjectId] || {};
  const rows = document.getElementById('cfg_providers_rows')
    ? collectProvidersFromConfigEditor()
    : (Array.isArray(config.providers) ? config.providers.slice() : []);
  if (Number.isInteger(index) && index >= 0 && index < rows.length) {
    rows.splice(index, 1);
  }
  state.configByProject[state.selectedProjectId] = { ...config, providers: rows };
  renderMainPanel(state.selectedProjectId);
}

async function ensureProjectConfig(projectPath) {
  if (state.configByProject[projectPath]) return;
  if (state.configLoadingByProject[projectPath]) return;
  state.configLoadingByProject[projectPath] = true;
  state.configLoadErrorByProject[projectPath] = '';
  try {
    const enc = encodeURIComponent(projectPath);
    let data = null;
    try {
      data = await fetchJsonWithTimeout(\`/api/projects/\${enc}/config\`, 6000);
    } catch (firstErr) {
      console.warn('[dashboard] first config fetch failed, retrying', { projectPath, error: String(firstErr) });
      data = await fetchJsonWithTimeout(\`/api/projects/\${enc}/config\`, 12000);
    }
    state.configByProject[projectPath] = data.config || {};
    state.configLoadErrorByProject[projectPath] = '';
    if (state.selectedMainTab === 'config' && state.selectedProjectId === projectPath) {
      renderMainPanel(projectPath);
    }
  } catch (e) {
    const message = String(e);
    console.error('[dashboard] failed to load config', { projectPath, error: message });
    state.configLoadErrorByProject[projectPath] = message;
    if (state.selectedMainTab === 'config' && state.selectedProjectId === projectPath) {
      renderMainPanel(projectPath);
    }
  } finally {
    state.configLoadingByProject[projectPath] = false;
  }
}

async function saveProjectConfig() {
  if (!state.selectedProjectId) return;
  const projectPath = state.selectedProjectId;
  try {
    const providers = collectProvidersFromConfigEditor();
    const payload = {
      config: {
        autoOptimize: document.getElementById('cfg_auto_optimize').checked,
        userConfirm: document.getElementById('cfg_user_confirm').checked,
        runtimeSync: document.getElementById('cfg_runtime_sync').checked,
        providers,
      },
    };
    const enc = encodeURIComponent(projectPath);
    await fetchJsonWithTimeout(\`/api/projects/\${enc}/config\`, 8000, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    state.configByProject[projectPath] = {
      ...payload.config,
      providers: sanitizeProvidersForState(payload.config.providers),
    };
    setConfigUi(projectPath, { saveHint: t('configSaved') });
    await ensureProviderHealth(projectPath, true);
    renderMainPanel(projectPath);
  } catch (e) {
    console.error('[dashboard] failed to save config', { error: String(e) });
    setConfigUi(projectPath, { saveHint: t('configSaveFailed') + ': ' + String(e) });
    renderMainPanel(projectPath);
  }
}

function renderConnectivityResultsHtml(results) {
  const title = '<div class="config-connectivity-title">' + t('configConnectivityTitle') + '</div>';
  if (!Array.isArray(results) || results.length === 0) {
    return title + '<div class="config-help">No providers</div>';
  }
  const rows = results.map((r) => {
    const statusClass = r.ok ? 'conn-ok' : 'conn-fail';
    const statusText = r.ok ? 'OK' : 'FAIL';
    return '<div class="config-connectivity-item">' +
      '<span class="' + statusClass + '">[' + statusText + ']</span> ' +
      escHtml(r.provider + ' / ' + r.modelName) +
      ' (' + String(r.durationMs || 0) + 'ms)' +
      '<div class="config-help">' + escHtml(r.message || '') + '</div>' +
      '</div>';
  }).join('');
  return title + rows;
}

async function checkProvidersConnectivity() {
  if (!state.selectedProjectId) return;
  const projectPath = state.selectedProjectId;
  const btn = document.getElementById('cfg_check_btn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = t('configConnectivityChecking');
  }
  setConfigUi(projectPath, {
    saveHint: currentLang === 'zh' ? '连通性检查中...' : 'Checking connectivity...',
  });
  renderMainPanel(projectPath);
  try {
    const providers = collectProvidersFromConfigEditor();
    const enc = encodeURIComponent(projectPath);
    const data = await fetchJsonWithTimeout('/api/projects/' + enc + '/config/providers/connectivity', 15000, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providers }),
    });
    state.configByProject[projectPath] = {
      ...(state.configByProject[projectPath] || {}),
      providers: sanitizeProvidersForState(providers),
    };
    setConfigUi(projectPath, {
      connectivityResults: data.results || [],
      saveHint: currentLang === 'zh' ? '连通性检查完成' : 'Connectivity check completed',
    });
    await ensureProviderHealth(projectPath, true);
    renderMainPanel(projectPath);
  } catch (e) {
    setConfigUi(projectPath, {
      connectivityResults: [{ ok: false, provider: 'n/a', modelName: 'n/a', durationMs: 0, message: String(e) }],
      saveHint: currentLang === 'zh' ? ('连通性检查失败: ' + String(e)) : ('Connectivity check failed: ' + String(e)),
    });
    renderMainPanel(projectPath);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = t('configCheckConnectivity');
    }
  }
}

function renderStateBadge(state) {
  const stateMap = {idle:'state-idle',analyzing:'state-analyzing',optimizing:'state-optimizing',error:'state-error'};
  const dotMap = {idle:'dot-green',analyzing:'dot-blue',optimizing:'dot-yellow',error:'dot-red'};
  const cls = stateMap[state] || 'state-idle';
  const stateText = {idle:t('stateIdle'),analyzing:t('stateAnalyzing'),optimizing:t('stateOptimizing'),error:t('stateError')}[state] || t('stateIdle');
  return \`<span class="state-badge \${cls}">\${stateText}</span>\`;
}

function selectRuntimeTab(runtime) {
  state.selectedRuntimeTab = runtime;
  updateSkillsList();
}

function handleSearch(query) {
  state.searchQuery = query.toLowerCase().trim();
  updateSkillsList();
}

function toggleSort(sortBy) {
  if (state.sortBy === sortBy) {
    state.sortOrder = state.sortOrder === 'asc' ? 'desc' : 'asc';
  } else {
    state.sortBy = sortBy;
    state.sortOrder = 'asc';
  }
  updateSkillsList();
}

function updateSkillsList() {
  const container = document.getElementById('skillsListContainer');
  const countEl = document.getElementById('skillsCount');
  if (!container || !state.selectedProjectId) return;
  
  const pd = state.projectData[state.selectedProjectId];
  if (!pd) return;
  
  const skills = pd.skills || [];
  const filtered = getFilteredAndSortedSkills(skills);
  
  if (countEl) {
    countEl.textContent = filtered.length + ' ' + t('skillsCount');
  }
  
  container.innerHTML = filtered.length === 0
    ? '<div class="empty-state">' + (state.searchQuery ? 'No skills found matching "' + escHtml(state.searchQuery) + '"' : t('skillsEmpty')) + '</div>'
    : '<div class="skills-list">' + filtered.map(s => renderSkillCard(s, state.selectedProjectId)).join('') + '</div>';
}

function getFilteredSkills(skills) {
  if (state.selectedRuntimeTab === 'all') {
    return skills;
  }
  return skills.filter(s => (s.runtime || 'codex') === state.selectedRuntimeTab);
}

function getFilteredAndSortedSkills(skills) {
  let filtered = getFilteredSkills(skills);
  
  if (state.searchQuery) {
    filtered = filtered.filter(s => {
      const skillId = (s.skillId || '').toLowerCase();
      const status = (s.status || '').toLowerCase();
      const runtime = (s.runtime || 'codex').toLowerCase();
      return skillId.includes(state.searchQuery) || 
             status.includes(state.searchQuery) || 
             runtime.includes(state.searchQuery);
    });
  }
  
  filtered.sort((a, b) => {
    let comparison = 0;
    if (state.sortBy === 'name') {
      comparison = (a.skillId || '').localeCompare(b.skillId || '');
    } else if (state.sortBy === 'updated') {
      const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      comparison = aTime - bTime;
    }
    return state.sortOrder === 'asc' ? comparison : -comparison;
  });
  
  return filtered;
}

function highlightText(text, query) {
  if (!query || !text) return escHtml(text || '');
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerText.indexOf(lowerQuery);
  if (index === -1) return escHtml(text);
  const before = text.slice(0, index);
  const match = text.slice(index, index + query.length);
  const after = text.slice(index + query.length);
  return escHtml(before) + '<span class="highlight">' + escHtml(match) + '</span>' + escHtml(after);
}

function renderSkillCard(skill, projectPath) {
  const statusCls = 'status-' + (skill.status || 'pending');
  const versions = skill.versionsAvailable?.length ?? 0;
  const runtime = skill.runtime || 'codex';
  const highlightedName = highlightText(skill.skillId, state.searchQuery);
  return \`<div class="skill-card" onclick="viewSkill('\${escJsStr(projectPath)}','\${escJsStr(skill.skillId)}','\${escJsStr(runtime)}')">
    <div class="skill-top">
      <div class="skill-name">
        <span class="status-badge \${statusCls}">\${skill.status ?? 'pending'}</span>
        <span>\${highlightedName}</span>
      </div>
      <div class="skill-actions">
        \${versions > 0 ? \`<button class="btn-sm" onclick="viewSkill('\${escJsStr(projectPath)}','\${escJsStr(skill.skillId)}','\${escJsStr(runtime)}');event.stopPropagation()">\${t('skillHistory')} (\${versions})</button>\` : ''}
      </div>
    </div>
    <div class="skill-meta">
      <span>v\${skill.current_revision ?? skill.version ?? 1}</span>
      <span>\${runtime}</span>
      <span>\${skill.traceCount ?? 0} \${t('skillTraces')}</span>
      \${skill.analysisResult?.confidence !== undefined ? \`<span>\${t('skillConfidence')}: \${(skill.analysisResult.confidence * 100).toFixed(0)}%</span>\` : ''}
      \${skill.updatedAt ? \`<span>\${timeAgo(skill.updatedAt)}</span>\` : ''}
    </div>
  </div>\`;
}

function renderTraceBars(label, data, keys) {
  const total = Object.values(data).reduce((a, b) => a + b, 0);
  if (total === 0) return '';
  return \`<div style="margin-bottom:10px">
    <div style="font-size:10px;color:var(--muted);margin-bottom:6px">\${label}</div>
    \${keys.filter(k => data[k]).map(k => {
      const pct = Math.round((data[k] / total) * 100);
      return \`<div class="bar-row">
        <span class="bar-label">\${k}</span>
        <div class="bar-track"><div class="bar-fill bar-\${k}" style="width:\${pct}%"></div></div>
        <span class="bar-count">\${data[k]}</span>
      </div>\`;
    }).join('')}
  </div>\`;
}

function renderRecentTraces(traces) {
  if (!traces.length) return '';
  return \`<table class="trace-table">
    <thead><tr><th>\${t('traceTime')}</th><th>\${t('traceRuntime')}</th><th>\${t('traceEvent')}</th><th>\${t('traceStatus')}</th><th>\${t('traceSession')}</th><th>Trace ID</th></tr></thead>
    <tbody>\${traces.map(t => \`<tr>
      <td style="color:var(--muted)">\${t.timestamp ? t.timestamp.slice(11,19) : '—'}</td>
      <td>\${t.runtime}</td>
      <td>\${t.event_type}</td>
      <td style="color:\${t.status==='success'?'var(--green)':t.status==='failure'?'var(--red)':'var(--yellow)'}">\${t.status}</td>
      <td style="color:var(--muted)">\${t.session_id?.slice(0,8) ?? '—'}</td>
      <td style="color:var(--muted)">\${t.trace_id?.slice(0,8) ?? '—'}</td>
    </tr>\`).join('')}</tbody>
  </table>\`;
}

// ─── Skill Modal ──────────────────────────────────────────────────────────────
async function viewSkill(projectPath, skillId, runtime = 'codex') {
  state.currentSkillId = skillId;
  state.currentSkillRuntime = runtime;
  const modal = document.getElementById('skillModal');
  modal.classList.add('visible');
  document.getElementById('modalSkillName').textContent = \`\${skillId} (\${runtime})\`;
  document.getElementById('modalSaveHint').textContent = '';
  document.getElementById('modalSaveBtn').disabled = false;

  // Look up skill in state
  const pd = state.projectData[projectPath];
  const skill = pd?.skills?.find(s => s.skillId === skillId && (s.runtime || 'codex') === runtime);
  if (skill) {
    document.getElementById('modalSkillStatus').innerHTML =
      \`<span class="status-badge status-\${skill.status}">\${skill.status}</span>\`;
  }

  // Load content
  document.getElementById('modalContent').value = t('modalLoading');
  try {
    const enc = encodeURIComponent(projectPath);
    const r = await fetch(\`/api/projects/\${enc}/skills/\${encodeURIComponent(skillId)}?runtime=\${encodeURIComponent(runtime)}\`);
    if (!r.ok) {
      throw new Error(\`HTTP \${r.status}: \${r.statusText}\`);
    }
    const data = await r.json();
    document.getElementById('modalContent').value = data.content ?? t('modalNoContent');

    // Render version history
    const versionList = document.getElementById('versionList');
    const versions = data.versions ?? [];
    if (versions.length === 0) {
      versionList.innerHTML = '<div style="font-size:11px;color:var(--muted)">' + t('modalNoVersions') + '</div>';
    } else {
      versionList.innerHTML = versions.slice().reverse().map(v => {
        const isCurrent = v === Math.max(...versions);
        return \`<div class="version-item \${isCurrent?'current':''}" onclick="loadVersion('\${enc}','\${encodeURIComponent(skillId)}','\${encodeURIComponent(runtime)}',\${v})">
          <div class="version-num">v\${v} \${isCurrent ? '(' + t('modalCurrent') + ')':''}</div>
          <div id="vmeta_\${v}" class="version-meta">\${t('modalClickToLoad')}</div>
        </div>\`;
      }).join('');
      // Auto-load current version metadata
      if (versions.length > 0) loadVersionMeta(enc, encodeURIComponent(skillId), encodeURIComponent(runtime), Math.max(...versions));
    }
  } catch (e) {
    console.error('[dashboard] failed to load skill content', { projectPath, skillId, runtime, error: String(e) });
    document.getElementById('modalContent').value = 'Error loading skill content.';
  }
}

async function loadVersionMeta(encProject, encSkill, encRuntime, version) {
  try {
    const r = await fetch(\`/api/projects/\${encProject}/skills/\${encSkill}/versions/\${version}?runtime=\${encRuntime}\`);
    if (!r.ok) return;
    const data = await r.json();
    const el = document.getElementById(\`vmeta_\${version}\`);
    if (el && data.metadata) {
      const m = data.metadata;
      el.innerHTML = \`<span>\${m.createdAt?.slice(0,10) ?? ''}</span>
        \${m.reason ? \`<br><span class="version-change">\${escHtml(m.reason.slice(0,40))}</span>\` : ''}\`;
    }
  } catch (e) {
    console.warn('[dashboard] failed to load version metadata', { encProject, encSkill, version, error: String(e) });
  }
}

async function loadVersion(encProject, encSkill, encRuntime, version) {
  try {
    const r = await fetch(\`/api/projects/\${encProject}/skills/\${encSkill}/versions/\${version}?runtime=\${encRuntime}\`);
    if (!r.ok) {
      throw new Error(\`HTTP \${r.status}: \${r.statusText}\`);
    }
    const data = await r.json();
    document.getElementById('modalContent').value = data.content ?? t('modalNoContent');
    await loadVersionMeta(encProject, encSkill, encRuntime, version);
  } catch (e) {
    console.error('[dashboard] failed to load version content', { encProject, encSkill, version, error: String(e) });
  }
}

async function saveCurrentSkill() {
  if (!state.selectedProjectId || !state.currentSkillId) return;

  const saveBtn = document.getElementById('modalSaveBtn');
  const hintEl = document.getElementById('modalSaveHint');
  const contentEl = document.getElementById('modalContent');
  const content = contentEl?.value ?? '';
  const runtime = state.currentSkillRuntime || 'codex';

  saveBtn.disabled = true;
  hintEl.textContent = currentLang === 'zh' ? '保存中...' : 'Saving...';

  try {
    const encProject = encodeURIComponent(state.selectedProjectId);
    const encSkill = encodeURIComponent(state.currentSkillId);
    const r = await fetch(\`/api/projects/\${encProject}/skills/\${encSkill}?runtime=\${encodeURIComponent(runtime)}\`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content,
        runtime,
        reason: 'Manual edit from dashboard',
      }),
    });
    if (!r.ok) {
      throw new Error(\`HTTP \${r.status}: \${r.statusText}\`);
    }
    const data = await r.json();
    hintEl.textContent = data.unchanged
      ? (currentLang === 'zh' ? '内容未变化' : 'No changes detected')
      : (currentLang === 'zh' ? \`保存成功，已创建 v\${data.version}\` : \`Saved. Created v\${data.version}\`);

    const sr = await fetch(\`/api/projects/\${encProject}/snapshot\`);
    if (sr.ok) {
      state.projectData[state.selectedProjectId] = await sr.json();
      if (state.selectedMainTab === 'skills') updateSkillsList();
    }
    await viewSkill(state.selectedProjectId, state.currentSkillId, runtime);
  } catch (e) {
    console.error('[dashboard] failed to save skill content', {
      projectPath: state.selectedProjectId,
      skillId: state.currentSkillId,
      runtime,
      error: String(e),
    });
    hintEl.textContent = currentLang === 'zh' ? '保存失败' : 'Save failed';
  } finally {
    saveBtn.disabled = false;
  }
}

function closeModal() {
  document.getElementById('skillModal').classList.remove('visible');
}
// Close modal on overlay click
document.getElementById('skillModal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeModal();
});

// ─── Logs ─────────────────────────────────────────────────────────────────────
function renderLogs() {
  const filter = state.logFilter;
  const list = document.getElementById('logList');
  if (!list) return;
  const entries = filter === 'ALL' ? state.allLogs : state.allLogs.filter(l => l.level === filter);
  const MAX = 300;
  const visible = entries.slice(-MAX);

  if (visible.length === 0) {
    list.innerHTML = '<div class="empty-state">' + t('logsEmpty') + '</div>';
    return;
  }

  list.innerHTML = visible.map(l => \`<div class="log-entry">
    <span class="log-ts">\${l.timestamp?.slice(11,19) ?? ''}</span>
    <span class="log-level level-\${l.level}">\${l.level}</span>
    \${l.context ? \`<span class="log-ctx">[\${escHtml(l.context)}]</span>\` : ''}
    <span class="log-msg">\${escHtml(l.message)}</span>
  </div>\`).join('');

  // Auto-scroll to bottom
  list.scrollTop = list.scrollHeight;
}

function filterLogs() {
  state.logFilter = document.getElementById('logFilter').value;
  renderLogs();
}

// ─── Add Project Form ─────────────────────────────────────────────────────────
function toggleAddForm() {
  const form = document.getElementById('addForm');
  form.classList.toggle('visible');
  if (form.classList.contains('visible')) {
    document.getElementById('addPathInput').focus();
  }
}

document.getElementById('addPathInput').addEventListener('keydown', async (e) => {
  if (e.key !== 'Enter') return;
  const path = e.target.value.trim();
  if (!path) return;
  try {
    const r = await fetch('/api/projects', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({path}) });
    const data = await r.json();
    if (data.ok) {
      state.projects = data.projects;
      renderSidebar();
      e.target.value = '';
      document.getElementById('addForm').classList.remove('visible');
      selectProject(path);
    } else {
      e.target.style.borderColor = 'var(--red)';
      setTimeout(() => { e.target.style.borderColor = ''; }, 1500);
    }
  } catch {}
});

// ─── Utilities ────────────────────────────────────────────────────────────────
function escHtml(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function escJsStr(s) {
  // 使用 JSON.stringify 统一处理引号、反斜杠与换行转义，再去掉外层双引号
  return JSON.stringify(String(s ?? '')).slice(1, -1);
}

function formatUptime(startedAt) {
  const diff = Date.now() - new Date(startedAt).getTime();
  if (isNaN(diff) || diff < 0) return '—';
  const s = Math.floor(diff/1000), m = Math.floor(s/60), h = Math.floor(m/60), d = Math.floor(h/24);
  if (d > 0) return d + t('uptimeDays') + ' ' + (h%24) + t('uptimeHours');
  if (h > 0) return h + t('uptimeHours') + ' ' + (m%60) + t('uptimeMinutes');
  if (m > 0) return m + t('uptimeMinutes') + ' ' + (s%60) + t('uptimeSeconds');
  return s + t('uptimeSeconds');
}

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  if (isNaN(diff)) return '—';
  const s = Math.floor(diff/1000), m = Math.floor(s/60), h = Math.floor(m/60), d = Math.floor(h/24);
  if (d > 0) return d + t('timeDays') + ' ' + t('timeAgo');
  if (h > 0) return h + t('timeHours') + ' ' + t('timeAgo');
  if (m > 0) return m + t('timeMinutes') + ' ' + t('timeAgo');
  return t('timeJustNow');
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
init();
</script>
</body>
</html>`;
}
