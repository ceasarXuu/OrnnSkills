/**
 * LiteLLM client — Shared types
 *
 * Extracted from litellm-client.ts to keep individual files under the
 * 500-line policy.
 */

export interface LiteLLMError {
  error: {
    message: string;
    type: string;
    code: string;
  };
}

export interface LiteLLMCompletionOptions {
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
  responseFormat?: 'text' | 'json_object';
}
