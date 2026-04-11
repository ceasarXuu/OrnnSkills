/**
 * LiteLLM Client
 *
 * 使用 LiteLLM 库进行 LLM 调用，支持多模型提供商。
 * LiteLLM 提供统一的接口来调用 OpenAI、DeepSeek、Anthropic 等模型。
 */

import { createChildLogger } from '../utils/logger.js';
import type { LLMConfig, LLMInstance } from './factory.js';

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

  private totalPromptTokens = 0;
  private totalCompletionTokens = 0;

  constructor(config: LLMConfig) {
    this.provider = config.provider;
    this.modelName = config.modelName;
    this.apiKey = config.apiKey;
    this.maxTokens = config.maxTokens || 4000;
    this.baseURL = this.getBaseURL();
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
      const response = await this.makeRequest(body, timeout);
      const content = this.extractContent(response);
      if (content) {
        return content;
      }

      if (responseFormat === 'json_object' && this.provider === 'deepseek') {
        logger.warn('DeepSeek returned empty content in json_object mode, retrying once', {
          provider: this.provider,
          modelName: this.modelName,
        });
        const retryResponse = await this.makeRequest(body, timeout);
        const retryContent = this.extractContent(retryResponse);
        if (retryContent) {
          return retryContent;
        }
      }

      throw new Error('Empty content in LLM response');
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

      return data;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`LLM request timed out after ${timeout}ms`);
      }

      throw error;
    }
  }

  /**
   * Parse response and extract content
   */
  private extractContent(response: LiteLLMResponse): string {
    if (!response.choices || response.choices.length === 0) {
      throw new Error('No choices in LLM response');
    }

    const content = response.choices[0].message.content;
    return content || '';
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
