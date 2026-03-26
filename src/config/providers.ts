/**
 * Supported LLM Providers Configuration
 */

export interface ProviderConfig {
  id: string;
  name: string;
  models: string[];
  apiKeyUrl: string;
  defaultModel: string;
}

export const SUPPORTED_PROVIDERS: ProviderConfig[] = [
  {
    id: "deepseek",
    name: "DeepSeek",
    models: ["deepseek-reasoner", "deepseek-chat"],
    apiKeyUrl: "https://platform.deepseek.com/api_keys",
    defaultModel: "deepseek-reasoner",
  },
  {
    id: "openai",
    name: "OpenAI",
    models: ["gpt-4", "gpt-4-turbo", "gpt-3.5-turbo"],
    apiKeyUrl: "https://platform.openai.com/api-keys",
    defaultModel: "gpt-4",
  },
  {
    id: "anthropic",
    name: "Anthropic",
    models: ["claude-3-opus", "claude-3-sonnet", "claude-3-haiku"],
    apiKeyUrl: "https://console.anthropic.com/settings/keys",
    defaultModel: "claude-3-sonnet",
  },
];

export function getProviderConfig(providerId: string): ProviderConfig | undefined {
  return SUPPORTED_PROVIDERS.find((p) => p.id === providerId);
}

export function getAllProviders(): ProviderConfig[] {
  return SUPPORTED_PROVIDERS;
}
