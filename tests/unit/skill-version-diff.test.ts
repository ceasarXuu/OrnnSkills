import { describe, expect, it } from 'vitest'

import { buildSkillVersionDiff } from '../../frontend-v3/src/lib/skill-version-diff.ts'

describe('skill version diff', () => {
  it('builds code-style line rows with old and new line numbers', () => {
    expect(buildSkillVersionDiff('a\nb\nc\n', 'a\nbb\nc\nd\n')).toEqual([
      { content: 'a', kind: 'context', newLineNumber: 1, oldLineNumber: 1 },
      { content: 'bb', kind: 'added', newLineNumber: 2, oldLineNumber: null },
      { content: 'b', kind: 'removed', newLineNumber: null, oldLineNumber: 2 },
      { content: 'c', kind: 'context', newLineNumber: 3, oldLineNumber: 3 },
      { content: 'd', kind: 'added', newLineNumber: 4, oldLineNumber: null },
    ])
  })
})
