import { describe, expect, it } from 'vitest';
import { renderDashboardRuntimeSource } from '../../src/dashboard/web/runtime/source.js';
import { renderDashboardSidebarSource } from '../../src/dashboard/web/sidebar/source.js';
import { renderDashboardCostSource } from '../../src/dashboard/web/cost/source.js';
import { renderDashboardMainPanelSource } from '../../src/dashboard/web/main-panel/source.js';
import { renderDashboardConfigSource } from '../../src/dashboard/web/config/source.js';
import { renderDashboardSkillsSource } from '../../src/dashboard/web/skills/source.js';

describe('dashboard ui source modules', () => {
  it('returns runtime helpers', () => {
    const source = renderDashboardRuntimeSource();
    expect(source).toContain('async function init');
    expect(source).toContain('async function loadProjectSnapshot');
  });

  it('returns sidebar helpers', () => {
    const source = renderDashboardSidebarSource();
    expect(source).toContain('function renderSidebar');
    expect(source).toContain('async function selectProject');
  });

  it('returns cost helpers', () => {
    const source = renderDashboardCostSource();
    expect(source).toContain('function renderCostPanel');
    expect(source).toContain('function summarizeDecisionEvents');
  });

  it('returns main panel helpers', () => {
    const source = renderDashboardMainPanelSource();
    expect(source).toContain('function renderMainPanel');
    expect(source).toContain('function safeRenderMainPanel');
    expect(source).not.toContain('page-hero');
    expect(source).not.toContain('page-title');
    expect(source).not.toContain('page-meta');
    expect(source).not.toContain('page-kicker');
    expect(source).not.toContain('page-copy');
    expect(source).not.toContain("t('homeGlobalCopy')");
    expect(source).not.toContain("t('configIntro')");
  });

  it('returns config helpers', () => {
    const source = renderDashboardConfigSource();
    expect(source).toContain('function renderConfigPanel');
    expect(source).toContain('async function checkProvidersConnectivity');
  });

  it('returns skills and modal helpers', () => {
    const source = renderDashboardSkillsSource();
    expect(source).toContain('async function viewSkill');
    expect(source).toContain('function closeModal');
  });
});
