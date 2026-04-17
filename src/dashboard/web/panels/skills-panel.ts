type DashboardSkillsPanelInput = {
  deps: {
    renderSkillCard: (skill: { skillId?: string }, projectPath: string) => string;
    renderSkillsEmptyState: () => string;
    t: (key: string) => string;
  };
  filteredSkills: Array<{ skillId?: string }>;
  projectPath: string;
  searchQuery: string;
  selectedRuntimeTab: string;
  sortBy: string;
  sortOrder: string;
};

export function renderDashboardSkillsPanel(input: DashboardSkillsPanelInput): string {
  const { deps } = input;

  return `
    <div class="card">
      <div class="card-header">
        <span>${deps.t('skillsTitle')}</span>
        <div style="display:flex;align-items:center;gap:12px;">
          <div class="runtime-tabs">
            <button class="runtime-tab ${input.selectedRuntimeTab === 'all' ? 'active' : ''}" onclick="selectRuntimeTab('all')">${deps.t('skillsRuntimeAll')}</button>
            <button class="runtime-tab tab-codex ${input.selectedRuntimeTab === 'codex' ? 'active' : ''}" onclick="selectRuntimeTab('codex')">Codex</button>
            <button class="runtime-tab tab-claude ${input.selectedRuntimeTab === 'claude' ? 'active' : ''}" onclick="selectRuntimeTab('claude')">Claude</button>
            <button class="runtime-tab tab-opencode ${input.selectedRuntimeTab === 'opencode' ? 'active' : ''}" onclick="selectRuntimeTab('opencode')">OpenCode</button>
          </div>
          <span style="color:var(--muted)" id="skillsCount">${input.filteredSkills.length} ${deps.t('skillsCount')}</span>
        </div>
      </div>
      <div class="card-body">
        <div class="skills-controls">
          <div class="search-box">
            <span class="search-icon">🔍</span>
            <input type="text" class="search-input" id="skillSearchInput" placeholder="${deps.t('skillsSearchPlaceholder')}" value="${input.searchQuery}" oninput="handleSearch(this.value)" />
          </div>
          <div class="sort-controls">
            <span class="sort-label">${deps.t('skillsSortLabel')}</span>
            <button class="sort-btn ${input.sortBy === 'name' ? 'active' : ''}" onclick="toggleSort('name')">
              ${deps.t('skillsSortName')} <span class="arrow">${input.sortBy === 'name' ? (input.sortOrder === 'asc' ? '↑' : '↓') : ''}</span>
            </button>
            <button class="sort-btn ${input.sortBy === 'updated' ? 'active' : ''}" onclick="toggleSort('updated')">
              ${deps.t('skillsSortUpdated')} <span class="arrow">${input.sortBy === 'updated' ? (input.sortOrder === 'asc' ? '↑' : '↓') : ''}</span>
            </button>
          </div>
        </div>

        <div id="skillsListContainer">
          ${input.filteredSkills.length === 0
            ? deps.renderSkillsEmptyState()
            : '<div class="skills-list">' + input.filteredSkills.map((skill) => deps.renderSkillCard(skill, input.projectPath)).join('') + '</div>'}
        </div>
      </div>
    </div>
  `;
}

export function renderDashboardSkillsPanelSource(): string {
  return renderDashboardSkillsPanel.toString();
}
