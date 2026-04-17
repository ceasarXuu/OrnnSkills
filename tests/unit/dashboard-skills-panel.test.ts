import { describe, expect, it } from 'vitest';

describe('dashboard skills panel', () => {
  it('renders localized controls, runtime tabs, and skill cards', async () => {
    const { renderDashboardSkillsPanel } = await import('../../src/dashboard/web/panels/skills-panel.js');

    const html = renderDashboardSkillsPanel({
      deps: {
        renderSkillCard: (skill, projectPath) => `<article>${projectPath}:${skill.skillId}</article>`,
        renderSkillsEmptyState: () => '<div>empty</div>',
        t: (key: string) => key,
      },
      filteredSkills: [{ skillId: 'test-driven-development' }],
      projectPath: '/tmp/ornn-project',
      searchQuery: 'test',
      selectedRuntimeTab: 'codex',
      sortBy: 'updated',
      sortOrder: 'desc',
    });

    expect(html).toContain('skillsTitle');
    expect(html).toContain('runtime-tab tab-codex active');
    expect(html).toContain('skillsSearchPlaceholder');
    expect(html).toContain('value="test"');
    expect(html).toContain('skillsSortUpdated');
    expect(html).toContain('<span style="color:var(--muted)" id="skillsCount">1 skillsCount</span>');
    expect(html).toContain('<article>/tmp/ornn-project:test-driven-development</article>');
  });

  it('renders the shared empty state when no filtered skills remain', async () => {
    const { renderDashboardSkillsPanel } = await import('../../src/dashboard/web/panels/skills-panel.js');

    const html = renderDashboardSkillsPanel({
      deps: {
        renderSkillCard: () => '<article>unused</article>',
        renderSkillsEmptyState: () => '<div class="empty-state">skillsSearchEmpty</div>',
        t: (key: string) => key,
      },
      filteredSkills: [],
      projectPath: '/tmp/ornn-project',
      searchQuery: 'missing',
      selectedRuntimeTab: 'all',
      sortBy: 'name',
      sortOrder: 'asc',
    });

    expect(html).toContain('<div class="empty-state">skillsSearchEmpty</div>');
    expect(html).not.toContain('<article>unused</article>');
  });
});
