import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { bootstrapSkillsForMonitoring } from '../../src/core/shadow-bootstrapper/index.js';

describe('shadow-bootstrapper', () => {
  const projectRoot = join(tmpdir(), `ornn-shadow-bootstrapper-${Date.now()}`);
  const globalRoot = join(tmpdir(), `ornn-shadow-bootstrapper-global-${Date.now()}`);

  beforeEach(() => {
    rmSync(projectRoot, { recursive: true, force: true });
    rmSync(globalRoot, { recursive: true, force: true });

    mkdirSync(join(projectRoot, '.agents', 'skills', 'project-skill'), { recursive: true });
    writeFileSync(
      join(projectRoot, '.agents', 'skills', 'project-skill', 'SKILL.md'),
      '# Project Skill\n\nproject source\n',
      'utf-8'
    );

    mkdirSync(join(globalRoot, 'project-skill'), { recursive: true });
    writeFileSync(
      join(globalRoot, 'project-skill', 'SKILL.md'),
      '# Project Skill\n\nglobal source should lose\n',
      'utf-8'
    );

    mkdirSync(join(globalRoot, 'global-only-skill'), { recursive: true });
    writeFileSync(
      join(globalRoot, 'global-only-skill', 'SKILL.md'),
      '# Global Only Skill\n\nglobal source\n',
      'utf-8'
    );
  });

  afterEach(() => {
    rmSync(projectRoot, { recursive: true, force: true });
    rmSync(globalRoot, { recursive: true, force: true });
  });

  it('prefers project skills over global duplicates and materializes global-only skills into the project', () => {
    const upsertOriginSkill = vi.fn();
    const upsertShadowSkill = vi.fn();
    const create = vi.fn();
    const get = vi.fn().mockReturnValue(undefined);
    const has = vi.fn().mockReturnValue(false);
    const readContent = vi.fn().mockReturnValue(undefined);
    const updateContent = vi.fn();
    const registerSkill = vi.fn();
    const createVersion = vi.fn();

    const result = bootstrapSkillsForMonitoring({
      projectRoot,
      db: {
        upsertOriginSkill,
        upsertShadowSkill,
      },
      shadowRegistry: {
        has,
        create,
        get,
        readContent,
        updateContent,
      },
      traceSkillMapper: {
        registerSkill,
      },
      createVersionManager: () => ({
        createVersion,
      }),
      originPaths: [globalRoot],
      enabledRuntimes: ['codex'],
      includeHomeSkillRoots: false,
    });

    expect(result).toMatchObject({
      selectedSkills: 2,
      materializedToProject: 1,
    });
    expect(create).toHaveBeenCalledWith(
      'project-skill',
      expect.stringContaining('project source'),
      expect.any(String),
      'codex'
    );
    expect(create).toHaveBeenCalledWith(
      'global-only-skill',
      expect.stringContaining('global source'),
      expect.any(String),
      'codex'
    );

    const materializedPath = join(projectRoot, '.codex', 'skills', 'global-only-skill', 'SKILL.md');
    expect(existsSync(materializedPath)).toBe(true);
    expect(readFileSync(materializedPath, 'utf-8')).toContain('global source');
  });
});
