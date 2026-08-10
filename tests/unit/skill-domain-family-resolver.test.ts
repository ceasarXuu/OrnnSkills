import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('skill domain family resolver (host direct read)', () => {
  const rootDir = join(tmpdir(), `ornn-skill-domain-family-${Date.now()}`);
  const projectA = join(rootDir, 'project-a');
  const projectB = join(rootDir, 'project-b');

  beforeEach(() => {
    mkdirSync(projectA, { recursive: true });
    mkdirSync(projectB, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(rootDir)) {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it('merges same-named skills across projects into one family and marks divergent content', async () => {
    const { aggregateSkillFamilies } = await import('../../src/core/skill-domain/projector.js');

    for (const [projectPath, runtime, body] of [
      [projectA, 'codex', '# alpha\n'],
      [projectB, 'claude', '# beta\n'],
    ] as const) {
      mkdirSync(join(projectPath, '.ornn', 'state'), { recursive: true });
      const hostDir = runtime === 'codex' ? '.codex' : '.claude';
      mkdirSync(join(projectPath, hostDir, 'skills', 'test-driven-development'), { recursive: true });
      writeFileSync(
        join(projectPath, hostDir, 'skills', 'test-driven-development', 'SKILL.md'),
        body,
        'utf-8'
      );
    }

    const families = aggregateSkillFamilies([projectA, projectB], { includeGlobalRoots: false });

    expect(families).toHaveLength(1);
    expect(families[0]).toMatchObject({
      familyName: 'test-driven-development',
      projectCount: 2,
      instanceCount: 2,
      runtimeCount: 2,
      identityMethod: 'normalized_skill_id',
      identityConfidence: 1,
      hasDivergedContent: true,
    });
  });

  it('excludes global skill roots when includeGlobalRoots is disabled', async () => {
    const { aggregateSkillFamilies } = await import('../../src/core/skill-domain/projector.js');

    const families = aggregateSkillFamilies([projectA], { includeGlobalRoots: false });

    expect(families).toHaveLength(0);
  });
});
