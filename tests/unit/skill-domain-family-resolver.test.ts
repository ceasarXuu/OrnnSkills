import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('skill domain family resolver', () => {
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

    for (const [projectPath, runtime, body, updatedAt] of [
      [projectA, 'codex', '# alpha\n', '2026-04-18T10:00:00.000Z'],
      [projectB, 'claude', '# beta\n', '2026-04-18T12:00:00.000Z'],
    ] as const) {
      mkdirSync(join(projectPath, '.ornn', 'shadows', runtime), { recursive: true });
      mkdirSync(join(projectPath, '.ornn', 'state'), { recursive: true });
      writeFileSync(
        join(projectPath, '.ornn', 'shadows', 'index.json'),
        JSON.stringify([
          {
            skillId: 'test-driven-development',
            runtime,
            version: '1',
            status: 'active',
            createdAt: '2026-04-18T09:00:00.000Z',
            updatedAt,
            traceCount: 1,
          },
        ]),
        'utf-8'
      );
      writeFileSync(
        join(projectPath, '.ornn', 'shadows', runtime, 'test-driven-development.md'),
        body,
        'utf-8'
      );
      const versionsDir = join(projectPath, '.ornn', 'skills', runtime, 'test-driven-development', 'versions');
      mkdirSync(join(versionsDir, 'v1'), { recursive: true });
      writeFileSync(join(versionsDir, 'v1', 'skill.md'), body, 'utf-8');
      writeFileSync(
        join(versionsDir, 'v1', 'metadata.json'),
        JSON.stringify({
          version: 1,
          createdAt: updatedAt,
          reason: 'seed',
          traceIds: [],
          previousVersion: null,
          isDisabled: false,
        }),
        'utf-8'
      );
      symlinkSync('v1', join(versionsDir, 'latest'));
    }

    const families = aggregateSkillFamilies([projectA, projectB]);

    expect(families).toHaveLength(1);
    expect(families[0]).toMatchObject({
      familyName: 'test-driven-development',
      projectCount: 2,
      instanceCount: 2,
      runtimeCount: 2,
      identityMethod: 'normalized_skill_id',
      identityConfidence: 1,
      hasDivergedContent: true,
      lastSeenAt: '2026-04-18T12:00:00.000Z',
    });
  });
});