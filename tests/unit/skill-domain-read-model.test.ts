import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

function seedLegacySkillProject(projectPath: string, updatedAt = '2026-04-18T09:10:00.000Z') {
  mkdirSync(join(projectPath, '.ornn', 'shadows', 'codex'), { recursive: true });
  mkdirSync(join(projectPath, '.ornn', 'state'), { recursive: true });
  writeFileSync(
    join(projectPath, '.ornn', 'shadows', 'index.json'),
    JSON.stringify([
      {
        skillId: 'demo-skill',
        runtime: 'codex',
        version: '1',
        status: 'active',
        createdAt: '2026-04-18T09:00:00.000Z',
        updatedAt,
        traceCount: 0,
      },
    ]),
    'utf-8'
  );
  writeFileSync(join(projectPath, '.ornn', 'shadows', 'codex', 'demo-skill.md'), '# demo current\n', 'utf-8');

  const versionsDir = join(projectPath, '.ornn', 'skills', 'codex', 'demo-skill', 'versions');
  mkdirSync(join(versionsDir, 'v1'), { recursive: true });
  writeFileSync(join(versionsDir, 'v1', 'skill.md'), '# demo current\n', 'utf-8');
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

describe('skill domain read model', () => {
  const rootDir = join(tmpdir(), `ornn-skill-domain-read-model-${Date.now()}`);
  const projectPath = join(rootDir, 'project-a');

  beforeEach(() => {
    mkdirSync(projectPath, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(rootDir)) {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it('reads a fresh stored projection without recomputing it on the read path', async () => {
    const { refreshSkillDomainProjection, projectSkillDomain } = await import('../../src/core/skill-domain/projector.js');

    seedLegacySkillProject(projectPath);
    const refreshed = refreshSkillDomainProjection(projectPath);
    const projectionPath = join(projectPath, '.ornn', 'state', 'skill-domain-projection.json');
    writeFileSync(
      projectionPath,
      JSON.stringify({
        ...refreshed,
        generatedAt: '1999-01-01T00:00:00.000Z',
      }, null, 2),
      'utf-8'
    );

    const result = projectSkillDomain(projectPath);

    expect(result.generatedAt).toBe('1999-01-01T00:00:00.000Z');
  });

  it('recomputes stale projections without persisting them on the read path', async () => {
    const { refreshSkillDomainProjection, projectSkillDomain } = await import('../../src/core/skill-domain/projector.js');

    seedLegacySkillProject(projectPath);
    const refreshed = refreshSkillDomainProjection(projectPath);
    const projectionPath = join(projectPath, '.ornn', 'state', 'skill-domain-projection.json');
    writeFileSync(
      projectionPath,
      JSON.stringify({
        ...refreshed,
        generatedAt: '1999-01-01T00:00:00.000Z',
      }, null, 2),
      'utf-8'
    );

    writeFileSync(
      join(projectPath, '.ornn', 'shadows', 'index.json'),
      JSON.stringify([
        {
          skillId: 'demo-skill',
          runtime: 'codex',
          version: '1',
          status: 'active',
          createdAt: '2026-04-18T09:00:00.000Z',
          updatedAt: '2026-04-18T10:30:00.000Z',
          traceCount: 1,
        },
      ]),
      'utf-8'
    );
    writeFileSync(join(projectPath, '.ornn', 'shadows', 'codex', 'demo-skill.md'), '# demo updated\n', 'utf-8');

    const result = projectSkillDomain(projectPath);
    const stored = JSON.parse(readFileSync(projectionPath, 'utf-8')) as { generatedAt: string };

    expect(result.generatedAt).not.toBe('1999-01-01T00:00:00.000Z');
    expect(stored.generatedAt).toBe('1999-01-01T00:00:00.000Z');
  });
});