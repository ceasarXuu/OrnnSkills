import { afterEach, describe, expect, it, vi } from 'vitest';
import { LiteLLMClient } from '../../src/llm/litellm-client.js';

describe('LiteLLMClient connectivity probe', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('accepts reasoning-only responses during completion-based connectivity probe', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        model: 'deepseek-reasoner',
        choices: [
          {
            index: 0,
            finish_reason: 'length',
            message: {
              role: 'assistant',
              content: '',
              reasoning_content: 'thinking',
            },
          },
        ],
        usage: {
          prompt_tokens: 5,
          completion_tokens: 8,
          total_tokens: 13,
        },
      }),
    }));

    const client = new LiteLLMClient({
      provider: 'openai',
      modelName: 'gpt-4o',
      apiKey: 'test-key',
      maxTokens: 8,
    });

    await expect(client.probeConnectivity()).resolves.toMatchObject({
      hasContent: false,
      hasReasoningContent: true,
      finishReason: 'length',
    });
  });

  it('uses the fast models endpoint for deepseek connectivity checks', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: 'deepseek-chat' },
          { id: 'deepseek-reasoner' },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new LiteLLMClient({
      provider: 'deepseek',
      modelName: 'deepseek/deepseek-reasoner',
      apiKey: 'test-key',
      maxTokens: 8,
    });

    await expect(client.probeConnectivity()).resolves.toMatchObject({
      hasContent: true,
      hasReasoningContent: false,
      finishReason: 'model-list',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.deepseek.com/v1/models',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-key',
        }),
      })
    );
  });

  it('normalizes deepseek provider/model names before chat completions', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        model: 'deepseek-reasoner',
        choices: [
          {
            index: 0,
            finish_reason: 'stop',
            message: {
              role: 'assistant',
              content: 'OK',
            },
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new LiteLLMClient({
      provider: 'deepseek',
      modelName: 'deepseek/deepseek-reasoner',
      apiKey: 'test-key',
      maxTokens: 8,
    });

    await expect(client.completion({ prompt: 'ping', timeout: 1000 })).resolves.toBe('OK');

    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(requestInit.body))).toMatchObject({
      model: 'deepseek-reasoner',
    });
  });

  it('still rejects empty completion content for normal generation', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        model: 'deepseek-reasoner',
        choices: [
          {
            index: 0,
            finish_reason: 'length',
            message: {
              role: 'assistant',
              content: '',
              reasoning_content: 'thinking',
            },
          },
        ],
      }),
    }));

    const client = new LiteLLMClient({
      provider: 'deepseek',
      modelName: 'deepseek-reasoner',
      apiKey: 'test-key',
      maxTokens: 8,
    });

    await expect(client.completion({ prompt: 'ping', timeout: 1000 })).rejects.toThrow(
      'Empty content in LLM response'
    );
  });

  it('enables json_object mode and retries once for deepseek empty JSON responses', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: 'deepseek-reasoner',
          choices: [
            {
              index: 0,
              finish_reason: 'stop',
              message: {
                role: 'assistant',
                content: '',
              },
            },
          ],
          usage: {
            prompt_tokens: 5,
            completion_tokens: 0,
            total_tokens: 5,
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: 'deepseek-reasoner',
          choices: [
            {
              index: 0,
              finish_reason: 'stop',
              message: {
                role: 'assistant',
                content: '{"ok":true}',
              },
            },
          ],
          usage: {
            prompt_tokens: 5,
            completion_tokens: 6,
            total_tokens: 11,
          },
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const client = new LiteLLMClient({
      provider: 'deepseek',
      modelName: 'deepseek/deepseek-reasoner',
      apiKey: 'test-key',
      maxTokens: 32,
    });

    await expect(client.completion({
      prompt: 'return json',
      timeout: 1000,
      responseFormat: 'json_object',
    })).resolves.toBe('{"ok":true}');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(requestInit.body))).toMatchObject({
      model: 'deepseek-reasoner',
      response_format: { type: 'json_object' },
    });
  });

  it('recovers json from reasoning_content when structured content is empty', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        model: 'deepseek-reasoner',
        choices: [
          {
            index: 0,
            finish_reason: 'stop',
            message: {
              role: 'assistant',
              content: '',
              reasoning_content: '```json\n{"ok":true}\n```',
            },
          },
        ],
        usage: {
          prompt_tokens: 5,
          completion_tokens: 6,
          total_tokens: 11,
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new LiteLLMClient({
      provider: 'deepseek',
      modelName: 'deepseek/deepseek-reasoner',
      apiKey: 'test-key',
      maxTokens: 32,
    });

    await expect(client.completion({
      prompt: 'return json',
      timeout: 1000,
      responseFormat: 'json_object',
    })).resolves.toBe('{"ok":true}');

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries structured deepseek responses when non-empty content is truncated before a valid json object completes', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: 'deepseek-reasoner',
          choices: [
            {
              index: 0,
              finish_reason: 'length',
              message: {
                role: 'assistant',
                content: '{"ok":true,',
              },
            },
          ],
          usage: {
            prompt_tokens: 5,
            completion_tokens: 32,
            total_tokens: 37,
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: 'deepseek-reasoner',
          choices: [
            {
              index: 0,
              finish_reason: 'stop',
              message: {
                role: 'assistant',
                content: '{"ok":true,"retry":2}',
              },
            },
          ],
          usage: {
            prompt_tokens: 5,
            completion_tokens: 20,
            total_tokens: 25,
          },
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const client = new LiteLLMClient({
      provider: 'deepseek',
      modelName: 'deepseek/deepseek-reasoner',
      apiKey: 'test-key',
      maxTokens: 32,
    });

    await expect(client.completion({
      prompt: 'return json',
      timeout: 1000,
      responseFormat: 'json_object',
    })).resolves.toBe('{"ok":true,"retry":2}');

    expect(fetchMock).toHaveBeenCalledTimes(2);

    const [, firstInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    const [, secondInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(JSON.parse(String(firstInit.body))).toMatchObject({
      max_tokens: 32,
      response_format: { type: 'json_object' },
    });
    expect(JSON.parse(String(secondInit.body))).toMatchObject({
      response_format: { type: 'json_object' },
    });
    expect(JSON.parse(String(secondInit.body)).max_tokens).toBeGreaterThan(32);
  });

  it('includes diagnostics after exhausting structured-response retries', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValue({
        ok: true,
        json: async () => ({
          model: 'deepseek-reasoner',
          choices: [
            {
              index: 0,
              finish_reason: 'stop',
              message: {
                role: 'assistant',
                content: '',
                reasoning_content: '',
              },
            },
          ],
          usage: {
            prompt_tokens: 5,
            completion_tokens: 0,
            total_tokens: 5,
          },
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const client = new LiteLLMClient({
      provider: 'deepseek',
      modelName: 'deepseek/deepseek-reasoner',
      apiKey: 'test-key',
      maxTokens: 32,
    });

    await expect(client.completion({
      prompt: 'return json',
      timeout: 1000,
      responseFormat: 'json_object',
    })).rejects.toThrow(
      'Empty content in LLM response | provider=deepseek | model=deepseek/deepseek-reasoner | response_format=json_object | attempts=3 | last_finish_reason=stop | last_has_reasoning_content=false | last_reasoning_has_json=false | last_total_tokens=5'
    );

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('blocks burst retries before they reach the provider when request rate exceeds the safety ceiling', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        model: 'deepseek-chat',
        choices: [
          {
            index: 0,
            finish_reason: 'stop',
            message: {
              role: 'assistant',
              content: 'OK',
            },
          },
        ],
        usage: {
          prompt_tokens: 5,
          completion_tokens: 5,
          total_tokens: 10,
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new LiteLLMClient({
      provider: 'deepseek',
      modelName: 'deepseek/deepseek-chat',
      apiKey: 'test-key',
      maxTokens: 32,
      safety: {
        maxRequestsPerWindow: 1,
        maxConcurrentRequests: 1,
        maxEstimatedTokensPerWindow: 500,
        windowMs: 60_000,
      },
    } as any);

    await expect(client.completion({ prompt: 'first', timeout: 1000 })).resolves.toBe('OK');
    await expect(client.completion({ prompt: 'second', timeout: 1000 })).rejects.toThrow(
      /rate limit|safety limit/i
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('blocks overlapping calls when the in-flight safety ceiling is reached', async () => {
    let releaseFirstRequest: (() => void) | null = null;
    const fetchMock = vi.fn().mockImplementationOnce(async () => {
      await new Promise<void>((resolve) => {
        releaseFirstRequest = resolve;
      });
      return {
        ok: true,
        json: async () => ({
          model: 'deepseek-chat',
          choices: [
            {
              index: 0,
              finish_reason: 'stop',
              message: {
                role: 'assistant',
                content: 'slow-ok',
              },
            },
          ],
          usage: {
            prompt_tokens: 5,
            completion_tokens: 5,
            total_tokens: 10,
          },
        }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new LiteLLMClient({
      provider: 'deepseek',
      modelName: 'deepseek/deepseek-chat',
      apiKey: 'test-key',
      maxTokens: 32,
      safety: {
        maxRequestsPerWindow: 10,
        maxConcurrentRequests: 1,
        maxEstimatedTokensPerWindow: 500,
        windowMs: 60_000,
      },
    } as any);

    const firstCall = client.completion({ prompt: 'slow', timeout: 1000 });

    await expect(client.completion({ prompt: 'blocked', timeout: 1000 })).rejects.toThrow(
      /concurrent|rate limit|safety limit/i
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);

    releaseFirstRequest?.();
    await expect(firstCall).resolves.toBe('slow-ok');
  });

  it('blocks requests when the rolling token safety budget would be exceeded', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        model: 'deepseek-chat',
        choices: [
          {
            index: 0,
            finish_reason: 'stop',
            message: {
              role: 'assistant',
              content: 'budget-ok',
            },
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 10,
          total_tokens: 20,
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new LiteLLMClient({
      provider: 'deepseek',
      modelName: 'deepseek/deepseek-chat',
      apiKey: 'test-key',
      maxTokens: 40,
      safety: {
        maxRequestsPerWindow: 10,
        maxConcurrentRequests: 1,
        maxEstimatedTokensPerWindow: 60,
        windowMs: 60_000,
      },
    } as any);

    await expect(client.completion({ prompt: 'short', timeout: 1000 })).resolves.toBe('budget-ok');
    await expect(
      client.completion({
        prompt: 'this follow-up prompt should be blocked because the estimated rolling token budget is too small',
        timeout: 1000,
      })
    ).rejects.toThrow(/token|budget|rate limit|safety limit/i);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
