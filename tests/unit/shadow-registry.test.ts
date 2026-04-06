import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdirSync, rmSync, existsSync, writeFileSync } from 'node:fs';
import { createShadowRegistry } from '../../src/core/shadow-registry/index.js';

describe('ShadowRegistry', () => {
  const testProjectPath = join(tmpdir(), 'ornn-sr-test-' + Date.now());

  beforeEach(() => {
    mkdirSync(testProjectPath, { recursive: true });
    mkdirSync(join(testProjectPath, '.ornn', 'shadows'), { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testProjectPath)) {
      rmSync(testProjectPath, { recursive: true, force: true });
    }
  });

  describe('init', () => {
    it('should initialize without errors', () => {
      const registry = createShadowRegistry(testProjectPath);
      expect(() => registry.init()).not.toThrow();
    });

    it('should be idempotent', () => {
      const registry = createShadowRegistry(testProjectPath);
      registry.init();
      registry.init();
    });

    it('should migrate legacy flat shadow files into codex directory', () => {
      const legacyPath = join(testProjectPath, '.ornn', 'shadows', 'legacy-skill.md');
      writeFileSync(legacyPath, '# Legacy');

      const registry = createShadowRegistry(testProjectPath);
      registry.init();

      const migratedPath = join(testProjectPath, '.ornn', 'shadows', 'codex', 'legacy-skill.md');
      expect(existsSync(legacyPath)).toBe(false);
      expect(existsSync(migratedPath)).toBe(true);
    });
  });

  describe('create', () => {
    it('should create a shadow skill', () => {
      const registry = createShadowRegistry(testProjectPath);
      registry.init();

      const result = registry.create('test-skill', '# Test Content', 'codex');
      expect(result).toBeDefined();
      expect(result?.skillId).toBe('test-skill');
    });

    it('should create shadow file on disk', () => {
      const registry = createShadowRegistry(testProjectPath);
      registry.init();

      registry.create('test-skill', '# Test Content', 'codex');
      const shadowPath = join(testProjectPath, '.ornn', 'shadows', 'codex', 'test-skill.md');
      expect(existsSync(shadowPath)).toBe(true);
    });

    it('should update index', () => {
      const registry = createShadowRegistry(testProjectPath);
      registry.init();

      registry.create('test-skill', '# Test', 'codex');
      const shadows = registry.list();
      expect(shadows.length).toBe(1);
      expect(shadows[0].skillId).toBe('test-skill');
    });
  });

  describe('get', () => {
    it('should return shadow by skill ID', () => {
      const registry = createShadowRegistry(testProjectPath);
      registry.init();

      registry.create('test-skill', '# Test', 'codex');
      const shadow = registry.get('test-skill');
      expect(shadow).toBeDefined();
      expect(shadow?.skillId).toBe('test-skill');
    });

    it('should return undefined for non-existent skill', () => {
      const registry = createShadowRegistry(testProjectPath);
      registry.init();

      expect(registry.get('non-existent')).toBeUndefined();
    });

    it('should isolate lookups by runtime when runtime is specified', () => {
      const registry = createShadowRegistry(testProjectPath);
      registry.init();

      registry.create('test-skill', '# Test', 'codex');
      expect(registry.has('test-skill', 'codex')).toBe(true);
      expect(registry.has('test-skill', 'claude')).toBe(false);
      expect(registry.get('test-skill', 'claude')).toBeUndefined();
    });
  });

  describe('list', () => {
    it('should return all shadows', () => {
      const registry = createShadowRegistry(testProjectPath);
      registry.init();

      registry.create('skill-1', '# Skill 1', 'codex');
      registry.create('skill-2', '# Skill 2', 'claude');

      const shadows = registry.list();
      expect(shadows.length).toBe(2);
    });

    it('should return empty array when no shadows', () => {
      const registry = createShadowRegistry(testProjectPath);
      registry.init();

      expect(registry.list()).toEqual([]);
    });
  });

  describe('updateStatus', () => {
    it('should update shadow status', () => {
      const registry = createShadowRegistry(testProjectPath);
      registry.init();

      registry.create('test-skill', '# Test', 'codex');
      registry.updateStatus('test-skill', 'frozen');

      const shadow = registry.get('test-skill');
      expect(shadow?.status).toBe('frozen');
    });
  });

  describe('updateContent', () => {
    it('should update shadow content', () => {
      const registry = createShadowRegistry(testProjectPath);
      registry.init();

      registry.create('test-skill', '# Original', 'codex');
      registry.updateContent('test-skill', '# Updated');

      const content = registry.readContent('test-skill');
      expect(content).toBe('# Updated');
    });

    it('should return undefined for non-existent skill', () => {
      const registry = createShadowRegistry(testProjectPath);
      registry.init();

      expect(registry.updateContent('non-existent', '# Test')).toBeUndefined();
    });
  });

  describe('readContent', () => {
    it('should read shadow content', () => {
      const registry = createShadowRegistry(testProjectPath);
      registry.init();

      registry.create('test-skill', '# Test Content', 'codex');
      const content = registry.readContent('test-skill');
      expect(content).toBe('# Test Content');
    });

    it('should return undefined for non-existent skill', () => {
      const registry = createShadowRegistry(testProjectPath);
      registry.init();

      expect(registry.readContent('non-existent')).toBeUndefined();
    });
  });

  describe('delete', () => {
    it('should delete a shadow', () => {
      const registry = createShadowRegistry(testProjectPath);
      registry.init();

      registry.create('test-skill', '# Test', 'codex');
      expect(registry.list().length).toBe(1);

      registry.delete('test-skill');
      expect(registry.list().length).toBe(0);
    });

    it('should return false for non-existent skill', () => {
      const registry = createShadowRegistry(testProjectPath);
      registry.init();

      expect(registry.delete('non-existent')).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear all shadows', () => {
      const registry = createShadowRegistry(testProjectPath);
      registry.init();

      registry.create('skill-1', '# Skill 1', 'codex');
      registry.create('skill-2', '# Skill 2', 'codex');
      expect(registry.list().length).toBe(2);

      registry.clear();
      expect(registry.list().length).toBe(0);
    });
  });

  describe('close', () => {
    it('should close without errors', () => {
      const registry = createShadowRegistry(testProjectPath);
      registry.init();
      expect(() => registry.close()).not.toThrow();
    });
  });
});
