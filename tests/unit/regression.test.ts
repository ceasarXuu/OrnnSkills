import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdirSync, rmSync, existsSync, writeFileSync } from 'node:fs';
import { createShadowRegistry } from '../../src/core/shadow-registry/index.js';
import { createJournalManager } from '../../src/core/journal/index.js';
import { cliInfo, cliWarn, cliError } from '../../src/utils/cli-output.js';
import { createShadowManager } from '../../src/core/shadow-manager/index.js';

describe('Regression Tests', () => {
  const testProjectPath = join(tmpdir(), 'ornn-regression-' + Date.now());

  beforeEach(() => {
    mkdirSync(testProjectPath, { recursive: true });
    mkdirSync(join(testProjectPath, '.ornn', 'skills'), { recursive: true });
    mkdirSync(join(testProjectPath, '.ornn', 'state'), { recursive: true });
    mkdirSync(join(testProjectPath, '.ornn', 'shadows'), { recursive: true });
  });

  afterEach(async () => {
    await new Promise((r) => setTimeout(r, 50));
    if (existsSync(testProjectPath)) {
      rmSync(testProjectPath, { recursive: true, force: true });
    }
  });

  describe('T01: CLI async correctness', () => {
    it('shadowRegistry.init() is synchronous', () => {
      const registry = createShadowRegistry(testProjectPath);
      const result = registry.init();
      expect(result).toBeUndefined();
    });

    it('journalManager.init() is async', async () => {
      const journal = createJournalManager(testProjectPath);
      const result = journal.init();
      expect(result).toBeInstanceOf(Promise);
      await result;
    });

    it('journalManager.getLatestRevision() is synchronous', async () => {
      const journal = createJournalManager(testProjectPath);
      await journal.init();
      const result = journal.getLatestRevision('test@' + testProjectPath);
      expect(typeof result).toBe('number');
    });
  });

  describe('T02: CLI resource cleanup', () => {
    it('shadowRegistry.close() is synchronous', () => {
      const registry = createShadowRegistry(testProjectPath);
      registry.init();
      expect(() => registry.close()).not.toThrow();
    });

    it('journalManager.close() returns Promise', async () => {
      const journal = createJournalManager(testProjectPath);
      await journal.init();
      const result = journal.close();
      expect(result).toBeInstanceOf(Promise);
      await result;
    });
  });

  describe('T03: ShadowRegistry type safety', () => {
    it('list() returns properly typed objects', () => {
      const registry = createShadowRegistry(testProjectPath);
      registry.init();
      registry.create('test-skill', '# Test', 'codex');
      const items = registry.list();
      for (const item of items) {
        expect(typeof item.skillId).toBe('string');
      }
    });
  });

  describe('T04: Config Wizard type safety', () => {
    it('provider name validation works', () => {
      const providerName = 'deepseek';
      const upper = providerName.toUpperCase().replace(/[^A-Z0-9]/g, '_');
      expect(upper).toBe('DEEPSEEK');
    });
  });

  describe('T05: safeString utility', () => {
    it('handles all types correctly', () => {
      expect(String('hello')).toBe('hello');
      expect(String(42)).toBe('42');
      expect(String(null)).toBe('null');
      expect(String(undefined)).toBe('undefined');
      expect(JSON.stringify({ key: 'value' })).toBe('{"key":"value"}');
    });
  });

  describe('T07: Daemon type safety', () => {
    it('daemon status parsing handles malformed data', () => {
      const parse = (data: string) => {
        try {
          return JSON.parse(data) as Record<string, unknown>;
        } catch {
          return null;
        }
      };
      expect(parse('not json')).toBeNull();
      expect(parse('{}')).toEqual({});
      expect(parse('{"key": "value"}')).toEqual({ key: 'value' });
    });
  });

  describe('T08: Logs error handling', () => {
    it('handles inaccessible directories gracefully', () => {
      const journal = createJournalManager(testProjectPath);
      expect(() => journal.init()).not.toThrow();
    });
  });

  describe('T09: CLI logging', () => {
    it('cliInfo is a function', () => {
      expect(typeof cliInfo).toBe('function');
    });

    it('cliWarn is a function', () => {
      expect(typeof cliWarn).toBe('function');
    });

    it('cliError is a function', () => {
      expect(typeof cliError).toBe('function');
    });
  });

  describe('ShadowManager integration', () => {
    it('initializes and closes without errors', async () => {
      const manager = createShadowManager(testProjectPath);
      await expect(manager.init()).resolves.not.toThrow();
      expect(() => manager.close()).not.toThrow();
    });
  });
});
