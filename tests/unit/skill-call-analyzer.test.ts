import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

const { readDashboardConfigMock } = vi.hoisted(() => ({
  readDashboardConfigMock: vi.fn(),
}));

vi.mock('../../src/config/manager.js', () => ({
  readDashboardConfig: readDashboardConfigMock,
}));

import { createSkillCallAnalyzer } from '../../src/core/skill-call-analyzer/index.js';

describe('SkillCallAnalyzer', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    readDashboardConfigMock.mockReset();
    readDashboardConfigMock.mockResolvedValue({
      autoOptimize: true,
      userConfirm: false,
      runtimeSync: true,
      defaultProvider: 'openai',
      logLevel: 'info',
      providers: [
        {
          provider: 'openai',
          modelName: 'gpt-4o-mini',
          apiKeyEnvVar: 'OPENAI_API_KEY',
          apiKey: 'test-key',
          hasApiKey: true,
        },
      ],
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns provider_not_configured when no active provider has an api key', async () => {
    const analyzer = createSkillCallAnalyzer();
    readDashboardConfigMock.mockResolvedValue({
      autoOptimize: true,
      userConfirm: false,
      runtimeSync: true,
      defaultProvider: '',
      logLevel: 'info',
      providers: [],
    });

    const result = await analyzer.analyzeWindow('/tmp/project', {
      windowId: 'window-1',
      skillId: 'test-skill',
      runtime: 'codex',
      sessionId: 'session-1',
      closeReason: 'completed',
      startedAt: '2026-04-10T00:00:00.000Z',
      lastTraceAt: '2026-04-10T00:01:00.000Z',
      traces: [],
    } as never, 'content');

    expect(result).toMatchObject({
      success: false,
      error: 'provider_not_configured',
      model: 'none',
    });
  });

  it('marks invalid JSON responses as analysis failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: 'not json',
            },
          },
        ],
      }),
    }));

    const analyzer = createSkillCallAnalyzer();
    const result = await analyzer.analyzeWindow('/tmp/project', {
      windowId: 'window-2',
      skillId: 'test-skill',
      runtime: 'codex',
      sessionId: 'session-1',
      closeReason: 'completed',
      startedAt: '2026-04-10T00:00:00.000Z',
      lastTraceAt: '2026-04-10T00:01:00.000Z',
      traces: [],
    } as never, 'content');

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });
});
