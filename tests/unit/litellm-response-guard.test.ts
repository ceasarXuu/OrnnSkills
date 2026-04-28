import { describe, expect, it } from 'vitest';

import {
  assertLiteLLMResponse,
  LiteLLMResponseShapeError,
} from '../../src/llm/litellm-response-guard.js';

describe('assertLiteLLMResponse', () => {
  function validResponse() {
    return {
      model: 'deepseek-chat',
      choices: [
        {
          index: 0,
          finish_reason: 'stop',
          message: { role: 'assistant', content: 'hi' },
        },
      ],
      usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
    };
  }

  it('accepts a well-formed response', () => {
    expect(() => assertLiteLLMResponse(validResponse())).not.toThrow();
  });

  it('accepts response without usage', () => {
    const r = validResponse() as Record<string, unknown>;
    delete r.usage;
    expect(() => assertLiteLLMResponse(r)).not.toThrow();
  });

  it('accepts message with empty content', () => {
    const r = validResponse();
    r.choices[0]!.message.content = '';
    expect(() => assertLiteLLMResponse(r)).not.toThrow();
  });

  it('accepts message with reasoning_content and no content', () => {
    const r = validResponse() as Record<string, unknown>;
    (r.choices as Array<Record<string, unknown>>)[0]!.message = {
      role: 'assistant',
      reasoning_content: 'thinking…',
    };
    expect(() => assertLiteLLMResponse(r)).not.toThrow();
  });

  it('rejects null', () => {
    expect(() => assertLiteLLMResponse(null)).toThrow(LiteLLMResponseShapeError);
  });

  it('rejects missing choices', () => {
    expect(() =>
      assertLiteLLMResponse({ model: 'm' })
    ).toThrow(/\$\.choices/);
  });

  it('rejects empty choices array', () => {
    expect(() =>
      assertLiteLLMResponse({ model: 'm', choices: [] })
    ).toThrow(/\$\.choices/);
  });

  it('rejects missing message in choice', () => {
    expect(() =>
      assertLiteLLMResponse({
        model: 'm',
        choices: [{ index: 0, finish_reason: 'stop' }],
      })
    ).toThrow(/\$\.choices\[0\]\.message/);
  });

  it('accepts response without optional model field', () => {
    expect(() =>
      assertLiteLLMResponse({
        choices: [
          { message: { content: 'hi' } },
        ],
      })
    ).not.toThrow();
  });

  it('rejects non-string model when present', () => {
    expect(() =>
      assertLiteLLMResponse({
        model: 42,
        choices: [{ message: { content: 'hi' } }],
      })
    ).toThrow(/\$\.model/);
  });

  it('rejects non-string content', () => {
    expect(() =>
      assertLiteLLMResponse({
        model: 'm',
        choices: [
          {
            index: 0,
            finish_reason: 'stop',
            message: { role: 'assistant', content: 42 },
          },
        ],
      })
    ).toThrow(/\$\.choices\[0\]\.message\.content/);
  });

  it('rejects non-numeric usage fields', () => {
    expect(() =>
      assertLiteLLMResponse({
        model: 'm',
        choices: [
          {
            index: 0,
            finish_reason: 'stop',
            message: { role: 'assistant', content: '' },
          },
        ],
        usage: { prompt_tokens: '1', completion_tokens: 2, total_tokens: 3 },
      })
    ).toThrow(/\$\.usage\.prompt_tokens/);
  });

  it('exposes path and received on error', () => {
    try {
      assertLiteLLMResponse('nope');
      throw new Error('expected throw');
    } catch (error) {
      expect(error).toBeInstanceOf(LiteLLMResponseShapeError);
      const err = error as LiteLLMResponseShapeError;
      expect(err.path).toBe('$');
      expect(err.received).toBe('string');
    }
  });
});
