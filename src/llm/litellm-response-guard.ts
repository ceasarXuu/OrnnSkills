/**
 * LiteLLM response shape guard
 *
 * Lightweight runtime validation for LLM HTTP responses.
 * Avoids adding zod/runtime dependency; only enforces structural invariants
 * the rest of the client assumes.
 */

export interface ValidatedLiteLLMResponse {
  choices: Array<{
    message: {
      content?: string;
      role?: string;
      reasoning_content?: string;
    };
    finish_reason?: string;
    index?: number;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model?: string;
}

export class LiteLLMResponseShapeError extends Error {
  readonly path: string;
  readonly received: string;

  constructor(path: string, received: string) {
    super(`Malformed LiteLLM response at "${path}" (received: ${received})`);
    this.name = 'LiteLLMResponseShapeError';
    this.path = path;
    this.received = received;
  }
}

function describe(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return `array(len=${value.length})`;
  return typeof value;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Asserts the parsed JSON body matches the expected LiteLLM chat completion
 * shape. Throws LiteLLMResponseShapeError on the first violation.
 *
 * Permissive on optional fields (usage, reasoning_content); strict on the
 * structural invariants that downstream code dereferences without checks.
 */
export function assertLiteLLMResponse(
  data: unknown
): asserts data is ValidatedLiteLLMResponse {
  if (!isObject(data)) {
    throw new LiteLLMResponseShapeError('$', describe(data));
  }

  if (data.model !== undefined && typeof data.model !== 'string') {
    throw new LiteLLMResponseShapeError('$.model', describe(data.model));
  }

  if (!Array.isArray(data.choices) || data.choices.length === 0) {
    throw new LiteLLMResponseShapeError('$.choices', describe(data.choices));
  }

  for (let i = 0; i < data.choices.length; i += 1) {
    const choice = data.choices[i];
    const path = `$.choices[${i}]`;
    if (!isObject(choice)) {
      throw new LiteLLMResponseShapeError(path, describe(choice));
    }
    if (choice.finish_reason !== undefined && typeof choice.finish_reason !== 'string') {
      throw new LiteLLMResponseShapeError(`${path}.finish_reason`, describe(choice.finish_reason));
    }
    if (choice.index !== undefined && typeof choice.index !== 'number') {
      throw new LiteLLMResponseShapeError(`${path}.index`, describe(choice.index));
    }
    const message = choice.message;
    if (!isObject(message)) {
      throw new LiteLLMResponseShapeError(`${path}.message`, describe(message));
    }
    if (message.role !== undefined && typeof message.role !== 'string') {
      throw new LiteLLMResponseShapeError(`${path}.message.role`, describe(message.role));
    }
    if (message.content !== undefined && typeof message.content !== 'string') {
      throw new LiteLLMResponseShapeError(`${path}.message.content`, describe(message.content));
    }
    if (
      message.reasoning_content !== undefined &&
      typeof message.reasoning_content !== 'string'
    ) {
      throw new LiteLLMResponseShapeError(
        `${path}.message.reasoning_content`,
        describe(message.reasoning_content)
      );
    }
  }

  if (data.usage !== undefined) {
    const usage = data.usage;
    if (!isObject(usage)) {
      throw new LiteLLMResponseShapeError('$.usage', describe(usage));
    }
    for (const key of ['prompt_tokens', 'completion_tokens', 'total_tokens'] as const) {
      if (typeof usage[key] !== 'number') {
        throw new LiteLLMResponseShapeError(`$.usage.${key}`, describe(usage[key]));
      }
    }
  }
}
