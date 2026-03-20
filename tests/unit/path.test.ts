import { describe, it, expect } from 'vitest';
import {
  expandHome,
  getEvoDir,
  getSkillsDir,
  getStateDir,
  getConfigDir,
  getShadowSkillPath,
  getShadowMetaPath,
  getShadowJournalPath,
  getSnapshotsDir,
  join,
} from '../../src/utils/path.js';
import { homedir } from 'node:os';

describe('Path Utils', () => {
  describe('expandHome', () => {
    it('should expand ~ to home directory', () => {
      const result = expandHome('~/test');
      expect(result).toBe(join(homedir(), 'test'));
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
    it('should return .evo directory path', () => {
      const result = getEvoDir('/project');
      expect(result).toBe('/project/.evo');
    });
  });

  describe('getSkillsDir', () => {
    it('should return .evo/skills directory path', () => {
      const result = getSkillsDir('/project');
      expect(result).toBe('/project/.evo/skills');
    });
  });

  describe('getStateDir', () => {
    it('should return .evo/state directory path', () => {
      const result = getStateDir('/project');
      expect(result).toBe('/project/.evo/state');
    });
  });

  describe('getConfigDir', () => {
    it('should return .evo/config directory path', () => {
      const result = getConfigDir('/project');
      expect(result).toBe('/project/.evo/config');
    });
  });

  describe('getShadowSkillPath', () => {
    it('should return shadow skill path', () => {
      const result = getShadowSkillPath('/project', 'my-skill');
      expect(result).toBe('/project/.evo/skills/my-skill/current.md');
    });
  });

  describe('getShadowMetaPath', () => {
    it('should return shadow meta path', () => {
      const result = getShadowMetaPath('/project', 'my-skill');
      expect(result).toBe('/project/.evo/skills/my-skill/meta.json');
    });
  });

  describe('getShadowJournalPath', () => {
    it('should return shadow journal path', () => {
      const result = getShadowJournalPath('/project', 'my-skill');
      expect(result).toBe('/project/.evo/skills/my-skill/journal.ndjson');
    });
  });

  describe('getSnapshotsDir', () => {
    it('should return snapshots directory path', () => {
      const result = getSnapshotsDir('/project', 'my-skill');
      expect(result).toBe('/project/.evo/skills/my-skill/snapshots');
    });
  });
});