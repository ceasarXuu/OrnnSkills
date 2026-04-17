import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { readDashboardConfigMock } = vi.hoisted(() => ({
  readDashboardConfigMock: vi.fn(),
}));
const { readProjectLanguageMock } = vi.hoisted(() => ({
  readProjectLanguageMock: vi.fn(),
}));
const { recordAgentUsageMock } = vi.hoisted(() => ({
  recordAgentUsageMock: vi.fn(),
}));
const loggerMocks = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock('../../src/config/manager.js', () => ({
  readDashboardConfig: readDashboardConfigMock,
}));

vi.mock('../../src/dashboard/language-state.js', () => ({
  readProjectLanguage: readProjectLanguageMock,
}));

vi.mock('../../src/utils/logger.js', () => ({
  createChildLogger: () => loggerMocks,
}));

vi.mock('../../src/core/agent-usage/index.js', async () => {
  const actual = await vi.importActual<typeof import('../../src/core/agent-usage/index.js')>(
    '../../src/core/agent-usage/index.js'
  );
  return {
    ...actual,
    recordAgentUsage: recordAgentUsageMock,
  };
});

describe('decision explainer', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    readProjectLanguageMock.mockReset();
    readDashboardConfigMock.mockReset();
    recordAgentUsageMock.mockReset();
    loggerMocks.debug.mockReset();
    loggerMocks.info.mockReset();
    loggerMocks.warn.mockReset();
    loggerMocks.error.mockReset();

    readProjectLanguageMock.mockResolvedValue('en');
    readDashboardConfigMock.mockResolvedValue({
      autoOptimize: true,
      userConfirm: false,
      runtimeSync: true,
      defaultProvider: 'deepseek',
      logLevel: 'info',
      providers: [
        {
          provider: 'deepseek',
          modelName: 'deepseek/deepseek-reasoner',
          apiKeyEnvVar: 'DEEPSEEK_API_KEY',
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

  it('retries once when the first model response does not contain valid json', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: 'Here is the explanation in prose only.',
              },
            },
          ],
          usage: {
            prompt_tokens: 20,
            completion_tokens: 30,
            total_tokens: 50,
          },
          model: 'deepseek/deepseek-reasoner',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  summary: 'Decision recorded for astartes-coding-custodes.',
                  evidence_readout: ['Trace evidence remained consistent.'],
                  causal_chain: ['Observed repeated behavior.', 'No patch was required.'],
                  decision_rationale: 'The evidence was stable enough to avoid a change.',
                  recommended_action: 'Continue monitoring before making changes.',
                  uncertainties: [],
                  contradictions: [],
                }),
              },
            },
          ],
          usage: {
            prompt_tokens: 20,
            completion_tokens: 35,
            total_tokens: 55,
          },
          model: 'deepseek/deepseek-reasoner',
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const { generateDecisionExplanation } = await import('../../src/core/decision-explainer/index.js');
    const result = await generateDecisionExplanation(
      '/tmp/project',
      'astartes-coding-custodes',
      {
        should_patch: false,
        source_sessions: ['session-1'],
        confidence: 0.62,
        reason: 'Evidence looks stable.',
      },
      [],
      null,
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(recordAgentUsageMock).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({
      summary: 'Decision recorded for astartes-coding-custodes.',
      decisionRationale: 'The evidence was stable enough to avoid a change.',
      recommendedAction: 'Continue monitoring before making changes.',
    });
    expect(loggerMocks.debug).toHaveBeenCalledWith(
      'Decision explanation returned non-json response, retrying',
      expect.objectContaining({
        projectPath: '/tmp/project',
        skillId: 'astartes-coding-custodes',
        attempt: 1,
      }),
    );
    expect(loggerMocks.warn).not.toHaveBeenCalledWith(
      'Decision explanation failed to return JSON',
      expect.anything(),
    );
  });

  it('appends configured prompt overrides to the decision explainer system prompt', async () => {
    readDashboardConfigMock.mockResolvedValue({
      autoOptimize: true,
      userConfirm: false,
      runtimeSync: true,
      defaultProvider: 'deepseek',
      logLevel: 'info',
      promptOverrides: {
        skillCallAnalyzer: '',
        decisionExplainer: 'Team style: avoid bullets and keep the explanation dry.',
        readinessProbe: '',
      },
      providers: [
        {
          provider: 'deepseek',
          modelName: 'deepseek/deepseek-reasoner',
          apiKeyEnvVar: 'DEEPSEEK_API_KEY',
          apiKey: 'test-key',
          hasApiKey: true,
        },
      ],
    });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                summary: 'Decision recorded.',
                evidence_readout: [],
                causal_chain: [],
                decision_rationale: 'Stable result.',
                recommended_action: 'Keep monitoring.',
                uncertainties: [],
                contradictions: [],
              }),
            },
          },
        ],
        usage: {
          prompt_tokens: 20,
          completion_tokens: 20,
          total_tokens: 40,
        },
        model: 'deepseek/deepseek-reasoner',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { generateDecisionExplanation } = await import('../../src/core/decision-explainer/index.js');
    await generateDecisionExplanation(
      '/tmp/project',
      'astartes-coding-custodes',
      {
        should_patch: false,
        source_sessions: ['session-1'],
        confidence: 0.62,
        reason: 'Evidence looks stable.',
      },
      [],
      null,
    );

    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    const requestBody = JSON.parse(String(requestInit.body)) as {
      messages: Array<{ role: string; content: string }>;
    };
    const systemMessage = requestBody.messages.find((message) => message.role === 'system')?.content || '';
    expect(systemMessage).toContain('Team style: avoid bullets and keep the explanation dry.');
  });
});
