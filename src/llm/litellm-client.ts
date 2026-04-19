/**
 * LiteLLM Client
 *
 * 使用 LiteLLM 库进行 LLM 调用，支持多模型提供商。
 * LiteLLM 提供统一的接口来调用 OpenAI、DeepSeek、Anthropic 等模型。
 */

import { createChildLogger } from '../utils/logger.js';
import type { LLMConfig, LLMInstance } from './factory.js';
import { extractJsonObject } from '../utils/json-response.js';
import {
  getSharedLLMRequestGuard,
  LLMRateLimitError,
  LLMRequestGuard,
  type LLMRequestGuardTicket,
} from './request-guard.js';

const logger = createChildLogger('litellm-client');

// LiteLLM response types
interface LiteLLMResponse {
  choices: Array<{
    message: {
      content: string;
      role: string;
      reasoning_content?: string;
    };
    finish_reason: string;
    index: number;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model: string;
}

interface LiteLLMError {
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

interface CompletionExtractionDiagnostics {
  responseModel: string | null;
  finishReason: string | null;
  hasContent: boolean;
  hasReasoningContent: boolean;
  reasoningHasJson: boolean;
  reasoningExcerpt: string | null;
  totalTokens: number | null;
}

interface CompletionExtractionResult {
  content: string;
  source: 'content' | 'reasoning_json' | null;
  diagnostics: CompletionExtractionDiagnostics;
}

/**
 * LiteLLM Client
 *
 * Responsibilities:
 * 1. Make HTTP requests to LLM APIs using LiteLLM format
 * 2. Handle different providers (OpenAI, DeepSeek, Anthropic, etc.)
 * 3. Manage retries and error handling
 * 4. Track token usage
 */
export class LiteLLMClient implements LLMInstance {
  provider: string;
  modelName: string;
  apiKey: string;
  maxTokens: number;
  baseURL: string;
  requestGuard: LLMRequestGuard;

  private totalPromptTokens = 0;
  private totalCompletionTokens = 0;

  constructor(config: LLMConfig) {
    this.provider = config.provider;
    this.modelName = config.modelName;
    this.apiKey = config.apiKey;
    this.maxTokens = config.maxTokens || 4000;
    this.baseURL = this.getBaseURL();
    this.requestGuard = config.requestGuard ||
      (config.safety ? new LLMRequestGuard(config.safety) : getSharedLLMRequestGuard());
  }

  /**
   * Get base URL for the provider
   */
  private getBaseURL(): string {
    const urls: Record<string, string> = {
      openai: 'https://api.openai.com/v1',
      deepseek: 'https://api.deepseek.com/v1',
      anthropic: 'https://api.anthropic.com/v1',
      azure: process.env.AZURE_OPENAI_ENDPOINT || '',
    };

    // Allow override via environment
    return (
      process.env.ORNN_LLM_BASE_URL ||
      urls[this.provider] ||
      'https://api.openai.com/v1'
    );
  }

  /**
   * Complete a prompt
   */
  async complete(prompt: string): Promise<string> {
    return this.completion({ prompt });
  }

  /**
   * Complete with full options
   */
  async completion(options: LiteLLMCompletionOptions): Promise<string> {
    const {
      prompt,
      systemPrompt,
      temperature = 0.7,
      maxTokens = this.maxTokens,
      timeout = 60000,
      responseFormat = 'text',
    } = options;

    // Build messages
    const messages: Array<{ role: string; content: string }> = [];

    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }

    messages.push({ role: 'user', content: prompt });

    // Build request body
    const body: Record<string, unknown> = {
      model: this.normalizeModelName(this.modelName),
      messages,
      temperature,
      max_tokens: maxTokens,
    };

    if (responseFormat === 'json_object' && this.supportsJsonResponseFormat()) {
      body.response_format = { type: 'json_object' };
    }

    logger.debug(`Calling ${this.provider} API with model ${this.modelName}`);

    try {
      const maxAttempts = this.getStructuredResponseAttempts(responseFormat);
      let lastDiagnostics: CompletionExtractionDiagnostics | null = null;
      let attemptMaxTokens = maxTokens;

      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        const response = await this.makeRequest({
          ...body,
          max_tokens: attemptMaxTokens,
        }, timeout);
        const extracted = this.extractContent(response, responseFormat);
        lastDiagnostics = extracted.diagnostics;
        const structuredJson =
          responseFormat === 'json_object' && extracted.source === 'content'
            ? extractJsonObject(extracted.content)
            : null;
        const shouldRetryTruncatedStructuredContent =
          responseFormat === 'json_object' &&
          extracted.source === 'content' &&
          !structuredJson &&
          extracted.diagnostics.finishReason === 'length';

        if (structuredJson) {
          return structuredJson;
        }

        if (extracted.content && !shouldRetryTruncatedStructuredContent) {
          if (extracted.source === 'reasoning_json') {
            logger.warn('Recovered structured response from reasoning_content after empty content', {
              provider: this.provider,
              modelName: this.modelName,
              attempt,
              finishReason: extracted.diagnostics.finishReason,
              responseModel: extracted.diagnostics.responseModel,
            });
          }
          return extracted.content;
        }

        if (attempt < maxAttempts) {
          const nextMaxTokens = this.getNextStructuredResponseMaxTokens(
            attemptMaxTokens,
            responseFormat,
            extracted.diagnostics,
            shouldRetryTruncatedStructuredContent,
          );
          logger.warn('Structured response returned no usable content, retrying', {
            provider: this.provider,
            modelName: this.modelName,
            attempt,
            maxAttempts,
            finishReason: extracted.diagnostics.finishReason,
            hasReasoningContent: extracted.diagnostics.hasReasoningContent,
            reasoningHasJson: extracted.diagnostics.reasoningHasJson,
            responseModel: extracted.diagnostics.responseModel,
            totalTokens: extracted.diagnostics.totalTokens,
            requestMaxTokens: attemptMaxTokens,
            retryMaxTokens: nextMaxTokens,
          });
          attemptMaxTokens = nextMaxTokens;
        }
      }

      throw new Error(this.buildEmptyResponseErrorMessage(responseFormat, maxAttempts, lastDiagnostics));
    } catch (error) {
      logger.error('LiteLLM API call failed:', error);
      throw error;
    }
  }

  async probeConnectivity(): Promise<{
    hasContent: boolean;
    hasReasoningContent: boolean;
    finishReason: string;
  }> {
    if (this.provider === 'deepseek') {
      const response = await fetch(`${this.baseURL}/models`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });
      if (!response.ok) {
        throw new Error(`LLM API error: ${response.statusText}`);
      }
      await response.json();
      return {
        hasContent: true,
        hasReasoningContent: false,
        finishReason: 'model-list',
      };
    }

    const raw = await this.makeRequest({
      model: this.normalizeModelName(this.modelName),
      messages: [{ role: 'user', content: 'ping' }],
      temperature: 0,
      max_tokens: 8,
    }, 10000);
    if (!raw.choices || raw.choices.length === 0) {
      throw new Error('No choices in LLM response');
    }
    const message = raw.choices[0].message;
    return {
      hasContent: Boolean(message.content),
      hasReasoningContent: Boolean(message.reasoning_content),
      finishReason: raw.choices[0].finish_reason,
    };
  }

  /**
   * Make HTTP request to LLM API
   */
  private async makeRequest(
    body: unknown,
    timeout: number
  ): Promise<LiteLLMResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    const estimatedTokens = this.estimateRequestTokens(body);
    let ticket: LLMRequestGuardTicket | null = null;

    try {
      ticket = this.requestGuard.acquire({
        provider: this.provider,
        modelName: this.modelName,
        estimatedTokens,
      });
    } catch (error) {
      if (error instanceof LLMRateLimitError) {
        logger.warn('LLM safety limit blocked request before provider call', {
          provider: this.provider,
          modelName: this.modelName,
          reason: error.reason,
          ...error.details,
        });
      }
      clearTimeout(timeoutId);
      throw error;
    }

    try {
      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
          // Anthropic requires special header
          ...(this.provider === 'anthropic' && {
            'anthropic-version': '2023-06-01',
          }),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = (await response.json()) as LiteLLMError;
        throw new Error(
          `LLM API error: ${errorData.error?.message || response.statusText}`
        );
      }

      const data = (await response.json()) as LiteLLMResponse;

      // Track token usage
      if (data.usage) {
        this.totalPromptTokens += data.usage.prompt_tokens;
        this.totalCompletionTokens += data.usage.completion_tokens;
        logger.debug(
          `Token usage - Prompt: ${data.usage.prompt_tokens}, Completion: ${data.usage.completion_tokens}`
        );
      }

      this.requestGuard.succeed(ticket, data.usage?.total_tokens ?? null);
      return data;
    } catch (error) {
      clearTimeout(timeoutId);
      if (ticket) {
        this.requestGuard.fail(ticket);
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`LLM request timed out after ${timeout}ms`);
      }

      throw error;
    }
  }

  private estimateRequestTokens(body: unknown): number {
    if (!body || typeof body !== 'object') {
      return this.maxTokens;
    }

    const payload = body as Record<string, unknown>;
    const messages = Array.isArray(payload.messages) ? payload.messages : [];
    const promptChars = messages.reduce((sum, entry) => {
      if (!entry || typeof entry !== 'object') return sum;
      const content = (entry as Record<string, unknown>).content;
      return sum + (typeof content === 'string' ? content.length : 0);
    }, 0);
    const promptTokens = Math.ceil(promptChars / 4);
    const completionTokens = typeof payload.max_tokens === 'number' && Number.isFinite(payload.max_tokens)
      ? Math.max(1, Math.floor(payload.max_tokens))
      : this.maxTokens;

    return Math.max(1, promptTokens + completionTokens);
  }

  /**
   * Parse response and extract content
   */
  private extractContent(
    response: LiteLLMResponse,
    responseFormat: LiteLLMCompletionOptions['responseFormat'] = 'text'
  ): CompletionExtractionResult {
    if (!response.choices || response.choices.length === 0) {
      throw new Error('No choices in LLM response');
    }

    const choice = response.choices[0];
    const message = choice.message || { content: '', role: 'assistant' };
    const content = typeof message.content === 'string' ? message.content.trim() : '';
    const reasoningContent = typeof message.reasoning_content === 'string'
      ? message.reasoning_content.trim()
      : '';
    const reasoningJson = responseFormat === 'json_object' && reasoningContent
      ? extractJsonObject(reasoningContent)
      : null;

    const diagnostics: CompletionExtractionDiagnostics = {
      responseModel: response.model || null,
      finishReason: choice.finish_reason || null,
      hasContent: Boolean(content),
      hasReasoningContent: Boolean(reasoningContent),
      reasoningHasJson: Boolean(reasoningJson),
      reasoningExcerpt: reasoningContent ? this.truncateForDiagnostics(reasoningContent) : null,
      totalTokens: response.usage?.total_tokens ?? null,
    };

    if (content) {
      return {
        content,
        source: 'content',
        diagnostics,
      };
    }

    if (reasoningJson) {
      return {
        content: reasoningJson,
        source: 'reasoning_json',
        diagnostics,
      };
    }

    return {
      content: '',
      source: null,
      diagnostics,
    };
  }

  private truncateForDiagnostics(value: string, maxLength = 160): string {
    return value.length <= maxLength ? value : `${value.slice(0, maxLength)}...`;
  }

  private getStructuredResponseAttempts(
    responseFormat: LiteLLMCompletionOptions['responseFormat']
  ): number {
    if (responseFormat !== 'json_object') {
      return 1;
    }
    return this.provider === 'deepseek' ? 3 : 2;
  }

  private getNextStructuredResponseMaxTokens(
    currentMaxTokens: number,
    responseFormat: LiteLLMCompletionOptions['responseFormat'],
    diagnostics: CompletionExtractionDiagnostics,
    shouldRetryTruncatedStructuredContent: boolean,
  ): number {
    if (responseFormat !== 'json_object') {
      return currentMaxTokens;
    }

    if (!shouldRetryTruncatedStructuredContent && diagnostics.finishReason !== 'length') {
      return currentMaxTokens;
    }

    const current = Math.max(1, Math.floor(currentMaxTokens));
    const retryCap = this.provider === 'deepseek'
      ? Math.min(6400, Math.max(this.maxTokens, current) * 4)
      : Math.min(4096, Math.max(this.maxTokens, current) * 2);

    return Math.min(retryCap, current * 2);
  }

  private buildEmptyResponseErrorMessage(
    responseFormat: LiteLLMCompletionOptions['responseFormat'],
    attempts: number,
    diagnostics: CompletionExtractionDiagnostics | null,
  ): string {
    const parts = [
      'Empty content in LLM response',
      `provider=${this.provider}`,
      `model=${this.modelName}`,
      `response_format=${responseFormat || 'text'}`,
      `attempts=${attempts}`,
    ];

    if (diagnostics?.finishReason) {
      parts.push(`last_finish_reason=${diagnostics.finishReason}`);
    }
    if (diagnostics) {
      parts.push(`last_has_reasoning_content=${diagnostics.hasReasoningContent}`);
      parts.push(`last_reasoning_has_json=${diagnostics.reasoningHasJson}`);
      if (typeof diagnostics.totalTokens === 'number') {
        parts.push(`last_total_tokens=${diagnostics.totalTokens}`);
      }
      if (diagnostics.responseModel) {
        parts.push(`last_response_model=${diagnostics.responseModel}`);
      }
      if (diagnostics.reasoningExcerpt) {
        parts.push(`last_reasoning_excerpt=${JSON.stringify(diagnostics.reasoningExcerpt)}`);
      }
    }

    return parts.join(' | ');
  }

  private supportsJsonResponseFormat(): boolean {
    return this.provider === 'openai' || this.provider === 'azure' || this.provider === 'deepseek';
  }

  private normalizeModelName(modelName: string): string {
    if (this.provider === 'deepseek' && modelName.includes('/')) {
      const [, maybeModel] = modelName.split('/', 2);
      if (maybeModel) return maybeModel;
    }
    return modelName;
  }

  /**
   * Get total token usage
   */
  getTokenUsage(): {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  } {
    return {
      promptTokens: this.totalPromptTokens,
      completionTokens: this.totalCompletionTokens,
      totalTokens: this.totalPromptTokens + this.totalCompletionTokens,
    };
  }

  /**
   * Reset token usage counters
   */
  resetTokenUsage(): void {
    this.totalPromptTokens = 0;
    this.totalCompletionTokens = 0;
  }
}

/**
 * Create LiteLLM client from config
 */
export function createLiteLLMClient(config: LLMConfig): LiteLLMClient {
  return new LiteLLMClient(config);
}

/**
 * Create LiteLLM client from environment
 */
export function createLiteLLMClientFromEnv(): LiteLLMClient {
  const provider = process.env.ORNN_LLM_PROVIDER || 'deepseek';
  const modelName = process.env.ORNN_LLM_MODEL || 'deepseek-reasoner';
  const apiKey = process.env.ORNN_LLM_API_KEY || '';

  if (!apiKey) {
    throw new Error(
      'LLM API key not found. Please set ORNN_LLM_API_KEY environment variable.'
    );
  }

  return new LiteLLMClient({
    provider,
    modelName,
    apiKey,
    maxTokens: 4000,
  });
}
