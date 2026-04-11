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
});
