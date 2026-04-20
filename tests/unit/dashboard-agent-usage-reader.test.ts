import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  getAgentUsageStatsCacheStats,
  readAgentUsageRecords,
  readAgentUsageStats,
  resetAgentUsageStatsCache,
} from '../../src/dashboard/readers/agent-usage-reader.js';

describe('dashboard agent usage reader', () => {
  const testDir = join(tmpdir(), `ornn-dashboard-agent-usage-reader-${Date.now()}`);

  beforeEach(() => {
    mkdirSync(join(testDir, '.ornn', 'state'), { recursive: true });
    resetAgentUsageStatsCache();
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

  it('prefers a fresh summary snapshot over rescanning ndjson when both exist', async () => {
    const ndjsonPath = join(testDir, '.ornn', 'state', 'agent-usage.ndjson');
    const summaryPath = join(testDir, '.ornn', 'state', 'agent-usage-summary.json');

    writeFileSync(
      ndjsonPath,
      [
        JSON.stringify({
          id: 'u-legacy-1',
          timestamp: '2026-04-17T09:59:00.000Z',
          scope: 'decision_explainer',
          eventId: 'legacy-1',
          skillId: 'legacy-skill',
          model: 'deepseek/deepseek-chat',
          promptTokens: 10,
          completionTokens: 5,
          totalTokens: 15,
          durationMs: 20,
        }),
      ].join('\n') + '\n',
      'utf-8'
    );

    await new Promise((resolve) => setTimeout(resolve, 5));

    writeFileSync(
      summaryPath,
      JSON.stringify({
        updatedAt: '2026-04-17T10:02:00.000Z',
        scope: 'ornn_agent',
        callCount: 3,
        promptTokens: 3100,
        completionTokens: 600,
        totalTokens: 3700,
        durationMsTotal: 5000,
        avgDurationMs: Math.round(5000 / 3),
        lastCallAt: '2026-04-17T10:02:00.000Z',
        byModel: {
          'deepseek/deepseek-reasoner': {
            callCount: 2,
            promptTokens: 2500,
            completionTokens: 500,
            totalTokens: 3000,
            durationMsTotal: 4000,
            avgDurationMs: 2000,
            lastCallAt: '2026-04-17T10:01:00.000Z',
          },
        },
        byScope: {
          decision_explainer: {
            callCount: 1,
            promptTokens: 1000,
            completionTokens: 200,
            totalTokens: 1200,
            durationMsTotal: 1800,
            avgDurationMs: 1800,
            lastCallAt: '2026-04-17T10:00:00.000Z',
          },
          skill_call_analyzer: {
            callCount: 1,
            promptTokens: 1500,
            completionTokens: 300,
            totalTokens: 1800,
            durationMsTotal: 2200,
            avgDurationMs: 2200,
            lastCallAt: '2026-04-17T10:01:00.000Z',
          },
          readiness_probe: {
            callCount: 1,
            promptTokens: 600,
            completionTokens: 100,
            totalTokens: 700,
            durationMsTotal: 1000,
            avgDurationMs: 1000,
            lastCallAt: '2026-04-17T10:02:00.000Z',
          },
        },
        bySkill: {
          'show-my-repo': {
            callCount: 2,
            promptTokens: 2500,
            completionTokens: 500,
            totalTokens: 3000,
            durationMsTotal: 4000,
            avgDurationMs: 2000,
            lastCallAt: '2026-04-17T10:01:00.000Z',
          },
          'summary-my-repo': {
            callCount: 1,
            promptTokens: 600,
            completionTokens: 100,
            totalTokens: 700,
            durationMsTotal: 1000,
            avgDurationMs: 1000,
            lastCallAt: '2026-04-17T10:02:00.000Z',
          },
        },
      }),
      'utf-8'
    );

    expect(readAgentUsageStats(testDir)).toMatchObject({
      callCount: 3,
      totalTokens: 3700,
      durationMsTotal: 5000,
      lastCallAt: '2026-04-17T10:02:00.000Z',
      bySkill: {
        'show-my-repo': {
          callCount: 2,
          totalTokens: 3000,
        },
      },
    });
  });

  it('keeps the agent usage stats cache bounded across many project rotations', () => {
    const cacheStats = getAgentUsageStatsCacheStats();
    const rootDir = join(testDir, 'agent-usage-cache-rotation');
    mkdirSync(rootDir, { recursive: true });

    for (let index = 0; index < cacheStats.maxEntries + 40; index += 1) {
      const projectRoot = join(rootDir, `project-${index}`);
      mkdirSync(join(projectRoot, '.ornn', 'state'), { recursive: true });
      writeFileSync(
        join(projectRoot, '.ornn', 'state', 'agent-usage-summary.json'),
        JSON.stringify({
          updatedAt: `2026-04-21T00:${String(index % 60).padStart(2, '0')}:00.000Z`,
          scope: 'ornn_agent',
          callCount: 1,
          promptTokens: 10,
          completionTokens: 5,
          totalTokens: 15,
          durationMsTotal: 25,
          avgDurationMs: 25,
          lastCallAt: '2026-04-21T00:00:00.000Z',
          byModel: {},
          byScope: {},
          bySkill: {},
        }),
        'utf-8'
      );

      expect(readAgentUsageStats(projectRoot)).toMatchObject({
        callCount: 1,
        totalTokens: 15,
      });
    }

    expect(getAgentUsageStatsCacheStats().entries).toBeLessThanOrEqual(cacheStats.maxEntries);
  });
});
