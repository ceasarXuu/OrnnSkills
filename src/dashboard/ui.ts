/**
 * Dashboard UI
 *
 * 返回完整的单页 HTML Dashboard，内嵌 CSS + JS，无外部依赖。
 * 深色主题，双栏布局：项目列表 / 主面板（含子 Tab）。
 * 支持多语言切换（中英文）。
 */

import { getI18n, type Language } from './i18n.js';
import { renderDashboardAppShell } from './web/app-shell.js';
import { renderDashboardActivityBusinessSource } from './web/activity/business-events.js';
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
import { renderDashboardStateSource } from './web/state.js';

export function getDashboardHtml(_port: number, lang: Language = 'en', buildId = 'dev'): string {
  const t = getI18n(lang);
  const shortBuildId = buildId.slice(-8);
  const dashboardActivityBusinessSource = renderDashboardActivityBusinessSource();
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
  const dashboardTraceBarsSource = renderDashboardTraceBarsSource();

  const styleCss = renderDashboardStylesSource();

  const scriptSource = /* js */ `
// ─── i18n ─────────────────────────────────────────────────────────────────────
const I18N = ${JSON.stringify({ en: getI18n('en'), zh: getI18n('zh') })};
let currentLang = '${lang}';
const DASHBOARD_BUILD_ID = '${buildId}';
const DASHBOARD_BUILD_SHORT = DASHBOARD_BUILD_ID.slice(-8);
${dashboardStateSource}
${dashboardActivityPanelSource}
${dashboardConfigPanelSource}
${dashboardCostPanelSource}
${dashboardLogsPanelSource}
${dashboardOverviewPanelSource}
${dashboardActivityBusinessSource}
${dashboardActivityTablesSource}
${dashboardCostBreakdownSource}
${dashboardMetricRowsSource}
${dashboardSkillCardSource}
${dashboardStateBadgeSource}
${dashboardSkillsPanelSource}
${dashboardTraceBarsSource}

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
  invalidateActivityScopeDetails();
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
  const modalSaveBtnEl = document.getElementById('modalSaveBtn');
  if (modalSaveBtnEl) modalSaveBtnEl.textContent = t('modalSave');
  const modalApplyAllBtnEl = document.getElementById('modalApplyAllBtn');
  if (modalApplyAllBtnEl) modalApplyAllBtnEl.textContent = t('modalApplyAllButton');
  const applyAllTitleEl = document.getElementById('applyAllConfirmTitle');
  if (applyAllTitleEl) applyAllTitleEl.textContent = t('modalApplyAllTitle');
  const applyAllCancelBtnEl = document.getElementById('applyAllCancelBtn');
  if (applyAllCancelBtnEl) applyAllCancelBtnEl.textContent = t('modalApplyAllCancel');
  const applyAllConfirmBtnEl = document.getElementById('applyAllConfirmBtn');
  if (applyAllConfirmBtnEl) applyAllConfirmBtnEl.textContent = t('modalApplyAllConfirm');
  if (document.getElementById('applyAllSkillModal')?.classList.contains('visible')) {
    renderApplyToAllConfirmation();
  }
  const eventModalTitleEl = document.getElementById('eventModalTitle');
  if (eventModalTitleEl) eventModalTitleEl.textContent = t('activityDetailTitle');
  // Re-render dynamic content
  renderSidebar();
  if (state.selectedProjectId) safeRenderMainPanel(state.selectedProjectId, 'updateLanguageUI');
  renderLogs();
  await persistDashboardLanguage(currentLang, state.selectedProjectId);
}

function getSkillVersionContextKey(encProject, encSkill, encRuntime) {
  return String(encProject) + '::' + String(encSkill) + '::' + String(encRuntime);
}

function getVersionActivityScopeId(meta) {
  return meta && typeof meta.activityScopeId === 'string' && meta.activityScopeId.trim()
    ? meta.activityScopeId.trim()
    : '';
}

function renderVersionReasonTag(encProject, meta) {
  if (!meta?.reason) return '';
  const fullReason = String(meta.reason);
  const reasonText = escHtml(fullReason.slice(0, 40));
  const scopeId = getVersionActivityScopeId(meta);
  if (scopeId) {
    return '<br><button class="version-change version-scope-link" type="button" title="' + escHtml(fullReason) + '" onclick="openVersionScopeDetail(\\'' + encProject + '\\',\\'' + escJsStr(scopeId) + '\\');event.stopPropagation()">' + reasonText + '</button>';
  }
  return '<br><span class="version-change">' + reasonText + '</span>';
}

function renderVersionMetaHtml(encProject, meta) {
  if (!meta) return t('modalClickToLoad');
  const createdAt = meta?.createdAt?.slice(0, 10) ?? '';
  return '<span>' + createdAt + '</span>' + renderVersionReasonTag(encProject, meta);
}

function renderVersionHistory(encProject, encSkill, encRuntime) {
  const versionList = document.getElementById('versionList');
  if (!versionList) return;
  const versions = Array.isArray(state.currentSkillVersions) ? state.currentSkillVersions : [];
  if (versions.length === 0) {
    versionList.innerHTML = '<div style="font-size:11px;color:var(--muted)">' + t('modalNoVersions') + '</div>';
    return;
  }
  const selectedVersion = state.currentSkillVersion ?? Math.max(...versions);
  const effectiveVersion = state.currentSkillEffectiveVersion ?? selectedVersion;
  const metaByVersion = state.currentSkillVersionMeta || {};
  versionList.innerHTML = versions.slice().reverse().map(v => {
    const isSelected = v === selectedVersion;
    const meta = metaByVersion[v];
    const isDisabled = !!meta?.isDisabled;
    const isEffective = !isDisabled && v === effectiveVersion;
    const metaHtml = renderVersionMetaHtml(encProject, meta);
    const flags = []
      .concat(isEffective ? ['<span class="version-flag effective">' + t('modalEffective') + '</span>'] : [])
      .concat(isDisabled ? ['<span class="version-flag invalid">' + t('modalInvalid') + '</span>'] : [])
      .join('');
    const actionLabel = isDisabled ? t('modalRestore') : t('modalInvalidate');
    const actionTarget = isDisabled ? 'false' : 'true';
    return '<div class="version-item ' + (isSelected ? 'current ' : '') + (isDisabled ? 'invalid' : '') + '" onclick="loadVersion(\\'' + encProject + '\\',\\'' + encSkill + '\\',\\'' + encRuntime + '\\',' + v + ')">' +
          '<div class="version-num">v' + v + '</div>' +
          (flags ? '<div class="version-flags">' + flags + '</div>' : '') +
          '<div id="vmeta_' + v + '" class="version-meta">' + metaHtml + '</div>' +
          '<div class="version-actions"><button class="btn-secondary" type="button" onclick="toggleSkillVersionDisabled(\\'' + encProject + '\\',\\'' + encSkill + '\\',\\'' + encRuntime + '\\',' + v + ',' + actionTarget + ');event.stopPropagation()">' + actionLabel + '</button></div>' +
        '</div>';
  }).join('');
}

function getConfigScopeId() {
  return GLOBAL_CONFIG_SCOPE;
}

function getStoredConfig(projectPath) {
  const scopeId = getConfigScopeId();
  return state.configByProject[scopeId] || state.configByProject[projectPath] || null;
}

function getStoredProviderHealth(projectPath) {
  const scopeId = getConfigScopeId();
  return state.providerHealthByProject[scopeId] || state.providerHealthByProject[projectPath] || null;
}

function getStoredConfigUi(projectPath) {
  const scopeId = getConfigScopeId();
  return state.configUiByProject[scopeId] || state.configUiByProject[projectPath] || {};
}

function getStoredConfigLoading(projectPath) {
  const scopeId = getConfigScopeId();
  return !!(state.configLoadingByProject[scopeId] || state.configLoadingByProject[projectPath]);
}

function getStoredConfigLoadError(projectPath) {
  const scopeId = getConfigScopeId();
  return state.configLoadErrorByProject[scopeId] || state.configLoadErrorByProject[projectPath] || '';
}

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
    void handleUpdate(data);
  });
  src.addEventListener('open', () => setHeaderStatus('connected'));
  src.onerror = () => {
    setHeaderStatus('error');
    setTimeout(connectSSE, 3000);
  };
}

function applyProjectSnapshot(projectPath, snapshot) {
  state.projectData[projectPath] = snapshot;
  state.staleProjectData[projectPath] = false;
  invalidateActivityScopeDetails(projectPath);
  return snapshot;
}

async function loadProjectSnapshot(projectPath, options = {}) {
  if (!projectPath) return null;
  const force = !!options.force;
  const existing = state.projectData[projectPath];
  if (!force && existing && !state.staleProjectData[projectPath]) {
    return existing;
  }
  if (projectSnapshotLoads[projectPath]) {
    return projectSnapshotLoads[projectPath];
  }

  const request = (async () => {
    try {
      const enc = encodeURIComponent(projectPath);
      let data = null;
      try {
        data = await fetchJsonWithTimeout('/api/projects/' + enc + '/snapshot', 8000);
      } catch (firstErr) {
        console.warn('[dashboard] project snapshot fetch failed, retrying', { path: projectPath, error: String(firstErr) });
        data = await fetchJsonWithTimeout('/api/projects/' + enc + '/snapshot', 12000);
      }
      return applyProjectSnapshot(projectPath, data);
    } catch (e) {
      console.error('[dashboard] failed to load project snapshot', { path: projectPath, error: String(e), force });
      if (existing) {
        state.staleProjectData[projectPath] = true;
        return existing;
      }
      return applyProjectSnapshot(projectPath, buildEmptyProjectData());
    } finally {
      delete projectSnapshotLoads[projectPath];
    }
  })();

  projectSnapshotLoads[projectPath] = request;
  return request;
}

async function handleUpdate(data) {
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
  const changedProjects = Array.isArray(data.changedProjects) ? data.changedProjects : [];
  if (changedProjects.length > 0) {
    for (const projectPath of changedProjects) {
      state.staleProjectData[projectPath] = true;
      invalidateActivityScopeDetails(projectPath);
    }
    if (state.selectedProjectId && changedProjects.includes(state.selectedProjectId) && state.selectedMainTab !== 'config') {
      await loadProjectSnapshot(state.selectedProjectId, { force: true });
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

const DEFAULT_LLM_SAFETY_CONFIG = {
  enabled: true,
  windowMs: 60000,
  maxRequestsPerWindow: 12,
  maxConcurrentRequests: 2,
  maxEstimatedTokensPerWindow: 48000,
};

const DEFAULT_PROMPT_OVERRIDES = {
  skillCallAnalyzer: '',
  decisionExplainer: '',
  readinessProbe: '',
};

function parsePositiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function sanitizeLLMSafetyForState(safety) {
  const raw = safety && typeof safety === 'object' ? safety : {};
  return {
    enabled: raw.enabled !== false,
    windowMs: parsePositiveInteger(raw.windowMs, DEFAULT_LLM_SAFETY_CONFIG.windowMs),
    maxRequestsPerWindow: parsePositiveInteger(
      raw.maxRequestsPerWindow,
      DEFAULT_LLM_SAFETY_CONFIG.maxRequestsPerWindow
    ),
    maxConcurrentRequests: parsePositiveInteger(
      raw.maxConcurrentRequests,
      DEFAULT_LLM_SAFETY_CONFIG.maxConcurrentRequests
    ),
    maxEstimatedTokensPerWindow: parsePositiveInteger(
      raw.maxEstimatedTokensPerWindow,
      DEFAULT_LLM_SAFETY_CONFIG.maxEstimatedTokensPerWindow
    ),
  };
}

function sanitizePromptOverridesForState(promptOverrides) {
  const raw = promptOverrides && typeof promptOverrides === 'object' ? promptOverrides : {};
  return {
    skillCallAnalyzer: typeof raw.skillCallAnalyzer === 'string' ? raw.skillCallAnalyzer : DEFAULT_PROMPT_OVERRIDES.skillCallAnalyzer,
    decisionExplainer: typeof raw.decisionExplainer === 'string' ? raw.decisionExplainer : DEFAULT_PROMPT_OVERRIDES.decisionExplainer,
    readinessProbe: typeof raw.readinessProbe === 'string' ? raw.readinessProbe : DEFAULT_PROMPT_OVERRIDES.readinessProbe,
  };
}

function collectLLMSafetyFromConfigEditor(fallbackSafety) {
  const safeFallback = sanitizeLLMSafetyForState(fallbackSafety);
  const enabledEl = document.getElementById('cfg_llm_safety_enabled');
  const windowEl = document.getElementById('cfg_llm_safety_window_ms');
  const requestEl = document.getElementById('cfg_llm_safety_max_requests');
  const concurrentEl = document.getElementById('cfg_llm_safety_max_concurrent');
  const tokenEl = document.getElementById('cfg_llm_safety_max_tokens');

  if (!enabledEl || !windowEl || !requestEl || !concurrentEl || !tokenEl) {
    return safeFallback;
  }

  return sanitizeLLMSafetyForState({
    enabled: !!enabledEl.checked,
    windowMs: windowEl.value,
    maxRequestsPerWindow: requestEl.value,
    maxConcurrentRequests: concurrentEl.value,
    maxEstimatedTokensPerWindow: tokenEl.value,
  });
}

function collectPromptOverridesFromConfigEditor(fallbackPromptOverrides) {
  const safeFallback = sanitizePromptOverridesForState(fallbackPromptOverrides);
  const analyzerEl = document.getElementById('cfg_prompt_skill_call_analyzer');
  const explainerEl = document.getElementById('cfg_prompt_decision_explainer');
  const readinessEl = document.getElementById('cfg_prompt_readiness_probe');

  if (!analyzerEl || !explainerEl || !readinessEl) {
    return safeFallback;
  }

  return sanitizePromptOverridesForState({
    skillCallAnalyzer: analyzerEl.value,
    decisionExplainer: explainerEl.value,
    readinessProbe: readinessEl.value,
  });
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
function isProjectMonitoringPaused(project, projectData) {
  if (projectData?.daemon?.isPaused === true) return true;
  if (projectData?.daemon?.monitoringState === 'paused') return true;
  return project?.isPaused === true || project?.monitoringState === 'paused';
}

function renderSidebar() {
  const list = document.getElementById('projectList');
  if (state.projects.length === 0) {
    list.innerHTML = '<div class="empty-state">' + t('sidebarNoProjects') + '</div>';
    return;
  }
  list.innerHTML = state.projects.map(p => {
    const pd = state.projectData[p.path];
    const useCachedSnapshot = !!pd && !state.staleProjectData[p.path];
    const paused = useCachedSnapshot ? isProjectMonitoringPaused(p, pd) : (p.isPaused === true || p.monitoringState === 'paused');
    const running = useCachedSnapshot ? (pd?.daemon?.isRunning ?? p.isRunning) : p.isRunning;
    const skills = useCachedSnapshot ? (pd?.skills?.length ?? p.skillCount ?? 0) : (p.skillCount ?? 0);
    const dotClass = paused ? 'dot-yellow' : running === undefined ? 'dot-gray' : running ? 'dot-green' : 'dot-red';
    const statusText = paused
      ? '|| ' + t('sidebarPaused')
      : running === undefined
        ? ''
        : running
          ? '● ' + t('sidebarRunning')
          : '○ ' + t('sidebarStopped');
    const statusColor = paused
      ? 'color:var(--yellow)'
      : running === undefined
        ? 'color:var(--muted)'
        : running
          ? 'color:var(--green)'
          : 'color:var(--muted)';
    const active = state.selectedProjectId === p.path ? 'active' : '';
    const skillsText = skills > 0 ? ' · ' + skills + ' ' + t('sidebarSkills') : '';
    const monitorBusy = !!state.monitoringMutationByProject[p.path];
    const buttonLabel = paused ? t('sidebarResume') : t('sidebarPause');
    const buttonClass = paused ? 'project-monitor-btn resume' : 'project-monitor-btn';
    return \`<div class="project-item \${active}" onclick="selectProject('\${escJsStr(p.path)}')">
      <div class="project-top">
        <div class="project-name">
          <span class="dot \${dotClass}"></span>
          <span>\${escHtml(p.name)}</span>
        </div>
        <button
          class="\${buttonClass}"
          type="button"
          \${monitorBusy ? 'disabled' : ''}
          onclick="event.stopPropagation();toggleProjectMonitoring('\${escJsStr(p.path)}', \${paused ? 'false' : 'true'})"
        >\${buttonLabel}</button>
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
  if (!state.projectData[path]) {
    document.getElementById('mainPanel').innerHTML = '<div class="panel-inner"><div class="no-project">' + t('mainLoading') + '</div></div>';
  }
  if (!state.projectData[path] || state.staleProjectData[path]) {
    await loadProjectSnapshot(path, { force: !!state.staleProjectData[path] });
  }
  safeRenderMainPanel(path, 'selectProject');
  if (state.providerCatalog.length === 0 && !state.providerCatalogLoading) {
    console.debug('[dashboard] warming provider catalog', { projectPath: path });
    void loadProviderCatalog();
  }
  renderSidebar();
}

async function toggleProjectMonitoring(projectPath, paused) {
  if (!projectPath) return;
  if (state.monitoringMutationByProject[projectPath]) return;

  state.monitoringMutationByProject[projectPath] = true;
  renderSidebar();

  try {
    const encProject = encodeURIComponent(projectPath);
    const data = await fetchJsonWithTimeout('/api/projects/' + encProject + '/monitoring', 10000, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paused: !!paused }),
    });

    if (Array.isArray(data.projects)) {
      state.projects = data.projects;
    } else {
      state.projects = state.projects.map((project) => {
        if (project.path !== projectPath) return project;
        return {
          ...project,
          monitoringState: paused ? 'paused' : 'active',
          pausedAt: paused ? new Date().toISOString() : null,
          isPaused: !!paused,
          isRunning: !paused,
        };
      });
    }

    if (state.projectData[projectPath] || state.selectedProjectId === projectPath) {
      await loadProjectSnapshot(projectPath, { force: true });
    }
  } catch (error) {
    console.warn('[dashboard] failed to toggle project monitoring', {
      projectPath,
      paused: !!paused,
      error: String(error),
    });
  } finally {
    delete state.monitoringMutationByProject[projectPath];
    renderSidebar();
    if (state.selectedProjectId === projectPath) {
      safeRenderMainPanel(projectPath, 'toggleProjectMonitoring');
    }
  }
}

function ensureConfigTabDependencies(projectPath) {
  if (!projectPath) return;
  if (state.providerCatalog.length === 0 && !state.providerCatalogLoading) {
    void loadProviderCatalog(true);
  }
  if (!getStoredProviderHealth(projectPath)) {
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
  const scopeId = getConfigScopeId();
  if (!force && state.providerHealthByProject[scopeId]) return;
  try {
    const enc = encodeURIComponent(projectPath || '');
    const data = await fetchJsonWithTimeout('/api/provider-health?projectPath=' + enc, 20000);
    state.providerHealthByProject[scopeId] = data.health || null;
  } catch (e) {
    console.warn('[dashboard] failed to load provider health', { projectPath, error: String(e) });
    state.providerHealthByProject[scopeId] = {
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
  const health = getStoredProviderHealth(projectPath);
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

function getProjectName(projectPath) {
  if (!projectPath) return '—';
  const normalized = String(projectPath).replace(/[\\/]+$/, '');
  const parts = normalized.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] || normalized || '—';
}

function localizeActivityScopeStatus(status) {
  switch (status) {
  case 'optimized':
    return t('activityScopeStatusOptimized');
  case 'no_optimization':
    return t('activityScopeStatusNoOptimization');
  case 'observing':
  default:
    return t('activityScopeStatusObserving');
  }
}

function buildScopeActivityRows(projectPath) {
  const pd = state.projectData[projectPath] || {};
  const scopes = Array.isArray(pd.activityScopes) ? pd.activityScopes : [];
  const rows = scopes.map((scope) => ({
    id: 'scope:' + scope.scopeId,
    kind: 'scope',
    scopeId: scope.scopeId,
    timestamp: scope.createdAt || '',
    updatedAt: scope.updatedAt || scope.createdAt || '',
    runtime: scope.runtime || t('activityHostFallback'),
    skillId: scope.skillId || null,
    projectName: scope.projectName || getProjectName(projectPath),
    rawStatus: scope.status || 'observing',
    status: localizeActivityScopeStatus(scope.status),
    sessionId: scope.sessionId || null,
  })).sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));

  state.activityRowsByProject[projectPath] = rows;
  return rows;
}

function isScopeActivityRow(row) {
  return Boolean(row && row.kind === 'scope' && row.scopeId);
}

function getScopeDetailCache(projectPath) {
  if (!state.activityScopeDetailsByProject[projectPath]) {
    state.activityScopeDetailsByProject[projectPath] = {};
  }
  return state.activityScopeDetailsByProject[projectPath];
}

function invalidateActivityScopeDetails(projectPath) {
  if (projectPath) {
    delete state.activityScopeDetailsByProject[projectPath];
    return;
  }
  state.activityScopeDetailsByProject = {};
}

function formatScopeTimelineNodeLabel(nodeType) {
  switch (nodeType) {
  case 'skill_called':
    return t('activityScopeNodeSkillCalled');
  case 'analysis_submitted':
    return t('activityScopeNodeAnalysisSubmitted');
  case 'analysis_result':
    return t('activityScopeNodeAnalysisResult');
  case 'optimization_completed':
    return t('activityScopeNodeOptimizationCompleted');
  case 'no_optimization':
    return t('activityScopeNodeNoOptimization');
  default:
    return t('activityDetailFallback');
  }
}

function renderScopeDetailValue(value) {
  return value ? escHtml(String(value)) : escHtml(t('activityDetailFallback'));
}

function renderScopeStatusBadge(rawStatus) {
  const normalized = rawStatus === 'optimized' || rawStatus === 'no_optimization'
    ? rawStatus
    : 'observing';
  return '<span class="activity-scope-status activity-scope-status-' + normalized + '">' +
    escHtml(localizeActivityScopeStatus(normalized)) +
    '</span>';
}

function renderScopeMetric(label, value) {
  return '<span class="activity-scope-metric">' +
    '<span class="activity-scope-metric-label">' + escHtml(label) + '</span>' +
    '<span class="activity-scope-metric-value">' + escHtml(value) + '</span>' +
    '</span>';
}

function renderActivityScopeTimelineNode(node) {
  const metrics = [];
  if (node.traceCount != null) {
    metrics.push(renderScopeMetric(t('activityScopeTraceCount'), String(node.traceCount) + (currentLang === 'zh' ? ' 条 trace' : ' traces')));
  }
  if (node.charCount != null) {
    metrics.push(renderScopeMetric(t('activityScopeCharCount'), String(node.charCount) + (currentLang === 'zh' ? ' 字符' : ' chars')));
  }
  if (node.model) {
    metrics.push(renderScopeMetric(t('activityScopeModel'), String(node.model)));
  }

  return '<div class="activity-scope-node">' +
    '<div class="activity-scope-node-head">' +
      '<div class="activity-scope-node-title">' + escHtml(formatScopeTimelineNodeLabel(node.type)) + '</div>' +
      '<div class="activity-scope-node-time">' + escHtml(formatEventTimestamp(node.timestamp)) + '</div>' +
    '</div>' +
    '<div class="activity-scope-node-summary">' + escHtml(node.summary || t('activityDetailFallback')) + '</div>' +
    (metrics.length > 0 ? ('<div class="activity-scope-metrics">' + metrics.join('') + '</div>') : '') +
    (node.traceText
      ? '<details class="activity-scope-traces"><summary>' + escHtml(t('activityScopeSubmittedTraceText')) + '</summary><pre>' + escHtml(node.traceText) + '</pre></details>'
      : '') +
    '</div>';
}

function renderActivityScopeDetail(detail) {
  const timeline = Array.isArray(detail?.timeline) ? detail.timeline : [];
  return '<div class="activity-scope-detail">' +
    '<div class="activity-scope-summary">' +
      '<div class="activity-scope-summary-item"><span class="activity-scope-summary-label">' + escHtml(t('traceTime')) + '</span><span class="activity-scope-summary-value">' + escHtml(formatEventTimestamp(detail.createdAt)) + '</span></div>' +
      '<div class="activity-scope-summary-item"><span class="activity-scope-summary-label">' + escHtml(t('activitySkillLabel')) + '</span><span class="activity-scope-summary-value">' + renderScopeDetailValue(detail.skillId || '—') + '</span></div>' +
      '<div class="activity-scope-summary-item"><span class="activity-scope-summary-label">' + escHtml(t('traceRuntime')) + '</span><span class="activity-scope-summary-value">' + renderScopeDetailValue(detail.runtime || t('activityHostFallback')) + '</span></div>' +
      '<div class="activity-scope-summary-item"><span class="activity-scope-summary-label">' + escHtml(t('activityProject')) + '</span><span class="activity-scope-summary-value">' + renderScopeDetailValue(detail.projectName || '—') + '</span></div>' +
      '<div class="activity-scope-summary-item"><span class="activity-scope-summary-label">' + escHtml(t('traceStatus')) + '</span><span class="activity-scope-summary-value">' + renderScopeStatusBadge(detail.status) + '</span></div>' +
      '<div class="activity-scope-summary-item"><span class="activity-scope-summary-label">' + escHtml(t('traceScope')) + '</span><span class="activity-scope-summary-value">' + renderScopeDetailValue(detail.scopeId || '—') + '</span></div>' +
    '</div>' +
    '<div class="activity-scope-timeline">' +
      timeline.map((node) => renderActivityScopeTimelineNode(node)).join('') +
    '</div>' +
  '</div>';
}

function buildActivityScopeDetailText(detail) {
  if (!detail) return t('activityDetailEmpty');
  const lines = [
    t('traceTime') + ': ' + formatEventTimestamp(detail.createdAt),
    t('activitySkillLabel') + ': ' + (detail.skillId || '—'),
    t('traceRuntime') + ': ' + (detail.runtime || t('activityHostFallback')),
    t('activityProject') + ': ' + (detail.projectName || '—'),
    t('traceStatus') + ': ' + localizeActivityScopeStatus(detail.status),
    t('traceScope') + ': ' + (detail.scopeId || '—'),
    '',
    t('activityScopeTimelineTitle') + ':',
  ];

  for (const node of Array.isArray(detail.timeline) ? detail.timeline : []) {
    lines.push(
      formatScopeTimelineNodeLabel(node.type) + ' | ' + formatEventTimestamp(node.timestamp),
      node.summary || t('activityDetailFallback')
    );
    if (node.traceCount != null) lines.push(t('activityScopeTraceCount') + ': ' + node.traceCount);
    if (node.charCount != null) lines.push(t('activityScopeCharCount') + ': ' + node.charCount);
    if (node.model) lines.push(t('activityScopeModel') + ': ' + node.model);
    if (node.traceText) {
      lines.push(t('activityScopeSubmittedTraceText') + ':', node.traceText);
    }
    lines.push('');
  }

  return lines.join('\\n').trim();
}

async function fetchActivityScopeDetail(projectPath, scopeId) {
  const cache = getScopeDetailCache(projectPath);
  if (cache[scopeId]) return cache[scopeId];
  const encodedProjectPath = encodeURIComponent(projectPath);
  const encodedScopeId = encodeURIComponent(scopeId);
  const response = await fetchJsonWithTimeout('/api/projects/' + encodedProjectPath + '/activity-scopes/' + encodedScopeId, 12000);
  cache[scopeId] = response.detail || null;
  return cache[scopeId];
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
      t('activitySkillLabel') + ': ' + (row.skillId || '—'),
      t('activityDetailNode') + ': ' + formatActivityNode(row),
      t('activityDetailInput') + ': ' + buildActivityInputText(row),
      t('activityDetailSummary') + ': ' + failure.summary,
      (currentLang === 'zh' ? '对结果的影响' : 'Impact') + ': ' + failure.impact,
      t('activityDetailNextStep') + ': ' + failure.action,
    ];
    if (failure.technical) {
      lines.push((currentLang === 'zh' ? '原始技术信息' : 'Technical Detail') + ': ' + failure.technical);
    }
    return lines.join('\\n');
  }
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
    t('activitySkillLabel') + ': ' + (row.skillId || '—'),
    t('activityDetailNode') + ': ' + formatActivityNode(row),
    t('activityDetailInput') + ': ' + buildActivityInputText(row),
    t('activityDetailSummary') + ': ' + (row.detail || t('activityDetailFallback')),
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
  const rows = buildScopeActivityRows(projectPath);
  console.debug('[dashboard] activity scope rows rebuilt', {
    projectPath,
    rowCount: rows.length,
  });
  return rows;
}

function getActivityRow(projectPath, rowId) {
  const rows = (state.activityRowsByProject[projectPath] || []).concat(state.rawActivityRowsByProject[projectPath] || []);
  return rows.find((row) => row.id === rowId) || null;
}

function setEventModalContentHtml(html) {
  const el = document.getElementById('eventModalContent');
  if (!el) return;
  el.innerHTML = html;
  if (typeof HTMLElement === 'undefined' || !(el instanceof HTMLElement)) {
    el.textContent = String(html).replace(/<[^>]+>/g, '');
  }
}

async function copyActivityDetail(projectPath, rowId) {
  const row = getActivityRow(projectPath, rowId);
  const text = isScopeActivityRow(row)
    ? buildActivityScopeDetailText(await fetchActivityScopeDetail(projectPath, row.scopeId))
    : buildActivityDetail(row);
  state.lastCopiedActivityText = text;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    await navigator.clipboard.writeText(text);
  }
}

async function openActivityScopeDetail(projectPath, scopeId, fallbackSkillId = '—') {
  document.getElementById('eventModalTitle').textContent = fallbackSkillId + ' · ' + t('activityScopeTimelineTitle');
  setEventModalContentHtml('<pre class="activity-detail-text">' + escHtml(t('activityScopeDetailLoading')) + '</pre>');
  document.getElementById('eventModal').classList.add('visible');
  try {
    const detail = await fetchActivityScopeDetail(projectPath, scopeId);
    if (!detail) {
      setEventModalContentHtml('<pre class="activity-detail-text">' + escHtml(t('activityDetailEmpty')) + '</pre>');
      return;
    }
    document.getElementById('eventModalTitle').textContent = (detail.skillId || fallbackSkillId || '—') + ' · ' + t('activityScopeTimelineTitle');
    setEventModalContentHtml(renderActivityScopeDetail(detail));
  } catch (error) {
    console.warn('[dashboard] failed to load activity scope detail', {
      projectPath,
      scopeId,
      error: String(error),
    });
    setEventModalContentHtml('<pre class="activity-detail-text">' + escHtml(t('activityScopeDetailLoadFailed') + ' ' + String(error)) + '</pre>');
  }
}

async function openActivityDetail(projectPath, rowId) {
  const row = getActivityRow(projectPath, rowId);
  if (isScopeActivityRow(row)) {
    return openActivityScopeDetail(projectPath, row.scopeId, row.skillId || '—');
  }

  document.getElementById('eventModalTitle').textContent = row
    ? ((row.rawTrace ? summarizeTraceEventType(row.rawTrace) : businessEventLabel(row.tag)) + ' · ' + (row.skillId || '—'))
    : t('activityDetailTitle');
  setEventModalContentHtml('<pre class="activity-detail-text">' + escHtml(buildActivityDetail(row)) + '</pre>');
  document.getElementById('eventModal').classList.add('visible');
}

async function openVersionScopeDetail(encProject, scopeId) {
  if (!scopeId) return;
  return openActivityScopeDetail(decodeURIComponent(encProject), scopeId);
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
  return renderDashboardBusinessEvents({
    events,
    projectPath,
    projectName: getProjectName(projectPath),
    deps: {
      escHtml,
      escJsStr,
      formatEventTimestamp,
      getActivityColumnStyle,
      renderActivitySkillCell,
      renderScopeStatusBadge,
      t,
    },
  });
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

function normalizeCostModelKey(modelName) {
  const segments = String(modelName || '')
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean);
  if (segments.length === 0) return '';

  while (segments.length >= 3 && String(segments[0]).toLowerCase() === String(segments[1]).toLowerCase()) {
    segments.splice(1, 1);
  }

  return segments.join('/');
}

function buildCostModelAliases(modelName) {
  const normalized = normalizeCostModelKey(modelName);
  if (!normalized) return [];
  const segments = normalized.split('/').filter(Boolean);
  const aliases = new Set([normalized]);
  if (segments.length > 1) {
    aliases.add(segments.slice(1).join('/'));
    aliases.add(segments[segments.length - 1]);
  }
  return [...aliases];
}

function getLiteLLMModelDetailsIndex() {
  const index = {};
  const catalog = Array.isArray(state.providerCatalog) ? state.providerCatalog : [];
  for (const provider of catalog) {
    const details = Array.isArray(provider.modelDetails) ? provider.modelDetails : [];
    for (const detail of details) {
      if (!detail || !detail.id) continue;
      for (const alias of buildCostModelAliases(detail.id)) {
        if (!index[alias]) index[alias] = detail;
      }
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
      const rawKey = String(key || '');
      const normalizedKey = options?.type === 'model' ? normalizeCostModelKey(rawKey) : rawKey;
      const detail = options?.type === 'model'
        ? (buildCostModelAliases(normalizedKey)
          .map((alias) => modelDetailsIndex[alias] || null)
          .find(Boolean) || null)
        : null;
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
  return renderDashboardCapabilityPills({
    detail,
    deps: {
      escHtml,
      t,
    },
  });
}

function renderCostBreakdown(title, rows, emptyText, formatter, countLabel) {
  return renderDashboardCostBreakdown({
    title,
    rows,
    emptyText,
    formatter,
    countLabel,
    deps: {
      escHtml,
      formatPlainNumber,
      formatUsageCompact,
      t,
    },
  });
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
  return renderDashboardMetricRows({
    title,
    rows,
    emptyText,
    deps: {
      escHtml,
      formatCompactNumber,
    },
  });
}

function renderCostPanel(projectPath) {
  return renderDashboardCostPanel({
    deps: {
      buildCostRows,
      escHtml,
      formatContextWindow,
      formatDurationMs,
      formatPlainNumber,
      formatUsd,
      formatUsdPerMillion,
      formatUsageCompact,
      getLiteLLMModelDetailsIndex,
      renderCapabilityPills,
      renderCostBreakdown,
      t,
      timeAgo,
    },
    projectData: state.projectData[projectPath] || {},
  });
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
  const filteredSkills = getFilteredAndSortedSkills(skills);
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

    \${state.selectedMainTab === 'overview'
      ? renderDashboardOverviewPanel({
        agentUsage,
        daemon,
        decisionSummary,
        deps: {
          escHtml,
          formatUptime,
          formatUsageCompact,
          renderMetricRows,
          renderStateBadge,
          renderTraceBars,
          t,
          timeAgo,
        },
        hasDecisionEvents: decisionEvents.length > 0,
        skillsCount: skills.length,
        traceStats,
      })
      : ''}

    \${state.selectedMainTab === 'skills'
      ? renderDashboardSkillsPanel({
        deps: {
          renderSkillCard,
          renderSkillsEmptyState,
          t,
        },
        filteredSkills,
        projectPath,
        searchQuery: state.searchQuery,
        selectedRuntimeTab: state.selectedRuntimeTab,
        sortBy: state.sortBy,
        sortOrder: state.sortOrder,
      })
      : ''}

    \${state.selectedMainTab === 'activity'
      ? renderDashboardActivityPanel({
        activityLayer: state.activityLayer,
        deps: {
          renderBusinessEvents,
          renderRecentTraces,
          renderTraceBars,
          t,
        },
        projectPath,
        recentTraces,
        traceStats,
      })
      : ''}

    \${state.selectedMainTab === 'cost' ? \`
    <div class="card">
      <div class="card-header"><span>\${t('mainTabCost')}</span><span style="color:var(--muted)">\${agentUsage.callCount ?? 0}</span></div>
      <div class="card-body">
        \${renderCostPanel(projectPath)}
      </div>
    </div>
    \` : ''}

    \${state.selectedMainTab === 'logs' ? renderDashboardLogsPanel({ deps: { t }, logFilter: state.logFilter }) : ''}

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
  if (tab !== 'config' && state.selectedProjectId && state.staleProjectData[state.selectedProjectId]) {
    void loadProjectSnapshot(state.selectedProjectId, { force: true }).then(() => {
      if (state.selectedProjectId) {
        safeRenderMainPanel(state.selectedProjectId, 'selectMainTab:refresh:' + tab);
      }
    });
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
  const config = getStoredConfig(projectPath) || {
    autoOptimize: true,
    userConfirm: false,
    runtimeSync: true,
    llmSafety: DEFAULT_LLM_SAFETY_CONFIG,
    promptOverrides: DEFAULT_PROMPT_OVERRIDES,
    defaultProvider: '',
    logLevel: 'info',
    providers: [],
  };
  const loading = getStoredConfigLoading(projectPath);
  const loadError = getStoredConfigLoadError(projectPath);
  const configUi = getStoredConfigUi(projectPath);

  const providers = Array.isArray(config.providers) ? config.providers : [];
  const llmSafety = sanitizeLLMSafetyForState(config.llmSafety);
  const promptOverrides = sanitizePromptOverridesForState(config.promptOverrides);
  const activeProviderIndex = getActiveProviderIndex(config.defaultProvider, providers);
  const rowsHtml = providers.length > 0
    ? providers.map((row, index) => renderProviderRow(projectPath, row, index, activeProviderIndex)).join('')
    : \`<div class="config-help">\${t('configNoProviders')}</div>\`;

  return renderDashboardConfigPanel({
    deps: {
      escHtml,
      t,
    },
    connectivityHtml: renderConnectivityResultsHtml(configUi.connectivityResults),
    llmSafety,
    loading,
    loadError,
    promptOverrides,
    providerCatalogError: state.providerCatalogError,
    providerCatalogLoading: state.providerCatalogLoading,
    rowsHtml,
    saveHint: configUi.saveHint || '',
  });
}

function retryLoadConfig() {
  if (!state.selectedProjectId) return;
  const scopeId = getConfigScopeId();
  delete state.configByProject[scopeId];
  delete state.configByProject[state.selectedProjectId];
  state.configLoadErrorByProject[scopeId] = '';
  state.configLoadErrorByProject[state.selectedProjectId] = '';
  void ensureProjectConfig(state.selectedProjectId);
  safeRenderMainPanel(state.selectedProjectId, 'reloadProjectConfig');
}

async function loadProviderCatalog(force = false) {
  if (state.providerCatalogLoading) return;
  if (!force && state.providerCatalog.length > 0) return;
  state.providerCatalogLoading = true;
  state.providerCatalogError = '';
  if ((state.selectedMainTab === 'config' || state.selectedMainTab === 'cost') && state.selectedProjectId) {
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
    console.debug('[dashboard] provider catalog loaded', {
      providerCount: providers.length,
      selectedMainTab: state.selectedMainTab,
    });
  } catch (e) {
    state.providerCatalogError = String(e);
    console.error('[dashboard] provider catalog fetch failed', { error: String(e) });
  } finally {
    state.providerCatalogLoading = false;
    if ((state.selectedMainTab === 'config' || state.selectedMainTab === 'cost') && state.selectedProjectId) {
      safeRenderMainPanel(state.selectedProjectId, 'scheduleProjectConfigSave.complete');
    }
  }
}

function reloadProviderCatalog() {
  void loadProviderCatalog(true);
}

function setConfigUi(projectPath, patch) {
  const scopeId = getConfigScopeId();
  const prev = getStoredConfigUi(projectPath);
  state.configUiByProject[scopeId] = { ...prev, ...patch };
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

function getConfigApiKeyVisibility(projectPath) {
  const configUi = getStoredConfigUi(projectPath);
  const visibility = configUi?.apiKeyVisibilityByRow;
  return visibility && typeof visibility === 'object' ? visibility : {};
}

function isConfigApiKeyVisible(projectPath, rowIndex) {
  const visibility = getConfigApiKeyVisibility(projectPath);
  return !!visibility[String(rowIndex)];
}

function setConfigApiKeyVisible(projectPath, rowIndex, visible) {
  const visibility = getConfigApiKeyVisibility(projectPath);
  setConfigUi(projectPath, {
    apiKeyVisibilityByRow: {
      ...visibility,
      [String(rowIndex)]: !!visible,
    },
  });
}

function renderProviderRow(projectPath, row, index, activeProviderIndex) {
  const normalizedProvider = String(row.provider || '');
  const knownProvider = isKnownProvider(normalizedProvider);
  const providerOptions = getProviderOptionsHtml(knownProvider ? normalizedProvider : '__custom__');
  const normalizedModel = String(row.modelName || '');
  const modelOptions = getModelOptionsHtml(normalizedProvider, normalizedModel);
  const modelIsCustom = !isKnownModel(normalizedProvider, normalizedModel);
  const apiKey = String(row.apiKey || '');
  const apiKeyEnvVar = String(row.apiKeyEnvVar || guessApiKeyEnvVar(normalizedProvider));
  const apiKeyVisible = isConfigApiKeyVisible(projectPath, index);
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
        <div class="config-secret-field">
          <input class="config-input cfg_api_key" type="\${apiKeyVisible ? 'text' : 'password'}" value="\${escHtml(apiKey)}" placeholder="\${t('configApiKeyPastePlaceholder')}" oninput="scheduleProjectConfigSave(500)" />
          <button class="btn-secondary config-secret-toggle cfg_api_key_toggle" type="button" onclick="toggleApiKeyVisibility(\${index}, this)">\${apiKeyVisible ? t('configApiKeyHide') : t('configApiKeyShow')}</button>
        </div>
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

function toggleApiKeyVisibility(rowIndex, trigger) {
  const projectPath = state.selectedProjectId;
  if (!projectPath || !trigger) return;
  const row = typeof trigger.closest === 'function' ? trigger.closest('.provider-row') : null;
  const input = row && typeof row.querySelector === 'function' ? row.querySelector('.cfg_api_key') : null;
  const nextVisible = input ? input.type === 'password' : !isConfigApiKeyVisible(projectPath, rowIndex);

  if (input) {
    input.type = nextVisible ? 'text' : 'password';
  }
  trigger.textContent = nextVisible ? t('configApiKeyHide') : t('configApiKeyShow');
  setConfigApiKeyVisible(projectPath, rowIndex, nextVisible);
  console.info('[dashboard] config api key visibility changed', {
    projectPath,
    rowIndex,
    visible: nextVisible,
  });
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
  const scopeId = getConfigScopeId();
  const config = getStoredConfig(state.selectedProjectId) || {};
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
  state.configByProject[scopeId] = { ...config, defaultProvider: nextDefaultProvider, providers: rows };
  safeRenderMainPanel(state.selectedProjectId, 'addProviderRow');
  scheduleProjectConfigSave(150);
}

function removeProviderRow(btn) {
  if (!state.selectedProjectId) return;
  const scopeId = getConfigScopeId();
  const row = btn.closest('.provider-row');
  if (!row) return;
  const index = Number(row.getAttribute('data-row-index'));
  const config = getStoredConfig(state.selectedProjectId) || {};
  const rows = document.getElementById('cfg_providers_rows')
    ? collectProvidersFromConfigEditor()
    : (Array.isArray(config.providers) ? config.providers.slice() : []);
  if (Number.isInteger(index) && index >= 0 && index < rows.length) {
    rows.splice(index, 1);
  }
  const nextDefaultProvider = rows.some((item) => item.provider === config.defaultProvider)
    ? config.defaultProvider
    : (rows[0]?.provider || '');
  state.configByProject[scopeId] = { ...config, defaultProvider: nextDefaultProvider, providers: rows };
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
  const scopeId = getConfigScopeId();
  if (state.configByProject[scopeId]) return;
  if (state.configLoadingByProject[scopeId]) return;
  state.configLoadingByProject[scopeId] = true;
  state.configLoadErrorByProject[scopeId] = '';
  try {
    let data = null;
    const enc = encodeURIComponent(projectPath || '');
    try {
      data = await fetchJsonWithTimeout('/api/config?projectPath=' + enc, 6000);
    } catch (firstErr) {
      console.warn('[dashboard] first config fetch failed, retrying', { projectPath, error: String(firstErr) });
      data = await fetchJsonWithTimeout('/api/config?projectPath=' + enc, 12000);
    }
    state.configByProject[scopeId] = {
      ...(data.config || {}),
      llmSafety: sanitizeLLMSafetyForState(data?.config?.llmSafety),
      promptOverrides: sanitizePromptOverridesForState(data?.config?.promptOverrides),
      providers: sanitizeProvidersForState(data?.config?.providers),
    };
    state.configLoadErrorByProject[scopeId] = '';
    if (state.selectedMainTab === 'config' && state.selectedProjectId === projectPath) {
      safeRenderMainPanel(projectPath, 'checkProvidersConnectivity.start');
    }
  } catch (e) {
    const message = String(e);
    console.error('[dashboard] failed to load config', { projectPath, error: message });
    state.configLoadErrorByProject[scopeId] = message;
    if (state.selectedMainTab === 'config' && state.selectedProjectId === projectPath) {
      safeRenderMainPanel(projectPath, 'checkProvidersConnectivity.end');
    }
  } finally {
    state.configLoadingByProject[scopeId] = false;
  }
}

async function saveProjectConfig(options = {}) {
  if (!state.selectedProjectId) return;
  const projectPath = state.selectedProjectId;
  const scopeId = getConfigScopeId();
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
    const currentConfig = getStoredConfig(projectPath) || {};
    const llmSafety = collectLLMSafetyFromConfigEditor(currentConfig.llmSafety);
    const promptOverrides = collectPromptOverridesFromConfigEditor(currentConfig.promptOverrides);
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
        llmSafety,
        promptOverrides,
        defaultProvider: selectedProviderIndex >= 0 ? (providers[selectedProviderIndex]?.provider || '') : '',
        logLevel: currentConfig.logLevel || 'info',
        providers,
      },
    };
    await fetchJsonWithTimeout('/api/config', 8000, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    state.configByProject[scopeId] = {
      ...payload.config,
      llmSafety: sanitizeLLMSafetyForState(payload.config.llmSafety),
      promptOverrides: sanitizePromptOverridesForState(payload.config.promptOverrides),
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
  const scopeId = getConfigScopeId();
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
    const currentConfig = getStoredConfig(projectPath) || {};
    const llmSafety = collectLLMSafetyFromConfigEditor(currentConfig.llmSafety);
    const selectedProviderIndex = getSelectedProviderIndexFromEditor(
      providers.length,
      currentConfig.defaultProvider,
      providers
    );
    const data = await fetchJsonWithTimeout('/api/config/providers/connectivity', 15000, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providers: providersToCheck }),
    });
    state.configByProject[scopeId] = {
      ...(state.configByProject[scopeId] || {}),
      llmSafety,
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
  return renderDashboardStateBadge({
    state,
    deps: {
      t,
    },
  });
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
  return renderDashboardSkillsEmptyState({
    searchQuery: state.searchQuery,
    deps: {
      escHtml,
      t,
    },
  });
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
  return renderDashboardSkillCard({
    skill,
    projectPath,
    searchQuery: state.searchQuery,
    deps: {
      escHtml,
      escJsStr,
      highlightText,
      maxVersion,
      t,
      timeAgo,
    },
  });
}

function renderTraceBars(label, data, keys) {
  return renderDashboardTraceBars({ label, data, keys });
}

function renderRecentTraces(traces) {
  const projectPath = state.selectedProjectId;
  const rows = projectPath ? buildRawTraceRows(projectPath) : [];
  return projectPath
    ? renderDashboardRecentTraces({
      projectPath,
      rows,
      deps: {
        escHtml,
        escJsStr,
        formatEventTimestamp,
        getActivityColumnStyle,
        summarizeTraceEventType,
        t,
      },
    })
    : '';
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
  document.getElementById('modalSaveBtn').textContent = t('modalSave');
  document.getElementById('modalApplyAllBtn').disabled = false;
  document.getElementById('modalApplyAllBtn').textContent = t('modalApplyAllButton');

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
    const encSkill = encodeURIComponent(skillId);
    const encRuntime = encodeURIComponent(runtime);
    const r = await fetch(\`/api/projects/\${enc}/skills/\${encSkill}?runtime=\${encRuntime}\`);
    if (!r.ok) {
      throw new Error(\`HTTP \${r.status}: \${r.statusText}\`);
    }
    const data = await r.json();
    document.getElementById('modalContent').value = data.content ?? t('modalNoContent');

    // Render version history
    const versions = data.versions ?? [];
    state.currentSkillVersions = Array.isArray(versions) ? versions.slice() : [];
    state.currentSkillEffectiveVersion = typeof data.effectiveVersion === 'number' ? data.effectiveVersion : null;
    state.currentSkillVersion = typeof data.effectiveVersion === 'number'
      ? data.effectiveVersion
      : (versions.length > 0 ? Math.max(...versions) : null);
    state.currentSkillVersionMeta = {};
    state.currentSkillVersionContextKey = getSkillVersionContextKey(enc, encSkill, encRuntime);
    renderVersionHistory(enc, encSkill, encRuntime);
    if (versions.length > 0) {
      // Preload metadata for every card so the history summary is visible before any click.
      await Promise.allSettled(versions.map((version) => loadVersionMeta(enc, encSkill, encRuntime, version)));
    }
  } catch (e) {
    console.error('[dashboard] failed to load skill content', { projectPath, skillId, runtime, error: String(e) });
    document.getElementById('modalContent').value = t('modalLoadError');
  }
}

async function loadVersionMeta(encProject, encSkill, encRuntime, version) {
  const contextKey = getSkillVersionContextKey(encProject, encSkill, encRuntime);
  try {
    const r = await fetch(\`/api/projects/\${encProject}/skills/\${encSkill}/versions/\${version}?runtime=\${encRuntime}\`);
    if (!r.ok) return;
    const data = await r.json();
    if (state.currentSkillVersionContextKey !== contextKey) return;
    if (!state.currentSkillVersionMeta || typeof state.currentSkillVersionMeta !== 'object') {
      state.currentSkillVersionMeta = {};
    }
    state.currentSkillVersionMeta[version] = data.metadata || null;
    renderVersionHistory(encProject, encSkill, encRuntime);
    const el = document.getElementById(\`vmeta_\${version}\`);
    if (el && data.metadata) {
      el.innerHTML = renderVersionMetaHtml(encProject, data.metadata);
    }
  } catch (e) {
    console.warn('[dashboard] failed to load version metadata', { encProject, encSkill, version, error: String(e) });
  }
}

async function loadVersion(encProject, encSkill, encRuntime, version) {
  const contextKey = getSkillVersionContextKey(encProject, encSkill, encRuntime);
  try {
    const r = await fetch(\`/api/projects/\${encProject}/skills/\${encSkill}/versions/\${version}?runtime=\${encRuntime}\`);
    if (!r.ok) {
      throw new Error(\`HTTP \${r.status}: \${r.statusText}\`);
    }
    const data = await r.json();
    if (state.currentSkillVersionContextKey === contextKey) {
      state.currentSkillVersion = version;
      if (!state.currentSkillVersionMeta || typeof state.currentSkillVersionMeta !== 'object') {
        state.currentSkillVersionMeta = {};
      }
      state.currentSkillVersionMeta[version] = data.metadata || state.currentSkillVersionMeta[version] || null;
      renderVersionHistory(encProject, encSkill, encRuntime);
      console.debug('[dashboard] selected skill version', { encProject, encSkill, encRuntime, version });
    }
    document.getElementById('modalContent').value = data.content ?? t('modalNoContent');
    await loadVersionMeta(encProject, encSkill, encRuntime, version);
  } catch (e) {
    console.error('[dashboard] failed to load version content', { encProject, encSkill, version, error: String(e) });
  }
}

async function toggleSkillVersionDisabled(encProject, encSkill, encRuntime, version, disabled) {
  const contextKey = getSkillVersionContextKey(encProject, encSkill, encRuntime);
  const hintEl = document.getElementById('modalSaveHint');
  try {
    const r = await fetch('/api/projects/' + encProject + '/skills/' + encSkill + '/versions/' + version + '?runtime=' + encRuntime, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ disabled: !!disabled }),
    });
    if (!r.ok) {
      const errorBody = await r.json().catch(() => ({}));
      throw new Error((errorBody && errorBody.error) || ('HTTP ' + r.status + ': ' + r.statusText));
    }
    const data = await r.json();
    if (state.currentSkillVersionContextKey !== contextKey) return;
    if (!state.currentSkillVersionMeta || typeof state.currentSkillVersionMeta !== 'object') {
      state.currentSkillVersionMeta = {};
    }
    state.currentSkillVersionMeta[version] = data.metadata || state.currentSkillVersionMeta[version] || null;
    state.currentSkillEffectiveVersion = typeof data.effectiveVersion === 'number' ? data.effectiveVersion : state.currentSkillEffectiveVersion;
    renderVersionHistory(encProject, encSkill, encRuntime);

    const projectPath = decodeURIComponent(encProject);
    const runtime = decodeURIComponent(encRuntime);
    const skillId = decodeURIComponent(encSkill);
    const pd = state.projectData[projectPath];
    const skills = Array.isArray(pd?.skills) ? pd.skills : [];
    const skill = skills.find((item) => item.skillId === skillId && (item.runtime || 'codex') === runtime);
    if (skill) {
      skill.effectiveVersion = state.currentSkillEffectiveVersion;
    }
    if (state.selectedProjectId === projectPath && state.selectedMainTab === 'skills') {
      updateSkillsList();
    }

    if (hintEl) {
      hintEl.textContent = '';
    }
    console.info('[dashboard] toggled skill version state', { encProject, encSkill, encRuntime, version, disabled, effectiveVersion: state.currentSkillEffectiveVersion });
  } catch (e) {
    console.error('[dashboard] failed to toggle skill version state', { encProject, encSkill, encRuntime, version, disabled, error: String(e) });
    if (hintEl) {
      hintEl.textContent = t('modalVersionActionFailed');
    }
  }
}

function renderApplyToAllConfirmation() {
  const titleEl = document.getElementById('applyAllConfirmTitle');
  const bodyEl = document.getElementById('applyAllConfirmBody');
  if (!titleEl || !bodyEl) return;
  const skillId = state.currentSkillId || '—';
  const runtime = state.currentSkillRuntime || 'codex';
  titleEl.textContent = t('modalApplyAllTitle');
  bodyEl.innerHTML =
    '<p><strong>' + escHtml(skillId) + ' (' + escHtml(runtime) + ')</strong></p>' +
    '<p>' + escHtml(t('modalApplyAllSavingLine')) + '</p>' +
    '<p>' + escHtml(t('modalApplyAllTargetsLine')) + '</p>' +
    '<div class="confirm-copy-note">' + escHtml(t('modalApplyAllOneOffLine')) + '</div>';
}

function openApplyToAllSkillModal() {
  if (!state.selectedProjectId || !state.currentSkillId) return;
  renderApplyToAllConfirmation();
  document.getElementById('applyAllSkillModal').classList.add('visible');
}

function closeApplyToAllSkillModal() {
  document.getElementById('applyAllSkillModal').classList.remove('visible');
}

function formatApplyToAllSummary(data) {
  const updated = Number(data?.updatedTargets ?? 0);
  const skipped = Number(data?.skippedTargets ?? 0);
  const failed = Number(data?.failedTargets ?? 0);
  if (currentLang === 'zh') {
    const parts = [
      t('modalApplyAllSummaryPrefix'),
      String(updated) + t('modalApplyAllSummaryUpdated'),
      '，',
      String(skipped) + t('modalApplyAllSummarySkipped'),
    ];
    if (failed > 0) {
      parts.push('，', String(failed) + t('modalApplyAllSummaryFailed'));
    }
    return parts.join('');
  }

  const parts = [
    t('modalApplyAllSummaryPrefix'),
    ' ',
    String(updated),
    ' ',
    t('modalApplyAllSummaryUpdated'),
    ', ',
    String(skipped),
    ' ',
    t('modalApplyAllSummarySkipped'),
  ];
  if (failed > 0) {
    parts.push(', ', String(failed), ' ', t('modalApplyAllSummaryFailed'));
  }
  return parts.join('');
}

async function refreshCurrentSkillModal(runtime, successHint = '') {
  if (!state.selectedProjectId || !state.currentSkillId) return;
  const snapshot = await loadProjectSnapshot(state.selectedProjectId, { force: true });
  if (snapshot && state.selectedMainTab === 'skills') {
    updateSkillsList();
  }
  await viewSkill(state.selectedProjectId, state.currentSkillId, runtime);
  const hintEl = document.getElementById('modalSaveHint');
  if (hintEl && successHint) {
    hintEl.textContent = successHint;
  }
}

async function saveCurrentSkill() {
  if (!state.selectedProjectId || !state.currentSkillId) return;

  const saveBtn = document.getElementById('modalSaveBtn');
  const applyAllBtn = document.getElementById('modalApplyAllBtn');
  const hintEl = document.getElementById('modalSaveHint');
  const contentEl = document.getElementById('modalContent');
  const content = contentEl?.value ?? '';
  const runtime = state.currentSkillRuntime || 'codex';

  saveBtn.disabled = true;
  if (applyAllBtn) {
    applyAllBtn.disabled = true;
  }
  hintEl.textContent = t('modalSaving');

  try {
    const encProject = encodeURIComponent(state.selectedProjectId);
    const encSkill = encodeURIComponent(state.currentSkillId);
    const data = await fetchJsonWithTimeout(\`/api/projects/\${encProject}/skills/\${encSkill}?runtime=\${encodeURIComponent(runtime)}\`, 12000, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content,
        runtime,
        reason: t('modalManualEditReason'),
      }),
    });
    const successHint = data.unchanged
      ? t('modalNoChanges')
      : (t('modalSavedVersionPrefix') + data.version);
    await refreshCurrentSkillModal(runtime, successHint);
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
    if (applyAllBtn) {
      applyAllBtn.disabled = false;
    }
  }
}

async function confirmApplyCurrentSkillToAll() {
  if (!state.selectedProjectId || !state.currentSkillId) return;

  const saveBtn = document.getElementById('modalSaveBtn');
  const applyAllBtn = document.getElementById('modalApplyAllBtn');
  const confirmBtn = document.getElementById('applyAllConfirmBtn');
  const cancelBtn = document.getElementById('applyAllCancelBtn');
  const hintEl = document.getElementById('modalSaveHint');
  const contentEl = document.getElementById('modalContent');
  const content = contentEl?.value ?? '';
  const runtime = state.currentSkillRuntime || 'codex';

  saveBtn.disabled = true;
  if (applyAllBtn) {
    applyAllBtn.disabled = true;
  }
  if (confirmBtn) {
    confirmBtn.disabled = true;
  }
  if (cancelBtn) {
    cancelBtn.disabled = true;
  }
  hintEl.textContent = t('modalApplyAllRunning');

  try {
    const encProject = encodeURIComponent(state.selectedProjectId);
    const encSkill = encodeURIComponent(state.currentSkillId);
    const data = await fetchJsonWithTimeout(\`/api/projects/\${encProject}/skills/\${encSkill}/apply-to-all?runtime=\${encodeURIComponent(runtime)}\`, 30000, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content,
        runtime,
        reason: t('modalManualEditReason'),
      }),
    });
    closeApplyToAllSkillModal();
    await refreshCurrentSkillModal(runtime, formatApplyToAllSummary(data));
  } catch (e) {
    console.error('[dashboard] failed to apply skill content to same-named skills', {
      projectPath: state.selectedProjectId,
      skillId: state.currentSkillId,
      runtime,
      error: String(e),
    });
    hintEl.textContent = t('modalApplyAllFailed');
  } finally {
    saveBtn.disabled = false;
    if (applyAllBtn) {
      applyAllBtn.disabled = false;
    }
    if (confirmBtn) {
      confirmBtn.disabled = false;
    }
    if (cancelBtn) {
      cancelBtn.disabled = false;
    }
  }
}

function closeModal() {
  document.getElementById('skillModal').classList.remove('visible');
}
// Close modal on overlay click
document.getElementById('skillModal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeModal();
});
document.getElementById('applyAllSkillModal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeApplyToAllSkillModal();
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
`;

  return renderDashboardAppShell({
    lang,
    shortBuildId,
    styleCss,
    scriptSource,
    labels: {
      headerVersion: t.headerVersion,
      headerConnecting: t.headerConnecting,
      sidebarProjects: t.sidebarProjects,
      sidebarAddProject: t.sidebarAddProject,
      sidebarAddPlaceholder: t.sidebarAddPlaceholder,
      sidebarAddHint: t.sidebarAddHint,
      mainSelectProject: t.mainSelectProject,
      modalClose: t.modalClose,
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
