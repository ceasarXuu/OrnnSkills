import { describe, it, expect } from 'vitest';
import {
  extractSkillRefs,
  extractSkillRefsFromSources,
  hasSkillRef,
  formatSkillRef,
} from '../../src/utils/skill-refs.js';

describe('Skill Refs Utils', () => {
  describe('extractSkillRefs', () => {
    it('should extract skill refs from markdown content', () => {
      const content = '# Test\n\nSee also: @code-review, @test-skill';
      const refs = extractSkillRefs(content);
      expect(refs).toContain('code-review');
      expect(refs).toContain('test-skill');
    });

    it('should return empty array when no skill refs', () => {
      const content = '# Test\n\nNo references here.';
      const refs = extractSkillRefs(content);
      expect(refs).toEqual([]);
    });

    it('should handle multiple refs on same line', () => {
      const content = '@skill-a @skill-b @skill-c';
      const refs = extractSkillRefs(content);
      expect(refs).toContain('skill-a');
      expect(refs).toContain('skill-b');
      expect(refs).toContain('skill-c');
    });

    it('should handle refs with hyphens and underscores', () => {
      const content = '@my-skill @another_skill';
      const refs = extractSkillRefs(content);
      expect(refs).toContain('my-skill');
      expect(refs).toContain('another_skill');
    });

    it('should handle empty content', () => {
      const refs = extractSkillRefs('');
      expect(refs).toEqual([]);
    });

    it('should deduplicate refs', () => {
      const content = '@skill-a @skill-a @skill-b';
      const refs = extractSkillRefs(content);
      expect(refs.filter((r) => r === 'skill-a').length).toBe(1);
    });

    it('should extract skill refs from skill file paths', () => {
      const content = 'cat /Users/xuzhang/.agents/skills/show-my-repo/SKILL.md';
      const refs = extractSkillRefs(content);
      expect(refs).toContain('show-my-repo');
    });
  });

  describe('extractSkillRefsFromSources', () => {
    it('should extract refs from string sources', () => {
      const sources = ['@skill-a', 'no refs', '@skill-b'];
      const refs = extractSkillRefsFromSources(sources);
      expect(refs).toContain('skill-a');
      expect(refs).toContain('skill-b');
    });

    it('should skip non-string sources', () => {
      const sources = ['@skill-a', undefined, { key: '@skill-b' }];
      const refs = extractSkillRefsFromSources(sources);
      expect(refs).toContain('skill-a');
    });
  });

  describe('hasSkillRef', () => {
    it('should return true when skill ref exists', () => {
      expect(hasSkillRef('@code-review', 'code-review')).toBe(true);
    });

    it('should return false when skill ref does not exist', () => {
      expect(hasSkillRef('no refs here', 'code-review')).toBe(false);
    });
  });

  describe('formatSkillRef', () => {
    it('should format as bracket by default', () => {
      expect(formatSkillRef('code-review')).toBe('[$code-review]');
    });

    it('should format as at sign', () => {
      expect(formatSkillRef('code-review', 'at')).toBe('@code-review');
    });
  });
});
