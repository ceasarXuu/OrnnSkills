/**
 * Dashboard UI
 *
 * 返回完整的单页 HTML Dashboard。
 * HTML shell 保持 no-store；JS/CSS 作为可缓存静态资源输出。
 * 支持多语言（中英文）。
 */

import { createHash } from 'node:crypto';
import { getI18n, type Language } from './i18n.js';
import { renderDashboardAppShell } from './web/app-shell.js';
import { renderDashboardRuntimeSource } from './web/runtime/source.js';
import { renderDashboardSidebarSource } from './web/sidebar/source.js';
import { renderDashboardCostSource } from './web/cost/source.js';
import { renderDashboardMainPanelSource } from './web/main-panel/source.js';
import { renderDashboardConfigSource } from './web/config/source.js';
import { renderDashboardConfigSubtabsSource } from './web/config/subtabs.js';
import { renderDashboardSkillsSource } from './web/skills/source.js';
import { renderDashboardActivityBusinessSource } from './web/activity/business-events.js';
import { renderDashboardActivityDetailSource } from './web/activity/detail-view.js';
import { renderDashboardActivityListingSource } from './web/activity/listing.js';
import { renderDashboardStylesSource } from './web/styles.js';
import { renderDashboardActivityPanelSource } from './web/panels/activity-panel.js';
import { renderDashboardConfigPanelSource } from './web/panels/config-panel.js';
import { renderDashboardCostPanelSource } from './web/panels/cost-panel.js';
import { renderDashboardLogsPanelSource } from './web/panels/logs-panel.js';
import { renderDashboardOverviewPanelSource } from './web/panels/overview-panel.js';
import { renderDashboardSkillsPanelSource } from './web/panels/skills-panel.js';
import { renderDashboardActivityTablesSource } from './web/render/activity-tables.js';
import { renderDashboardCostBreakdownSource } from './web/render/cost-breakdown.js';
import { renderDashboardMetricRowsSource } from './web/render/metric-rows.js';
import { renderDashboardSkillCardSource } from './web/render/skill-card.js';
import { renderDashboardStateBadgeSource } from './web/render/state-badge.js';
import { renderDashboardTraceBarsSource } from './web/render/trace-bars.js';
import { renderDashboardBootstrapCacheSource } from './web/bootstrap-cache.js';
import { renderDashboardStateSource } from './web/state.js';
import { getDashboardSystemPromptDefaults } from '../core/prompt-defaults.js';

interface DashboardBootstrapOverrides {
  requestedConfigSubTab?: 'model' | 'evolution';
  requestedMainTab?: 'skills' | 'project' | 'config';
}

interface DashboardAssetBundle {
  styleCss: string;
  scriptSource: string;
  styleHref: string;
  scriptHref: string;
}

let cachedDashboardAssetBundle: DashboardAssetBundle | null = null;

function hashDashboardAssetSource(source: string): string {
  return createHash('sha1').update(source, 'utf-8').digest('hex').slice(0, 16);
}

export function getDashboardStyleCss(): string {
  return renderDashboardStylesSource();
}

export function getDashboardInlineBootScript(
  lang: Language = 'en',
  buildId = 'dev',
  overrides: DashboardBootstrapOverrides = {}
): string {
  return `window.__DASHBOARD_BOOTSTRAP__ = ${JSON.stringify({
    lang: lang === 'zh' ? 'zh' : 'en',
    buildId,
    ...overrides,
  })};`;
}

export function getDashboardScriptSource(): string {
  const dashboardPromptDefaults = {
    en: getDashboardSystemPromptDefaults('en'),
    zh: getDashboardSystemPromptDefaults('zh'),
  };
  const dashboardActivityBusinessSource = renderDashboardActivityBusinessSource();
  const dashboardRuntimeSource = renderDashboardRuntimeSource();
  const dashboardSidebarSource = renderDashboardSidebarSource();
  const dashboardCostSource = renderDashboardCostSource();
  const dashboardMainPanelSource = renderDashboardMainPanelSource();
  const dashboardConfigSource = renderDashboardConfigSource();
  const dashboardConfigSubtabsSource = renderDashboardConfigSubtabsSource();
  const dashboardSkillsSource = renderDashboardSkillsSource();
  const dashboardActivityDetailSource = renderDashboardActivityDetailSource();
  const dashboardActivityListingSource = renderDashboardActivityListingSource();
  const dashboardActivityPanelSource = renderDashboardActivityPanelSource();
  const dashboardConfigPanelSource = renderDashboardConfigPanelSource();
  const dashboardCostPanelSource = renderDashboardCostPanelSource();
  const dashboardLogsPanelSource = renderDashboardLogsPanelSource();
  const dashboardOverviewPanelSource = renderDashboardOverviewPanelSource();
  const dashboardActivityTablesSource = renderDashboardActivityTablesSource();
  const dashboardCostBreakdownSource = renderDashboardCostBreakdownSource();
  const dashboardMetricRowsSource = renderDashboardMetricRowsSource();
  const dashboardSkillCardSource = renderDashboardSkillCardSource();
  const dashboardStateBadgeSource = renderDashboardStateBadgeSource();
  const dashboardSkillsPanelSource = renderDashboardSkillsPanelSource();
  const dashboardStateSource = renderDashboardStateSource();
  const dashboardBootstrapCacheSource = renderDashboardBootstrapCacheSource();
  const dashboardTraceBarsSource = renderDashboardTraceBarsSource();

  return /* js */ `
// ─── Boot Config ─────────────────────────────────────────────────────────────
const DASHBOARD_BOOTSTRAP =
  (typeof window !== 'undefined' && window.__DASHBOARD_BOOTSTRAP__) ||
  { lang: 'en', buildId: 'dev' };

// ─── i18n ─────────────────────────────────────────────────────────────────────
const I18N = ${JSON.stringify({ en: getI18n('en'), zh: getI18n('zh') })};
let currentLang = DASHBOARD_BOOTSTRAP.lang === 'zh' ? 'zh' : 'en';
const DASHBOARD_BUILD_ID = String(DASHBOARD_BOOTSTRAP.buildId || 'dev');
const DASHBOARD_BUILD_SHORT = DASHBOARD_BUILD_ID.slice(-8);
const DEFAULT_DASHBOARD_SYSTEM_PROMPTS = ${JSON.stringify(dashboardPromptDefaults)};
${dashboardStateSource}
function applyRequestedWorkspaceFromBootstrap() {
  const requestedMainTab = DASHBOARD_BOOTSTRAP.requestedMainTab;
  if (
    requestedMainTab !== 'skills' &&
    requestedMainTab !== 'project' &&
    requestedMainTab !== 'config'
  ) {
    return;
  }

  state.selectedMainTab = requestedMainTab;
  if (requestedMainTab === 'skills') {
    state.selectedSkillsSubTab = 'skill_library';
  }
  if (requestedMainTab === 'config') {
    state.selectedConfigSubTab =
      DASHBOARD_BOOTSTRAP.requestedConfigSubTab === 'evolution' ? 'evolution' : 'model';
  }
}

${dashboardBootstrapCacheSource}
${dashboardActivityPanelSource}
${dashboardConfigPanelSource}
${dashboardCostPanelSource}
${dashboardLogsPanelSource}
${dashboardOverviewPanelSource}
${dashboardActivityBusinessSource}
${dashboardActivityDetailSource}
${dashboardActivityListingSource}
${dashboardActivityTablesSource}
${dashboardCostBreakdownSource}
${dashboardMetricRowsSource}
${dashboardSkillCardSource}
${dashboardStateBadgeSource}
${dashboardSkillsPanelSource}
${dashboardRuntimeSource}
${dashboardSidebarSource}
${dashboardCostSource}
${dashboardMainPanelSource}
${dashboardConfigSource}
${dashboardConfigSubtabsSource}
${dashboardSkillsSource}
${dashboardTraceBarsSource}

function t(key) {
  return (I18N[currentLang] && I18N[currentLang][key]) || (I18N.en && I18N.en[key]) || key;
}

function skillKey(skill) {
  return (skill.skillId || '') + '@' + (skill.runtime || 'codex');
}

function maxVersion(skill) {
  const versions = Array.isArray(skill.versionsAvailable) ? skill.versionsAvailable : [];
  return versions.length > 0 ? Math.max(...versions) : (skill.current_revision || skill.version || 1);
}

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

async function openProjectPicker() {
  try {
    console.debug('[dashboard] opening native project picker');
    const data = await fetchJsonWithTimeout('/api/projects/pick', 15000, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (data.ok && data.path) {
      state.projects = Array.isArray(data.projects) ? data.projects : state.projects;
      console.info('[dashboard] native project picker selected project', {
        projectPath: data.path,
        projectCount: state.projects.length,
      });
      renderSidebar();
      document.getElementById('addForm').classList.remove('visible');
      document.getElementById('addPathInput').value = '';
      await selectProject(data.path);
      return;
    }
    if (data.cancelled) {
      console.debug('[dashboard] native project picker cancelled');
      return;
    }
    console.warn('[dashboard] native project picker returned unexpected payload', data);
    toggleAddForm();
  } catch (error) {
    console.warn('[dashboard] native project picker failed, falling back to manual path input', {
      error: String(error),
    });
    toggleAddForm();
  }
}

document.getElementById('addPathInput').addEventListener('keydown', async (e) => {
  if (e.key !== 'Enter') return;
  const path = e.target.value.trim();
  if (!path) return;
  try {
    const r = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ path }),
    });
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
`;
}

export function getDashboardAssetBundle(): DashboardAssetBundle {
  if (cachedDashboardAssetBundle) {
    return cachedDashboardAssetBundle;
  }

  const styleCss = getDashboardStyleCss();
  const scriptSource = getDashboardScriptSource();
  const styleHref = `/assets/dashboard.${hashDashboardAssetSource(styleCss)}.css`;
  const scriptHref = `/assets/dashboard.${hashDashboardAssetSource(scriptSource)}.js`;

  cachedDashboardAssetBundle = {
    styleCss,
    scriptSource,
    styleHref,
    scriptHref,
  };

  return cachedDashboardAssetBundle;
}

export function getDashboardHtml(
  _port: number,
  lang: Language = 'en',
  buildId = 'dev',
  bootstrapOverrides: DashboardBootstrapOverrides = {}
): string {
  const t = getI18n(lang);
  const assets = getDashboardAssetBundle();

  return renderDashboardAppShell({
    lang,
    styleHref: assets.styleHref,
    scriptHref: assets.scriptHref,
    inlineBootstrapScript: getDashboardInlineBootScript(lang, buildId, bootstrapOverrides),
    labels: {
      headerConnecting: t.headerConnecting,
      sidebarProjects: t.sidebarProjects,
      sidebarAddProject: t.sidebarAddProject,
      sidebarAddPlaceholder: t.sidebarAddPlaceholder,
      sidebarAddHint: t.sidebarAddHint,
      mainSelectProject: t.mainSelectProject,
      modalClose: t.modalClose,
      modalHostLabel: t.traceRuntime,
      modalLoading: t.modalLoading,
      modalApplyAllButton: t.modalApplyAllButton,
      modalSave: t.modalSave,
      modalVersionHistory: t.modalVersionHistory,
      modalApplyAllTitle: t.modalApplyAllTitle,
      modalApplyAllCancel: t.modalApplyAllCancel,
      modalApplyAllConfirm: t.modalApplyAllConfirm,
      activityDetailTitle: t.activityDetailTitle,
      activityDetailEmpty: t.activityDetailEmpty,
    },
  });
}
