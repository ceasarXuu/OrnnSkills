import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { SkillVersionManager } from '../../src/core/skill-version/index.js';

describe('SkillVersionManager', () => {
  const testDir = join(tmpdir(), 'ornn-sv-test-' + Date.now());

  beforeEach(() => { mkdirSync(testDir, { recursive: true }); });
  afterEach(() => { if (existsSync(testDir)) rmSync(testDir, { recursive: true, force: true }); });

  describe('constructor', () => {
    it('should create versions directory', () => {
      const manager = new SkillVersionManager({ projectPath: testDir, skillId: 'my-skill', runtime: 'codex' });
      expect(existsSync(join(testDir, '.ornn', 'skills', 'my-skill', 'versions'))).toBe(true);
    });

    it('should scan existing versions', () => {
      const manager = new SkillVersionManager({ projectPath: testDir, skillId: 'my-skill', runtime: 'codex' });
      expect(manager.getCurrentVersion()).toBe(0);
    });
  });

  describe('getCurrentVersion', () => {
    it('should return 0 initially', () => {
      const manager = new SkillVersionManager({ projectPath: testDir, skillId: 'my-skill', runtime: 'codex' });
      expect(manager.getCurrentVersion()).toBe(0);
    });

    it('should return correct version after creation', () => {
      const manager = new SkillVersionManager({ projectPath: testDir, skillId: 'my-skill', runtime: 'codex' });
      manager.createVersion('v1', 'initial', []);
      manager.createVersion('v2', 'update', []);
      expect(manager.getCurrentVersion()).toBe(2);
    });
  });

  describe('createVersion', () => {
    it('should create a new version', () => {
      const manager = new SkillVersionManager({ projectPath: testDir, skillId: 'my-skill', runtime: 'codex' });
      const version = manager.createVersion('# Content', 'Initial', ['t-1', 't-2'], { prompt: 100, completion: 200, total: 300 }, 'gpt-4');
      expect(version.version).toBe(1);
      expect(version.content).toBe('# Content');
      expect(version.metadata.reason).toBe('Initial');
      expect(version.metadata.traceIds).toEqual(['t-1', 't-2']);
      expect(version.metadata.tokenUsage).toEqual({ prompt: 100, completion: 200, total: 300 });
      expect(version.metadata.analyzerModel).toBe('gpt-4');
    });

    it('should increment version number', () => {
      const manager = new SkillVersionManager({ projectPath: testDir, skillId: 'my-skill', runtime: 'codex' });
      manager.createVersion('v1', 'initial', []);
      const v2 = manager.createVersion('v2', 'update', []);
      expect(v2.version).toBe(2);
    });

    it('should create version directory and files', () => {
      const manager = new SkillVersionManager({ projectPath: testDir, skillId: 'my-skill', runtime: 'codex' });
      manager.createVersion('content', 'reason', []);
      expect(existsSync(join(testDir, '.ornn', 'skills', 'my-skill', 'versions', 'v1', 'skill.md'))).toBe(true);
      expect(existsSync(join(testDir, '.ornn', 'skills', 'my-skill', 'versions', 'v1', 'metadata.json'))).toBe(true);
    });

    it('should create latest symlink', () => {
      const manager = new SkillVersionManager({ projectPath: testDir, skillId: 'my-skill', runtime: 'codex' });
      manager.createVersion('v1', 'initial', []);
      manager.createVersion('v2', 'update', []);
      expect(existsSync(join(testDir, '.ornn', 'skills', 'my-skill', 'versions', 'latest'))).toBe(true);
    });
  });

  describe('getVersion', () => {
    it('should retrieve existing version', () => {
      const manager = new SkillVersionManager({ projectPath: testDir, skillId: 'my-skill', runtime: 'codex' });
      manager.createVersion('content', 'reason', []);
      const version = manager.getVersion(1);
      expect(version).not.toBeNull();
      expect(version?.content).toBe('content');
    });

    it('should return null for non-existent version', () => {
      const manager = new SkillVersionManager({ projectPath: testDir, skillId: 'my-skill', runtime: 'codex' });
      expect(manager.getVersion(99)).toBeNull();
    });
  });

  describe('getLatestVersion', () => {
    it('should return null when no versions', () => {
      const manager = new SkillVersionManager({ projectPath: testDir, skillId: 'my-skill', runtime: 'codex' });
      expect(manager.getLatestVersion()).toBeNull();
    });

    it('should return latest version', () => {
      const manager = new SkillVersionManager({ projectPath: testDir, skillId: 'my-skill', runtime: 'codex' });
      manager.createVersion('v1', 'initial', []);
      manager.createVersion('v2', 'update', []);
      const latest = manager.getLatestVersion();
      expect(latest?.version).toBe(2);
    });
  });

  describe('listVersions', () => {
    it('should return empty array when no versions', () => {
      const manager = new SkillVersionManager({ projectPath: testDir, skillId: 'my-skill', runtime: 'codex' });
      expect(manager.listVersions()).toEqual([]);
    });

    it('should list all versions', () => {
      const manager = new SkillVersionManager({ projectPath: testDir, skillId: 'my-skill', runtime: 'codex' });
      manager.createVersion('v1', 'initial', []);
      manager.createVersion('v2', 'update', []);
      manager.createVersion('v3', 'refactor', []);
      expect(manager.listVersions().length).toBe(3);
    });
  });

  describe('getAllVersions', () => {
    it('should return all versions with metadata', () => {
      const manager = new SkillVersionManager({ projectPath: testDir, skillId: 'my-skill', runtime: 'codex' });
      manager.createVersion('v1', 'initial', []);
      manager.createVersion('v2', 'update', []);
      const versions = manager.getAllVersions();
      expect(versions.length).toBe(2);
      expect(versions[0].version).toBe(1);
      expect(versions[1].version).toBe(2);
    });
  });

  describe('getVersionsDir', () => {
    it('should return versions directory', () => {
      const manager = new SkillVersionManager({ projectPath: testDir, skillId: 'my-skill', runtime: 'codex' });
      expect(manager.getVersionsDir()).toBe(join(testDir, '.ornn', 'skills', 'my-skill', 'versions'));
    });
  });

  describe('hasVersion', () => {
    it('should return true for existing version', () => {
      const manager = new SkillVersionManager({ projectPath: testDir, skillId: 'my-skill', runtime: 'codex' });
      manager.createVersion('v1', 'initial', []);
      expect(manager.hasVersion(1)).toBe(true);
    });

    it('should return false for non-existent version', () => {
      const manager = new SkillVersionManager({ projectPath: testDir, skillId: 'my-skill', runtime: 'codex' });
      expect(manager.hasVersion(99)).toBe(false);
    });
  });

  describe('getVersionDir', () => {
    it('should return version directory path', () => {
      const manager = new SkillVersionManager({ projectPath: testDir, skillId: 'my-skill', runtime: 'codex' });
      expect(manager.getVersionDir(1)).toBe(join(testDir, '.ornn', 'skills', 'my-skill', 'versions', 'v1'));
    });
  });

  describe('getLatestVersionViaSymlink', () => {
    it('should return null when no symlink exists', () => {
      const manager = new SkillVersionManager({ projectPath: testDir, skillId: 'my-skill', runtime: 'codex' });
      expect(manager.getLatestVersionViaSymlink()).toBeNull();
    });

    it('should return latest version via symlink', () => {
      const manager = new SkillVersionManager({ projectPath: testDir, skillId: 'my-skill', runtime: 'codex' });
      manager.createVersion('v1', 'initial', []);
      manager.createVersion('v2', 'update', []);
      const latest = manager.getLatestVersionViaSymlink();
      expect(latest?.version).toBe(2);
    });
  });
});
