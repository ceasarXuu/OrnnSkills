import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

const { readDashboardConfigMock } = vi.hoisted(() => ({
  readDashboardConfigMock: vi.fn(),
}));
const { readProjectLanguageMock } = vi.hoisted(() => ({
  readProjectLanguageMock: vi.fn(),
}));

vi.mock('../../src/config/manager.js', () => ({
  readDashboardConfig: readDashboardConfigMock,
}));

vi.mock('../../src/dashboard/language-state.js', () => ({
  readProjectLanguage: readProjectLanguageMock,
}));

import { createSkillCallAnalyzer } from '../../src/core/skill-call-analyzer/index.js';

describe('SkillCallAnalyzer', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    readDashboardConfigMock.mockReset();
    readProjectLanguageMock.mockReset();
    readProjectLanguageMock.mockResolvedValue('en');
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
      errorCode: 'provider_not_configured',
      model: 'none',
    });
    expect(result.userMessage).toContain('no model provider');
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
    expect(result.error).toBe('invalid_analysis_json');
    expect(result.userMessage).toContain('required JSON format');
    expect(result.technicalDetail).toContain('Raw model response excerpt');
    expect(result.technicalDetail).toContain('not json');
  });

  it('recovers a valid json object even when malformed brace text appears before it', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: [
                '先说明一下：{bad json}',
                '最终输出如下：',
                '{"decision":"no_optimization","reason":"当前无需修改","confidence":0.92,"evidence":[]}',
              ].join('\n'),
            },
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30,
        },
        model: 'gpt-4o-mini',
      }),
    }));

    const analyzer = createSkillCallAnalyzer();
    const result = await analyzer.analyzeWindow('/tmp/project', {
      windowId: 'window-2b',
      skillId: 'test-skill',
      runtime: 'codex',
      sessionId: 'session-1',
      closeReason: 'completed',
      startedAt: '2026-04-10T00:00:00.000Z',
      lastTraceAt: '2026-04-10T00:01:00.000Z',
      traces: [],
    } as never, 'content');

    expect(result.success).toBe(true);
    expect(result.decision).toBe('no_optimization');
    expect(result.evaluation?.reason).toBe('当前无需修改');
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

  it('maps empty model responses to a user-friendly failure reason', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: '',
            },
          },
        ],
      }),
    }));

    const analyzer = createSkillCallAnalyzer();
    const result = await analyzer.analyzeWindow('/tmp/project', {
      windowId: 'window-4',
      skillId: 'test-skill',
      runtime: 'codex',
      sessionId: 'session-1',
      closeReason: 'completed',
      startedAt: '2026-04-10T00:00:00.000Z',
      lastTraceAt: '2026-04-10T00:01:00.000Z',
      traces: [],
    } as never, 'content');

    expect(result.success).toBe(false);
    expect(result.error).toBe('empty_llm_response');
    expect(result.userMessage).toContain('empty response');
    expect(result.technicalDetail).toContain('Empty content in LLM response');
    expect(result.technicalDetail).toContain('response_format=json_object');
    expect(result.technicalDetail).toContain('attempts=2');
  });

  it('compacts noisy traces before sending the analysis prompt', async () => {
    readProjectLanguageMock.mockResolvedValue('zh');

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: '{"decision":"no_optimization","reason":"当前无需修改","confidence":0.9,"evidence":[]}',
            },
          },
        ],
        usage: {
          prompt_tokens: 120,
          completion_tokens: 20,
          total_tokens: 140,
        },
        model: 'gpt-4o-mini',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const analyzer = createSkillCallAnalyzer();
    const result = await analyzer.analyzeWindow('/tmp/project', {
      windowId: 'window-compact',
      skillId: 'test-skill',
      runtime: 'codex',
      sessionId: 'session-1',
      closeReason: 'completed',
      startedAt: '2026-04-10T00:00:00.000Z',
      lastTraceAt: '2026-04-10T00:01:00.000Z',
      traces: [
        {
          trace_id: 'trace-1',
          runtime: 'codex',
          session_id: 'session-1',
          turn_id: 'turn-1',
          event_type: 'assistant_output',
          timestamp: '2026-04-10T00:00:10.000Z',
          assistant_output: `开始排查。${'低信号文本 '.repeat(120)}这个尾巴不应该原样进入模型。`,
          status: 'success',
        },
        {
          trace_id: 'trace-2',
          runtime: 'codex',
          session_id: 'session-1',
          turn_id: 'turn-2',
          event_type: 'tool_call',
          timestamp: '2026-04-10T00:00:20.000Z',
          tool_name: 'exec_command',
          tool_args: {
            cmd: 'npm test',
            workdir: '/tmp/project',
            max_output_tokens: 24000,
            yield_time_ms: 1000,
            login: true,
            noisy_blob: 'Y'.repeat(1000),
          },
          status: 'success',
        },
        {
          trace_id: 'trace-3',
          runtime: 'codex',
          session_id: 'session-1',
          turn_id: 'turn-3',
          event_type: 'tool_result',
          timestamp: '2026-04-10T00:00:30.000Z',
          tool_name: 'exec_command',
          tool_result: {
            exit_code: 0,
            stdout: `PASS${' result'.repeat(100)}`,
            stderr: '',
            yield_time_ms: 1000,
          },
          status: 'success',
        },
      ],
    } as never, 'skill content');

    expect(result.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    const requestBody = JSON.parse(String(requestInit.body)) as {
      messages: Array<{ role: string; content: string }>;
    };
    const userMessage = requestBody.messages.find((message) => message.role === 'user')?.content || '';

    expect(userMessage).toContain('助手输出: 开始排查。');
    expect(userMessage).toContain('工具调用: exec_command cmd=npm test; workdir=/tmp/project');
    expect(userMessage).toContain('工具结果: exec_command exit_code=0; stdout=PASS');
    expect(userMessage).not.toContain('max_output_tokens');
    expect(userMessage).not.toContain('yield_time_ms');
    expect(userMessage).not.toContain('YYYYY');
    expect(userMessage).not.toContain('这个尾巴不应该原样进入模型。');
  });

  it('recovers structured json from reasoning_content-only responses', async () => {
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

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: '',
              reasoning_content: '{"decision":"no_optimization","reason":"当前无需修改","confidence":0.92,"evidence":[]}',
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
    }));

    const analyzer = createSkillCallAnalyzer();
    const result = await analyzer.analyzeWindow('/tmp/project', {
      windowId: 'window-4b',
      skillId: 'test-skill',
      runtime: 'codex',
      sessionId: 'session-1',
      closeReason: 'completed',
      startedAt: '2026-04-10T00:00:00.000Z',
      lastTraceAt: '2026-04-10T00:01:00.000Z',
      traces: [],
    } as never, 'content');

    expect(result.success).toBe(true);
    expect(result.decision).toBe('no_optimization');
    expect(result.evaluation?.reason).toBe('当前无需修改');
  });

  it('forces zh analyzer reasons to stay in chinese even when the model returns english prose', async () => {
    readProjectLanguageMock.mockResolvedValue('zh');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                decision: 'no_optimization',
                reason: 'The skill was correctly invoked and followed, with no optimization needed.',
                confidence: 0.9,
                evidence: ['The assistant followed the skill guidance correctly.'],
              }),
            },
          },
        ],
        usage: {
          prompt_tokens: 12,
          completion_tokens: 18,
          total_tokens: 30,
        },
        model: 'gpt-4o-mini',
      }),
    }));

    const analyzer = createSkillCallAnalyzer();
    const result = await analyzer.analyzeWindow('/tmp/project', {
      windowId: 'window-5',
      skillId: 'systematic-debugging',
      runtime: 'codex',
      sessionId: 'session-1',
      closeReason: 'completed',
      startedAt: '2026-04-10T00:00:00.000Z',
      lastTraceAt: '2026-04-10T00:01:00.000Z',
      traces: [],
    } as never, 'content');

    expect(result.success).toBe(true);
    expect(result.userMessage).toBe('当前窗口显示该技能被正确调用并按预期执行，未发现需要优化的设计问题。');
    expect(result.evaluation?.reason).toBe('当前窗口显示该技能被正确调用并按预期执行，未发现需要优化的设计问题。');
  });
});
