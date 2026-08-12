import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { collectMock } = vi.hoisted(() => ({
  collectMock: vi.fn(() => 'sig'),
}));

vi.mock('../../src/core/skill-domain/source-signature.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/core/skill-domain/source-signature.js')>();
  return {
    ...actual,
    collectDirectoryContentSignature: collectMock,
    collectSkillVersionTreeSignature: vi.fn(() => 'v'),
  };
});

import { readProjectSnapshotVersion } from '../../src/dashboard/data-reader.js';

describe('host skill signature TTL cache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    collectMock.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reuses cached host signatures within TTL and rescans after expiry', () => {
    const projectRoot = '/tmp/proj';
    const first = readProjectSnapshotVersion(projectRoot);
    const callsAfterFirst = collectMock.mock.calls.length;
    expect(callsAfterFirst).toBeGreaterThan(0);

    const withinTtl = readProjectSnapshotVersion(projectRoot);
    expect(withinTtl).toBe(first);
    expect(collectMock.mock.calls.length).toBe(callsAfterFirst);

    vi.setSystemTime(Date.now() + 20_000);
    const afterTtl = readProjectSnapshotVersion(projectRoot);
    expect(afterTtl).toBe(first);
    expect(collectMock.mock.calls.length).toBeGreaterThan(callsAfterFirst);
  });
});
