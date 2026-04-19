import { describe, expect, it, vi } from 'vitest';

describe('dashboard web state', () => {
  it('creates the initial dashboard state with the saved activity widths and preferred modal runtime', async () => {
    const { createDashboardState, createProjectSnapshotLoads, GLOBAL_CONFIG_SCOPE } = await import('../../src/dashboard/web/state.js');

    const state = createDashboardState(() => ({ skill: 240 }), () => 'claude');
    const loads = createProjectSnapshotLoads();

    expect(state.selectedProjectId).toBeNull();
    expect(state.selectedMainTab).toBe('home');
    expect(state.selectedSkillsSubTab).toBe('project_overview');
    expect(state.currentSkillRuntime).toBe('codex');
    expect(state.selectedSkillFamilyId).toBeNull();
    expect(state.preferredSkillRuntime).toBe('claude');
    expect(state.skillFamilies).toEqual([]);
    expect(state.skillLibraryLoaded).toBe(false);
    expect(state.providerCatalog).toEqual([]);
    expect(state.activityColumnWidths).toEqual({ skill: 240 });
    expect(GLOBAL_CONFIG_SCOPE).toBe('__global__');
    expect(loads).toEqual({});
  });

  it('builds the empty project snapshot shape used by the dashboard', async () => {
    const { buildEmptyProjectData } = await import('../../src/dashboard/web/state.js');

    expect(buildEmptyProjectData()).toEqual({
      daemon: {
        isRunning: false,
        isPaused: false,
        pid: null,
        startedAt: null,
        processedTraces: 0,
        lastCheckpointAt: null,
        retryQueueSize: 0,
        monitoringState: 'active',
        pausedAt: null,
        optimizationStatus: {
          currentState: 'idle',
          currentSkillId: null,
          lastOptimizationAt: null,
          lastError: null,
          queueSize: 0,
        },
      },
      skills: [],
      skillGroups: [],
      skillInstances: [],
      traceStats: { total: 0, byRuntime: {}, byStatus: {}, byEventType: {} },
      recentTraces: [],
      decisionEvents: [],
      activityScopes: [],
      agentUsage: {
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
      },
    });
  });

  it('renders the browser bootstrap source for dashboard state', async () => {
    const { renderDashboardStateSource } = await import('../../src/dashboard/web/state.js');
    const source = renderDashboardStateSource();

    expect(source).toContain('const GLOBAL_CONFIG_SCOPE = ');
    expect(source).toContain('__global__');
    expect(source).toContain('const state = {');
    expect(source).toContain('activityColumnWidths: loadSavedActivityColumnWidths()');
    expect(source).toContain('preferredSkillRuntime: loadSavedSkillModalRuntime()');
    expect(source).toContain('const projectSnapshotLoads = {};');
    expect(source).toContain('function buildEmptyProjectData() {');
  });
});
