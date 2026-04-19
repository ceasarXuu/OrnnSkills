import { describe, expect, it } from 'vitest';

describe('dashboard skills source', () => {
  it('includes skill library loaders, family selection, and instance-based mutation routes', async () => {
    const { renderDashboardSkillsSource } = await import('../../src/dashboard/web/skills/source.js');

    const source = renderDashboardSkillsSource();

    expect(source).toContain('async function loadSkillLibrary');
    expect(source).toContain('async function loadSkillFamilyDetail');
    expect(source).toContain('function selectSkillFamily');
    expect(source).toContain('function openSkillFamilyFromProject');
    expect(source).toContain("'/api/skills/families'");
    expect(source).toContain("'/api/projects/' + encProject + '/skill-instances/'");
    expect(source).toContain("'/versions/' + version");
    expect(source).toContain("'/apply-preview'");
    expect(source).toContain("'/apply-to-family'");
    expect(source).toContain('function openSkillLibraryInstance');
    expect(source).toContain('skillInlineContent');
  });
});
