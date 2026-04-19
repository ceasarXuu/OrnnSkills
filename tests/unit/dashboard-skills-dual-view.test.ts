import { describe, expect, it } from 'vitest';

describe('dashboard skills dual view', () => {
  it('stores the global skill-library state separately from project snapshots', async () => {
    const { createDashboardState, buildEmptyProjectData } = await import('../../src/dashboard/web/state.js');

    const state = createDashboardState(() => ({}), () => 'codex');
    const emptyProjectData = buildEmptyProjectData();

    expect(state.selectedSkillsSubTab).toBe('skill_library');
    expect(state.skillFamilies).toEqual([]);
    expect(state.skillFamilyDetailsById).toEqual({});
    expect(state.skillFamilyInstancesById).toEqual({});
    expect(state.skillLibraryLoaded).toBe(false);
    expect(emptyProjectData.skillGroups).toEqual([]);
    expect(emptyProjectData.skillInstances).toEqual([]);
  });

  it('renders main panel source with project navigation on the standalone project tab', async () => {
    const { renderDashboardMainPanelSource } = await import('../../src/dashboard/web/main-panel/source.js');

    const source = renderDashboardMainPanelSource();

    expect(source).toContain("normalizeMainTab(state.selectedMainTab) === 'project'");
    expect(source).toContain("workspaceState.mainTab === 'project'");
    expect(source).toContain('renderProjectWorkbenchContent');
    expect(source).not.toContain('renderSkillsSubTabs');
  });
});
