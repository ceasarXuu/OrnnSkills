import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdirSync, rmSync, existsSync, writeFileSync } from 'node:fs';
import {
  expandHome,
  getEvoDir,
  getSkillsDir,
  getStateDir,
  getConfigDir,
  getSkillCurrentPath,
  getSkillMetaPath,
  getSkillJournalPath,
  getSkillSnapshotsDir,
  join as pathJoin,
  validateProjectPath,
  validateSkillId,
  sanitizeSkillId,
  assertValidSkillId,
  pathExists,
  isDirectory,
  isFile,
  getRelativePath,
  getExtension,
  getFileNameWithoutExt,
  getDirName,
} from '../../src/utils/path.js';
import { homedir } from 'node:os';

describe('Path Utils', () => {
  describe('expandHome', () => {
    it('should expand ~ to home directory', () => {
      const result = expandHome('~/test');
      expect(result).toBe(pathJoin(homedir(), 'test'));
    });

    it('should handle ~ alone', () => {
      const result = expandHome('~');
      expect(result).toBe(homedir());
    });

    it('should not modify paths without ~', () => {
      const result = expandHome('/absolute/path');
      expect(result).toBe('/absolute/path');
    });
  });

  describe('getEvoDir', () => {
    it('should return .ornn directory path', () => {
      const result = getEvoDir('/project');
      expect(result).toBe('/project/.ornn');
    });
  });

  describe('getSkillsDir', () => {
    it('should return .ornn/skills directory path', () => {
      const result = getSkillsDir('/project');
      expect(result).toBe('/project/.ornn/skills');
    });
  });

  describe('getStateDir', () => {
    it('should return .ornn/state directory path', () => {
      const result = getStateDir('/project');
      expect(result).toBe('/project/.ornn/state');
    });
  });

  describe('getConfigDir', () => {
    it('should return .ornn/config directory path', () => {
      const result = getConfigDir('/project');
      expect(result).toBe('/project/.ornn/config');
    });
  });

  describe('getSkillCurrentPath', () => {
    it('should return shadow skill path', () => {
      const result = getSkillCurrentPath('/project', 'my-skill');
      expect(result).toBe('/project/.ornn/skills/my-skill/current.md');
    });
  });

  describe('getSkillMetaPath', () => {
    it('should return shadow meta path', () => {
      const result = getSkillMetaPath('/project', 'my-skill');
      expect(result).toBe('/project/.ornn/skills/my-skill/meta.json');
    });
  });

  describe('getSkillJournalPath', () => {
    it('should return shadow journal path', () => {
      const result = getSkillJournalPath('/project', 'my-skill');
      expect(result).toBe('/project/.ornn/skills/my-skill/journal.ndjson');
    });
  });

  describe('getSkillSnapshotsDir', () => {
    it('should return snapshots directory path', () => {
      const result = getSkillSnapshotsDir('/project', 'my-skill');
      expect(result).toBe('/project/.ornn/skills/my-skill/snapshots');
    });
  });
});

describe('Path Validation', () => {
  const testProjectPath = join(tmpdir(), 'ornn-path-validate-test-' + Date.now());

  beforeEach(() => {
    mkdirSync(testProjectPath, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testProjectPath)) {
      rmSync(testProjectPath, { recursive: true, force: true });
    }
  });

  describe('validateProjectPath', () => {
    it('should return normalized path for valid input within cwd', () => {
      const result = validateProjectPath(process.cwd());
      expect(result).toBeDefined();
    });

    it('should throw for path traversal', () => {
      expect(() => validateProjectPath('../../../etc/passwd')).toThrow();
    });
  });

  describe('validateSkillId', () => {
    it('should return true for valid skill id', () => {
      expect(validateSkillId('my-skill')).toBe(true);
    });

    it('should return false for empty string', () => {
      expect(validateSkillId('')).toBe(false);
    });

    it('should return false for too long id', () => {
      expect(validateSkillId('a'.repeat(101))).toBe(false);
    });
  });

  describe('sanitizeSkillId', () => {
    it('should trim whitespace', () => {
      expect(sanitizeSkillId('  my-skill  ')).toBe('my-skill');
    });
  });

  describe('assertValidSkillId', () => {
    it('should not throw for valid id', () => {
      expect(() => assertValidSkillId('valid-skill')).not.toThrow();
    });

    it('should throw for invalid id', () => {
      expect(() => assertValidSkillId('')).toThrow();
    });
  });

  describe('pathExists', () => {
    it('should return true for existing path', () => {
      expect(pathExists(testProjectPath)).toBe(true);
    });

    it('should return false for non-existing path', () => {
      expect(pathExists(join(testProjectPath, 'nonexistent'))).toBe(false);
    });
  });

  describe('isDirectory', () => {
    it('should return true for directory', () => {
      expect(isDirectory(testProjectPath)).toBe(true);
    });

    it('should return false for file', () => {
      const filePath = join(testProjectPath, 'test.txt');
      writeFileSync(filePath, 'test');
      expect(isDirectory(filePath)).toBe(false);
    });
  });

  describe('isFile', () => {
    it('should return true for file', () => {
      const filePath = join(testProjectPath, 'test.txt');
      writeFileSync(filePath, 'test');
      expect(isFile(filePath)).toBe(true);
    });

    it('should return false for directory', () => {
      expect(isFile(testProjectPath)).toBe(false);
    });
  });

  describe('getRelativePath', () => {
    it('should return relative path', () => {
      const result = getRelativePath('/a/b', '/a/b/c/d.txt');
      expect(result).toBe('c/d.txt');
    });
  });

  describe('getExtension', () => {
    it('should return file extension', () => {
      expect(getExtension('/path/to/file.md')).toBe('.md');
    });
  });

  describe('getFileNameWithoutExt', () => {
    it('should return filename without extension', () => {
      expect(getFileNameWithoutExt('/path/to/file.md')).toBe('file');
    });
  });

  describe('getDirName', () => {
    it('should return directory name', () => {
      expect(getDirName('/path/to/file.md')).toBe('/path/to');
    });
  });

  describe('getEvoDir', () => {
    it('should return .ornn directory path', () => {
      expect(getEvoDir(testProjectPath)).toBe(join(testProjectPath, '.ornn'));
    });
  });

  describe('getSkillsDir', () => {
    it('should return skills directory path', () => {
      expect(getSkillsDir(testProjectPath)).toBe(join(testProjectPath, '.ornn', 'skills'));
    });
  });

  describe('getStateDir', () => {
    it('should return state directory path', () => {
      expect(getStateDir(testProjectPath)).toBe(join(testProjectPath, '.ornn', 'state'));
    });
  });

  describe('getConfigDir', () => {
    it('should return config directory path', () => {
      expect(getConfigDir(testProjectPath)).toBe(join(testProjectPath, '.ornn', 'config'));
    });
  });
});
