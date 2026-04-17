import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  readAgentUsageRecords,
  readAgentUsageStats,
} from '../../src/dashboard/readers/agent-usage-reader.js';

describe('dashboard agent usage reader', () => {
  const testDir = join(tmpdir(), `ornn-dashboard-agent-usage-reader-${Date.now()}`);

  beforeEach(() => {
    mkdirSync(join(testDir, '.ornn', 'state'), { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('returns empty usage stats when neither ndjson nor summary exists', () => {
    expect(readAgentUsageStats(testDir)).toEqual({
      callCount: 0,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      durationMsTotal: 0,
      avgDurationMs: 0,
      lastCallAt: null,
      byModel: {},
      byScope: {},
      bySkill: {},
    });
  });

  it('aggregates ndjson usage, canonicalizes model ids, and returns chronologically ordered records', () => {
    writeFileSync(
      join(testDir, '.ornn', 'state', 'agent-usage.ndjson'),
      [
        JSON.stringify({
          id: 'u-1',
          timestamp: '2026-04-17T10:00:00.000Z',
          scope: 'decision_explainer',
          eventId: 'e-1',
          skillId: 'show-my-repo',
          model: 'deepseek/deepseek/deepseek-reasoner',
          promptTokens: 1000,
          completionTokens: 200,
          totalTokens: 1200,
          durationMs: 1800,
        }),
        JSON.stringify({
          id: 'u-2',
          timestamp: '2026-04-17T10:01:00.000Z',
          scope: 'skill_call_analyzer',
          eventId: 'e-2',
          skillId: 'show-my-repo',
          model: 'deepseek/deepseek-reasoner',
          promptTokens: 1500,
          completionTokens: 300,
          totalTokens: 1800,
          durationMs: 2200,
        }),
        JSON.stringify({
          id: 'u-3',
          timestamp: '2026-04-17T10:02:00.000Z',
          scope: 'readiness_probe',
          eventId: 'e-3',
          skillId: 'summary-my-repo',
          model: 'deepseek/deepseek-chat',
          promptTokens: 600,
          completionTokens: 100,
          totalTokens: 700,
          durationMs: 1000,
        }),
      ].join('\n') + '\n',
      'utf-8'
    );

    const stats = readAgentUsageStats(testDir);
    expect(stats).toMatchObject({
      callCount: 3,
      promptTokens: 3100,
      completionTokens: 600,
      totalTokens: 3700,
      durationMsTotal: 5000,
      avgDurationMs: Math.round(5000 / 3),
      lastCallAt: '2026-04-17T10:02:00.000Z',
    });
    expect(stats.byModel['deepseek/deepseek-reasoner']).toMatchObject({
      callCount: 2,
      totalTokens: 3000,
      durationMsTotal: 4000,
      lastCallAt: '2026-04-17T10:01:00.000Z',
    });
    expect(stats.byModel['deepseek/deepseek/deepseek-reasoner']).toBeUndefined();
    expect(stats.bySkill['show-my-repo']).toMatchObject({
      callCount: 2,
      totalTokens: 3000,
      durationMsTotal: 4000,
    });

    expect(readAgentUsageRecords(testDir, 10).map((record) => record.id)).toEqual(['u-1', 'u-2', 'u-3']);
  });
});
