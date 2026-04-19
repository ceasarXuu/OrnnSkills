import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('skill domain instance projector', () => {
  const testDir = join(tmpdir(), `ornn-skill-domain-instance-${Date.now()}`);

  beforeEach(() => {
    mkdirSync(join(testDir, '.ornn', 'shadows'), { recursive: true });
    mkdirSync(join(testDir, '.ornn', 'state'), { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('projects per-runtime instances, revisions, and project skill groups from legacy state', async () => {
    const { projectSkillDomain } = await import('../../src/core/skill-domain/projector.js');

    writeFileSync(
      join(testDir, '.ornn', 'shadows', 'index.json'),
      JSON.stringify([
        {
          skillId: 'demo-skill',
          runtime: 'codex',
          version: '2',
          status: 'active',
          createdAt: '2026-04-18T09:00:00.000Z',
          updatedAt: '2026-04-18T09:10:00.000Z',
          traceCount: 5,
        },
        {
          skillId: 'demo-skill',
          runtime: 'claude',
          version: '1',
          status: 'frozen',
          createdAt: '2026-04-18T09:05:00.000Z',
          updatedAt: '2026-04-18T09:20:00.000Z',
          traceCount: 2,
        },
      ]),
      'utf-8'
    );

    mkdirSync(join(testDir, '.ornn', 'shadows', 'codex'), { recursive: true });
    mkdirSync(join(testDir, '.ornn', 'shadows', 'claude'), { recursive: true });
    writeFileSync(join(testDir, '.ornn', 'shadows', 'codex', 'demo-skill.md'), '# codex current\n', 'utf-8');
    writeFileSync(join(testDir, '.ornn', 'shadows', 'claude', 'demo-skill.md'), '# claude current\n', 'utf-8');

    const codexVersionsDir = join(testDir, '.ornn', 'skills', 'codex', 'demo-skill', 'versions');
    const claudeVersionsDir = join(testDir, '.ornn', 'skills', 'claude', 'demo-skill', 'versions');
    mkdirSync(join(codexVersionsDir, 'v1'), { recursive: true });
    mkdirSync(join(codexVersionsDir, 'v2'), { recursive: true });
    mkdirSync(join(claudeVersionsDir, 'v1'), { recursive: true });

    writeFileSync(join(codexVersionsDir, 'v1', 'skill.md'), '# codex v1\n', 'utf-8');
    writeFileSync(
      join(codexVersionsDir, 'v1', 'metadata.json'),
      JSON.stringify({
        version: 1,
        createdAt: '2026-04-18T09:00:00.000Z',
        reason: 'seed',
        traceIds: ['trace-1'],
        previousVersion: null,
        isDisabled: false,
      }),
      'utf-8'
    );
    writeFileSync(join(codexVersionsDir, 'v2', 'skill.md'), '# codex v2\n', 'utf-8');
    writeFileSync(
      join(codexVersionsDir, 'v2', 'metadata.json'),
      JSON.stringify({
        version: 2,
        createdAt: '2026-04-18T09:10:00.000Z',
        reason: 'improved',
        traceIds: ['trace-2'],
        previousVersion: 1,
        isDisabled: false,
      }),
      'utf-8'
    );
    symlinkSync('v2', join(codexVersionsDir, 'latest'));

    writeFileSync(join(claudeVersionsDir, 'v1', 'skill.md'), '# claude v1\n', 'utf-8');
    writeFileSync(
      join(claudeVersionsDir, 'v1', 'metadata.json'),
      JSON.stringify({
        version: 1,
        createdAt: '2026-04-18T09:05:00.000Z',
        reason: 'seed',
        traceIds: ['trace-3'],
        previousVersion: null,
        isDisabled: false,
      }),
      'utf-8'
    );
    symlinkSync('v1', join(claudeVersionsDir, 'latest'));

    const projection = projectSkillDomain(testDir);

    expect(projection.instances).toHaveLength(2);
    expect(new Set(projection.instances.map((instance) => instance.instanceId)).size).toBe(2);
    expect(new Set(projection.instances.map((instance) => instance.familyId)).size).toBe(1);
    expect(projection.instances.map((instance) => instance.runtime).sort()).toEqual(['claude', 'codex']);
    expect(projection.instances.find((instance) => instance.runtime === 'codex')).toMatchObject({
      skillId: 'demo-skill',
      effectiveVersion: 2,
      status: 'active',
      versionCount: 2,
    });
    expect(projection.instances.find((instance) => instance.runtime === 'claude')).toMatchObject({
      skillId: 'demo-skill',
      effectiveVersion: 1,
      status: 'frozen',
      versionCount: 1,
    });

    expect(projection.revisions).toHaveLength(3);
    expect(projection.revisions.filter((revision) => revision.isEffective)).toHaveLength(2);
    expect(projection.revisions.find((revision) => revision.version === 2 && revision.runtime === 'codex')).toMatchObject({
      reason: 'improved',
      previousVersion: 1,
      isEffective: true,
    });

    expect(projection.skillGroups).toEqual([
      expect.objectContaining({
        familyName: 'demo-skill',
        familyId: projection.instances[0]?.familyId,
        instanceCount: 2,
        runtimeCount: 2,
      }),
    ]);
  });
});