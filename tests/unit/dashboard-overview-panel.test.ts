import { describe, expect, it } from 'vitest';

function createDeps() {
  return {
    escHtml: (value: unknown) => String(value),
    formatUptime: (value: string) => `uptime:${value}`,
    formatUsageCompact: (value: unknown) => String(value),
    renderMetricRows: (title: string, rows: Record<string, number>) =>
      `<section data-title="${title}">${Object.keys(rows).join(',')}</section>`,
    renderStateBadge: (value: unknown) => `<span>${String(value)}</span>`,
    renderTraceBars: (label: string) => `<div data-trace="${label}"></div>`,
    t: (key: string) => key,
    timeAgo: (value: string) => `ago:${value}`,
  };
}

describe('dashboard overview panel', () => {
  it('renders decision summary cards and metric groups', async () => {
    const { renderDashboardOverviewPanel } = await import('../../src/dashboard/web/panels/overview-panel.js');

    const html = renderDashboardOverviewPanel({
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
      daemon: {
        isRunning: true,
        startedAt: '2026-04-10T00:00:00.000Z',
        processedTraces: 42,
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
      decisionSummary: {
        mappingByStrategy: { tool_call: 1 },
        evaluationByRule: { analysis_failed_output: 1 },
        skippedByReason: { low_confidence: 1 },
        patchByType: { add_fallback: 1 },
        patchVolume: { linesAdded: 12, linesRemoved: 3 },
        runtimeDriftCount: 1,
      },
      deps: createDeps(),
      hasDecisionEvents: true,
      skillsCount: 0,
      traceStats: { total: 0, byRuntime: {}, byStatus: {}, byEventType: {} },
    });

    expect(html).toContain('overviewMapped');
    expect(html).toContain('overviewSkipped');
    expect(html).toContain('+12/-3');
    expect(html).toContain('overviewHostDrift');
    expect(html).toContain('data-title="overviewMappingStrategy"');
    expect(html).toContain('tool_call');
    expect(html).toContain('analysis_failed_output');
    expect(html).toContain('low_confidence');
    expect(html).toContain('add_fallback');
  });

  it('renders the agent usage section and trace cards', async () => {
    const { renderDashboardOverviewPanel } = await import('../../src/dashboard/web/panels/overview-panel.js');

    const html = renderDashboardOverviewPanel({
      agentUsage: {
        callCount: 1250,
        promptTokens: 2300000,
        completionTokens: 540000,
        totalTokens: 2840000,
        durationMsTotal: 4650000,
        avgDurationMs: 3720,
        lastCallAt: '2026-04-10T02:00:00.000Z',
        byModel: {},
        byScope: {
          decision_explainer: { callCount: 1000 },
          skill_call_analyzer: { callCount: 250 },
        },
        bySkill: {},
      },
      daemon: {
        isRunning: true,
        startedAt: '2026-04-10T00:00:00.000Z',
        processedTraces: 10,
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
      decisionSummary: {
        mappingByStrategy: {},
        evaluationByRule: {},
        skippedByReason: {},
        patchByType: {},
        patchVolume: { linesAdded: 0, linesRemoved: 0 },
        runtimeDriftCount: 0,
      },
      deps: createDeps(),
      skillsCount: 0,
      traceStats: {
        total: 12,
        byRuntime: { codex: 12 },
        byStatus: { success: 10, failure: 2 },
        byEventType: {},
      },
    });

    expect(html).toContain('costCalls');
    expect(html).toContain('overviewAgentScopes');
    expect(html).toContain('decision_explainer');
    expect(html).toContain('skill_call_analyzer');
    expect(html).toContain('data-trace="traceRuntime"');
    expect(html).toContain('data-trace="traceStatus"');
  });
});
