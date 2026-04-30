/**
 * Supported LLM Providers Configuration
 * 
 * LiteLLM supports 100+ providers. This file defines the most commonly used ones.
 * For a complete list, see: https://docs.litellm.ai/docs/providers
 */

export interface ProviderConfig {
  id: string;
  name: string;
  models: string[];
  apiKeyUrl: string;
  defaultModel: string;
  apiKeyFormat?: string;
  apiKeyEnvVar?: string;
}

// Popular providers supported by LiteLLM
export const SUPPORTED_PROVIDERS: ProviderConfig[] = [
  // DeepSeek
  {
    id: "deepseek",
    name: "DeepSeek",
    models: ["deepseek-reasoner", "deepseek-chat", "deepseek-coder"],
    apiKeyUrl: "https://platform.deepseek.com/api_keys",
    defaultModel: "deepseek-reasoner",
    apiKeyFormat: "32+ characters",
    apiKeyEnvVar: "DEEPSEEK_API_KEY",
  },
  // OpenAI
  {
    id: "openai",
    name: "OpenAI",
    models: ["gpt-4o", "gpt-4-turbo", "gpt-4", "gpt-3.5-turbo", "o1-preview", "o1-mini"],
    apiKeyUrl: "https://platform.openai.com/api-keys",
    defaultModel: "gpt-4o",
    apiKeyFormat: "sk-...",
    apiKeyEnvVar: "OPENAI_API_KEY",
  },
  // Anthropic
  {
    id: "anthropic",
    name: "Anthropic",
    models: ["claude-3-opus", "claude-3-sonnet", "claude-3-haiku", "claude-3-5-sonnet"],
    apiKeyUrl: "https://console.anthropic.com/settings/keys",
    defaultModel: "claude-3-sonnet",
    apiKeyFormat: "sk-ant-...",
    apiKeyEnvVar: "ANTHROPIC_API_KEY",
  },
  // Azure OpenAI
  {
    id: "azure",
    name: "Azure OpenAI",
    models: ["gpt-4", "gpt-4-turbo", "gpt-35-turbo"],
    apiKeyUrl: "https://portal.azure.com/#view/Microsoft_Azure_ProjectOxford/CognitiveServicesHub/~/OpenAI",
    defaultModel: "gpt-4",
    apiKeyFormat: "32-character hex",
    apiKeyEnvVar: "AZURE_OPENAI_API_KEY",
  },
  // Google Gemini
  {
    id: "gemini",
    name: "Google Gemini",
    models: ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-1.0-pro"],
    apiKeyUrl: "https://aistudio.google.com/app/apikey",
    defaultModel: "gemini-1.5-pro",
    apiKeyFormat: "AIza...",
    apiKeyEnvVar: "GOOGLE_API_KEY",
  },
  // Alibaba Cloud (Tongyi Qianwen)
  {
    id: "alibaba",
    name: "Alibaba Cloud (Qwen)",
    models: ["qwen-max", "qwen-plus", "qwen-turbo", "qwen-coder-plus"],
    apiKeyUrl: "https://dashscope.console.aliyun.com/apiKey",
    defaultModel: "qwen-max",
    apiKeyFormat: "sk-...",
    apiKeyEnvVar: "DASHSCOPE_API_KEY",
  },
  // Cohere
  {
    id: "cohere",
    name: "Cohere",
    models: ["command-r-plus", "command-r", "command", "command-light"],
    apiKeyUrl: "https://dashboard.cohere.com/api-keys",
    defaultModel: "command-r",
    apiKeyFormat: "...",
    apiKeyEnvVar: "COHERE_API_KEY",
  },
  // Mistral AI
  {
    id: "mistral",
    name: "Mistral AI",
    models: ["mistral-large", "mistral-medium", "mistral-small", "codestral"],
    apiKeyUrl: "https://console.mistral.ai/api-keys/",
    defaultModel: "mistral-medium",
    apiKeyFormat: "...",
    apiKeyEnvVar: "MISTRAL_API_KEY",
  },
  // Groq
  {
    id: "groq",
    name: "Groq",
    models: ["llama3-70b", "llama3-8b", "mixtral-8x7b", "gemma-7b"],
    apiKeyUrl: "https://console.groq.com/keys",
    defaultModel: "llama3-70b",
    apiKeyFormat: "gsk_...",
    apiKeyEnvVar: "GROQ_API_KEY",
  },
  // Together AI
  {
    id: "together_ai",
    name: "Together AI",
    models: ["meta-llama/Llama-3-70b", "mistralai/Mixtral-8x22B", "Qwen/Qwen2-72B"],
    apiKeyUrl: "https://api.together.xyz/settings/api-keys",
    defaultModel: "meta-llama/Llama-3-70b",
    apiKeyFormat: "...",
    apiKeyEnvVar: "TOGETHERAI_API_KEY",
  },
  // AI21
  {
    id: "ai21",
    name: "AI21 Labs",
    models: ["jamba-1.5-large", "jamba-1.5-mini", "j2-ultra", "j2-mid"],
    apiKeyUrl: "https://studio.ai21.com/account/api-key",
    defaultModel: "jamba-1.5-large",
    apiKeyFormat: "...",
    apiKeyEnvVar: "AI21_API_KEY",
  },
  // Fireworks AI
  {
    id: "fireworks_ai",
    name: "Fireworks AI",
    models: ["accounts/fireworks/models/llama-v3p1-70b-instruct", "accounts/fireworks/models/mixtral-8x22b-instruct"],
    apiKeyUrl: "https://fireworks.ai/account/api-keys",
    defaultModel: "accounts/fireworks/models/llama-v3p1-70b-instruct",
    apiKeyFormat: "...",
    apiKeyEnvVar: "FIREWORKS_API_KEY",
  },
  // Perplexity
  {
    id: "perplexity",
    name: "Perplexity",
    models: ["sonar", "sonar-pro", "sonar-reasoning", "llama-3.1-sonar-large"],
    apiKeyUrl: "https://www.perplexity.ai/settings/api",
    defaultModel: "sonar",
    apiKeyFormat: "pplx-...",
    apiKeyEnvVar: "PERPLEXITYAI_API_KEY",
  },
  // OpenRouter
  {
    id: "openrouter",
    name: "OpenRouter",
    models: ["meta-llama/llama-3.1-70b", "anthropic/claude-3.5-sonnet", "openai/gpt-4o"],
    apiKeyUrl: "https://openrouter.ai/keys",
    defaultModel: "meta-llama/llama-3.1-70b",
    apiKeyFormat: "sk-or-...",
    apiKeyEnvVar: "OPENROUTER_API_KEY",
  },
  // Replicate
  {
    id: "replicate",
    name: "Replicate",
    models: ["meta/meta-llama-3-70b", "mistralai/mixtral-8x7b-instruct"],
    apiKeyUrl: "https://replicate.com/account/api-tokens",
    defaultModel: "meta/meta-llama-3-70b",
    apiKeyFormat: "r8_...",
    apiKeyEnvVar: "REPLICATE_API_KEY",
  },
  // Vertex AI (Google Cloud)
  {
    id: "vertex_ai",
    name: "Vertex AI (Google Cloud)",
    models: ["gemini-1.5-pro", "gemini-1.5-flash", "claude-3-sonnet@20240229"],
    apiKeyUrl: "https://console.cloud.google.com/vertex-ai",
    defaultModel: "gemini-1.5-pro",
    apiKeyFormat: "Service Account JSON",
    apiKeyEnvVar: "GOOGLE_APPLICATION_CREDENTIALS",
  },
  // AWS Bedrock
  {
    id: "bedrock",
    name: "AWS Bedrock",
    models: ["anthropic.claude-3-sonnet", "amazon.titan-text", "meta.llama3-70b"],
    apiKeyUrl: "https://aws.amazon.com/bedrock/",
    defaultModel: "anthropic.claude-3-sonnet",
    apiKeyFormat: "AWS Credentials",
    apiKeyEnvVar: "AWS_ACCESS_KEY_ID",
  },
];

export function getProviderConfig(providerId: string): ProviderConfig | undefined {
  return SUPPORTED_PROVIDERS.find((p) => p.id === providerId);
}

export function getAllProviders(): ProviderConfig[] {
  return SUPPORTED_PROVIDERS;
}

/**
 * Get provider by model name
 * Useful when user provides a model in provider/model format
 */
export function getProviderByModel(modelName: string): ProviderConfig | undefined {
  // Handle provider/model format
  if (modelName.includes('/')) {
    const providerId = modelName.split('/')[0];
    return getProviderConfig(providerId);
  }
  
  // Search through all providers for matching model
  return SUPPORTED_PROVIDERS.find((p) => 
    p.models.some((m) => m.toLowerCase() === modelName.toLowerCase())
  );
}

/**
 * Check if a provider is supported
 */
export function isProviderSupported(providerId: string): boolean {
  return SUPPORTED_PROVIDERS.some((p) => p.id === providerId);
}

/**
 * Get API key environment variable name for a provider
 */
export function getProviderApiKeyEnvVar(providerId: string): string {
  const config = getProviderConfig(providerId);
  return config?.apiKeyEnvVar || `${providerId.toUpperCase()}_API_KEY`;
}
