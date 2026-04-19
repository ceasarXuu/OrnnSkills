import { describe, expect, it } from 'vitest';

describe('dashboard skills dual view', () => {
  it('stores the global skill-library state separately from project snapshots', async () => {
    const { createDashboardState, buildEmptyProjectData } = await import('../../src/dashboard/web/state.js');

    const state = createDashboardState(() => ({}), () => 'codex');
    const emptyProjectData = buildEmptyProjectData();

    expect(state.selectedSkillsSubTab).toBe('project_overview');
    expect(state.skillFamilies).toEqual([]);
    expect(state.skillFamilyDetailsById).toEqual({});
    expect(state.skillFamilyInstancesById).toEqual({});
    expect(state.skillLibraryLoaded).toBe(false);
    expect(emptyProjectData.skillGroups).toEqual([]);
    expect(emptyProjectData.skillInstances).toEqual([]);
  });

  it('renders main panel source with project navigation only for the project workbench', async () => {
    const { renderDashboardMainPanelSource } = await import('../../src/dashboard/web/main-panel/source.js');

    const source = renderDashboardMainPanelSource();

    expect(source).toContain("normalizeSkillsSubTab(state.selectedSkillsSubTab) === 'project_overview'");
    expect(source).toContain("activeSubTab === 'project_overview'");
    expect(source).toContain('renderProjectWorkbenchContent');
    expect(source).toContain('renderSkillLibraryContent');
  });
});