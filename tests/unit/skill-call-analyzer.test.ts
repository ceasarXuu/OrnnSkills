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

  it('retries deepseek json-mode calls when the first response has empty content', async () => {
    readDashboardConfigMock.mockResolvedValue({
      autoOptimize: true,
      userConfirm: false,
      runtimeSync: true,
      defaultProvider: 'deepseek',
      logLevel: 'info',
      providers: [
        {
          provider: 'deepseek',
          modelName: 'deepseek/deepseek-chat',
          apiKeyEnvVar: 'DEEPSEEK_API_KEY',
          apiKey: 'test-key',
          hasApiKey: true,
        },
      ],
    });

    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: '',
              },
            },
          ],
          usage: {
            prompt_tokens: 12,
            completion_tokens: 0,
            total_tokens: 12,
          },
          model: 'deepseek-chat',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: '{"should_patch":false,"reason":"证据不足","confidence":0.2,"evidence":[]}',
              },
            },
          ],
          usage: {
            prompt_tokens: 12,
            completion_tokens: 18,
            total_tokens: 30,
          },
          model: 'deepseek-chat',
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const analyzer = createSkillCallAnalyzer();
    const result = await analyzer.analyzeWindow('/tmp/project', {
      windowId: 'window-3',
      skillId: 'test-skill',
      runtime: 'codex',
      sessionId: 'session-1',
      closeReason: 'completed',
      startedAt: '2026-04-10T00:00:00.000Z',
      lastTraceAt: '2026-04-10T00:01:00.000Z',
      traces: [],
    } as never, 'content');

    expect(result.success).toBe(true);
    expect(result.evaluation?.should_patch).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(requestInit.body))).toMatchObject({
      model: 'deepseek-chat',
      response_format: { type: 'json_object' },
    });
  });
});
