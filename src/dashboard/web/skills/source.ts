const DASHBOARD_SKILLS_SOURCE = `
function renderStateBadge(state) {
  return renderDashboardStateBadge({
    state,
    deps: {
      t,
    },
  });
}

function normalizeSkillRuntime(runtime) {
  return runtime === 'claude' || runtime === 'opencode' ? runtime : 'codex';
}

function getRuntimeLabel(runtime) {
  const normalized = normalizeSkillRuntime(runtime);
  if (normalized === 'claude') return 'Claude';
  if (normalized === 'opencode') return 'OpenCode';
  return 'Codex';
}

function runtimeSortValue(runtime) {
  const normalized = normalizeSkillRuntime(runtime);
  if (normalized === 'codex') return 0;
  if (normalized === 'claude') return 1;
  if (normalized === 'opencode') return 2;
  return 9;
}

function getSkillUpdatedTimestamp(skill) {
  return skill && skill.updatedAt ? new Date(skill.updatedAt).getTime() : 0;
}

function sortSkillRuntimeMembers(members) {
  return (Array.isArray(members) ? members : []).slice().sort(function(a, b) {
    const runtimeComparison = runtimeSortValue(a && a.runtime) - runtimeSortValue(b && b.runtime);
    if (runtimeComparison !== 0) return runtimeComparison;
    const updatedComparison = getSkillUpdatedTimestamp(b) - getSkillUpdatedTimestamp(a);
    if (updatedComparison !== 0) return updatedComparison;
    return String((a && a.skillId) || '').localeCompare(String((b && b.skillId) || ''));
  });
}

function getProjectSkills(projectPath) {
  const pd = state.projectData[projectPath];
  return Array.isArray(pd && pd.skills) ? pd.skills : [];
}

function findSkillRuntimes(projectPath, skillId) {
  return sortSkillRuntimeMembers(
    getProjectSkills(projectPath).filter(function(skill) {
      return (skill && skill.skillId) === skillId;
    }).map(function(skill) {
      return Object.assign({}, skill, {
        runtime: normalizeSkillRuntime(skill && skill.runtime),
      });
    })
  );
}

function resolveRuntimeFromMembers(members, preferredRuntime) {
  const normalizedPreferred = preferredRuntime ? normalizeSkillRuntime(preferredRuntime) : '';
  const normalizedSelectedTab = state.selectedRuntimeTab && state.selectedRuntimeTab !== 'all'
    ? normalizeSkillRuntime(state.selectedRuntimeTab)
    : '';
  const normalizedStatePreferred = normalizeSkillRuntime(state.preferredSkillRuntime);
  const normalizedMembers = sortSkillRuntimeMembers((Array.isArray(members) ? members : []).map(function(member) {
    return Object.assign({}, member, {
      runtime: normalizeSkillRuntime(member && member.runtime),
    });
  }));

  if (normalizedMembers.length === 0) {
    return 'codex';
  }

  const availableRuntimes = normalizedMembers.map(function(member) {
    return normalizeSkillRuntime(member.runtime);
  });

  if (normalizedPreferred && availableRuntimes.indexOf(normalizedPreferred) >= 0) {
    return normalizedPreferred;
  }

  if (normalizedSelectedTab && availableRuntimes.indexOf(normalizedSelectedTab) >= 0) {
    return normalizedSelectedTab;
  }

  if (normalizedStatePreferred && availableRuntimes.indexOf(normalizedStatePreferred) >= 0) {
    return normalizedStatePreferred;
  }

  if (availableRuntimes.indexOf('codex') >= 0) {
    return 'codex';
  }

  return availableRuntimes[0];
}

function persistPreferredSkillRuntime(runtime) {
  const normalized = normalizeSkillRuntime(runtime);
  state.preferredSkillRuntime = normalized;
  try {
    localStorage.setItem(SKILL_MODAL_RUNTIME_STORAGE_KEY, normalized);
  } catch (error) {
    console.warn('[dashboard] failed to persist preferred skill host', {
      runtime: normalized,
      error: String(error),
    });
  }
  console.info('[dashboard] preferred skill host updated', { runtime: normalized });
}

function buildGroupedSkill(skillId, members) {
  const runtimeMembers = sortSkillRuntimeMembers(members).map(function(member) {
    return Object.assign({}, member, {
      runtime: normalizeSkillRuntime(member && member.runtime),
    });
  });
  const selectedRuntime = resolveRuntimeFromMembers(runtimeMembers);
  const selectedMember = runtimeMembers.find(function(member) {
    return normalizeSkillRuntime(member.runtime) === selectedRuntime;
  }) || runtimeMembers[0] || {};
  const latestMember = runtimeMembers.slice().sort(function(a, b) {
    return getSkillUpdatedTimestamp(b) - getSkillUpdatedTimestamp(a);
  })[0] || selectedMember;
  const totalTraceCount = runtimeMembers.reduce(function(sum, member) {
    return sum + Number((member && member.traceCount) || 0);
  }, 0);

  return Object.assign({}, selectedMember, {
    skillId: skillId,
    runtime: selectedRuntime,
    runtimeMembers: runtimeMembers.map(function(member) {
      return { runtime: normalizeSkillRuntime(member.runtime) };
    }),
    traceCount: totalTraceCount,
    updatedAt: latestMember && latestMember.updatedAt ? latestMember.updatedAt : selectedMember.updatedAt,
    members: runtimeMembers,
  });
}

function buildGroupedSkills(skills) {
  const groups = new Map();
  (Array.isArray(skills) ? skills : []).forEach(function(skill) {
    const skillId = skill && skill.skillId ? skill.skillId : '';
    if (!skillId) return;
    if (!groups.has(skillId)) {
      groups.set(skillId, []);
    }
    groups.get(skillId).push(skill);
  });

  return Array.from(groups.entries()).map(function(entry) {
    return buildGroupedSkill(entry[0], entry[1]);
  });
}

function isSkillLibraryViewActive() {
  return normalizeMainTab(state.selectedMainTab) === 'skills' && normalizeSkillsSubTab(state.selectedSkillsSubTab) === 'skill_library';
}

function getSkillLibraryFamilies() {
  return Array.isArray(state.skillFamilies) ? state.skillFamilies : [];
}

function getCurrentProjectSkillInstances(projectPath) {
  const pd = state.projectData[projectPath];
  return Array.isArray(pd && pd.skillInstances) ? pd.skillInstances : [];
}

function getCurrentSkillProjectId() {
  return state.currentSkillProjectId || state.selectedProjectId || '';
}

async function loadProjectSkillInstances(projectPath, force = false) {
  if (!projectPath) return [];
  const pd = state.projectData[projectPath];
  if (!pd) return [];
  if (!force && Array.isArray(pd.skillInstances) && pd.skillInstances.length > 0) {
    return pd.skillInstances;
  }

  try {
    const encProject = encodeURIComponent(projectPath);
    const data = await fetchJsonWithTimeout('/api/projects/' + encProject + '/skill-instances', 12000);
    pd.skillInstances = Array.isArray(data && data.instances) ? data.instances : [];
  } catch (error) {
    console.warn('[dashboard] failed to load project skill instances', {
      projectPath: projectPath,
      error: String(error),
    });
    pd.skillInstances = Array.isArray(pd.skillInstances) ? pd.skillInstances : [];
  }

  return pd.skillInstances;
}

function resolveCurrentSkillInstanceId(projectPath, skillId, runtime) {
  if (!projectPath || !skillId) return null;
  const normalizedRuntime = normalizeSkillRuntime(runtime);
  const instances = getCurrentProjectSkillInstances(projectPath);
  const matched = instances.find(function(instance) {
    return instance && instance.skillId === skillId && normalizeSkillRuntime(instance.runtime) === normalizedRuntime;
  });
  return matched ? matched.instanceId : null;
}

function matchesFamilySearch(family) {
  if (!state.searchQuery) return true;
  const query = state.searchQuery;
  const familyName = String((family && family.familyName) || '').toLowerCase();
  const runtimes = (Array.isArray(family && family.runtimes) ? family.runtimes : []).join(' ').toLowerCase();
  const status = String((family && family.status) || '').toLowerCase();
  return familyName.indexOf(query) >= 0 || runtimes.indexOf(query) >= 0 || status.indexOf(query) >= 0;
}

function getSkillLibraryUpdatedTimestamp(family) {
  return family && family.lastSeenAt ? new Date(family.lastSeenAt).getTime() : 0;
}

function getFilteredAndSortedSkillFamilies() {
  let families = getSkillLibraryFamilies().slice();

  if (state.selectedRuntimeTab !== 'all') {
    families = families.filter(function(family) {
      return (Array.isArray(family && family.runtimes) ? family.runtimes : []).some(function(runtime) {
        return normalizeSkillRuntime(runtime) === state.selectedRuntimeTab;
      });
    });
  }

  families = families.filter(matchesFamilySearch);
  families.sort(function(a, b) {
    let comparison = 0;
    if (state.sortBy === 'updated') {
      comparison = getSkillLibraryUpdatedTimestamp(a) - getSkillLibraryUpdatedTimestamp(b);
    } else {
      comparison = String((a && a.familyName) || '').localeCompare(String((b && b.familyName) || ''));
    }
    return state.sortOrder === 'asc' ? comparison : -comparison;
  });

  return families;
}

function getSkillLibraryInstanceTimestamp(instance) {
  return instance && instance.lastUsedAt ? new Date(instance.lastUsedAt).getTime() : 0;
}

function getSkillLibraryInstances(familyId) {
  return Array.isArray(state.skillFamilyInstancesById[familyId]) ? state.skillFamilyInstancesById[familyId] : [];
}

function sortSkillLibraryInstances(instances) {
  const selectedProjectPath = state.selectedProjectId || '';
  const currentProjectPath = getCurrentSkillProjectId();
  const preferredRuntime = normalizeSkillRuntime(state.preferredSkillRuntime);

  return (Array.isArray(instances) ? instances : []).slice().sort(function(a, b) {
    const aCurrent = a && a.instanceId === state.currentSkillInstanceId ? 1 : 0;
    const bCurrent = b && b.instanceId === state.currentSkillInstanceId ? 1 : 0;
    if (aCurrent !== bCurrent) return bCurrent - aCurrent;

    const aCurrentProject = a && a.projectPath === currentProjectPath ? 1 : 0;
    const bCurrentProject = b && b.projectPath === currentProjectPath ? 1 : 0;
    if (aCurrentProject !== bCurrentProject) return bCurrentProject - aCurrentProject;

    const aSelectedProject = a && a.projectPath === selectedProjectPath ? 1 : 0;
    const bSelectedProject = b && b.projectPath === selectedProjectPath ? 1 : 0;
    if (aSelectedProject !== bSelectedProject) return bSelectedProject - aSelectedProject;

    const aPreferredRuntime = normalizeSkillRuntime(a && a.runtime) === preferredRuntime ? 1 : 0;
    const bPreferredRuntime = normalizeSkillRuntime(b && b.runtime) === preferredRuntime ? 1 : 0;
    if (aPreferredRuntime !== bPreferredRuntime) return bPreferredRuntime - aPreferredRuntime;

    const lastUsedComparison = getSkillLibraryInstanceTimestamp(b) - getSkillLibraryInstanceTimestamp(a);
    if (lastUsedComparison !== 0) return lastUsedComparison;

    const runtimeComparison = runtimeSortValue(a && a.runtime) - runtimeSortValue(b && b.runtime);
    if (runtimeComparison !== 0) return runtimeComparison;

    return String((a && a.projectPath) || '').localeCompare(String((b && b.projectPath) || ''));
  });
}

function resolveSkillLibraryTargetInstance(familyId, options) {
  const settings = options || {};
  const instances = sortSkillLibraryInstances(getSkillLibraryInstances(familyId));
  if (instances.length === 0) return null;

  if (settings.instanceId) {
    const directMatch = instances.find(function(instance) {
      return instance && instance.instanceId === settings.instanceId;
    });
    if (directMatch) return directMatch;
  }

  if (settings.runtime) {
    const normalizedRuntime = normalizeSkillRuntime(settings.runtime);
    const runtimeMatches = instances.filter(function(instance) {
      return normalizeSkillRuntime(instance && instance.runtime) === normalizedRuntime;
    });
    if (runtimeMatches.length > 0) {
      const preferredProjectPath = settings.projectPath || getCurrentSkillProjectId() || state.selectedProjectId || '';
      const projectMatch = runtimeMatches.find(function(instance) {
        return instance && instance.projectPath === preferredProjectPath;
      });
      return projectMatch || runtimeMatches[0];
    }
  }

  const currentInstance = instances.find(function(instance) {
    return instance && instance.instanceId === state.currentSkillInstanceId;
  });
  if (currentInstance) return currentInstance;

  const preferredProjectPath = state.selectedProjectId || '';
  const preferredRuntime = normalizeSkillRuntime(state.preferredSkillRuntime);
  const sameProjectPreferredRuntime = instances.find(function(instance) {
    return instance &&
      instance.projectPath === preferredProjectPath &&
      normalizeSkillRuntime(instance.runtime) === preferredRuntime;
  });
  if (sameProjectPreferredRuntime) return sameProjectPreferredRuntime;

  const sameProject = instances.find(function(instance) {
    return instance && instance.projectPath === preferredProjectPath;
  });
  if (sameProject) return sameProject;

  const preferredRuntimeMatch = instances.find(function(instance) {
    return normalizeSkillRuntime(instance && instance.runtime) === preferredRuntime;
  });
  return preferredRuntimeMatch || instances[0];
}

function renderSkillLibraryInstances(familyId, instances) {
  if (instances.length === 0) {
    return '<div class="empty-state">' + t('skillsEmpty') + '</div>';
  }

  return instances.map(function(instance) {
    const activeCls = instance && instance.instanceId === state.currentSkillInstanceId ? ' active' : '';
    return '<button class="skill-instance-item' + activeCls + '" type="button" onclick="openSkillLibraryInstance(\\'' + escJsStr(familyId) + '\\',\\'' + escJsStr(instance.instanceId) + '\\')">' +
      '<span class="skill-instance-project">' + escHtml(instance.projectPath || '') + '</span>' +
      '<span class="skill-instance-meta">' +
        escHtml(getRuntimeLabel(instance.runtime)) +
        ' · v' + escHtml(String(instance.effectiveVersion || 0)) +
        ' · ' + escHtml(instance.status || 'active') +
      '</span>' +
    '</button>';
  }).join('');
}

function getSkillFamilyStatusDotClass(status) {
  const normalizedStatus = String(status || '').toLowerCase();
  if (normalizedStatus === 'error') return 'dot-red';
  if (normalizedStatus === 'optimizing') return 'dot-yellow';
  if (normalizedStatus === 'analyzing') return 'dot-blue';
  if (normalizedStatus === 'idle' || normalizedStatus === 'active') return 'dot-green';
  return 'dot-gray';
}

function formatSkillFamilyRuntimeSummary(family) {
  const runtimes = (Array.isArray(family && family.runtimes) ? family.runtimes : [])
    .map(function(runtime) {
      return normalizeSkillRuntime(runtime);
    })
    .sort(function(a, b) {
      return runtimeSortValue(a) - runtimeSortValue(b);
    })
    .map(function(runtime) {
      return getRuntimeLabel(runtime);
    });

  if (runtimes.length === 0) return 'No runtimes';
  if (runtimes.length === 1) return runtimes[0];
  return runtimes[0] + ' +' + String(runtimes.length - 1);
}

function renderFamilyCard(family) {
  const activeCls = family && family.familyId === state.selectedSkillFamilyId ? ' active' : '';
  const usage = family && family.usage ? family.usage : { observedCalls: 0 };
  const status = String((family && family.status) || 'idle');
  const dotClass = getSkillFamilyStatusDotClass(status);
  const runtimeSummary = formatSkillFamilyRuntimeSummary(family);
  const metaParts = [
    escHtml(String(family.instanceCount || 0)) + ' ' + t('sidebarSkills'),
    escHtml(String(family.projectCount || 0)) + ' projects',
    escHtml(String(usage.observedCalls || 0)) + ' ' + t('skillTraces'),
    escHtml(runtimeSummary),
  ];

  if (family && family.lastUsedAt) {
    metaParts.push(timeAgo(family.lastUsedAt));
  }
  if (family && family.hasDivergedContent) {
    metaParts.push('forked');
  }

  return '<button class="skill-nav-item project-item' + activeCls + '" type="button" onclick="selectSkillFamily(\\'' + escJsStr(family.familyId) + '\\')">' +
    '<div class="project-top">' +
      '<div class="project-name skill-name">' +
        '<span class="dot ' + dotClass + '"></span>' +
        '<span>' + highlightText(family.familyName || '', state.searchQuery) + '</span>' +
      '</div>' +
      '<span class="skill-nav-badge">' + escHtml(String(family.instanceCount || 0)) + '</span>' +
    '</div>' +
    '<div class="project-path" title="' + escHtml(family.familyId || '') + '">' + escHtml(family.familyId || family.familyName || '') + '</div>' +
    '<div class="project-meta">' + metaParts.join(' · ') + '</div>' +
  '</button>';
}

function renderSkillLibraryDetail() {
  const familyId = state.selectedSkillFamilyId;
  if (!familyId) {
    return '<div class="card" id="skillLibraryInlineDetailContainer"><div class="card-body"><div class="empty-state">' + t('skillsEmpty') + '</div></div></div>';
  }

  const family = state.skillFamilyDetailsById[familyId] || getSkillLibraryFamilies().find(function(item) {
    return item && item.familyId === familyId;
  });
  const instances = sortSkillLibraryInstances(getSkillLibraryInstances(familyId));
  if (!family) {
    return '<div class="card" id="skillLibraryInlineDetailContainer"><div class="card-body"><div class="empty-state">' + t('mainLoading') + '</div></div></div>';
  }

  const activeInstance = resolveSkillLibraryTargetInstance(familyId);
  if (activeInstance && (
    state.currentSkillInstanceId !== activeInstance.instanceId ||
    getCurrentSkillProjectId() !== activeInstance.projectPath ||
    normalizeSkillRuntime(state.currentSkillRuntime) !== normalizeSkillRuntime(activeInstance.runtime)
  )) {
    void ensureSkillLibraryInlineSkill(familyId, { instanceId: activeInstance.instanceId });
  }

  const availableRuntimes = (Array.isArray(family && family.runtimes) ? family.runtimes : [])
    .map(function(runtime) { return normalizeSkillRuntime(runtime); });
  const runtimeOptions = (availableRuntimes.length > 0 ? availableRuntimes : [normalizeSkillRuntime(activeInstance && activeInstance.runtime)]);
  const selectedRuntime = normalizeSkillRuntime((activeInstance && activeInstance.runtime) || state.currentSkillRuntime || runtimeOptions[0] || 'codex');
  const visibleInstances = instances.filter(function(instance) {
    return normalizeSkillRuntime(instance && instance.runtime) === selectedRuntime;
  });
  const runtimeOptionsHtml = runtimeOptions.map(function(runtime) {
    return '<option value="' + escHtml(runtime) + '">' + escHtml(getRuntimeLabel(runtime)) + '</option>';
  }).join('');
  const historyPlaceholder = '<div style="font-size:11px;color:var(--muted)">' + escHtml(t('mainLoading')) + '</div>';
  const editorHtml = instances.length === 0
    ? '<div class="empty-state">' + t('skillsEmpty') + '</div>'
    : '<div class="skill-inline-editor-layout">' +
      '<div class="skill-inline-editor-pane">' +
        '<textarea id="skillInlineContent" class="modal-editor" spellcheck="false">' + escHtml(t('modalLoading')) + '</textarea>' +
        '<div class="modal-actions">' +
          '<span id="skillInlineSaveHint" class="modal-save-hint"></span>' +
          '<div class="modal-action-group">' +
            '<button id="skillInlineApplyAllBtn" class="btn-secondary" onclick="openApplyToAllSkillModal()">' + t('modalApplyAllButton') + '</button>' +
            '<button id="skillInlineSaveBtn" class="btn-primary" onclick="saveCurrentSkill()">' + t('modalSave') + '</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="modal-history skill-inline-history">' +
        '<h4>' + t('modalVersionHistory') + '</h4>' +
        '<div id="skillInlineVersionList">' + historyPlaceholder + '</div>' +
      '</div>' +
    '</div>';

  return '<div class="card skill-inline-card" id="skillLibraryInlineDetailContainer">' +
    '<div class="card-header skill-inline-card-header">' +
      '<div class="skill-inline-header-copy">' +
        '<div class="skill-inline-title-row">' +
          '<span id="skillInlineName">' + escHtml((activeInstance && activeInstance.skillId) || family.familyName || '') + '</span>' +
          '<span id="skillInlineStatus"></span>' +
        '</div>' +
        '<div class="project-summary-meta">' +
          '<span>' + escHtml(String((family.usage && family.usage.observedCalls) || 0)) + ' ' + t('skillTraces') + '</span>' +
          '<span>' + escHtml(String((family.projectCount) || 0)) + ' projects</span>' +
          '<span>' + escHtml(String((family.runtimeCount) || 0)) + ' runtimes</span>' +
        '</div>' +
      '</div>' +
      '<div class="skill-inline-header-actions">' +
        '<div class="skill-inline-project-path" id="skillInlineProjectPath">' + escHtml((activeInstance && activeInstance.projectPath) || '—') + '</div>' +
        '<label class="modal-runtime-select" for="skillInlineRuntimeSelect">' +
          '<span>' + t('traceRuntime') + '</span>' +
          '<select id="skillInlineRuntimeSelect" onchange="switchSkillRuntime(this.value)"' + (runtimeOptions.length <= 1 ? ' disabled' : '') + '>' + runtimeOptionsHtml + '</select>' +
        '</label>' +
      '</div>' +
    '</div>' +
    '<div class="card-body skill-inline-card-body">' +
      '<div class="skill-instance-strip">' + renderSkillLibraryInstances(familyId, visibleInstances) + '</div>' +
      editorHtml +
    '</div>' +
  '</div>';
}

async function ensureSkillLibraryInlineSkill(familyId, options) {
  if (!familyId) return;
  const target = resolveSkillLibraryTargetInstance(familyId, options);
  if (!target) {
    if (isSkillLibraryViewActive()) {
      safeRenderMainPanel('', 'ensureSkillLibraryInlineSkill:empty');
    }
    return;
  }

  const targetRuntime = normalizeSkillRuntime(target.runtime);
  const isSameTarget =
    state.currentSkillInstanceId === target.instanceId &&
    getCurrentSkillProjectId() === target.projectPath &&
    state.currentSkillId === target.skillId &&
    normalizeSkillRuntime(state.currentSkillRuntime) === targetRuntime;

  if (isSameTarget && !(options && options.force)) {
    return;
  }

  console.info('[dashboard] selected skill library instance', {
    familyId: familyId,
    instanceId: target.instanceId,
    projectPath: target.projectPath,
    runtime: targetRuntime,
  });
  await viewSkill(target.projectPath, target.skillId, targetRuntime, target.instanceId);
}

async function loadSkillLibrary(force = false, options) {
  if (state.skillLibraryLoading) return state.skillFamilies;
  if (!force && state.skillLibraryLoaded && Array.isArray(state.skillFamilies) && state.skillFamilies.length > 0) {
    if (isSkillLibraryViewActive() && state.selectedSkillFamilyId) {
      void ensureSkillLibraryInlineSkill(state.selectedSkillFamilyId);
    }
    return state.skillFamilies;
  }

  state.skillLibraryLoading = true;
  state.skillLibraryError = '';
  try {
    const data = await fetchJsonWithTimeout('/api/skills/families', 12000);
    state.skillFamilies = Array.isArray(data && data.families) ? data.families : [];
    state.skillLibraryLoaded = true;
    if (state.selectedSkillFamilyId && !state.skillFamilies.some(function(item) { return item && item.familyId === state.selectedSkillFamilyId; })) {
      state.selectedSkillFamilyId = null;
    }
    if (!state.selectedSkillFamilyId && state.skillFamilies.length > 0) {
      state.selectedSkillFamilyId = state.skillFamilies[0].familyId;
    }
    if (state.selectedSkillFamilyId) {
      await loadSkillFamilyDetail(state.selectedSkillFamilyId, force, options);
    } else if (isSkillLibraryViewActive()) {
      safeRenderMainPanel('', 'loadSkillLibrary');
    }
    return state.skillFamilies;
  } catch (error) {
    state.skillLibraryError = String(error);
    if (isSkillLibraryViewActive()) {
      safeRenderMainPanel('', 'loadSkillLibrary:error');
    }
    return [];
  } finally {
    state.skillLibraryLoading = false;
  }
}

async function loadSkillFamilyDetail(familyId, force = false, options) {
  if (!familyId) return null;
  if (!force && state.skillFamilyDetailsById[familyId] && state.skillFamilyInstancesById[familyId]) {
    if (isSkillLibraryViewActive() && state.selectedSkillFamilyId === familyId) {
      void ensureSkillLibraryInlineSkill(familyId);
    }
    return {
      family: state.skillFamilyDetailsById[familyId],
      instances: state.skillFamilyInstancesById[familyId],
    };
  }

  const encFamily = encodeURIComponent(familyId);
  const familyData = await fetchJsonWithTimeout('/api/skills/families/' + encFamily, 12000);
  const instancesData = await fetchJsonWithTimeout('/api/skills/families/' + encFamily + '/instances', 12000);
  state.skillFamilyDetailsById[familyId] = familyData.family || null;
  state.skillFamilyInstancesById[familyId] = Array.isArray(instancesData.instances) ? instancesData.instances : [];
  if (isSkillLibraryViewActive() && state.selectedSkillFamilyId === familyId) {
    const preserveInlineDetail = !!(options && options.preserveInlineDetail && state.currentSkillInstanceId);
    const instances = state.skillFamilyInstancesById[familyId];
    const hasCurrentInstance = preserveInlineDetail && instances.some(function(instance) {
      return instance && instance.instanceId === state.currentSkillInstanceId;
    });
    if (hasCurrentInstance) {
      console.debug('[dashboard] refreshed skill family detail without reloading inline editor', {
        familyId: familyId,
        instanceId: state.currentSkillInstanceId,
        runtime: state.currentSkillRuntime,
      });
    } else {
      await ensureSkillLibraryInlineSkill(familyId, { force: force });
    }
  }
  return {
    family: state.skillFamilyDetailsById[familyId],
    instances: state.skillFamilyInstancesById[familyId],
  };
}

function selectSkillFamily(familyId) {
  state.selectedSkillFamilyId = familyId;
  if (!familyId) return;
  console.info('[dashboard] selected skill library family', { familyId: familyId });
  if (!state.skillFamilyDetailsById[familyId] || !state.skillFamilyInstancesById[familyId]) {
    void loadSkillFamilyDetail(familyId, true);
    if (isSkillLibraryViewActive()) {
      safeRenderMainPanel('', 'selectSkillFamily:loading');
    }
    return;
  }
  if (isSkillLibraryViewActive()) {
    void ensureSkillLibraryInlineSkill(familyId, { force: true });
  }
}

async function openSkillLibraryInstance(familyId, instanceId) {
  if (!familyId) return;
  state.selectedSkillFamilyId = familyId;
  if (!state.skillFamilyDetailsById[familyId] || !state.skillFamilyInstancesById[familyId]) {
    await loadSkillFamilyDetail(familyId, true);
    return;
  }
  await ensureSkillLibraryInlineSkill(familyId, { force: true, instanceId: instanceId });
}

async function openSkillFamilyFromProject(familyId) {
  state.selectedMainTab = 'skills';
  state.selectedSkillsSubTab = 'skill_library';
  state.selectedSkillFamilyId = familyId;
  safeRenderMainPanel('', 'openSkillFamilyFromProject');
  await loadSkillLibrary(false);
  await loadSkillFamilyDetail(familyId, true);
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

function matchesSkillSearch(skill) {
  if (!state.searchQuery) return true;
  const query = state.searchQuery;
  const skillId = String((skill && skill.skillId) || '').toLowerCase();
  const status = String((skill && skill.status) || '').toLowerCase();
  const runtimes = (Array.isArray(skill && skill.runtimeMembers) ? skill.runtimeMembers : []).map(function(member) {
    return String(normalizeSkillRuntime(member && member.runtime)).toLowerCase();
  }).join(' ');
  return skillId.indexOf(query) >= 0 || status.indexOf(query) >= 0 || runtimes.indexOf(query) >= 0;
}

function getFilteredSkills(skills) {
  let grouped = buildGroupedSkills(skills);

  if (state.selectedRuntimeTab !== 'all') {
    grouped = grouped.filter(function(skill) {
      return (Array.isArray(skill && skill.runtimeMembers) ? skill.runtimeMembers : []).some(function(member) {
        return normalizeSkillRuntime(member && member.runtime) === state.selectedRuntimeTab;
      });
    });
  }

  return grouped.filter(matchesSkillSearch);
}

function getFilteredAndSortedSkills(skills) {
  const filtered = getFilteredSkills(skills);

  filtered.forEach(function(skill) {
    skill.runtime = resolveRuntimeFromMembers(skill.members || skill.runtimeMembers);
  });

  filtered.sort(function(a, b) {
    let comparison = 0;
    if (state.sortBy === 'name') {
      comparison = String((a && a.skillId) || '').localeCompare(String((b && b.skillId) || ''));
    } else if (state.sortBy === 'updated') {
      comparison = getSkillUpdatedTimestamp(a) - getSkillUpdatedTimestamp(b);
    }
    return state.sortOrder === 'asc' ? comparison : -comparison;
  });

  return filtered;
}

function updateSkillsList() {
  const containerId = isSkillLibraryViewActive() ? 'skillLibraryNavContainer' : 'skillsListContainer';
  const listClassName = isSkillLibraryViewActive() ? 'skill-library-nav-list' : 'skills-list';
  const container = document.getElementById(containerId);
  const countEl = document.getElementById('skillsCount');
  if (!container) return;

  if (isSkillLibraryViewActive()) {
    const filteredFamilies = getFilteredAndSortedSkillFamilies();
    if (countEl) {
      countEl.textContent = filteredFamilies.length + ' ' + t('skillsCount');
    }
    container.innerHTML = filteredFamilies.length === 0
      ? renderSkillsEmptyState()
      : '<div class="' + listClassName + '">' + filteredFamilies.map(function(family) {
        return renderFamilyCard(family);
      }).join('') + '</div>';
    return;
  }

  if (!state.selectedProjectId) return;

  const pd = state.projectData[state.selectedProjectId];
  if (!pd) return;

  const filtered = getFilteredAndSortedSkills(pd.skills || []);

  if (countEl) {
    countEl.textContent = filtered.length + ' ' + t('skillsCount');
  }

  container.innerHTML = filtered.length === 0
    ? renderSkillsEmptyState()
    : '<div class="skills-list">' + filtered.map(function(skill) {
      return renderSkillCard(skill, state.selectedProjectId);
    }).join('') + '</div>';
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
  const preferredRuntime = resolveRuntimeFromMembers(skill && skill.members ? skill.members : skill && skill.runtimeMembers, skill && skill.runtime);
  const cardSkill = Object.assign({}, skill, {
    runtime: preferredRuntime,
  });

  return renderDashboardSkillCard({
    skill: cardSkill,
    projectPath: projectPath,
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
  return renderDashboardTraceBars({ label: label, data: data, keys: keys });
}

function renderRecentTraces(traces) {
  const projectPath = state.selectedProjectId;
  const rows = projectPath ? buildRawTraceRows(projectPath) : [];
  return projectPath
    ? renderDashboardRecentTraces({
      projectPath: projectPath,
      rows: rows,
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

function isSkillLibraryInlineSurfaceActive() {
  return isSkillLibraryViewActive() && !!state.selectedSkillFamilyId;
}

function getSkillDetailElement(key) {
  const elementIds = isSkillLibraryInlineSurfaceActive()
    ? {
      applyAllBtn: 'skillInlineApplyAllBtn',
      content: 'skillInlineContent',
      projectPath: 'skillInlineProjectPath',
      runtimeSelect: 'skillInlineRuntimeSelect',
      saveBtn: 'skillInlineSaveBtn',
      saveHint: 'skillInlineSaveHint',
      status: 'skillInlineStatus',
      title: 'skillInlineName',
      versionList: 'skillInlineVersionList',
    }
    : {
      applyAllBtn: 'modalApplyAllBtn',
      content: 'modalContent',
      projectPath: '',
      runtimeSelect: 'modalRuntimeSelect',
      saveBtn: 'modalSaveBtn',
      saveHint: 'modalSaveHint',
      status: 'modalSkillStatus',
      title: 'modalSkillName',
      versionList: 'versionList',
    };
  const elementId = elementIds[key];
  return elementId ? document.getElementById(elementId) : null;
}

function getSkillVersionMetaElementId(version) {
  return (isSkillLibraryInlineSurfaceActive() ? 'skillInlineVmeta_' : 'vmeta_') + version;
}

function renderVersionHistory(encProject, encSkill, encRuntime) {
  const versionList = getSkillDetailElement('versionList');
  if (!versionList) return;
  const versions = Array.isArray(state.currentSkillVersions) ? state.currentSkillVersions : [];
  if (versions.length === 0) {
    versionList.innerHTML = '<div style="font-size:11px;color:var(--muted)">' + t('modalNoVersions') + '</div>';
    return;
  }
  const selectedVersion = state.currentSkillVersion ?? Math.max.apply(Math, versions);
  const effectiveVersion = state.currentSkillEffectiveVersion ?? selectedVersion;
  const metaByVersion = state.currentSkillVersionMeta || {};
  versionList.innerHTML = versions.slice().reverse().map(function(version) {
    const isSelected = version === selectedVersion;
    const meta = metaByVersion[version];
    const isDisabled = !!(meta && meta.isDisabled);
    const isEffective = !isDisabled && version === effectiveVersion;
    const metaHtml = renderVersionMetaHtml(encProject, meta);
    const flags = []
      .concat(isEffective ? ['<span class="version-flag effective">' + t('modalEffective') + '</span>'] : [])
      .concat(isDisabled ? ['<span class="version-flag invalid">' + t('modalInvalid') + '</span>'] : [])
      .join('');
    const actionLabel = isDisabled ? t('modalRestore') : t('modalInvalidate');
    const actionTarget = isDisabled ? 'false' : 'true';
    return '<div class="version-item ' + (isSelected ? 'current ' : '') + (isDisabled ? 'invalid' : '') + '" onclick="loadVersion(\\'' + encProject + '\\',\\'' + encSkill + '\\',\\'' + encRuntime + '\\',' + version + ')">' +
      '<div class="version-num">v' + version + '</div>' +
      (flags ? '<div class="version-flags">' + flags + '</div>' : '') +
      '<div id="' + getSkillVersionMetaElementId(version) + '" class="version-meta">' + metaHtml + '</div>' +
      '<div class="version-actions"><button class="btn-secondary" type="button" onclick="toggleSkillVersionDisabled(\\'' + encProject + '\\',\\'' + encSkill + '\\',\\'' + encRuntime + '\\',' + version + ',' + actionTarget + ');event.stopPropagation()">' + actionLabel + '</button></div>' +
    '</div>';
  }).join('');
}

function refreshInlineSkillLibraryDetail() {
  if (!isSkillLibraryInlineSurfaceActive()) return;
  const detailContainer = document.getElementById('skillLibraryInlineDetailContainer');
  if (detailContainer) {
    detailContainer.outerHTML = renderSkillLibraryDetail();
  }
}

function updateModalRuntimeSelect(runtimes, currentRuntime) {
  const select = getSkillDetailElement('runtimeSelect');
  if (!select) return;

  const normalizedRuntimes = sortSkillRuntimeMembers((Array.isArray(runtimes) ? runtimes : []).map(function(runtime) {
    return typeof runtime === 'string'
      ? { runtime: normalizeSkillRuntime(runtime) }
      : { runtime: normalizeSkillRuntime(runtime && runtime.runtime) };
  }));
  const runtimeOptions = normalizedRuntimes.length > 0 ? normalizedRuntimes : [{ runtime: 'codex' }];

  select.innerHTML = runtimeOptions.map(function(runtimeOption) {
    const runtime = normalizeSkillRuntime(runtimeOption.runtime);
    return '<option value="' + escHtml(runtime) + '">' + escHtml(getRuntimeLabel(runtime)) + '</option>';
  }).join('');
  select.value = normalizeSkillRuntime(currentRuntime || runtimeOptions[0].runtime);
  select.disabled = runtimeOptions.length <= 1;
}

function updateModalSkillHeader(projectPath, skillId, runtime) {
  const titleEl = getSkillDetailElement('title');
  const statusEl = getSkillDetailElement('status');
  const projectPathEl = getSkillDetailElement('projectPath');
  if (titleEl) {
    titleEl.textContent = skillId;
  }
  if (projectPathEl) {
    projectPathEl.textContent = projectPath || '—';
  }

  if (!statusEl) return;
  const skill = getProjectSkills(projectPath).find(function(item) {
    return item && item.skillId === skillId && normalizeSkillRuntime(item.runtime) === normalizeSkillRuntime(runtime);
  });

  if (skill) {
    const familyButton = state.currentSkillInstanceId && !isSkillLibraryViewActive()
      ? '<button class="btn-sm" onclick="openCurrentSkillFamily();event.stopPropagation()">Family</button>'
      : '';
    statusEl.innerHTML = '<span class="status-badge status-' + escHtml(skill.status) + '">' + escHtml(skill.status) + '</span>' + familyButton;
  } else {
    statusEl.innerHTML = '';
  }
}

async function openCurrentSkillFamily() {
  const projectPath = getCurrentSkillProjectId();
  if (!projectPath || !state.currentSkillId) return;
  await loadProjectSkillInstances(projectPath, false);
  const instances = getCurrentProjectSkillInstances(projectPath);
  const matched = instances.find(function(instance) {
    return instance && instance.instanceId === state.currentSkillInstanceId;
  });
  let familyId = matched ? matched.familyId : null;

  if (!familyId) {
    await loadSkillLibrary(false);
    const fallback = getSkillLibraryFamilies().find(function(family) {
      const runtimes = Array.isArray(family && family.runtimes) ? family.runtimes : [];
      return family && family.familyName === state.currentSkillId && runtimes.indexOf(state.currentSkillRuntime || 'codex') >= 0;
    });
    familyId = fallback ? fallback.familyId : null;
  }

  if (!familyId) return;

  closeModal();
  await openSkillFamilyFromProject(familyId);
}

async function viewSkill(projectPath, skillId, runtime, instanceId) {
  if (projectPath && (!state.projectData[projectPath] || state.staleProjectData[projectPath])) {
    await loadProjectSnapshot(projectPath, { force: !!state.staleProjectData[projectPath] });
  }
  const runtimeMembers = findSkillRuntimes(projectPath, skillId);
  const resolvedRuntime = runtimeMembers.length > 0
    ? resolveRuntimeFromMembers(runtimeMembers, runtime)
    : normalizeSkillRuntime(runtime);
  if (!instanceId) {
    await loadProjectSkillInstances(projectPath, false);
  }
  state.currentSkillProjectId = projectPath;
  state.currentSkillId = skillId;
  state.currentSkillInstanceId = instanceId || resolveCurrentSkillInstanceId(projectPath, skillId, resolvedRuntime);
  state.currentSkillRuntime = resolvedRuntime;
  state.currentSkillAvailableRuntimes = runtimeMembers.length > 0
    ? runtimeMembers.map(function(member) {
      return normalizeSkillRuntime(member.runtime);
    })
    : [resolvedRuntime];

  if (isSkillLibraryInlineSurfaceActive()) {
    refreshInlineSkillLibraryDetail();
  } else {
    const modal = document.getElementById('skillModal');
    if (modal) {
      modal.classList.add('visible');
    }
  }

  updateModalRuntimeSelect(state.currentSkillAvailableRuntimes, resolvedRuntime);
  updateModalSkillHeader(projectPath, skillId, resolvedRuntime);

  const saveHintEl = getSkillDetailElement('saveHint');
  if (saveHintEl) {
    saveHintEl.textContent = '';
  }
  const saveBtn = getSkillDetailElement('saveBtn');
  if (saveBtn) {
    saveBtn.disabled = false;
    saveBtn.textContent = t('modalSave');
  }
  const applyAllBtn = getSkillDetailElement('applyAllBtn');
  if (applyAllBtn) {
    applyAllBtn.disabled = false;
    applyAllBtn.textContent = t('modalApplyAllButton');
  }

  const contentEl = getSkillDetailElement('content');
  if (contentEl) {
    contentEl.value = t('modalLoading');
  }

  try {
    const enc = encodeURIComponent(projectPath);
    const encSkill = encodeURIComponent(skillId);
    const encRuntime = encodeURIComponent(resolvedRuntime);
    const r = await fetch('/api/projects/' + enc + '/skills/' + encSkill + '?runtime=' + encRuntime);
    if (!r.ok) {
      throw new Error('HTTP ' + r.status + ': ' + r.statusText);
    }
    const data = await r.json();
    if (contentEl) {
      contentEl.value = data.content ?? t('modalNoContent');
    }

    const versions = data.versions ?? [];
    state.currentSkillVersions = Array.isArray(versions) ? versions.slice() : [];
    state.currentSkillEffectiveVersion = typeof data.effectiveVersion === 'number' ? data.effectiveVersion : null;
    state.currentSkillVersion = typeof data.effectiveVersion === 'number'
      ? data.effectiveVersion
      : (versions.length > 0 ? Math.max.apply(Math, versions) : null);
    state.currentSkillVersionMeta = {};
    state.currentSkillVersionContextKey = getSkillVersionContextKey(enc, encSkill, encRuntime);
    renderVersionHistory(enc, encSkill, encRuntime);

    if (versions.length > 0) {
      await Promise.allSettled(versions.map(function(version) {
        return loadVersionMeta(enc, encSkill, encRuntime, version);
      }));
    }
  } catch (e) {
    console.error('[dashboard] failed to load skill content', {
      projectPath: projectPath,
      skillId: skillId,
      runtime: resolvedRuntime,
      error: String(e),
    });
    if (contentEl) {
      contentEl.value = t('modalLoadError');
    }
  }
}

async function switchSkillRuntime(runtime) {
  const normalized = normalizeSkillRuntime(runtime);
  let projectPath = getCurrentSkillProjectId();
  persistPreferredSkillRuntime(normalized);

  const select = getSkillDetailElement('runtimeSelect');
  if (select) {
    select.value = normalized;
  }

  if (!state.currentSkillId) {
    return;
  }

  let targetInstanceId = resolveCurrentSkillInstanceId(projectPath, state.currentSkillId, normalized);
  if (isSkillLibraryViewActive() && state.selectedSkillFamilyId) {
    const targetInstance = resolveSkillLibraryTargetInstance(state.selectedSkillFamilyId, {
      projectPath: projectPath,
      runtime: normalized,
    });
    if (targetInstance) {
      projectPath = targetInstance.projectPath;
      targetInstanceId = targetInstance.instanceId;
    }
  }

  if (!projectPath) {
    return;
  }

  console.info('[dashboard] switching skill modal host', {
    projectPath: projectPath,
    skillId: state.currentSkillId,
    runtime: normalized,
  });

  await viewSkill(
    projectPath,
    state.currentSkillId,
    normalized,
    targetInstanceId
  );

  if (normalizeMainTab(state.selectedMainTab) === 'project') {
    updateSkillsList();
  }
}

async function loadVersionMeta(encProject, encSkill, encRuntime, version) {
  const contextKey = getSkillVersionContextKey(encProject, encSkill, encRuntime);
  try {
    const versionUrl = state.currentSkillInstanceId
      ? '/api/projects/' + encProject + '/skill-instances/' + encodeURIComponent(state.currentSkillInstanceId) + '/versions/' + version
      : '/api/projects/' + encProject + '/skills/' + encSkill + '/versions/' + version + '?runtime=' + encRuntime;
    const r = await fetch(versionUrl);
    if (!r.ok) return;
    const data = await r.json();
    if (state.currentSkillVersionContextKey !== contextKey) return;
    if (!state.currentSkillVersionMeta || typeof state.currentSkillVersionMeta !== 'object') {
      state.currentSkillVersionMeta = {};
    }
    state.currentSkillVersionMeta[version] = data.metadata || null;
    renderVersionHistory(encProject, encSkill, encRuntime);
    const el = document.getElementById(getSkillVersionMetaElementId(version));
    if (el && data.metadata) {
      el.innerHTML = renderVersionMetaHtml(encProject, data.metadata);
    }
  } catch (e) {
    console.warn('[dashboard] failed to load version metadata', {
      encProject: encProject,
      encSkill: encSkill,
      version: version,
      error: String(e),
    });
  }
}

async function loadVersion(encProject, encSkill, encRuntime, version) {
  const contextKey = getSkillVersionContextKey(encProject, encSkill, encRuntime);
  try {
    const versionUrl = state.currentSkillInstanceId
      ? '/api/projects/' + encProject + '/skill-instances/' + encodeURIComponent(state.currentSkillInstanceId) + '/versions/' + version
      : '/api/projects/' + encProject + '/skills/' + encSkill + '/versions/' + version + '?runtime=' + encRuntime;
    const r = await fetch(versionUrl);
    if (!r.ok) {
      throw new Error('HTTP ' + r.status + ': ' + r.statusText);
    }
    const data = await r.json();
    if (state.currentSkillVersionContextKey === contextKey) {
      state.currentSkillVersion = version;
      if (!state.currentSkillVersionMeta || typeof state.currentSkillVersionMeta !== 'object') {
        state.currentSkillVersionMeta = {};
      }
      state.currentSkillVersionMeta[version] = data.metadata || state.currentSkillVersionMeta[version] || null;
      renderVersionHistory(encProject, encSkill, encRuntime);
      console.debug('[dashboard] selected skill version', {
        encProject: encProject,
        encSkill: encSkill,
        encRuntime: encRuntime,
        version: version,
      });
    }
    const contentEl = getSkillDetailElement('content');
    if (contentEl) {
      contentEl.value = data.content ?? t('modalNoContent');
    }
    await loadVersionMeta(encProject, encSkill, encRuntime, version);
  } catch (e) {
    console.error('[dashboard] failed to load version content', {
      encProject: encProject,
      encSkill: encSkill,
      version: version,
      error: String(e),
    });
  }
}

async function toggleSkillVersionDisabled(encProject, encSkill, encRuntime, version, disabled) {
  const contextKey = getSkillVersionContextKey(encProject, encSkill, encRuntime);
  const hintEl = getSkillDetailElement('saveHint');
  try {
    const versionUrl = state.currentSkillInstanceId
      ? '/api/projects/' + encProject + '/skill-instances/' + encodeURIComponent(state.currentSkillInstanceId) + '/versions/' + version
      : '/api/projects/' + encProject + '/skills/' + encSkill + '/versions/' + version + '?runtime=' + encRuntime;
    const r = await fetch(versionUrl, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ disabled: !!disabled }),
    });
    if (!r.ok) {
      const errorBody = await r.json().catch(function() { return {}; });
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
    const skills = Array.isArray(pd && pd.skills) ? pd.skills : [];
    const skill = skills.find(function(item) {
      return item && item.skillId === skillId && normalizeSkillRuntime(item.runtime) === normalizeSkillRuntime(runtime);
    });
    if (skill) {
      skill.effectiveVersion = state.currentSkillEffectiveVersion;
    }
    if (state.selectedProjectId === projectPath && normalizeMainTab(state.selectedMainTab) === 'project') {
      updateSkillsList();
    }
    if (normalizeMainTab(state.selectedMainTab) === 'skills' && normalizeSkillsSubTab(state.selectedSkillsSubTab) === 'skill_library') {
      void loadSkillLibrary(true);
    }

    if (hintEl) {
      hintEl.textContent = '';
    }
    console.info('[dashboard] toggled skill version state', {
      encProject: encProject,
      encSkill: encSkill,
      encRuntime: encRuntime,
      version: version,
      disabled: disabled,
      effectiveVersion: state.currentSkillEffectiveVersion,
    });
  } catch (e) {
    console.error('[dashboard] failed to toggle skill version state', {
      encProject: encProject,
      encSkill: encSkill,
      encRuntime: encRuntime,
      version: version,
      disabled: disabled,
      error: String(e),
    });
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
  const preview = state.currentSkillApplyPreview;
  const previewSummary = preview && typeof preview.totalTargets === 'number'
    ? 'This will target ' + preview.totalTargets + ' related instances.'
    : t('modalApplyAllTargetsLine');
  const previewTargets = preview && Array.isArray(preview.targets) && preview.targets.length > 0
    ? '<div class="confirm-copy-note">' + preview.targets.slice(0, 5).map(function(target) {
      return escHtml(target.projectPath + ' · ' + getRuntimeLabel(target.runtime));
    }).join('<br>') + '</div>'
    : '<div class="confirm-copy-note">' + escHtml(t('modalApplyAllOneOffLine')) + '</div>';
  titleEl.textContent = t('modalApplyAllTitle');
  bodyEl.innerHTML =
    '<p><strong>' + escHtml(skillId) + ' (' + escHtml(runtime) + ')</strong></p>' +
    '<p>' + escHtml(t('modalApplyAllSavingLine')) + '</p>' +
    '<p>' + escHtml(previewSummary) + '</p>' +
    previewTargets;
}

async function loadApplyToAllPreview() {
  const projectPath = getCurrentSkillProjectId();
  if (!projectPath || !state.currentSkillInstanceId) {
    state.currentSkillApplyPreview = null;
    renderApplyToAllConfirmation();
    return;
  }

  try {
    const encProject = encodeURIComponent(projectPath);
    state.currentSkillApplyPreview = await fetchJsonWithTimeout(
      '/api/projects/' + encProject + '/skill-instances/' + encodeURIComponent(state.currentSkillInstanceId) + '/apply-preview',
      12000
    );
  } catch (error) {
    console.warn('[dashboard] failed to load apply-to-family preview', {
      projectPath: projectPath,
      instanceId: state.currentSkillInstanceId,
      error: String(error),
    });
    state.currentSkillApplyPreview = null;
  }

  renderApplyToAllConfirmation();
}

function openApplyToAllSkillModal() {
  if (!getCurrentSkillProjectId() || !state.currentSkillId) return;
  state.currentSkillApplyPreview = null;
  renderApplyToAllConfirmation();
  document.getElementById('applyAllSkillModal').classList.add('visible');
  void loadApplyToAllPreview();
}

function closeApplyToAllSkillModal() {
  document.getElementById('applyAllSkillModal').classList.remove('visible');
}

function formatApplyToAllSummary(data) {
  const updated = Number(data && data.updatedTargets || 0);
  const skipped = Number(data && data.skippedTargets || 0);
  const failed = Number(data && data.failedTargets || 0);
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

async function refreshCurrentSkillModal(runtime, successHint) {
  const projectPath = getCurrentSkillProjectId();
  if (!projectPath || !state.currentSkillId) return;
  const snapshot = await loadProjectSnapshot(projectPath, { force: true });
  if (snapshot && normalizeMainTab(state.selectedMainTab) === 'project') {
    updateSkillsList();
  }
  if (normalizeMainTab(state.selectedMainTab) === 'skills' && normalizeSkillsSubTab(state.selectedSkillsSubTab) === 'skill_library') {
    await loadSkillLibrary(true);
  }
  await viewSkill(projectPath, state.currentSkillId, runtime, state.currentSkillInstanceId);
  const hintEl = getSkillDetailElement('saveHint');
  if (hintEl && successHint) {
    hintEl.textContent = successHint;
  }
}

async function saveCurrentSkill() {
  const projectPath = getCurrentSkillProjectId();
  if (!projectPath || !state.currentSkillId) return;

  const saveBtn = getSkillDetailElement('saveBtn');
  const applyAllBtn = getSkillDetailElement('applyAllBtn');
  const hintEl = getSkillDetailElement('saveHint');
  const contentEl = getSkillDetailElement('content');
  const content = contentEl && contentEl.value ? contentEl.value : '';
  const runtime = state.currentSkillRuntime || 'codex';

  if (saveBtn) {
    saveBtn.disabled = true;
  }
  if (applyAllBtn) {
    applyAllBtn.disabled = true;
  }
  if (hintEl) {
    hintEl.textContent = t('modalSaving');
  }

  try {
    const encProject = encodeURIComponent(projectPath);
    const encSkill = encodeURIComponent(state.currentSkillId);
    const saveUrl = state.currentSkillInstanceId
      ? '/api/projects/' + encProject + '/skill-instances/' + encodeURIComponent(state.currentSkillInstanceId)
      : '/api/projects/' + encProject + '/skills/' + encSkill + '?runtime=' + encodeURIComponent(runtime);
    const data = await fetchJsonWithTimeout(saveUrl, 12000, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: content,
        runtime: runtime,
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
      runtime: runtime,
      error: String(e),
    });
    if (hintEl) {
      hintEl.textContent = t('modalSaveFailed');
    }
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
    }
    if (applyAllBtn) {
      applyAllBtn.disabled = false;
    }
  }
}

async function confirmApplyCurrentSkillToAll() {
  const projectPath = getCurrentSkillProjectId();
  if (!projectPath || !state.currentSkillId) return;

  const saveBtn = getSkillDetailElement('saveBtn');
  const applyAllBtn = getSkillDetailElement('applyAllBtn');
  const confirmBtn = document.getElementById('applyAllConfirmBtn');
  const cancelBtn = document.getElementById('applyAllCancelBtn');
  const hintEl = getSkillDetailElement('saveHint');
  const contentEl = getSkillDetailElement('content');
  const content = contentEl && contentEl.value ? contentEl.value : '';
  const runtime = state.currentSkillRuntime || 'codex';

  if (saveBtn) {
    saveBtn.disabled = true;
  }
  if (applyAllBtn) {
    applyAllBtn.disabled = true;
  }
  if (confirmBtn) {
    confirmBtn.disabled = true;
  }
  if (cancelBtn) {
    cancelBtn.disabled = true;
  }
  if (hintEl) {
    hintEl.textContent = t('modalApplyAllRunning');
  }

  try {
    const encProject = encodeURIComponent(projectPath);
    const encSkill = encodeURIComponent(state.currentSkillId);
    const applyUrl = state.currentSkillInstanceId
      ? '/api/projects/' + encProject + '/skill-instances/' + encodeURIComponent(state.currentSkillInstanceId) + '/apply-to-family'
      : '/api/projects/' + encProject + '/skills/' + encSkill + '/apply-to-all?runtime=' + encodeURIComponent(runtime);
    const data = await fetchJsonWithTimeout(applyUrl, 30000, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: content,
        runtime: runtime,
        reason: t('modalManualEditReason'),
      }),
    });
    closeApplyToAllSkillModal();
    await refreshCurrentSkillModal(runtime, formatApplyToAllSummary(data));
  } catch (e) {
    console.error('[dashboard] failed to apply skill content to same-named skills', {
      projectPath: state.selectedProjectId,
      skillId: state.currentSkillId,
      runtime: runtime,
      error: String(e),
    });
    if (hintEl) {
      hintEl.textContent = t('modalApplyAllFailed');
    }
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
    }
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

document.getElementById('skillModal').addEventListener('click', function(e) {
  if (e.target === e.currentTarget) closeModal();
});
document.getElementById('applyAllSkillModal').addEventListener('click', function(e) {
  if (e.target === e.currentTarget) closeApplyToAllSkillModal();
});
document.getElementById('eventModal').addEventListener('click', function(e) {
  if (e.target === e.currentTarget) closeEventModal();
});
`;

const DASHBOARD_SKILL_LIBRARY_STALE_SNAPSHOT_SNIPPET = `  if (projectPath && (!state.projectData[projectPath] || state.staleProjectData[projectPath])) {
    await loadProjectSnapshot(projectPath, { force: !!state.staleProjectData[projectPath] });
  }`;

const DASHBOARD_SKILL_LIBRARY_STALE_SNAPSHOT_OPTIMIZED = `  const hasProjectSnapshot = !!(projectPath && state.projectData[projectPath]);
  const shouldRefreshProjectSnapshot = !!projectPath && (
    !hasProjectSnapshot ||
    (state.staleProjectData[projectPath] && !isSkillLibraryInlineSurfaceActive())
  );
  if (shouldRefreshProjectSnapshot) {
    await loadProjectSnapshot(projectPath, { force: !!state.staleProjectData[projectPath] });
  }`;

export function renderDashboardSkillsSource(): string {
  return DASHBOARD_SKILLS_SOURCE.replace(
    DASHBOARD_SKILL_LIBRARY_STALE_SNAPSHOT_SNIPPET,
    DASHBOARD_SKILL_LIBRARY_STALE_SNAPSHOT_OPTIMIZED
  );
}
