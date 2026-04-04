import { describe, it, expect } from 'vitest';
import { hashString } from '../../src/utils/hash.js';
import { hasChanges, countChanges } from '../../src/utils/diff.js';

describe('Hash Utils', () => {
  it('should generate consistent hash for same content', () => {
    const content = 'test content';
    const hash1 = hashString(content);
    const hash2 = hashString(content);
    expect(hash1).toBe(hash2);
  });

  it('should generate different hash for different content', () => {
    const hash1 = hashString('content1');
    const hash2 = hashString('content2');
    expect(hash1).not.toBe(hash2);
  });

  it('should generate a 64-char hex hash', () => {
    const content = 'test content';
    const hash = hashString(content);
    expect(hash.length).toBe(64);
  });
});

describe('Diff Utils', () => {
  it('should detect no changes for same content', () => {
    const content = 'same content';
    expect(hasChanges(content, content)).toBe(false);
  });

  it('should detect changes for different content', () => {
    const oldContent = 'old content';
    const newContent = 'new content';
    expect(hasChanges(oldContent, newContent)).toBe(true);
  });

  it('should count changes correctly', () => {
    const oldContent = 'line1\nline2\nline3';
    const newContent = 'line1\nmodified\nline3\nnewline4';
    const { added, removed } = countChanges(oldContent, newContent);
    expect(added).toBeGreaterThan(0);
    expect(removed).toBeGreaterThan(0);
  });
});