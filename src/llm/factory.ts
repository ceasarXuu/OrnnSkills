/**
 * LLM Factory for creating LLM instances
 * Using LiteLLM client for unified API access
 */

import { LiteLLMClient, createLiteLLMClient } from './litellm-client.js';

export interface LLMConfig {
  provider: string;
  modelName: string;
  apiKey: string;
  maxTokens?: number;
}

export interface LLMInstance {
  provider: string;
  modelName: string;
  apiKey: string;
  maxTokens: number;
  complete(prompt: string): Promise<string>;
}

const DEFAULT_MAX_TOKENS = 4000;
const EXECUTOR_MAX_TOKENS = 2000;

/**
 * Create LLM instance using LiteLLM client
 */
export function createLLM(config: LLMConfig): LiteLLMClient {
  return createLiteLLMClient(config);
}

/**
 * Predefined configurations (without apiKey, to be filled at runtime)
 */
export const ANALYZER_CONFIG: Omit<LLMConfig, 'apiKey'> = {
  provider: "deepseek",
  modelName: "deepseek-reasoner",
  maxTokens: DEFAULT_MAX_TOKENS,
};

export const EXECUTOR_CONFIG: Omit<LLMConfig, 'apiKey'> = {
  provider: "deepseek",
  modelName: "deepseek-chat",
  maxTokens: EXECUTOR_MAX_TOKENS,
};

/**
 * Load LLM config from environment or config file
 */
export function loadLLMConfigFromEnv(): LLMConfig {
  const provider = process.env.ORNN_LLM_PROVIDER || "deepseek";
  const modelName = process.env.ORNN_LLM_MODEL || "deepseek-reasoner";
  const apiKey = process.env.ORNN_LLM_API_KEY || "";

  if (!apiKey) {
    throw new Error(
      "LLM API key not found. Please set ORNN_LLM_API_KEY environment variable or run 'ornn init'"
    );
  }

  return {
    provider,
    modelName,
    apiKey,
    maxTokens: DEFAULT_MAX_TOKENS,
  };
}
