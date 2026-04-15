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
    max-width: 30ch;
    font-size: 11px;
    line-height: 1.6;
    color: var(--text);
  }
  .cost-hero-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 14px;
  }
  .cost-hero-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 9px;
    border-radius: 999px;
    border: 1px solid rgba(88,166,255,.2);
    background: rgba(15,23,30,.72);
    color: var(--text);
    font-size: 10px;
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

<div class="modal-overlay" id="eventModal">
  <div class="modal">
    <div class="modal-header">
      <div class="modal-title">
        <span id="eventModalTitle">${t.activityDetailTitle}</span>
      </div>
      <button class="modal-close" onclick="closeEventModal()">✕ ${t.modalClose}</button>
    </div>
    <div class="modal-body" style="grid-template-columns: 1fr;">
      <div class="modal-content" style="border-right:none;">
        <pre id="eventModalContent">${t.activityDetailEmpty}</pre>
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

async function persistDashboardLanguage(lang, projectPath) {
  if (!projectPath) return;
  try {
    await fetchJsonWithTimeout('/api/lang', 5000, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lang: lang === 'zh' ? 'zh' : 'en',
        projectPath,
      }),
    });
  } catch (error) {
    console.warn('[dashboard] failed to persist dashboard language', {
      lang,
      projectPath,
      error: String(error),
    });
  }
}

async function switchLang(lang) {
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
  document.querySelectorAll('.modal-close').forEach((el) => {
    el.textContent = '✕ ' + t('modalClose');
  });
  const modalHistoryTitleEl = document.querySelector('.modal-history h4');
  if (modalHistoryTitleEl) modalHistoryTitleEl.textContent = t('modalVersionHistory');
  const eventModalTitleEl = document.getElementById('eventModalTitle');
  if (eventModalTitleEl) eventModalTitleEl.textContent = t('activityDetailTitle');
  // Re-render dynamic content
  renderSidebar();
  if (state.selectedProjectId) safeRenderMainPanel(state.selectedProjectId, 'updateLanguageUI');
  renderLogs();
  await persistDashboardLanguage(currentLang, state.selectedProjectId);
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
  activityTagFilter: 'core_flow',
  activityRowsByProject: {},
  rawActivityRowsByProject: {},
  activityColumnWidths: loadSavedActivityColumnWidths(),
  lastCopiedActivityText: '',
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
let configAutoSaveTimer = null;
let configAutoSaveInFlight = false;
let configAutoSaveQueued = false;

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
  const href =
    (typeof location !== 'undefined' && location && location.href) ||
    (typeof window !== 'undefined' && window.location && window.location.href) ||
    '';
  const item = {
    message: String(event.message || '').slice(0, 1000),
    stack: String(event.stack || '').slice(0, 4000),
    source: String(event.source || '').slice(0, 1000),
    lineno: Number(event.lineno || 0) || undefined,
    colno: Number(event.colno || 0) || undefined,
    href: String(href).slice(0, 1000),
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
      el.textContent = t('runtimeBuildMismatchPrefix') + ' ui#' + DASHBOARD_BUILD_SHORT + ' / svr#' + runtimeBuildShort;
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
    el.textContent = 'build #' + DASHBOARD_BUILD_SHORT + ' (' + t('runtimeHostUnavailable') + ')';
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
      safeRenderMainPanel(state.selectedProjectId, 'handleUpdate');
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
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timed out after ' + timeoutMs + 'ms');
    }
    throw error;
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
    apiKey: provider.apiKey || '',
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
      projectListEl.innerHTML = '<div class="empty-state" style="color:var(--red)">' + t('initProjectsLoadFailed') + '</div>';
    }
    const mainPanelEl = document.getElementById('mainPanel');
    if (mainPanelEl) {
      mainPanelEl.innerHTML = '<div class="panel-inner"><div class="no-project" style="color:var(--yellow)">' + t('initRecoveryWaiting') + '</div></div>';
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
  await persistDashboardLanguage(currentLang, path);
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
        decisionEvents: [],
        agentUsage: {
          callCount: 0,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          byModel: {},
          byScope: {},
        },
      };
    }
  }
  safeRenderMainPanel(path, 'selectProject');
  renderSidebar();
}

function ensureConfigTabDependencies(projectPath) {
  if (!projectPath) return;
  if (state.providerCatalog.length === 0 && !state.providerCatalogLoading) {
    void loadProviderCatalog(true);
  }
  if (!state.providerHealthByProject[projectPath]) {
    void ensureProviderHealth(projectPath)
      .then(() => {
        if (state.selectedProjectId === projectPath && state.selectedMainTab === 'config') {
          safeRenderMainPanel(projectPath, 'ensureProviderHealth');
        }
      })
      .catch(() => {
        // ensureProviderHealth already degrades internally
      });
  }
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
    return t('configProviderAlertNotConfigured');
  }
  if (code === 'provider_connectivity_failed') {
    return t('configProviderAlertConnectivityFailed');
  }
  return t('configProviderAlertWarning');
}

function renderProviderAlert(projectPath) {
  const health = state.providerHealthByProject[projectPath];
  if (!health || health.level !== 'warn') return '';

  let message = health.message || '';
  if (health.code === 'provider_not_configured') {
    message = t('configProviderAlertNotConfiguredMessage');
  } else if (health.code === 'provider_connectivity_failed' && Array.isArray(health.results) && health.results.length > 0) {
    const failed = health.results.filter((item) => !item.ok);
    const failedText = failed.slice(0, 3).map((item) => item.provider + '/' + item.modelName).join(', ');
    message = t('configProviderAlertConnectivityFailedPrefix') + ' ' + failedText;
  }

  return '<div class="provider-alert">' +
    '<span class="provider-alert-dot"></span>' +
    '<div>' +
      '<div class="provider-alert-title">⚠ ' + escHtml(providerAlertTitle(health.code)) + '</div>' +
      '<div class="provider-alert-message">' + escHtml(message) + '</div>' +
      '<div class="provider-alert-hint">' + t('configProviderAlertHint') + '</div>' +
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

function updateBusinessEvents() {}

function businessEventLabel(tag) {
  const map = {
    all: t('activityTagAll'),
    core_flow: t('activityTagCoreFlow'),
    stability_feedback: t('activityTagStabilityFeedback'),
    skill_observed: t('activityTagSkillObserved'),
    analysis_started: t('activityTagAnalysisStarted'),
    analysis_interrupted: t('activityTagAnalysisInterrupted'),
    analysis_waiting_more_context: t('activityTagAnalysisWaiting'),
    analysis_concluded: t('activityTagAnalysisConcluded'),
    optimization_skipped: t('activityTagOptimizationSkipped'),
    optimization_applied: t('activityTagOptimizationApplied'),
    skill_called: t('activityTagSkillCalled'),
    skill_monitoring_started: t('activityTagSkillAdded'),
    skill_removed: t('activityTagSkillRemoved'),
    skill_edited: t('activityTagSkillEdited'),
    skill_version_iterated: t('activityTagSkillVersion'),
    daemon_state: t('activityTagDaemon'),
    optimization_state: t('activityTagOptimization'),
    evaluation_result: t('activityTagEvaluationResult'),
    skill_feedback: t('activityTagSkillFeedback'),
    patch_applied: t('activityTagPatchApplied'),
    analysis_failed: t('activityTagAnalysisFailed'),
    analysis_requested: t('activityTagAnalysisSubmitted'),
    episode_probe_result: t('activityTagProbeResult'),
    episode_probe_requested: t('activityTagProbeSubmitted'),
  };
  return map[tag] || tag;
}

function businessCategoryForTag(tag) {
  if (tag === 'analysis_failed') return 'stability_feedback';
  return 'core_flow';
}

function formatPatchSummary(e) {
  const parts = [];
  if (e.changeType) parts.push(String(e.changeType));
  const linesAdded = Number(e.linesAdded || 0);
  const linesRemoved = Number(e.linesRemoved || 0);
  if (linesAdded || linesRemoved) parts.push('+' + linesAdded + '/-' + linesRemoved);
  return parts.join(' · ');
}

function formatBusinessEvent(e) {
  switch (e.tag) {
    case 'analysis_started':
      return normalizeActivityNarrative('analysis_started', e.rawStatus || e.status, e.detail)
        || t('activitySummaryAnalysisStarted');
    case 'analysis_interrupted':
      return normalizeActivityNarrative('analysis_interrupted', e.rawStatus || e.status, e.detail)
        || t('activitySummaryAnalysisInterrupted');
    case 'analysis_waiting_more_context':
      return normalizeActivityNarrative('analysis_waiting_more_context', e.rawStatus || e.status, e.detail)
        || t('activitySummaryAnalysisWaiting');
    case 'analysis_concluded':
      return normalizeActivityNarrative('analysis_concluded', e.rawStatus || e.status, e.detail)
        || t('activitySummaryAnalysisConcluded');
    case 'optimization_skipped':
      return normalizeActivityNarrative('optimization_skipped', e.rawStatus || e.status, e.detail)
        || t('activitySummaryOptimizationSkipped');
    case 'optimization_applied': {
      const patchSummary = formatPatchSummary(e);
      return patchSummary
        ? t('activitySummaryOptimizationApplied') + ': ' + patchSummary
        : t('activitySummaryOptimizationApplied');
    }
    case 'skill_called':
      return t('activitySummarySkillCalled') + ': ' + (e.skillId || 'unknown');
    case 'skill_monitoring_started':
      return t('activitySummarySkillAdded') + ': ' + (e.skillId || 'unknown');
    case 'skill_removed':
      return t('activitySummarySkillRemoved') + ': ' + (e.skillId || 'unknown');
    case 'skill_edited':
      return t('activitySummarySkillEdited') + ': ' + (e.skillId || 'unknown');
    case 'skill_version_iterated':
      return t('activitySummarySkillVersion') + (e.skillId ? ': ' + e.skillId : '');
    case 'daemon_state':
      return e.status === 'started'
        ? t('activitySummaryDaemonStarted')
        : t('activitySummaryDaemonStopped');
    case 'optimization_state':
      return t('activitySummaryOptimizationChanged') + ': ' + (e.status || 'idle');
    case 'evaluation_result':
      return t('activitySummaryEvaluationResult') + ': ' + normalizeActivityNarrative(
        normalizeDecisionTag(e) || e.tag,
        e.rawStatus || e.status,
        e.detail || e.reason || ''
      );
    case 'skill_feedback':
      return t('activitySummarySkillFeedback') + ': ' + normalizeActivityNarrative(
        normalizeDecisionTag(e) || e.tag,
        e.rawStatus || e.status,
        e.detail || e.reason || ''
      );
    case 'patch_applied':
      return formatPatchSummary(e)
        ? t('activitySummaryPatchApplied') + ': ' + formatPatchSummary(e)
        : t('activitySummaryPatchApplied');
    case 'analysis_failed':
      return t('activitySummaryAnalysisFailed') + ': ' + normalizeActivityNarrative(
        'analysis_failed',
        e.rawStatus || e.status,
        e.detail || e.reason || ''
      );
    case 'analysis_requested':
      return t('activitySummaryAnalysisSubmitted');
    case 'episode_probe_result':
      return t('activitySummaryProbeResult') + ': ' + (e.status || '');
    case 'episode_probe_requested':
      return t('activitySummaryProbeSubmitted');
    default:
      return e.tag;
  }
}

function normalizeDecisionTag(event) {
  if (event?.businessTag) return event.businessTag;
  const tag = event?.tag;
  const status = event?.status;
  if (!tag) return null;
  if (
    tag === 'skill_mapping' ||
    tag === 'skill_mapped' ||
    tag === 'skill_mapping_result' ||
    tag === 'skill_monitoring_started' ||
    tag === 'skill_removed' ||
    tag === 'skill_edited' ||
    tag === 'skill_version_iterated' ||
    tag === 'episode_probe_result' ||
    tag === 'episode_probe_requested' ||
    tag === 'skill_feedback'
  ) {
    return null;
  }
  if (tag === 'analysis_requested') return 'analysis_started';
  if (tag === 'patch_applied') return 'optimization_applied';
  if (tag === 'analysis_failed') return 'analysis_failed';
  if (tag === 'evaluation_result' || tag === 'skill_evaluation') {
    if (status === 'continue_collecting') return 'analysis_waiting_more_context';
    if (
      status === 'cooldown' ||
      status === 'daily_limit_reached' ||
      status === 'frozen' ||
      status === 'confidence_too_low'
    ) {
      return 'optimization_skipped';
    }
    return 'analysis_concluded';
  }
  return tag;
}

function getActivityRelationKeys(event) {
  if (!event) return [];
  const keys = [];
  const scopeId = event.windowId || event.scopeId || (event.evidence && typeof event.evidence === 'object' ? event.evidence.windowId : null);
  if (scopeId) keys.push('scope:' + scopeId);
  const traceId = event.traceId || event.trace_id || null;
  if (traceId) keys.push('trace:' + traceId);
  const sessionId = event.sessionId || event.session_id || null;
  const skillId = event.skillId || event.skill_id || null;
  if (sessionId && skillId) keys.push('session-skill:' + sessionId + '::' + skillId);
  return [...new Set(keys)];
}

function collectUniqueText(values) {
  return [...new Set(values.map((value) => (typeof value === 'string' ? value.trim() : '')).filter(Boolean))];
}

const ACTIVITY_CJK_CHAR_RE = /[\u3400-\u9fff]/u;
const ACTIVITY_LATIN_CHAR_RE = /[A-Za-z]/;
const ACTIVITY_LATIN_WORD_RE = /[A-Za-z]{2,}/g;

function countActivityLatinWords(text) {
  return String(text || '').match(ACTIVITY_LATIN_WORD_RE)?.length || 0;
}

function needsActivityNarrativeFallback(text) {
  const normalized = String(text || '').trim();
  if (!normalized || currentLang !== 'zh') return false;
  if (!ACTIVITY_LATIN_CHAR_RE.test(normalized)) return false;
  if (!ACTIVITY_CJK_CHAR_RE.test(normalized)) return true;
  return countActivityLatinWords(normalized) >= 5;
}

function fallbackActivityNarrative(tag, rawStatus) {
  switch (tag) {
    case 'analysis_started':
      return currentLang === 'zh'
        ? '时机探测已通过，开始深度分析本次调用窗口。'
        : 'The readiness probe passed, and the system started deep analysis for this call window.';
    case 'analysis_waiting_more_context':
      return currentLang === 'zh'
        ? '当前窗口证据仍不够完整，系统会继续扩展观察范围后再分析。'
        : 'The current window still lacks enough evidence, so the system will widen the observation scope before analyzing again.';
    case 'analysis_concluded':
      return currentLang === 'zh'
        ? '窗口分析认为当前技能调用符合预期，暂时无需修改。'
        : 'Window analysis concluded that the current skill call is behaving as expected and does not need changes right now.';
    case 'optimization_skipped':
      return currentLang === 'zh'
        ? '这轮分析决定暂不执行优化，当前保持现状。'
        : 'This round decided to skip optimization and keep the current skill unchanged.';
    case 'optimization_applied':
      return currentLang === 'zh'
        ? '系统已经将本轮优化补丁写回技能，并会继续观察后续效果。'
        : 'The system has written the optimization patch back to the skill and will continue validating the outcome.';
    case 'analysis_interrupted':
      return currentLang === 'zh'
        ? '这轮分析在形成业务结论前被中断，需要先恢复分析链路。'
        : 'This analysis round was interrupted before it could reach a business conclusion and the analysis path needs attention first.';
    case 'analysis_failed':
      return currentLang === 'zh'
        ? '分析链路执行失败，本轮没有生成可用结论。'
        : 'The analysis pipeline failed and did not produce a usable conclusion.';
    case 'skill_called':
      return currentLang === 'zh'
        ? '系统记录到一次技能调用。'
        : 'The system recorded a skill invocation.';
    default:
      if (rawStatus === 'continue_collecting') {
        return currentLang === 'zh'
          ? '当前窗口证据仍不够完整，系统会继续扩展观察范围后再分析。'
          : 'The current window still lacks enough evidence, so the system will widen the observation scope before analyzing again.';
      }
      if (
        rawStatus === 'cooldown' ||
        rawStatus === 'daily_limit_reached' ||
        rawStatus === 'frozen' ||
        rawStatus === 'confidence_too_low'
      ) {
        return currentLang === 'zh'
          ? '当前判断是暂不执行优化，先继续保持现状。'
          : 'The current decision is to skip optimization for now and keep the skill unchanged.';
      }
      if (rawStatus === 'no_patch_needed') {
        return currentLang === 'zh'
          ? '窗口分析认为当前技能调用符合预期，暂时无需修改。'
          : 'Window analysis concluded that the current skill call is behaving as expected and does not need changes right now.';
      }
      return '';
  }
}

function normalizeActivityNarrative(tag, rawStatus, value) {
  const candidate = typeof value === 'string' ? value.trim() : '';
  const fallback = fallbackActivityNarrative(tag, rawStatus);
  if (!candidate) return fallback;
  return needsActivityNarrativeFallback(candidate) ? (fallback || candidate) : candidate;
}

function mergeBusinessDetail(primary, supportingValues) {
  const parts = collectUniqueText([primary].concat(Array.isArray(supportingValues) ? supportingValues : [supportingValues]));
  return parts.join('\\n');
}

function shouldMergeSupportingDetailIntoRow(tag, category) {
  if (category === 'stability_feedback') return false;
  return (
    tag === 'analysis_concluded' ||
    tag === 'analysis_waiting_more_context' ||
    tag === 'optimization_skipped' ||
    tag === 'optimization_applied'
  );
}

function getActivityScopeId(event) {
  if (!event) return null;
  if (event.windowId) return event.windowId;
  if (event.evidence && typeof event.evidence === 'object' && event.evidence.windowId) return event.evidence.windowId;
  return null;
}

function describeAnalysisFailure(row) {
  const technical = [
    row && (row.rawReason || row.reason),
    row && (row.rawDetail || row.detail),
    row && row.evidence && typeof row.evidence === 'object' ? row.evidence.rawEvidence : null,
  ]
    .filter((item, index, list) => item && list.indexOf(item) === index)
    .join(' | ');
  const haystack = technical.toLowerCase();
  const isZh = currentLang === 'zh';

  if (haystack.includes('provider_not_configured')) {
    return {
      summary: isZh
        ? '当前项目没有可用的模型服务配置，所以这轮分析没有开始。'
        : 'This analysis did not start because no model provider is configured for the project.',
      impact: isZh
        ? '这属于配置缺失，不代表 skill 本身已经确认有问题。'
        : 'This is a configuration gap, not confirmed evidence that the skill itself is wrong.',
      action: isZh
        ? '请先在 Config 页面补充 provider、API Key，并完成连通性检查。'
        : 'Configure a provider, add an API key, and verify connectivity in Config first.',
      technical,
    };
  }

  if (haystack.includes('invalid_analysis_json')) {
    return {
      summary: isZh
        ? '模型返回了内容，但格式不符合系统要求，所以这轮分析结果无法解析。'
        : 'The model replied, but the response did not match the required format, so the analysis result could not be parsed.',
      impact: isZh
        ? '这更像是分析链路的输出格式异常，不代表 skill 本身已经确认有问题。'
        : 'This points to an analysis pipeline formatting issue, not confirmed evidence that the skill is faulty.',
      action: isZh
        ? '建议保留这次原始返回并继续观察；如果连续出现，优先检查结构化输出协议。'
        : 'Keep the raw response for inspection and monitor recurrence; if it repeats, check the structured output protocol first.',
      technical,
    };
  }

  if (haystack.includes('empty content in llm response') || haystack.includes('empty_llm_response')) {
    return {
      summary: isZh
        ? '模型接口返回了空内容，所以这轮分析没有拿到可用结果。'
        : 'The model API returned empty content, so this analysis produced no usable result.',
      impact: isZh
        ? '这通常是模型服务瞬时异常或响应被截断，不代表 skill 本身已经确认有问题。'
        : 'This usually indicates a transient provider issue or truncated response, not confirmed evidence against the skill.',
      action: isZh
        ? '建议优先观察 provider 稳定性，并检查是否存在超时、重试或响应截断。'
        : 'Check provider stability first, including timeout, retry, and truncation behavior.',
      technical,
    };
  }

  if (haystack.includes('llm api error:')) {
    return {
      summary: isZh
        ? '模型服务调用失败，所以这轮分析没有完成。'
        : 'The model provider request failed, so this analysis did not complete.',
      impact: isZh
        ? '这属于外部服务异常，不代表 skill 本身已经确认有问题。'
        : 'This is an external service failure, not confirmed evidence that the skill is faulty.',
      action: isZh
        ? '建议先检查 provider 连通性、鉴权和限流状态。'
        : 'Check provider connectivity, authentication, and rate limits first.',
      technical,
    };
  }

  if (haystack.includes('timeout')) {
    return {
      summary: isZh
        ? '分析请求超时了，所以这轮分析没有完成。'
        : 'The analysis request timed out before a usable result was returned.',
      impact: isZh
        ? '这更像是时延问题，不代表 skill 本身已经确认有问题。'
        : 'This looks like a latency problem, not confirmed evidence that the skill is faulty.',
      action: isZh
        ? '建议检查模型超时配置、分析窗口大小以及 provider 响应速度。'
        : 'Check model timeout settings, analysis window size, and provider latency.',
      technical,
    };
  }

  return {
    summary: isZh
      ? '分析链路在执行过程中发生异常，所以这轮分析没有产出可用结论。'
      : 'The analysis pipeline hit an unexpected error before it could produce a usable conclusion.',
    impact: isZh
      ? '当前只能确认分析没有完成，不能据此直接判定 skill 已有问题。'
      : 'At this point we only know the analysis did not complete; this alone does not prove the skill is faulty.',
    action: isZh
      ? '建议结合原始技术信息继续排查分析链路，而不是直接修改 skill。'
      : 'Investigate the analysis pipeline using the technical detail before changing the skill itself.',
    technical,
  };
}

function describeAnalysisInterruption(row) {
  const failure = describeAnalysisFailure(row);
  const isZh = currentLang === 'zh';
  return {
    summary: isZh
      ? ('本轮分析已中断：' + failure.summary)
      : ('This analysis round was interrupted: ' + failure.summary),
    nextAction: failure.action,
  };
}

function localizeActivityStatus(tag, rawStatus) {
  switch (tag) {
    case 'analysis_started':
      return t('activityStatusAnalyzing');
    case 'analysis_interrupted':
      return t('activityStatusInterrupted');
    case 'analysis_waiting_more_context':
      return t('activityStatusWaiting');
    case 'analysis_concluded':
      return t('activityStatusNoOptimization');
    case 'optimization_skipped':
      return t('activityStatusSkipped');
    case 'optimization_applied':
      return t('activityStatusApplied');
    case 'analysis_failed':
      return t('activityStatusFailed');
    default:
      if (rawStatus === 'failed') return t('activityStatusFailed');
      return rawStatus || t('activityStatusFallback');
  }
}

function formatActivityPreview(row) {
  if (!row) return t('activityDetailFallback');
  if (row.tag === 'analysis_failed') {
    return describeAnalysisFailure(row).summary;
  }
  return row.detail || formatBusinessEvent(row) || t('activityDetailFallback');
}

function loadSavedActivityColumnWidths() {
  try {
    const raw = localStorage.getItem('ornn-dashboard-activity-columns');
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function persistActivityColumnWidths() {
  try {
    localStorage.setItem('ornn-dashboard-activity-columns', JSON.stringify(state.activityColumnWidths || {}));
  } catch {}
}

const DEFAULT_ACTIVITY_TIME_COLUMN_WIDTH = 172;

function getActivityColumnWidth(columnKey, fallbackWidth) {
  const width = Number(state.activityColumnWidths?.[columnKey]);
  if (!Number.isFinite(width) || width <= 0) return fallbackWidth;
  if (columnKey === 'time' && width < fallbackWidth) return fallbackWidth;
  return width;
}

function getActivityColumnStyle(columnKey, fallbackWidth) {
  const width = getActivityColumnWidth(columnKey, fallbackWidth);
  return 'width:' + width + 'px;min-width:' + width + 'px;';
}

function startActivityColumnResize(event, columnKey) {
  if (!event || !columnKey) return;
  if (event.preventDefault) event.preventDefault();
  const startX = event.clientX || 0;
  const startWidth = getActivityColumnWidth(columnKey, 120);

  function handleMove(moveEvent) {
    const delta = (moveEvent.clientX || 0) - startX;
    state.activityColumnWidths[columnKey] = Math.max(72, startWidth + delta);
    if (state.selectedProjectId) safeRenderMainPanel(state.selectedProjectId, 'startActivityColumnResize');
  }

  function handleUp() {
    window.removeEventListener('mousemove', handleMove);
    window.removeEventListener('mouseup', handleUp);
    persistActivityColumnWidths();
  }

  window.addEventListener('mousemove', handleMove);
  window.addEventListener('mouseup', handleUp);
}

function formatEventTimestamp(iso) {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return String(iso) || '—';
  }
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-') + ' ' + [
    String(date.getHours()).padStart(2, '0'),
    String(date.getMinutes()).padStart(2, '0'),
    String(date.getSeconds()).padStart(2, '0'),
  ].join(':');
}

function summarizeTraceEventType(trace) {
  if (!trace) return t('activityDetailFallback');
  if (trace.event_type === 'tool_call') return t('activityTraceToolCall');
  if (trace.event_type === 'tool_result') return t('activityTraceToolResult');
  if (trace.event_type === 'assistant_output') return t('activityTraceAssistantOutput');
  if (trace.event_type === 'user_input') return t('activityTraceUserInput');
  if (trace.event_type === 'file_change') return t('activityTraceFileChange');
  return trace.event_type || t('activityDetailFallback');
}

function buildActivityDetail(row) {
  if (!row) return t('activityDetailEmpty');
  if (row.rawTrace) {
    return buildRawTraceDetail(row);
  }
  if (row.tag === 'analysis_failed') {
    const failure = describeAnalysisFailure(row);
    const lines = [
      t('traceTime') + ': ' + formatEventTimestamp(row.timestamp),
      t('traceRuntime') + ': ' + (row.runtime || t('activityHostFallback')),
      t('traceEvent') + ': ' + businessEventLabel(row.tag),
      t('activitySkillLabel') + ': ' + (row.skillId || '—'),
      t('traceStatus') + ': ' + (row.status || t('activityStatusFallback')),
      t('traceScope') + ': ' + (row.scopeId || t('activityScopeFallback')),
      (currentLang === 'zh' ? '失败原因' : 'Failure Cause') + ': ' + failure.summary,
      (currentLang === 'zh' ? '对结果的影响' : 'Impact') + ': ' + failure.impact,
      (currentLang === 'zh' ? '建议动作' : 'Suggested Action') + ': ' + failure.action,
    ];
    if (failure.technical) {
      lines.push((currentLang === 'zh' ? '原始技术信息' : 'Technical Detail') + ': ' + failure.technical);
    }
    if (row.traceId) lines.push(t('traceId') + ': ' + row.traceId);
    if (row.sessionId) lines.push(t('activitySessionIdLabel') + ': ' + row.sessionId);
    return lines.join('\\n');
  }
  const inputParts = [];
  if (row.inputSummary) inputParts.push(row.inputSummary);
  if (row.sourceLabel) inputParts.push(t('activitySourceLabel') + ': ' + row.sourceLabel);
  if (row.traceId) inputParts.push(t('traceId') + ': ' + row.traceId);
  if (row.sessionId) inputParts.push(t('activitySessionIdLabel') + ': ' + row.sessionId);
  if (row.scopeId) inputParts.push(t('traceScope') + ': ' + row.scopeId);
  let nextStep = row.nextAction || '';
  if (!nextStep) {
    switch (row.tag) {
    case 'analysis_started':
      nextStep = currentLang === 'zh'
        ? '等待这一轮分析返回结果，再决定是继续观察、保持现状还是执行优化。'
        : 'Wait for this analysis round to return before deciding whether to keep observing, stay unchanged, or optimize.';
      break;
    case 'analysis_interrupted':
      nextStep = currentLang === 'zh'
        ? '本轮没有形成业务结论，先排查分析链路或模型服务，再决定是否重新发起分析。'
        : 'This round ended without a business conclusion; investigate the analysis path or model service before retrying.';
      break;
    case 'analysis_waiting_more_context':
      nextStep = currentLang === 'zh'
        ? '本轮不会直接改技能，系统会扩大窗口后再次分析。'
        : 'This round will not change the skill yet; the system will widen the window and analyze again.';
      break;
    case 'analysis_concluded':
    case 'optimization_skipped':
      nextStep = currentLang === 'zh'
        ? '当前保持现状，后续如果出现新的强信号，会重新开启下一轮分析。'
        : 'The current decision is to keep the skill unchanged unless stronger future evidence reopens analysis.';
      break;
    case 'optimization_applied':
      nextStep = currentLang === 'zh'
        ? '补丁已经写回，后续调用会继续验证这次优化是否有效。'
        : 'The patch has been written back, and later calls will validate whether the optimization worked.';
      break;
    default:
      nextStep = currentLang === 'zh'
        ? '继续观察同一技能后续窗口中的变化。'
        : 'Continue observing how this skill behaves in later windows.';
      break;
    }
  }
  const lines = [
    t('traceTime') + ': ' + formatEventTimestamp(row.timestamp),
    t('traceRuntime') + ': ' + (row.runtime || t('activityHostFallback')),
    t('traceEvent') + ': ' + businessEventLabel(row.tag),
    t('activitySkillLabel') + ': ' + (row.skillId || '—'),
    t('traceStatus') + ': ' + (row.status || t('activityStatusFallback')),
    t('traceScope') + ': ' + (row.scopeId || t('activityScopeFallback')),
    t('activityDetailInput') + ': ' + (inputParts.join(' | ') || t('activityDetailFallback')),
    t('activityDetailJudgment') + ': ' + (row.detail || t('activityDetailFallback')),
    t('activityDetailOutput') + ': ' + formatBusinessEvent(row),
    t('activityDetailNextStep') + ': ' + nextStep,
  ];
  return lines.join('\\n');
}

function stringifyRawTraceValue(value) {
  if (value == null) return '—';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function formatRawTracePreview(trace) {
  if (!trace) return t('activityDetailFallback');
  if (trace.event_type === 'tool_call') {
    const name = trace.tool_name || 'unknown_tool';
    const argsText = trace.tool_args ? stringifyRawTraceValue(trace.tool_args) : '';
    return argsText ? (name + ' ' + argsText) : name;
  }
  if (trace.event_type === 'tool_result') return stringifyRawTraceValue(trace.tool_result);
  if (trace.event_type === 'assistant_output') return trace.assistant_output || t('activityDetailFallback');
  if (trace.event_type === 'user_input') return trace.user_input || t('activityDetailFallback');
  if (trace.event_type === 'file_change') {
    return Array.isArray(trace.files_changed) && trace.files_changed.length > 0
      ? trace.files_changed.join(', ')
      : t('activityDetailFallback');
  }
  return stringifyRawTraceValue(trace.metadata || trace.event_type || t('activityDetailFallback'));
}

function buildRawTraceDetail(row) {
  const trace = row && row.rawTrace ? row.rawTrace : null;
  if (!trace) return t('activityDetailEmpty');
  const isZh = currentLang === 'zh';
  const lines = [
    t('traceTime') + ': ' + formatEventTimestamp(trace.timestamp),
    t('traceRuntime') + ': ' + (trace.runtime || t('activityHostFallback')),
    t('traceEvent') + ': ' + summarizeTraceEventType(trace),
    t('traceStatus') + ': ' + (trace.status || t('activityStatusFallback')),
    t('traceScope') + ': ' + (row.scopeId || t('activityScopeFallback')),
    t('traceSession') + ': ' + (trace.session_id || '—'),
    t('traceId') + ': ' + (trace.trace_id || '—'),
  ];
  if (trace.tool_name) lines.push((isZh ? '工具' : 'Tool') + ': ' + trace.tool_name);
  if (trace.tool_args) lines.push((isZh ? '参数' : 'Arguments') + ': ' + stringifyRawTraceValue(trace.tool_args));
  if (trace.tool_result) lines.push((isZh ? '结果' : 'Result') + ': ' + stringifyRawTraceValue(trace.tool_result));
  if (trace.user_input) lines.push((isZh ? '用户输入' : 'User Input') + ': ' + trace.user_input);
  if (trace.assistant_output) lines.push((isZh ? '助手输出' : 'Assistant Output') + ': ' + trace.assistant_output);
  if (Array.isArray(trace.files_changed) && trace.files_changed.length > 0) {
    lines.push((isZh ? '文件变更' : 'Files Changed') + ': ' + trace.files_changed.join(', '));
  }
  if (Array.isArray(trace.skill_refs) && trace.skill_refs.length > 0) {
    lines.push(t('activitySkillLabel') + ': ' + trace.skill_refs.join(', '));
  }
  return lines.join('\\n');
}

function buildActivityRows(projectPath) {
  const pd = state.projectData[projectPath] || {};
  const traces = Array.isArray(pd.recentTraces) ? pd.recentTraces : [];
  const decisionEvents = Array.isArray(pd.decisionEvents) ? pd.decisionEvents : [];
  const knownSkills = new Set(
    []
      .concat(Array.isArray(pd.skills) ? pd.skills.map((skill) => skill.skillId).filter(Boolean) : [])
      .concat(decisionEvents.map((event) => event.skillId).filter(Boolean))
  );
  const runtimeByTraceId = new Map();
  const scopeByTraceId = new Map();
  const scopeBySessionSkill = new Map();

  for (const trace of traces) {
    if (trace.trace_id) runtimeByTraceId.set(trace.trace_id, trace.runtime || null);
  }

  const feedbackByKey = new Map();
  for (const event of decisionEvents) {
    const scopeId = getActivityScopeId(event);
    if (scopeId && event.traceId) scopeByTraceId.set(event.traceId, scopeId);
    if (scopeId && event.sessionId && event.skillId) scopeBySessionSkill.set(event.sessionId + '::' + event.skillId, scopeId);

    if (event.businessCategory !== 'supporting_detail' && event.tag !== 'skill_feedback') continue;
    for (const key of getActivityRelationKeys(event)) {
      if (!feedbackByKey.has(key)) feedbackByKey.set(key, []);
      feedbackByKey.get(key).push(event);
    }
  }

  const decisionRows = [];
  for (const event of decisionEvents) {
    const tag = normalizeDecisionTag(event);
    if (!tag) continue;
    const scopeId = getActivityScopeId(event);
    const category = event.businessCategory || businessCategoryForTag(tag);
    const feedbackDetails = !shouldMergeSupportingDetailIntoRow(tag, category)
      ? []
      : (event.businessCategory || businessCategoryForTag(tag)) === 'stability_feedback'
      ? []
      : collectUniqueText(
        getActivityRelationKeys({
          windowId: scopeId,
          traceId: event.traceId,
          sessionId: event.sessionId,
          skillId: event.skillId,
        }).flatMap((key) =>
          (feedbackByKey.get(key) || []).map((item) =>
            normalizeActivityNarrative(
              normalizeDecisionTag(item) || item.tag,
              item.status,
              item.judgment || item.detail || item.reason || ''
            )
          )
        )
      );
    const primaryDetail = normalizeActivityNarrative(
      tag,
      event.status,
      event.judgment || event.detail || event.reason || formatBusinessEvent({ ...event, tag })
    );
    const row = {
      id: 'decision:' + event.id,
      timestamp: event.timestamp || '',
      tag,
      category,
      runtime: event.runtime || (event.traceId ? runtimeByTraceId.get(event.traceId) : null) || t('activityHostFallback'),
      skillId: event.skillId || null,
      status: localizeActivityStatus(tag, event.status),
      rawStatus: event.status || null,
      scopeId: scopeId || null,
      detail: mergeBusinessDetail(
        primaryDetail,
        feedbackDetails
      ),
      inputSummary: event.inputSummary || null,
      nextAction: event.nextAction || null,
      rawDetail: event.detail || null,
      rawReason: event.reason || null,
      evidence: event.evidence || null,
      sourceLabel: t('activitySourceDecision'),
      traceId: event.traceId || null,
      sessionId: event.sessionId || null,
    };

    if (tag === 'analysis_failed' && category === 'stability_feedback') {
      const interruption = describeAnalysisInterruption(row);
      decisionRows.push({
        ...row,
        id: 'decision:core-flow:' + event.id,
        tag: 'analysis_interrupted',
        category: 'core_flow',
        status: localizeActivityStatus('analysis_interrupted', 'interrupted'),
        detail: interruption.summary,
        nextAction: interruption.nextAction,
      });
    }

    decisionRows.push(row);
  }

  const dedupe = new Map();
  const rows = decisionRows
    .sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)))
    .filter((row) => {
      const dedupeKey = [row.tag, row.skillId || '', row.status || '', row.scopeId || '', row.detail || ''].join('::');
      const prevTs = dedupe.get(dedupeKey);
      if (!prevTs) {
        dedupe.set(dedupeKey, row.timestamp);
        return true;
      }
      const delta = Math.abs(new Date(prevTs).getTime() - new Date(row.timestamp).getTime());
      if (!Number.isFinite(delta) || delta > 15000) {
        dedupe.set(dedupeKey, row.timestamp);
        return true;
      }
      return false;
    })
    .slice(0, 150);

  state.activityRowsByProject[projectPath] = rows;
  console.debug('[dashboard] activity rows rebuilt', {
    projectPath,
    rowCount: rows.length,
    decisionCount: decisionRows.length,
    traceCount: 0,
    coreFlowCount: rows.filter((row) => (row.category || 'core_flow') === 'core_flow').length,
    stabilityFeedbackCount: rows.filter((row) => row.category === 'stability_feedback').length,
    interruptedCount: rows.filter((row) => row.tag === 'analysis_interrupted').length,
  });
  return rows;
}

function getActivityRow(projectPath, rowId) {
  const rows = (state.activityRowsByProject[projectPath] || []).concat(state.rawActivityRowsByProject[projectPath] || []);
  return rows.find((row) => row.id === rowId) || null;
}

async function copyActivityDetail(projectPath, rowId) {
  const row = getActivityRow(projectPath, rowId);
  const text = buildActivityDetail(row);
  state.lastCopiedActivityText = text;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    await navigator.clipboard.writeText(text);
  }
}

async function openActivityDetail(projectPath, rowId) {
  const row = getActivityRow(projectPath, rowId);
  document.getElementById('eventModalTitle').textContent = row
    ? ((row.rawTrace ? summarizeTraceEventType(row.rawTrace) : businessEventLabel(row.tag)) + ' · ' + (row.skillId || '—'))
    : t('activityDetailTitle');
  document.getElementById('eventModalContent').textContent = buildActivityDetail(row);
  document.getElementById('eventModal').classList.add('visible');
}

function closeEventModal() {
  document.getElementById('eventModal').classList.remove('visible');
}

function resolveActivitySkillTarget(projectPath, row) {
  const skillId = row && typeof row.skillId === 'string' ? row.skillId.trim() : '';
  if (!skillId || skillId === '—' || skillId.includes(',')) return null;

  const skills = Array.isArray(state.projectData[projectPath]?.skills)
    ? state.projectData[projectPath].skills
    : [];
  const preferredRuntime = row && typeof row.runtime === 'string' ? row.runtime.trim() : '';

  const exact = skills.find((skill) => skill.skillId === skillId && (skill.runtime || 'codex') === preferredRuntime);
  if (exact) {
    return { skillId, runtime: exact.runtime || 'codex' };
  }

  const fallback = skills.find((skill) => skill.skillId === skillId);
  if (!fallback) return null;
  return { skillId, runtime: fallback.runtime || 'codex' };
}

function renderActivitySkillCell(projectPath, row) {
  const skillId = row && typeof row.skillId === 'string' ? row.skillId : '';
  if (!skillId) return '—';

  const target = resolveActivitySkillTarget(projectPath, row);
  if (!target) return escHtml(skillId);

  return '<button class="activity-skill-link" onclick="viewSkill(\\'' +
    escJsStr(projectPath) + '\\',\\'' +
    escJsStr(target.skillId) + '\\',\\'' +
    escJsStr(target.runtime) +
    '\\');event.stopPropagation()">' +
    escHtml(skillId) +
    '</button>';
}

function renderBusinessEvents(projectPath) {
  const events = buildActivityRows(projectPath);
  const filters = [
    { id: 'core_flow', label: businessEventLabel('core_flow') },
    { id: 'stability_feedback', label: businessEventLabel('stability_feedback') },
    { id: 'all', label: businessEventLabel('all') },
  ];
  const activeFilter = state.activityTagFilter || 'core_flow';
  const filtered = activeFilter === 'all'
    ? events
    : events.filter((e) => (e.category || businessCategoryForTag(e.tag)) === activeFilter);

  if (events.length === 0) return '<div class="empty-state">' + t('activityEmpty') + '</div>';

  return \`
    <div class="activity-controls">
      <div class="activity-left">
        \${filters.map((filter) =>
          \`<button class="tag-chip \${activeFilter === filter.id ? 'active' : ''}" onclick="setActivityTagFilter('\${escJsStr(filter.id)}')">\${escHtml(filter.label)}</button>\`
        ).join('')}
      </div>
      <div style="font-size:10px;color:var(--muted)">\${filtered.length} / \${events.length}</div>
    </div>
    \${filtered.length === 0 ? \`<div class="empty-state">\${t('activityEmpty')}</div>\` : \`<div class="trace-table-wrap">
      <table class="activity-table">
        <thead><tr>
          <th style="\${getActivityColumnStyle('time', DEFAULT_ACTIVITY_TIME_COLUMN_WIDTH)}">\${t('traceTime')}<span class="column-resizer" onmousedown="startActivityColumnResize(event,'time')"></span></th>
          <th style="\${getActivityColumnStyle('host', 96)}">\${t('traceRuntime')}<span class="column-resizer" onmousedown="startActivityColumnResize(event,'host')"></span></th>
          <th style="\${getActivityColumnStyle('event', 128)}">\${t('traceEvent')}<span class="column-resizer" onmousedown="startActivityColumnResize(event,'event')"></span></th>
          <th style="\${getActivityColumnStyle('skill', 220)}">\${t('activitySkillLabel')}<span class="column-resizer" onmousedown="startActivityColumnResize(event,'skill')"></span></th>
          <th style="\${getActivityColumnStyle('status', 140)}">\${t('traceStatus')}<span class="column-resizer" onmousedown="startActivityColumnResize(event,'status')"></span></th>
          <th style="\${getActivityColumnStyle('scope', 180)}">\${t('traceScope')}<span class="column-resizer" onmousedown="startActivityColumnResize(event,'scope')"></span></th>
          <th style="\${getActivityColumnStyle('detail', 520)}">\${t('traceDetail')}<span class="column-resizer" onmousedown="startActivityColumnResize(event,'detail')"></span></th>
        </tr></thead>
        <tbody>
          \${filtered.slice(0, 80).map((e) => \`<tr>
            <td style="color:var(--muted);\${getActivityColumnStyle('time', DEFAULT_ACTIVITY_TIME_COLUMN_WIDTH)}">\${formatEventTimestamp(e.timestamp)}</td>
            <td style="\${getActivityColumnStyle('host', 96)}">\${escHtml(e.runtime || t('activityHostFallback'))}</td>
            <td style="\${getActivityColumnStyle('event', 128)}">\${escHtml(businessEventLabel(e.tag))}</td>
            <td style="\${getActivityColumnStyle('skill', 220)}">\${renderActivitySkillCell(projectPath, e)}</td>
            <td style="color:var(--muted);\${getActivityColumnStyle('status', 140)}">\${escHtml(e.status || t('activityStatusFallback'))}</td>
            <td style="\${getActivityColumnStyle('scope', 180)}">\${escHtml(e.scopeId || t('activityScopeFallback'))}</td>
            <td style="\${getActivityColumnStyle('detail', 520)}">
              <div class="business-detail-preview">\${escHtml(formatActivityPreview(e))}</div>
              <div class="business-detail-actions">
                <button class="detail-copy-btn" onclick="copyActivityDetail('\${escJsStr(projectPath)}','\${escJsStr(e.id)}')">\${t('activityCopy')}</button>
                <button class="detail-view-btn" onclick="openActivityDetail('\${escJsStr(projectPath)}','\${escJsStr(e.id)}')">\${t('activityViewDetails')}</button>
              </div>
            </td>
          </tr>\`).join('')}
        </tbody>
      </table>
    </div>\`}
  \`;
}

function buildRawTraceRows(projectPath) {
  const pd = state.projectData[projectPath] || {};
  const traces = Array.isArray(pd.recentTraces) ? pd.recentTraces : [];
  const decisionEvents = Array.isArray(pd.decisionEvents) ? pd.decisionEvents : [];
  const scopeByTraceId = new Map();

  for (const event of decisionEvents) {
    const scopeId = getActivityScopeId(event);
    if (scopeId && event.traceId) scopeByTraceId.set(event.traceId, scopeId);
  }

  const rows = traces
    .map((trace) => ({
      id: 'raw:' + trace.trace_id,
      timestamp: trace.timestamp || '',
      tag: trace.event_type || 'status',
      runtime: trace.runtime || t('activityHostFallback'),
      skillId: Array.isArray(trace.skill_refs) && trace.skill_refs.length > 0 ? trace.skill_refs.join(', ') : null,
      status: trace.status || t('activityStatusFallback'),
      scopeId: scopeByTraceId.get(trace.trace_id) || null,
      detail: formatRawTracePreview(trace),
      sourceLabel: t('activitySourceTrace'),
      traceId: trace.trace_id || null,
      sessionId: trace.session_id || null,
      rawTrace: trace,
    }))
    .sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)))
    .slice(0, 150);

  state.rawActivityRowsByProject[projectPath] = rows;
  return rows;
}

function formatCompactNumber(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return '0';
  return new Intl.NumberFormat(currentLang === 'zh' ? 'zh-CN' : 'en-US', {
    notation: num >= 10000 ? 'compact' : 'standard',
    maximumFractionDigits: num >= 10000 ? 1 : 0,
  }).format(num);
}

function formatUsd(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: num < 0.01 ? 4 : 2,
    maximumFractionDigits: num < 0.01 ? 4 : 2,
  }).format(num);
}

function formatUsdPerMillion(ratePerToken) {
  const num = Number(ratePerToken);
  if (!Number.isFinite(num)) return '—';
  return formatUsd(num * 1000000) + '/M';
}

function formatPlainNumber(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return '0';
  return new Intl.NumberFormat(currentLang === 'zh' ? 'zh-CN' : 'en-US', {
    maximumFractionDigits: 0,
  }).format(num);
}

function formatDurationMs(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num) || num <= 0) return '—';
  if (num < 1000) return Math.round(num) + 'ms';
  if (num < 60000) {
    return (Math.round((num / 1000) * 10) / 10).toFixed(1).replace(/\\.0$/, '') + 's';
  }
  const minutes = num / 60000;
  return (Math.round(minutes * 10) / 10).toFixed(1).replace(/\\.0$/, '') + 'm';
}

function getLiteLLMModelDetailsIndex() {
  const index = {};
  const catalog = Array.isArray(state.providerCatalog) ? state.providerCatalog : [];
  for (const provider of catalog) {
    const details = Array.isArray(provider.modelDetails) ? provider.modelDetails : [];
    for (const detail of details) {
      if (!detail || !detail.id) continue;
      index[detail.id] = detail;
      const shortName = String(detail.id).split('/').pop();
      if (shortName && !index[shortName]) index[shortName] = detail;
    }
  }
  return index;
}

function estimateModelSpend(modelStats, detail) {
  if (!detail) return null;
  const inputRate = Number(detail.inputCostPerToken);
  const outputRate = Number(detail.outputCostPerToken);
  if (!Number.isFinite(inputRate) && !Number.isFinite(outputRate)) return null;
  return (modelStats.promptTokens || 0) * (Number.isFinite(inputRate) ? inputRate : 0) +
    (modelStats.completionTokens || 0) * (Number.isFinite(outputRate) ? outputRate : 0);
}

function formatContextWindow(detail) {
  if (!detail) return '—';
  const input = typeof detail.maxInputTokens === 'number' ? formatUsageCompact(detail.maxInputTokens) : '—';
  const output = typeof detail.maxOutputTokens === 'number' ? formatUsageCompact(detail.maxOutputTokens) : '—';
  return input + ' / ' + output;
}

function buildCostRows(recordMap, modelDetailsIndex, options) {
  const rows = Object.entries(recordMap || {})
    .map(([key, bucket]) => {
      const normalizedKey = String(key || '');
      const detail = modelDetailsIndex[normalizedKey] || modelDetailsIndex[normalizedKey.split('/').pop() || ''] || null;
      const estimatedSpend = options?.type === 'model' ? estimateModelSpend(bucket, detail) : null;
      return { key: normalizedKey, bucket: bucket || {}, detail, estimatedSpend };
    })
    .sort((a, b) => {
      const aSort = typeof a.estimatedSpend === 'number' ? a.estimatedSpend : Number(a.bucket.totalTokens || 0);
      const bSort = typeof b.estimatedSpend === 'number' ? b.estimatedSpend : Number(b.bucket.totalTokens || 0);
      return bSort - aSort;
    });
  return rows;
}

function renderCapabilityPills(detail) {
  if (!detail) return '<span class="mono-compact">' + t('costCapabilityNone') + '</span>';
  const pills = [];
  if (detail.supportsReasoning) pills.push(t('costCapabilityReasoning'));
  if (detail.supportsFunctionCalling) pills.push(t('costCapabilityFunctionCalling'));
  if (detail.supportsPromptCaching) pills.push(t('costCapabilityPromptCaching'));
  if (detail.supportsStructuredOutput) pills.push(t('costCapabilityStructuredOutput'));
  if (detail.supportsVision) pills.push(t('costCapabilityVision'));
  if (detail.supportsWebSearch) pills.push(t('costCapabilityWebSearch'));
  if (pills.length === 0) return '<span class="mono-compact">' + t('costCapabilityNone') + '</span>';
  return '<div class="capability-pills">' + pills.map((label) => '<span class="capability-pill">' + escHtml(label) + '</span>').join('') + '</div>';
}

function renderCostBreakdown(title, rows, emptyText, formatter, countLabel) {
  const visibleRows = (rows || []).slice(0, 5);
  const body = visibleRows.length > 0
    ? visibleRows.map((row) =>
      '<div class="scope-item">' +
        '<div class="scope-item-top">' +
          '<div class="scope-item-name">' + escHtml(row.key) + '</div>' +
          '<div class="scope-item-value">' + escHtml(formatter(row)) + '</div>' +
        '</div>' +
        '<div class="scope-item-sub">' +
          formatPlainNumber(row.bucket.callCount || 0) + ' ' + escHtml(t('costTableCallsSuffix')) +
          ' · ' + formatUsageCompact(row.bucket.totalTokens || 0) + ' ' + escHtml(countLabel || t('costTableTokensSuffix')) +
        '</div>' +
      '</div>'
    ).join('')
    : '<div class="empty-state">' + escHtml(emptyText) + '</div>';

  return '<div class="card">' +
    '<div class="card-header"><span>' + escHtml(title) + '</span></div>' +
    '<div class="card-body">' + body + '</div>' +
  '</div>';
}

function formatUsageCompact(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return '0';
  const abs = Math.abs(num);
  if (abs >= 1000000) {
    return (Math.round((num / 1000000) * 10) / 10).toString().replace(/\\.0$/, '') + 'M';
  }
  if (abs >= 1000) {
    return (Math.round((num / 1000) * 10) / 10).toString().replace(/\\.0$/, '') + 'K';
  }
  return String(Math.round(num));
}

function incrementCounter(map, key) {
  const normalizedKey = String(key || 'unknown').trim() || 'unknown';
  map[normalizedKey] = (map[normalizedKey] || 0) + 1;
}

function summarizeDecisionEvents(events) {
  const summary = {
    mappingByStrategy: {},
    evaluationByRule: {},
    skippedByReason: {},
    patchByType: {},
    patchVolume: {
      linesAdded: 0,
      linesRemoved: 0,
    },
    runtimeDriftCount: 0,
  };

  const rows = Array.isArray(events) ? events : [];
  for (const event of rows) {
    const tag = String(event?.tag || '');
    if (tag === 'skill_mapping' || tag === 'skill_mapped' || tag === 'skill_mapping_result') {
      incrementCounter(summary.mappingByStrategy, event.reason || event.detail || event.status || 'mapped');
    }
    if (tag === 'evaluation_result' || tag === 'skill_evaluation') {
      incrementCounter(summary.evaluationByRule, event.ruleName || event.reason || event.status || 'unclassified');
    }
    if (event?.status === 'skipped') {
      incrementCounter(summary.skippedByReason, event.reason || event.detail || 'skipped');
    }
    if (tag === 'patch_applied') {
      incrementCounter(summary.patchByType, event.changeType || 'patch');
      summary.patchVolume.linesAdded += Number(event.linesAdded || 0);
      summary.patchVolume.linesRemoved += Number(event.linesRemoved || 0);
    }
    if (event?.runtimeDrift) {
      summary.runtimeDriftCount += 1;
    }
  }

  return summary;
}

function renderMetricRows(title, rows, emptyText) {
  const entries = Object.entries(rows || {})
    .sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0));

  const body = entries.length > 0
    ? entries.map(([label, count]) =>
      '<div class="scope-item">' +
        '<div class="scope-item-top">' +
          '<div class="scope-item-name">' + escHtml(label) + '</div>' +
          '<div class="scope-item-value">' + formatCompactNumber(count) + '</div>' +
        '</div>' +
      '</div>'
    ).join('')
    : '<div class="config-help">' + escHtml(emptyText) + '</div>';

  return '<div class="card">' +
    '<div class="card-header"><span>' + escHtml(title) + '</span><span style="color:var(--muted)">' + entries.length + '</span></div>' +
    '<div class="card-body">' +
      '<div class="scope-list">' + body + '</div>' +
    '</div>' +
  '</div>';
}

function renderCostPanel(projectPath) {
  const pd = state.projectData[projectPath] || {};
  const usage = pd.agentUsage || {
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
  if (!usage.callCount) {
    return '<div class="empty-state">' + t('costEmpty') + '</div>';
  }

  const modelIndex = getLiteLLMModelDetailsIndex();
  const modelRows = buildCostRows(usage.byModel, modelIndex, { type: 'model' });
  const scopeRows = buildCostRows(usage.byScope, modelIndex);
  const skillRows = buildCostRows(usage.bySkill, modelIndex);
  const pricedModelCount = modelRows.filter((row) => typeof row.estimatedSpend === 'number').length;
  const totalEstimatedSpend = modelRows.reduce((sum, row) => sum + (typeof row.estimatedSpend === 'number' ? row.estimatedSpend : 0), 0);
  const avgTokensPerCall = usage.callCount > 0 ? Math.round((usage.totalTokens || 0) / usage.callCount) : 0;
  const hasModelMetadata = modelRows.some((row) => !!row.detail);
  const hasReasoningSurcharge = modelRows.some(
    (row) => row.detail && Number(row.detail.outputCostPerReasoningToken) > 0
  );
  const leadModel = modelRows[0] || null;
  const leadScope = scopeRows[0] || null;
  const leadSkill = skillRows[0] || null;

  function renderSummaryCard(label, value, sub) {
    return '<div class="cost-summary-card">' +
      '<div class="cost-summary-label">' + escHtml(label) + '</div>' +
      '<div class="cost-summary-value">' + escHtml(value) + '</div>' +
      '<div class="cost-summary-sub">' + escHtml(sub) + '</div>' +
    '</div>';
  }

  function renderHeroPill(text) {
    return '<span class="cost-hero-pill">' + escHtml(text) + '</span>';
  }

  function renderModelStat(label, value, sub) {
    return '<div class="cost-model-stat">' +
      '<div class="cost-model-stat-label">' + escHtml(label) + '</div>' +
      '<div class="cost-model-stat-value">' + escHtml(value) + '</div>' +
      '<div class="cost-model-stat-sub">' + escHtml(sub) + '</div>' +
    '</div>';
  }

  const modelHtml = modelRows.map((row) =>
    '<tr>' +
      '<td>' +
        '<div class="cost-primary">' + escHtml(row.key) + '</div>' +
        '<div class="cost-secondary">' + escHtml((row.detail && row.detail.mode) || 'chat') + ' · ' +
          formatPlainNumber(row.bucket.callCount || 0) + ' ' + t('costTableCallsSuffix') + '</div>' +
      '</td>' +
      '<td>' +
        '<div class="cost-primary">' + (typeof row.estimatedSpend === 'number' ? formatUsd(row.estimatedSpend) : '—') + '</div>' +
        '<div class="cost-secondary">' + formatUsageCompact(row.bucket.totalTokens || 0) + ' ' + t('costTableTokensSuffix') + '</div>' +
      '</td>' +
      '<td>' +
        '<div class="cost-primary">' + formatUsageCompact(row.bucket.promptTokens || 0) + ' / ' + formatUsageCompact(row.bucket.completionTokens || 0) + '</div>' +
        '<div class="cost-secondary">' + t('costTableInOut') + '</div>' +
      '</td>' +
      '<td>' +
        '<div class="cost-primary">' + formatDurationMs(row.bucket.avgDurationMs) + '</div>' +
        '<div class="cost-secondary">' + t('costTableLastSeen') + ' ' + (row.bucket.lastCallAt ? timeAgo(row.bucket.lastCallAt) : '—') + '</div>' +
      '</td>' +
      '<td>' +
        '<div class="cost-primary">' + formatContextWindow(row.detail) + '</div>' +
        '<div class="cost-secondary">' + t('costTableInOut') + '</div>' +
      '</td>' +
      '<td>' +
        '<div class="cost-primary">' +
          (row.detail ? formatUsdPerMillion(row.detail.inputCostPerToken) + ' · ' + formatUsdPerMillion(row.detail.outputCostPerToken) : '—') +
        '</div>' +
        '<div class="cost-secondary">' +
          (row.detail ? (Number(row.detail.outputCostPerReasoningToken) > 0 ? t('costPricingReasoningSurcharge') : t('costPricingSource')) : t('costUnknownPricing')) +
        '</div>' +
      '</td>' +
      '<td>' + renderCapabilityPills(row.detail) + '</td>' +
    '</tr>'
  ).join('');

  return '<div class="cost-shell">' +
    '<div class="cost-hero">' +
      '<div class="cost-hero-main">' +
        '<div class="cost-eyebrow">' + escHtml(t('costEstimated')) + '</div>' +
        '<div class="cost-hero-value">' + escHtml(pricedModelCount > 0 ? formatUsd(totalEstimatedSpend) : '—') + '</div>' +
        '<div class="cost-hero-copy">' + escHtml(pricedModelCount > 0 ? t('costEstimatedSub') : t('costUnknownPricing')) + '</div>' +
        '<div class="cost-hero-meta">' +
          renderHeroPill(formatPlainNumber(modelRows.length) + ' ' + t('costModelCount')) +
          renderHeroPill(t('costCalls') + ' · ' + formatPlainNumber(usage.callCount)) +
          (leadScope ? renderHeroPill(leadScope.key + ' · ' + formatUsageCompact(leadScope.bucket.totalTokens || 0)) : '') +
          (leadSkill ? renderHeroPill(leadSkill.key + ' · ' + formatUsageCompact(leadSkill.bucket.totalTokens || 0)) : '') +
        '</div>' +
      '</div>' +
      '<div class="cost-summary-grid">' +
        renderSummaryCard(t('costInputTokens'), formatUsageCompact(usage.promptTokens), t('costInputTokensSub')) +
        renderSummaryCard(t('costOutputTokens'), formatUsageCompact(usage.completionTokens), t('costOutputTokensSub')) +
        renderSummaryCard(t('costTotalTokens'), formatUsageCompact(usage.totalTokens), t('costTotalTokensSub')) +
        renderSummaryCard(t('costAvgLatency'), formatDurationMs(usage.avgDurationMs), t('costAvgLatencySub')) +
        renderSummaryCard(t('costAvgTokensPerCall'), formatUsageCompact(avgTokensPerCall), t('costAvgTokensPerCallSub')) +
        renderSummaryCard(t('costLastCall'), usage.lastCallAt ? timeAgo(usage.lastCallAt) : '—', t('costLastCallSub')) +
      '</div>' +
    '</div>' +
    '<div class="cost-board">' +
      '<div class="cost-main">' +
        '<div class="card cost-model-card">' +
          '<div class="card-header"><span>' + t('costModelSpend') + '</span><span style="color:var(--muted)">' + formatPlainNumber(modelRows.length) + ' ' + t('costModelCount') + '</span></div>' +
          '<div class="card-body">' +
            '<div class="cost-model-summary">' +
              renderModelStat(
                t('costTableModel'),
                leadModel ? leadModel.key : '—',
                leadModel ? (formatUsageCompact(leadModel.bucket.totalTokens || 0) + ' ' + t('costTableTokensSuffix')) : t('costScopeEmpty')
              ) +
              renderModelStat(
                t('costEstimated'),
                formatPlainNumber(pricedModelCount) + '/' + formatPlainNumber(modelRows.length),
                pricedModelCount > 0 ? t('costPricingSource') : t('costUnknownPricing')
              ) +
              renderModelStat(
                t('costLastCall'),
                usage.lastCallAt ? timeAgo(usage.lastCallAt) : '—',
                usage.callCount > 0 ? (formatPlainNumber(usage.callCount) + ' ' + t('costTableCallsSuffix')) : t('costCallsSub')
              ) +
            '</div>' +
            '<div class="cost-table-wrap">' +
              '<table class="cost-table">' +
                '<thead><tr>' +
                  '<th>' + t('costTableModel') + '</th>' +
                  '<th>' + t('costEstimatedSpend') + '</th>' +
                  '<th>' + t('costTableUsage') + '</th>' +
                  '<th>' + t('costTableLatency') + '</th>' +
                  '<th>' + t('costTableContextWindow') + '</th>' +
                  '<th>' + t('costTablePricing') + '</th>' +
                  '<th>' + t('costTableCapabilities') + '</th>' +
                '</tr></thead>' +
                '<tbody>' + modelHtml + '</tbody>' +
              '</table>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="cost-rail">' +
        renderCostBreakdown(t('costScopeBreakdown'), scopeRows, t('costScopeEmpty'), (row) => formatUsageCompact(row.bucket.totalTokens || 0), t('costTableTokensSuffix')) +
        renderCostBreakdown(t('costSkillBreakdown'), skillRows, t('costSkillEmpty'), (row) => formatUsageCompact(row.bucket.totalTokens || 0), t('costTableTokensSuffix')) +
        '<div class="card">' +
          '<div class="card-header"><span>' + t('costSignalsTitle') + '</span></div>' +
          '<div class="card-body">' +
            '<div class="cost-note"><strong>' + t('costSignalsSourceLabel') + '</strong> ' + t('costSignalsSourceBody') + '</div>' +
            '<div class="cost-note" style="margin-top:8px"><strong>' + t('costSignalsVisibleLabel') + '</strong> ' + t('costSignalsVisibleBody') + '</div>' +
            '<div class="cost-chip-row" style="margin-top:10px">' +
              '<span class="cost-chip">' + (hasModelMetadata ? t('costSignalsContextReady') : t('costSignalsContextPending')) + '</span>' +
              '<span class="cost-chip">' + (hasReasoningSurcharge ? t('costSignalsReasoningDetected') : t('costSignalsInputOutputOnly')) + '</span>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>' +
  '</div>';
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
  const decisionEvents = pd.decisionEvents || [];
  const decisionSummary = summarizeDecisionEvents(decisionEvents);
  const agentUsage = pd.agentUsage || {
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

  const uptime = daemon.isRunning && daemon.startedAt ? formatUptime(daemon.startedAt) : '—';

  el.innerHTML = \`<div class="panel-inner">
    <div class="main-tabs">
      <button class="main-tab \${state.selectedMainTab === 'overview' ? 'active' : ''}" onclick="selectMainTab('overview')">\${t('mainTabOverview')}</button>
      <button class="main-tab \${state.selectedMainTab === 'skills' ? 'active' : ''}" onclick="selectMainTab('skills')">\${t('mainTabSkills')}</button>
      <button class="main-tab \${state.selectedMainTab === 'activity' ? 'active' : ''}" onclick="selectMainTab('activity')">\${t('mainTabActivity')}</button>
      <button class="main-tab \${state.selectedMainTab === 'cost' ? 'active' : ''}" onclick="selectMainTab('cost')">\${t('mainTabCost')}</button>
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
      <div class="stat-card">
        <div class="stat-label">\${t('costCalls')}</div>
        <div class="stat-value">\${agentUsage.callCount ?? 0}</div>
        <div class="stat-sub">\${t('costCallsSub')}</div>
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
    \${decisionEvents.length > 0 ? \`
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-label">\${t('overviewMapped')}</div>
        <div class="stat-value">\${Object.values(decisionSummary.mappingByStrategy).reduce((sum, count) => sum + count, 0)}</div>
        <div class="stat-sub">\${t('overviewMappedSub')}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">\${t('overviewSkipped')}</div>
        <div class="stat-value">\${Object.values(decisionSummary.skippedByReason).reduce((sum, count) => sum + count, 0)}</div>
        <div class="stat-sub">\${t('overviewSkippedSub')}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">\${t('overviewPatchDelta')}</div>
        <div class="stat-value" style="font-size:15px">+\${decisionSummary.patchVolume.linesAdded}/-\${decisionSummary.patchVolume.linesRemoved}</div>
        <div class="stat-sub">\${t('overviewPatchDeltaSub')}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">\${t('overviewHostDrift')}</div>
        <div class="stat-value">\${decisionSummary.runtimeDriftCount}</div>
        <div class="stat-sub">\${t('overviewHostDriftSub')}</div>
      </div>
    </div>

    <div class="skills-list" style="grid-template-columns:repeat(2,1fr)">
      \${renderMetricRows(t('overviewMappingStrategy'), decisionSummary.mappingByStrategy, t('overviewNoMappingData'))}
      \${renderMetricRows(t('overviewEvaluationRules'), decisionSummary.evaluationByRule, t('overviewNoEvaluationData'))}
      \${renderMetricRows(t('overviewSkipReasons'), decisionSummary.skippedByReason, t('overviewNoSkipData'))}
      \${renderMetricRows(t('overviewPatchTypes'), decisionSummary.patchByType, t('overviewNoPatchData'))}
    </div>
    \` : ''}
    \${agentUsage.callCount > 0 ? \`
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-label">\${t('costCalls')}</div>
        <div class="stat-value">\${formatUsageCompact(agentUsage.callCount)}</div>
        <div class="stat-sub">\${t('overviewAgentUsageSub')}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">\${t('costInputTokens')}</div>
        <div class="stat-value">\${formatUsageCompact(agentUsage.promptTokens)}</div>
        <div class="stat-sub">\${t('overviewAgentUsageSub')}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">\${t('costOutputTokens')}</div>
        <div class="stat-value">\${formatUsageCompact(agentUsage.completionTokens)}</div>
        <div class="stat-sub">\${t('overviewAgentUsageSub')}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">\${t('costTotalTokens')}</div>
        <div class="stat-value">\${formatUsageCompact(agentUsage.totalTokens)}</div>
        <div class="stat-sub">\${t('overviewAgentUsageSub')}</div>
      </div>
    </div>

    <div class="skills-list" style="grid-template-columns:repeat(1,1fr)">
      \${renderMetricRows(t('overviewAgentScopes'), Object.fromEntries(Object.entries(agentUsage.byScope || {}).map(([scope, item]) => [scope, item.callCount || 0])), t('overviewNoAgentScopes'))}
    </div>
    \` : ''}
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
            <button class="runtime-tab \${state.selectedRuntimeTab === 'all' ? 'active' : ''}" onclick="selectRuntimeTab('all')">\${t('skillsRuntimeAll')}</button>
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
            <input type="text" class="search-input" id="skillSearchInput" placeholder="\${t('skillsSearchPlaceholder')}" value="\${state.searchQuery}" oninput="handleSearch(this.value)" />
          </div>
          <div class="sort-controls">
            <span class="sort-label">\${t('skillsSortLabel')}</span>
            <button class="sort-btn \${state.sortBy === 'name' ? 'active' : ''}" onclick="toggleSort('name')">
              \${t('skillsSortName')} <span class="arrow">\${state.sortBy === 'name' ? (state.sortOrder === 'asc' ? '↑' : '↓') : ''}</span>
            </button>
            <button class="sort-btn \${state.sortBy === 'updated' ? 'active' : ''}" onclick="toggleSort('updated')">
              \${t('skillsSortUpdated')} <span class="arrow">\${state.sortBy === 'updated' ? (state.sortOrder === 'asc' ? '↑' : '↓') : ''}</span>
            </button>
          </div>
        </div>
        
        <div id="skillsListContainer">
          \${getFilteredAndSortedSkills(skills).length === 0
            ? renderSkillsEmptyState()
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

    \${state.selectedMainTab === 'cost' ? \`
    <div class="card">
      <div class="card-header"><span>\${t('mainTabCost')}</span><span style="color:var(--muted)">\${agentUsage.callCount ?? 0}</span></div>
      <div class="card-body">
        \${renderCostPanel(projectPath)}
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
    ensureConfigTabDependencies(projectPath);
    void ensureProjectConfig(projectPath);
  }
}

function showProjectRenderFailure(projectPath, source, error) {
  const el = document.getElementById('mainPanel');
  if (!el) return;
  el.innerHTML =
    '<div class="panel-inner"><div class="card"><div class="card-header"><span>' +
    escHtml(t('mainSelectProject')) +
    '</span></div><div class="card-body"><div class="empty-state" style="color:var(--yellow)">' +
    escHtml(t('projectRenderFailed')) +
    '</div><div class="config-help" style="margin-top:8px">' +
    escHtml(t('projectRenderHint')) +
    '</div><div class="config-help" style="margin-top:8px">' +
    escHtml(projectPath || '—') +
    (source ? ' · ' + escHtml(source) : '') +
    '</div></div></div></div>';
  console.error('[dashboard] main panel render failed', {
    projectPath,
    source,
    error: String(error),
  });
  enqueueClientError({
    message: 'main panel render failed: ' + String(error),
    source: source || 'renderMainPanel',
    stack: getErrorStack(error),
  });
}

function safeRenderMainPanel(projectPath, source = 'renderMainPanel') {
  try {
    renderMainPanel(projectPath);
    return true;
  } catch (error) {
    showProjectRenderFailure(projectPath, source, error);
    return false;
  }
}

function selectMainTab(tab) {
  state.selectedMainTab = tab;
  if ((tab === 'config' || tab === 'cost') && state.providerCatalog.length === 0) {
    void loadProviderCatalog(true);
  }
  if (tab === 'config' && state.selectedProjectId) {
    ensureConfigTabDependencies(state.selectedProjectId);
  }
  if (state.selectedProjectId) {
    safeRenderMainPanel(state.selectedProjectId, 'selectMainTab:' + tab);
  }
  // 前端日志：记录 dashboard 主 tab 切换
  console.debug('[dashboard] switched main tab', { tab });
}

function setActivityLayer(layer) {
  state.activityLayer = layer === 'raw' ? 'raw' : 'business';
  if (state.selectedProjectId) safeRenderMainPanel(state.selectedProjectId, 'setActivityLayer');
}

function setActivityTagFilter(tag) {
  state.activityTagFilter = tag || 'core_flow';
  if (state.selectedProjectId) safeRenderMainPanel(state.selectedProjectId, 'setActivityTagFilter');
}

function renderConfigPanel(projectPath) {
  const config = state.configByProject[projectPath] || {
    autoOptimize: true,
    userConfirm: false,
    runtimeSync: true,
    defaultProvider: '',
    logLevel: 'info',
    providers: [],
  };
  const loading = !!state.configLoadingByProject[projectPath];
  const loadError = state.configLoadErrorByProject[projectPath] || '';
  const configUi = state.configUiByProject[projectPath] || {};

  const providers = Array.isArray(config.providers) ? config.providers : [];
  const activeProviderIndex = getActiveProviderIndex(config.defaultProvider, providers);
  const rowsHtml = providers.length > 0
    ? providers.map((row, index) => renderProviderRow(row, index, activeProviderIndex)).join('')
    : \`<div class="config-help">\${t('configNoProviders')}</div>\`;

  return \`
    \${state.providerCatalogLoading ? \`<div class="config-help" style="margin-bottom:8px">\${t('configCatalogLoading')}</div>\` : ''}
    \${state.providerCatalogError ? \`<div class="config-help" style="margin-bottom:8px;color:var(--red)">\${t('configCatalogErrorPrefix')} \${escHtml(state.providerCatalogError)} <button class="btn-secondary" type="button" onclick="reloadProviderCatalog()">\${t('configRetry')}</button></div>\` : ''}
    \${loading ? \`<div class="config-help" style="margin-bottom:8px">\${t('configLoading')}</div>\` : ''}
    \${loadError ? \`<div class="config-help" style="margin-bottom:8px;color:var(--red)">\${t('configLoadErrorPrefix')} \${escHtml(loadError)}</div>\` : ''}
    <div class="config-intro">\${t('configIntro')}</div>
    <div class="config-field" style="margin-top:10px">
      <label class="config-label">\${t('configProvidersLabel')}</label>
      <div class="providers-editor" id="cfg_providers_rows">\${rowsHtml}</div>
      <div style="margin-top:8px;display:flex;gap:8px">
        <button class="btn-secondary" type="button" onclick="addProviderRow()">\${t('configAddProvider')}</button>
      </div>
      <div class="config-help">\${t('configProvidersHelp')}</div>
      <div class="config-connectivity" id="cfg_connectivity">
        \${renderConnectivityResultsHtml(configUi.connectivityResults)}
      </div>
    </div>
    <div class="config-actions">
      <span id="cfg_save_hint" class="config-label">\${escHtml(configUi.saveHint || '')}</span>
    </div>
  \`;
}

function retryLoadConfig() {
  if (!state.selectedProjectId) return;
  delete state.configByProject[state.selectedProjectId];
  state.configLoadErrorByProject[state.selectedProjectId] = '';
  void ensureProjectConfig(state.selectedProjectId);
  safeRenderMainPanel(state.selectedProjectId, 'reloadProjectConfig');
}

async function loadProviderCatalog(force = false) {
  if (state.providerCatalogLoading) return;
  if (!force && state.providerCatalog.length > 0) return;
  state.providerCatalogLoading = true;
  state.providerCatalogError = '';
  if (state.selectedMainTab === 'config' && state.selectedProjectId) {
    safeRenderMainPanel(state.selectedProjectId, 'scheduleProjectConfigSave.flush');
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
      safeRenderMainPanel(state.selectedProjectId, 'scheduleProjectConfigSave.complete');
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

function updateConfigSaveHint(projectPath, message) {
  setConfigUi(projectPath, { saveHint: message });
  if (state.selectedProjectId === projectPath && state.selectedMainTab === 'config') {
    const hintEl = document.getElementById('cfg_save_hint');
    if (hintEl) {
      hintEl.textContent = message || '';
    }
  }
}

function scheduleProjectConfigSave(delayMs = 450) {
  const projectPath = state.selectedProjectId;
  if (!projectPath) return;
  if (configAutoSaveTimer !== null) {
    clearTimeout(configAutoSaveTimer);
  }
  updateConfigSaveHint(projectPath, t('configSaving'));
  configAutoSaveTimer = setTimeout(() => {
    configAutoSaveTimer = null;
    if (state.selectedProjectId !== projectPath || state.selectedMainTab !== 'config') return;
    void saveProjectConfig({ auto: true });
  }, delayMs);
}

function getActiveProviderIndex(defaultProvider, providers) {
  const rows = Array.isArray(providers) ? providers : [];
  if (rows.length === 0) return -1;
  const matchedIndex = rows.findIndex((row) => String(row?.provider || '') === String(defaultProvider || ''));
  return matchedIndex >= 0 ? matchedIndex : 0;
}

function renderProviderRow(row, index, activeProviderIndex) {
  const normalizedProvider = String(row.provider || '');
  const knownProvider = isKnownProvider(normalizedProvider);
  const providerOptions = getProviderOptionsHtml(knownProvider ? normalizedProvider : '__custom__');
  const normalizedModel = String(row.modelName || '');
  const modelOptions = getModelOptionsHtml(normalizedProvider, normalizedModel);
  const modelIsCustom = !isKnownModel(normalizedProvider, normalizedModel);
  const apiKey = String(row.apiKey || '');
  const apiKeyEnvVar = String(row.apiKeyEnvVar || guessApiKeyEnvVar(normalizedProvider));
  return \`
    <div class="provider-row" data-row-index="\${index}" data-has-api-key="\${row.hasApiKey ? 'true' : 'false'}" data-api-key-env-var="\${escHtml(apiKeyEnvVar)}">
      <select class="config-select cfg_provider" onchange="handleProviderChange(this)">
        \${providerOptions}
      </select>
      <input class="config-input cfg_provider_custom" value="\${knownProvider ? '' : escHtml(normalizedProvider)}" placeholder="\${t('configCustomProviderPlaceholder')}" style="\${knownProvider ? 'display:none;' : ''}" oninput="handleCustomProviderInput(this)" />
      <div>
        <select class="config-select cfg_model" onchange="handleModelChange(this)">
          \${modelOptions}
        </select>
        <input class="config-input cfg_model_custom" value="\${modelIsCustom ? escHtml(normalizedModel) : ''}" placeholder="\${t('configCustomModelPlaceholder')}" style="margin-top:6px;\${modelIsCustom ? '' : 'display:none;'}" oninput="scheduleProjectConfigSave(500)" />
      </div>
      <div>
        <input class="config-input cfg_api_key" type="text" value="\${escHtml(apiKey)}" placeholder="\${t('configApiKeyPastePlaceholder')}" oninput="scheduleProjectConfigSave(500)" />
      </div>
      <div class="provider-actions">
        <label class="config-check">
          <input type="radio" class="cfg_provider_active" name="cfg_provider_active" value="\${index}" \${index === activeProviderIndex ? 'checked' : ''} onchange="scheduleProjectConfigSave(150)"/>
          \${t('configProviderActiveLabel')}
        </label>
        <button class="btn-secondary cfg_row_check_btn" type="button" onclick="checkProvidersConnectivity(\${index}, this)">\${t('configCheckConnectivity')}</button>
        <button class="btn-danger" type="button" onclick="removeProviderRow(this)">\${t('configRemoveProvider')}</button>
      </div>
    </div>
  \`;
}

function getProviderOptionsHtml(selectedProvider) {
  const catalog = Array.isArray(state.providerCatalog) ? state.providerCatalog : [];
  if (catalog.length === 0) {
    return '<option value="__custom__">' + escHtml(t('configCatalogCustomOnly')) + '</option>';
  }
  return catalog
    .map((item) => {
      const selected = item.id === selectedProvider ? 'selected' : '';
      return '<option value="' + escHtml(item.id) + '" ' + selected + '>' + escHtml(item.id) + '</option>';
    })
    .join('') + '<option value="__custom__" ' + (selectedProvider === '__custom__' ? 'selected' : '') + '>' + escHtml(t('configCustomOption')) + '</option>';
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

function buildProviderModelAliases(providerId, modelName) {
  const normalizedProvider = String(providerId || '').trim();
  const normalizedModel = String(modelName || '').trim();
  if (!normalizedModel) return [];
  const aliases = new Set([normalizedModel]);
  if (normalizedProvider) {
    const prefix = normalizedProvider + '/';
    if (normalizedModel.startsWith(prefix)) {
      aliases.add(normalizedModel.slice(prefix.length));
    } else if (!normalizedModel.includes('/')) {
      aliases.add(prefix + normalizedModel);
    }
  }
  return [...aliases];
}

function resolveKnownModel(providerId, modelName) {
  const aliases = new Set(
    buildProviderModelAliases(providerId, modelName).map((item) => item.toLowerCase())
  );
  if (aliases.size === 0) return '';
  return getModelsByProvider(providerId).find((model) => aliases.has(String(model).toLowerCase())) || '';
}

function getModelOptionsHtml(providerId, selectedModel) {
  const models = getModelsByProvider(providerId);
  const resolvedSelectedModel = resolveKnownModel(providerId, selectedModel);
  const options = models
    .map((model) => {
      const selected = model === resolvedSelectedModel ? 'selected' : '';
      return '<option value="' + escHtml(model) + '" ' + selected + '>' + escHtml(model) + '</option>';
    })
    .join('');
  const customSelected = resolvedSelectedModel ? '' : 'selected';
  return options + '<option value="__custom__" ' + customSelected + '>' + escHtml(t('configCustomOption')) + '</option>';
}

function isKnownModel(providerId, modelName) {
  return Boolean(resolveKnownModel(providerId, modelName));
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
    const storedApiKeyEnvVar = row.getAttribute('data-api-key-env-var')?.trim() || '';
    const apiKeyEnvVar = storedApiKeyEnvVar || guessApiKeyEnvVar(provider);
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
  const modelSelect = row.querySelector('.cfg_model');
  const modelCustomInput = row.querySelector('.cfg_model_custom');
  if (customInput) {
    customInput.style.display = providerId === '__custom__' ? '' : 'none';
  }
  if (providerId === '__custom__') {
    if (modelSelect) {
      modelSelect.innerHTML = '<option value="__custom__" selected>' + escHtml(t('configCustomOption')) + '</option>';
    }
    if (modelCustomInput) {
      modelCustomInput.style.display = '';
    }
    row.setAttribute('data-api-key-env-var', guessApiKeyEnvVar(customInput?.value?.trim() || ''));
    scheduleProjectConfigSave(150);
    return;
  }
  row.setAttribute('data-api-key-env-var', guessApiKeyEnvVar(providerId));
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
  scheduleProjectConfigSave(150);
}

function handleCustomProviderInput(inputEl) {
  const row = inputEl.closest('.provider-row');
  if (!row) return;
  row.setAttribute('data-api-key-env-var', guessApiKeyEnvVar(inputEl.value.trim()));
  scheduleProjectConfigSave(500);
}

function handleModelChange(selectEl) {
  const row = selectEl.closest('.provider-row');
  if (!row) return;
  const customInput = row.querySelector('.cfg_model_custom');
  if (!customInput) return;
  customInput.style.display = selectEl.value === '__custom__' ? '' : 'none';
  scheduleProjectConfigSave(150);
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
  const nextDefaultProvider = config.defaultProvider || rows[0]?.provider || '';
  state.configByProject[state.selectedProjectId] = { ...config, defaultProvider: nextDefaultProvider, providers: rows };
  safeRenderMainPanel(state.selectedProjectId, 'addProviderRow');
  scheduleProjectConfigSave(150);
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
  const nextDefaultProvider = rows.some((item) => item.provider === config.defaultProvider)
    ? config.defaultProvider
    : (rows[0]?.provider || '');
  state.configByProject[state.selectedProjectId] = { ...config, defaultProvider: nextDefaultProvider, providers: rows };
  safeRenderMainPanel(state.selectedProjectId, 'removeProviderRow');
  scheduleProjectConfigSave(150);
}

function getSelectedProviderIndexFromEditor(providerCount, fallbackDefaultProvider, providers) {
  const selected = document.querySelector('input[name="cfg_provider_active"]:checked');
  const index = Number(selected?.value);
  if (Number.isInteger(index) && index >= 0 && index < providerCount) {
    return index;
  }
  return getActiveProviderIndex(fallbackDefaultProvider, providers);
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
      safeRenderMainPanel(projectPath, 'checkProvidersConnectivity.start');
    }
  } catch (e) {
    const message = String(e);
    console.error('[dashboard] failed to load config', { projectPath, error: message });
    state.configLoadErrorByProject[projectPath] = message;
    if (state.selectedMainTab === 'config' && state.selectedProjectId === projectPath) {
      safeRenderMainPanel(projectPath, 'checkProvidersConnectivity.end');
    }
  } finally {
    state.configLoadingByProject[projectPath] = false;
  }
}

async function saveProjectConfig(options = {}) {
  if (!state.selectedProjectId) return;
  const projectPath = state.selectedProjectId;
  const auto = !!options.auto;
  if (auto && configAutoSaveInFlight) {
    configAutoSaveQueued = true;
    return;
  }
  if (auto) {
    configAutoSaveInFlight = true;
  }
  try {
    const providers = collectProvidersFromConfigEditor();
    const currentConfig = state.configByProject[projectPath] || {};
    const selectedProviderIndex = getSelectedProviderIndexFromEditor(
      providers.length,
      currentConfig.defaultProvider,
      providers
    );
    const payload = {
      config: {
        autoOptimize: true,
        userConfirm: false,
        runtimeSync: true,
        defaultProvider: selectedProviderIndex >= 0 ? (providers[selectedProviderIndex]?.provider || '') : '',
        logLevel: currentConfig.logLevel || 'info',
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
    updateConfigSaveHint(projectPath, auto ? t('configAutoSaved') : t('configSaved'));
    await ensureProviderHealth(projectPath, true);
    if (!auto) {
      safeRenderMainPanel(projectPath, 'saveProjectConfig.start');
    }
  } catch (e) {
    console.error('[dashboard] failed to save config', { error: String(e) });
    updateConfigSaveHint(projectPath, t('configSaveFailed') + ': ' + String(e));
    if (!auto) {
      safeRenderMainPanel(projectPath, 'saveProjectConfig.end');
    }
  } finally {
    if (auto) {
      configAutoSaveInFlight = false;
      if (configAutoSaveQueued) {
        configAutoSaveQueued = false;
        scheduleProjectConfigSave(150);
      }
    }
  }
}

function renderConnectivityResultsHtml(results) {
  const title = '<div class="config-connectivity-title">' + t('configConnectivityTitle') + '</div>';
  if (!Array.isArray(results) || results.length === 0) {
    return title + '<div class="config-help">' + t('configConnectivityEmpty') + '</div>';
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

async function checkProvidersConnectivity(targetRowIndex = null, btnEl = null) {
  if (!state.selectedProjectId) return;
  const projectPath = state.selectedProjectId;
  const rowIndex = Number.isInteger(Number(targetRowIndex)) ? Number(targetRowIndex) : null;
  const btn = btnEl || null;
  if (btn) {
    btn.disabled = true;
    btn.textContent = t('configConnectivityChecking');
  }
  updateConfigSaveHint(projectPath, t('configConnectivityCheckingHint'));
  try {
    const providers = collectProvidersFromConfigEditor();
    const providersToCheck = rowIndex !== null && rowIndex >= 0 && rowIndex < providers.length
      ? [providers[rowIndex]]
      : providers;
    const currentConfig = state.configByProject[projectPath] || {};
    const selectedProviderIndex = getSelectedProviderIndexFromEditor(
      providers.length,
      currentConfig.defaultProvider,
      providers
    );
    const enc = encodeURIComponent(projectPath);
    const data = await fetchJsonWithTimeout('/api/projects/' + enc + '/config/providers/connectivity', 15000, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providers: providersToCheck }),
    });
    state.configByProject[projectPath] = {
      ...(state.configByProject[projectPath] || {}),
      defaultProvider: selectedProviderIndex >= 0 ? (providers[selectedProviderIndex]?.provider || '') : '',
      providers: sanitizeProvidersForState(providers),
    };
    setConfigUi(projectPath, {
      connectivityResults: data.results || [],
      saveHint: t('configConnectivityDone'),
    });
    await ensureProviderHealth(projectPath, true);
    safeRenderMainPanel(projectPath, 'checkProviderHealth.start');
  } catch (e) {
    setConfigUi(projectPath, {
      connectivityResults: [{ ok: false, provider: 'n/a', modelName: 'n/a', durationMs: 0, message: String(e) }],
      saveHint: t('configConnectivityFailed') + ': ' + String(e),
    });
    safeRenderMainPanel(projectPath, 'checkProviderHealth.end');
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

function renderSkillsEmptyState() {
  if (!state.searchQuery) {
    return '<div class="empty-state">' + t('skillsEmpty') + '</div>';
  }
  return '<div class="empty-state">' + t('skillsSearchEmptyPrefix') + ' "' + escHtml(state.searchQuery) + '"</div>';
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
    ? renderSkillsEmptyState()
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
  const projectPath = state.selectedProjectId;
  const rows = projectPath ? buildRawTraceRows(projectPath) : [];
  if (!rows.length) return '';
  return \`<table class="activity-table">
    <thead><tr>
      <th style="\${getActivityColumnStyle('time', DEFAULT_ACTIVITY_TIME_COLUMN_WIDTH)}">\${t('traceTime')}<span class="column-resizer" onmousedown="startActivityColumnResize(event,'time')"></span></th>
      <th style="\${getActivityColumnStyle('host', 96)}">\${t('traceRuntime')}<span class="column-resizer" onmousedown="startActivityColumnResize(event,'host')"></span></th>
      <th style="\${getActivityColumnStyle('event', 128)}">\${t('traceEvent')}<span class="column-resizer" onmousedown="startActivityColumnResize(event,'event')"></span></th>
      <th style="\${getActivityColumnStyle('status', 120)}">\${t('traceStatus')}<span class="column-resizer" onmousedown="startActivityColumnResize(event,'status')"></span></th>
      <th style="\${getActivityColumnStyle('scope', 180)}">\${t('traceScope')}<span class="column-resizer" onmousedown="startActivityColumnResize(event,'scope')"></span></th>
      <th style="width:120px;min-width:120px;">\${t('traceSession')}</th>
      <th style="width:120px;min-width:120px;">\${t('traceId')}</th>
      <th style="\${getActivityColumnStyle('detail', 520)}">\${t('traceDetail')}<span class="column-resizer" onmousedown="startActivityColumnResize(event,'detail')"></span></th>
      <th style="width:120px;min-width:120px;">\${t('traceAction')}</th>
    </tr></thead>
    <tbody>\${rows.slice(0, 50).map((row) => \`<tr>
      <td style="color:var(--muted);\${getActivityColumnStyle('time', DEFAULT_ACTIVITY_TIME_COLUMN_WIDTH)}">\${formatEventTimestamp(row.timestamp)}</td>
      <td style="\${getActivityColumnStyle('host', 96)}">\${escHtml(row.runtime || t('activityHostFallback'))}</td>
      <td style="\${getActivityColumnStyle('event', 128)}">\${escHtml(summarizeTraceEventType(row.rawTrace))}</td>
      <td style="color:var(--muted);\${getActivityColumnStyle('status', 120)}">\${escHtml(row.status || t('activityStatusFallback'))}</td>
      <td style="\${getActivityColumnStyle('scope', 180)}">\${escHtml(row.scopeId || t('activityScopeFallback'))}</td>
      <td style="color:var(--muted);width:120px;min-width:120px;">\${escHtml((row.sessionId || '—').slice(0, 8))}</td>
      <td style="color:var(--muted);width:120px;min-width:120px;">\${escHtml((row.traceId || '—').slice(0, 8))}</td>
      <td style="\${getActivityColumnStyle('detail', 520)}"><div class="business-detail-preview">\${escHtml(row.detail || t('activityDetailFallback'))}</div></td>
      <td style="width:120px;min-width:120px;">
        <div class="business-detail-actions">
          <button class="detail-copy-btn" onclick="copyActivityDetail('\${escJsStr(projectPath)}','\${escJsStr(row.id)}')">\${t('activityCopy')}</button>
          <button class="detail-view-btn" onclick="openActivityDetail('\${escJsStr(projectPath)}','\${escJsStr(row.id)}')">\${t('activityViewDetails')}</button>
        </div>
      </td>
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
    document.getElementById('modalContent').value = t('modalLoadError');
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
  hintEl.textContent = t('modalSaving');

  try {
    const encProject = encodeURIComponent(state.selectedProjectId);
    const encSkill = encodeURIComponent(state.currentSkillId);
    const r = await fetch(\`/api/projects/\${encProject}/skills/\${encSkill}?runtime=\${encodeURIComponent(runtime)}\`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content,
        runtime,
        reason: t('modalManualEditReason'),
      }),
    });
    if (!r.ok) {
      throw new Error(\`HTTP \${r.status}: \${r.statusText}\`);
    }
    const data = await r.json();
    hintEl.textContent = data.unchanged
      ? t('modalNoChanges')
      : (t('modalSavedVersionPrefix') + data.version);

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
    hintEl.textContent = t('modalSaveFailed');
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
document.getElementById('eventModal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeEventModal();
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
