import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readRecentDecisionEvents } from '../../src/dashboard/readers/decision-events-reader.js';

describe('dashboard decision events reader', () => {
  const testDir = join(tmpdir(), `ornn-dashboard-decision-events-reader-${Date.now()}`);

  beforeEach(() => {
    mkdirSync(join(testDir, '.ornn', 'state'), { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('sorts recent events descending, normalizes optional fields, and skips malformed rows', () => {
    writeFileSync(
      join(testDir, '.ornn', 'state', 'decision-events.ndjson'),
      [
        '{"not":"valid event"}',
        JSON.stringify({
          id: 'evt-1',
          timestamp: '2026-04-17T09:00:00.000Z',
          tag: 'analysis_requested',
          skillId: 'systematic-debugging',
          runtime: 'codex',
          status: 'pending',
          detail: 'probe says ready',
        }),
        '{bad-json',
        JSON.stringify({
          id: 'evt-2',
          timestamp: '2026-04-17T09:01:00.000Z',
          tag: 'evaluation_result',
          skillId: 'systematic-debugging',
          runtime: 'codex',
          status: 'no_patch_needed',
          confidence: 0.61,
          reason: 'No patch needed',
          evidence: {
            windowId: 'scope-1',
            rawEvidence: 'stable',
          },
        }),
        JSON.stringify({
          id: 'evt-3',
          timestamp: '2026-04-17T08:59:00.000Z',
          tag: 'patch_applied',
          skillId: 'show-my-repo',
          runtime: 'claude',
          linesAdded: 12,
          linesRemoved: 3,
        }),
      ].join('\n') + '\n',
      'utf-8'
    );

    const events = readRecentDecisionEvents(testDir, 10);

    expect(events.map((event) => event.id)).toEqual(['evt-2', 'evt-1', 'evt-3']);
    expect(events[0]).toMatchObject({
      tag: 'evaluation_result',
      confidence: 0.61,
      reason: 'No patch needed',
      evidence: {
        windowId: 'scope-1',
        rawEvidence: 'stable',
      },
      detail: null,
      linesAdded: null,
      linesRemoved: null,
    });
    expect(events[1]).toMatchObject({
      tag: 'analysis_requested',
      detail: 'probe says ready',
      confidence: null,
      reason: null,
    });
  });
});
