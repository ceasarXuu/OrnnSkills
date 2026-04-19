import type { Language } from '../i18n.js';

interface DashboardAppShellLabels {
  headerVersion: string;
  headerConnecting: string;
  sidebarProjects: string;
  sidebarAddProject: string;
  sidebarAddPlaceholder: string;
  sidebarAddHint: string;
  mainSelectProject: string;
  modalClose: string;
  modalHostLabel: string;
  modalLoading: string;
  modalApplyAllButton: string;
  modalSave: string;
  modalVersionHistory: string;
  modalApplyAllTitle: string;
  modalApplyAllCancel: string;
  modalApplyAllConfirm: string;
  activityDetailTitle: string;
  activityDetailEmpty: string;
}

interface DashboardAppShellParams {
  lang: Language;
  shortBuildId: string;
  styleCss: string;
  scriptSource: string;
  labels: DashboardAppShellLabels;
}

export function renderDashboardAppShell(params: DashboardAppShellParams): string {
  const { lang, shortBuildId, styleCss, scriptSource, labels } = params;

  return /* html */ `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>OrnnSkills Dashboard</title>
<style>
${styleCss}
</style>
</head>
<body>
<div class="app">

  <!-- Header -->
  <header class="header">
    <div class="header-left">
      <span class="header-logo">🔧 OrnnSkills</span>
      <span class="header-version" id="appVersion">${labels.headerVersion}</span>
      <span class="header-version" id="appBuild">build #${shortBuildId}</span>
    </div>
    <div style="display:flex;align-items:center;gap:16px;">
      <div class="lang-switcher">
        <button class="lang-btn ${lang === 'en' ? 'active' : ''}" onclick="switchLang('en')">EN</button>
        <button class="lang-btn ${lang === 'zh' ? 'active' : ''}" onclick="switchLang('zh')">中文</button>
      </div>
      <div class="header-status" id="headerStatus">
        <span class="dot dot-gray"></span>
        <span>${labels.headerConnecting}</span>
      </div>
    </div>
  </header>

  <div class="workspace-bar">
    <div class="workspace-tabs" id="workspaceTabs"></div>
  </div>

  <div class="main">
    <!-- Sidebar: Project List -->
    <aside class="sidebar">
      <div class="sidebar-title">${labels.sidebarProjects}</div>
      <div class="sidebar-list" id="projectList"></div>
      <div class="sidebar-add" onclick="openProjectPicker()">
        <span>＋</span><span>${labels.sidebarAddProject}</span>
      </div>
      <div class="add-form" id="addForm">
        <input type="text" id="addPathInput" placeholder="${labels.sidebarAddPlaceholder}" />
        <div class="add-form-hint">${labels.sidebarAddHint}</div>
      </div>
    </aside>

    <!-- Main Panel -->
    <main class="panel" id="mainPanel">
      <div class="no-project">${labels.mainSelectProject}</div>
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
      <div class="modal-header-actions">
        <label class="modal-runtime-select" for="modalRuntimeSelect">
          <span>${labels.modalHostLabel}</span>
          <select id="modalRuntimeSelect" onchange="switchSkillRuntime(this.value)">
            <option value="codex">Codex</option>
          </select>
        </label>
        <button class="modal-close" onclick="closeModal()">✕ ${labels.modalClose}</button>
      </div>
    </div>
    <div class="modal-body">
      <div class="modal-content">
        <textarea id="modalContent" class="modal-editor" spellcheck="false">${labels.modalLoading}</textarea>
        <div class="modal-actions">
          <span id="modalSaveHint" class="modal-save-hint"></span>
          <div class="modal-action-group">
            <button id="modalApplyAllBtn" class="btn-secondary" onclick="openApplyToAllSkillModal()">${labels.modalApplyAllButton}</button>
            <button id="modalSaveBtn" class="btn-primary" onclick="saveCurrentSkill()">${labels.modalSave}</button>
          </div>
        </div>
      </div>
      <div class="modal-history">
        <h4>${labels.modalVersionHistory}</h4>
        <div id="versionList"></div>
      </div>
    </div>
  </div>
</div>

<div class="modal-overlay" id="applyAllSkillModal">
  <div class="modal">
    <div class="modal-header">
      <div class="modal-title">
        <span id="applyAllConfirmTitle">${labels.modalApplyAllTitle}</span>
      </div>
      <button class="modal-close" onclick="closeApplyToAllSkillModal()">✕ ${labels.modalClose}</button>
    </div>
    <div class="modal-body">
      <div class="modal-content">
        <div id="applyAllConfirmBody" class="confirm-copy"></div>
        <div class="modal-actions">
          <span></span>
          <div class="modal-action-group">
            <button id="applyAllCancelBtn" class="btn-secondary" onclick="closeApplyToAllSkillModal()">${labels.modalApplyAllCancel}</button>
            <button id="applyAllConfirmBtn" class="btn-primary" onclick="confirmApplyCurrentSkillToAll()">${labels.modalApplyAllConfirm}</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

<div class="modal-overlay" id="eventModal">
  <div class="modal">
    <div class="modal-header">
      <div class="modal-title">
        <span id="eventModalTitle">${labels.activityDetailTitle}</span>
      </div>
      <button class="modal-close" onclick="closeEventModal()">✕ ${labels.modalClose}</button>
    </div>
    <div class="modal-body" style="grid-template-columns: 1fr;">
      <div class="modal-content" style="border-right:none;">
        <div id="eventModalContent"><pre class="activity-detail-text">${labels.activityDetailEmpty}</pre></div>
      </div>
    </div>
  </div>
</div>

<script>
${scriptSource}
</script>
</body>
</html>`;
}
