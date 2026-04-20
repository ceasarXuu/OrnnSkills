import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { recordAgentUsage } from '../../src/core/agent-usage/index.js';

describe('agent usage summary persistence', () => {
  const testDir = join(tmpdir(), `ornn-agent-usage-summary-${Date.now()}`);

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('writes enriched summary fields needed by dashboard performance readers', () => {
    recordAgentUsage(testDir, {
      scope: 'decision_explainer',
      eventId: 'evt-1',
      skillId: 'show-my-repo',
      episodeId: null,
      triggerTraceId: null,
      windowId: 'window-1',
      model: 'deepseek/deepseek-reasoner',
      promptTokens: 1000,
      completionTokens: 200,
      totalTokens: 1200,
      durationMs: 1800,
    });
    recordAgentUsage(testDir, {
      scope: 'skill_call_analyzer',
      eventId: 'evt-2',
      skillId: 'show-my-repo',
      episodeId: null,
      triggerTraceId: null,
      windowId: 'window-2',
      model: 'deepseek/deepseek-reasoner',
      promptTokens: 1500,
      completionTokens: 300,
      totalTokens: 1800,
      durationMs: 2200,
    });

    const summary = JSON.parse(
      readFileSync(join(testDir, '.ornn', 'state', 'agent-usage-summary.json'), 'utf-8')
    ) as Record<string, unknown>;

    expect(summary).toMatchObject({
      callCount: 2,
      promptTokens: 2500,
      completionTokens: 500,
      totalTokens: 3000,
      durationMsTotal: 4000,
      avgDurationMs: 2000,
      lastCallAt: expect.any(String),
      bySkill: {
        'show-my-repo': {
          callCount: 2,
          totalTokens: 3000,
          durationMsTotal: 4000,
          avgDurationMs: 2000,
        },
      },
    });
  });
});