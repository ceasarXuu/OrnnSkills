import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('skill domain instance projector (host direct read)', () => {
  const testDir = join(tmpdir(), `ornn-skill-domain-instance-${Date.now()}`);

  beforeEach(() => {
    mkdirSync(join(testDir, '.codex', 'skills', 'demo-skill'), { recursive: true });
    mkdirSync(join(testDir, '.claude', 'skills', 'demo-skill'), { recursive: true });
    mkdirSync(join(testDir, '.ornn', 'state'), { recursive: true });
    writeFileSync(join(testDir, '.codex', 'skills', 'demo-skill', 'SKILL.md'), '# codex current\n', 'utf-8');
    writeFileSync(join(testDir, '.claude', 'skills', 'demo-skill', 'SKILL.md'), '# claude current\n', 'utf-8');
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('scans host skill directories and projects per-runtime instances (D6)', async () => {
    const { projectSkillDomain } = await import('../../src/core/skill-domain/projector.js');

    const projection = projectSkillDomain(testDir, { includeGlobalRoots: false });

    expect(projection.instances).toHaveLength(2);
    expect(new Set(projection.instances.map((instance) => instance.instanceId)).size).toBe(2);
    expect(new Set(projection.instances.map((instance) => instance.familyId)).size).toBe(1);
    expect(projection.instances.map((instance) => instance.runtime).sort()).toEqual(['claude', 'codex']);
    expect(projection.instances.find((instance) => instance.runtime === 'codex')).toMatchObject({
      skillId: 'demo-skill',
      status: 'active',
      versionCount: 0,
      effectiveVersion: null,
      installPath: join(testDir, '.codex', 'skills', 'demo-skill'),
    });
    expect(projection.instances.find((instance) => instance.runtime === 'claude')).toMatchObject({
      skillId: 'demo-skill',
      installPath: join(testDir, '.claude', 'skills', 'demo-skill'),
    });

    expect(projection.revisions).toHaveLength(0);
    expect(projection.skillGroups).toEqual([
      expect.objectContaining({
        familyName: 'demo-skill',
        familyId: projection.instances[0]?.familyId,
        instanceCount: 2,
        runtimeCount: 2,
      }),
    ]);
  });

  it('treats generic roots (skills, .agents/skills) as null runtime instances', async () => {
    const { projectSkillDomain } = await import('../../src/core/skill-domain/projector.js');
    mkdirSync(join(testDir, 'skills', 'generic-skill'), { recursive: true });
    writeFileSync(join(testDir, 'skills', 'generic-skill', 'SKILL.md'), '# generic\n', 'utf-8');

    const projection = projectSkillDomain(testDir, { includeGlobalRoots: false });

    const generic = projection.instances.find((instance) => instance.skillId === 'generic-skill');
    expect(generic).toBeDefined();
    expect(generic?.runtime).toBeNull();
    expect(generic?.installPath).toBe(join(testDir, 'skills', 'generic-skill'));
  });
});
