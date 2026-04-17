import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  readSkillContent,
  readSkills,
  readSkillVersion,
} from '../../src/dashboard/readers/skills-reader.js';

describe('dashboard skills reader', () => {
  const testDir = join(tmpdir(), `ornn-dashboard-skills-reader-${Date.now()}`);

  beforeEach(() => {
    mkdirSync(join(testDir, '.ornn', 'shadows'), { recursive: true });
    mkdirSync(join(testDir, '.ornn', 'skills'), { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('reads runtime-scoped skills, content, and versions', () => {
    const shadowsDir = join(testDir, '.ornn', 'shadows', 'claude');
    const versionsDir = join(testDir, '.ornn', 'skills', 'claude', 'demo-skill', 'versions');
    const version1Dir = join(versionsDir, 'v1');
    const version3Dir = join(versionsDir, 'v3');

    mkdirSync(shadowsDir, { recursive: true });
    mkdirSync(version1Dir, { recursive: true });
    mkdirSync(version3Dir, { recursive: true });

    writeFileSync(
      join(testDir, '.ornn', 'shadows', 'index.json'),
      JSON.stringify([
        {
          skillId: 'demo-skill',
          runtime: 'claude',
          version: '3',
          content: 'shadow body should be stripped from list',
          status: 'active',
          createdAt: '2026-04-17T10:00:00.000Z',
          updatedAt: '2026-04-17T10:05:00.000Z',
          traceCount: 8,
          analysisResult: {
            summary: 'demo',
            confidence: 0.92,
            suggestions: ['a'],
          },
        },
      ]),
      'utf-8'
    );
    writeFileSync(join(shadowsDir, 'demo-skill.md'), '# Claude shadow\n', 'utf-8');
    writeFileSync(join(version1Dir, 'skill.md'), '# v1\n', 'utf-8');
    writeFileSync(
      join(version1Dir, 'metadata.json'),
      JSON.stringify({
        version: 1,
        createdAt: '2026-04-17T10:01:00.000Z',
        reason: 'seed',
        traceIds: ['trace-1'],
        previousVersion: null,
      }),
      'utf-8'
    );
    writeFileSync(join(version3Dir, 'skill.md'), '# v3\n', 'utf-8');
    writeFileSync(
      join(version3Dir, 'metadata.json'),
      JSON.stringify({
        version: 3,
        createdAt: '2026-04-17T10:03:00.000Z',
        reason: 'improved',
        traceIds: ['trace-2'],
        previousVersion: 1,
      }),
      'utf-8'
    );
    symlinkSync('v3', join(versionsDir, 'latest'));

    const skills = readSkills(testDir);
    expect(skills).toHaveLength(1);
    expect(skills[0]).toMatchObject({
      skillId: 'demo-skill',
      runtime: 'claude',
      content: '',
      versionsAvailable: [1, 3],
      effectiveVersion: 3,
    });

    expect(readSkillContent(testDir, 'demo-skill', 'claude')).toBe('# Claude shadow\n');
    expect(readSkillVersion(testDir, 'demo-skill', 1, 'claude')).toEqual({
      content: '# v1\n',
      metadata: {
        version: 1,
        createdAt: '2026-04-17T10:01:00.000Z',
        reason: 'seed',
        traceIds: ['trace-1'],
        previousVersion: null,
      },
    });
  });

  it('falls back to the legacy non-runtime layout', () => {
    const legacyShadowsDir = join(testDir, '.ornn', 'shadows');
    const legacyVersionsDir = join(testDir, '.ornn', 'skills', 'legacy-skill', 'versions');
    const version2Dir = join(legacyVersionsDir, 'v2');

    mkdirSync(version2Dir, { recursive: true });

    writeFileSync(
      join(testDir, '.ornn', 'shadows', 'index.json'),
      JSON.stringify([
        {
          skillId: 'legacy-skill',
          version: '2',
          content: 'legacy body should be stripped from list',
          status: 'active',
          createdAt: '2026-04-17T11:00:00.000Z',
          updatedAt: '2026-04-17T11:05:00.000Z',
          traceCount: 3,
        },
      ]),
      'utf-8'
    );
    writeFileSync(join(legacyShadowsDir, 'legacy-skill.md'), '# Legacy shadow\n', 'utf-8');
    writeFileSync(join(version2Dir, 'skill.md'), '# Legacy v2\n', 'utf-8');
    writeFileSync(
      join(version2Dir, 'metadata.json'),
      JSON.stringify({
        version: 2,
        createdAt: '2026-04-17T11:02:00.000Z',
        reason: 'legacy',
        traceIds: ['trace-legacy'],
        previousVersion: 1,
      }),
      'utf-8'
    );
    symlinkSync('v2', join(legacyVersionsDir, 'latest'));

    const skills = readSkills(testDir);
    expect(skills).toHaveLength(1);
    expect(skills[0]).toMatchObject({
      skillId: 'legacy-skill',
      runtime: 'codex',
      content: '',
      versionsAvailable: [2],
      effectiveVersion: 2,
    });

    expect(readSkillContent(testDir, 'legacy-skill')).toBe('# Legacy shadow\n');
    expect(readSkillVersion(testDir, 'legacy-skill', 2)).toEqual({
      content: '# Legacy v2\n',
      metadata: {
        version: 2,
        createdAt: '2026-04-17T11:02:00.000Z',
        reason: 'legacy',
        traceIds: ['trace-legacy'],
        previousVersion: 1,
      },
    });
  });
});
