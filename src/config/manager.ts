/**
 * Configuration Manager
 * Manages multi-provider configuration with append/override logic
 */

import { join } from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import { existsSync, mkdirSync } from "node:fs";
import { parse } from "smol-toml";
import { logger } from "../utils/logger.js";
import { createLiteLLMClient } from "../llm/litellm-client.js";

export interface ProviderConfig {
  provider: string;
  modelName: string;
  apiKeyEnvVar: string;
}

export interface OrnnConfig {
  ornn?: {
    version?: string;
    log_level?: string;
    project_path?: string;
  };
  llm?: {
    default_provider?: string;
  };
  providers?: Record<string, ProviderConfig>;
  tracking?: {
    auto_optimize?: boolean;
    user_confirm?: boolean;
    runtime_sync?: boolean;
  };
}

const DEFAULT_LOG_LEVEL = "info";

/**
 * Read existing config file
 */
export async function readConfig(projectPath: string): Promise<OrnnConfig | null> {
  const configPath = join(projectPath, ".ornn", "config", "settings.toml");
  
  if (!existsSync(configPath)) {
    return null;
  }

  try {
    const content = await readFile(configPath, "utf-8");
    return parse(content) as OrnnConfig;
  } catch (error) {
    logger.warn("Failed to read existing config:", error);
    return null;
  }
}

/**
 * Generate config.toml content with multi-provider support
 */
export function generateConfigContent(
  projectPath: string,
  providers: ProviderConfig[],
  defaultProvider?: string,
  logLevel: string = DEFAULT_LOG_LEVEL,
  tracking: { autoOptimize?: boolean; userConfirm?: boolean; runtimeSync?: boolean } = {}
): string {
  let config = `[ornn]
version = "0.1.9"
log_level = "${logLevel}"
project_path = "${projectPath}"
`;

  if (providers.length > 0) {
    const defaultProv = defaultProvider || providers[0].provider;
    config += `
[llm]
default_provider = "${defaultProv}"
`;

    // Add each provider configuration
    for (const provider of providers) {
      config += `
[providers.${provider.provider}]
provider = "${provider.provider}"
model_name = "${provider.modelName}"
api_key_env_var = "${provider.apiKeyEnvVar}"
`;
    }
  }

  config += `
[tracking]
auto_optimize = ${tracking.autoOptimize ?? true}
user_confirm = ${tracking.userConfirm ?? false}
runtime_sync = ${tracking.runtimeSync ?? true}
`;

  return config.trim();
}

/**
 * Write config file with multi-provider support
 */
export async function writeConfig(
  projectPath: string,
  newProvider: ProviderConfig,
  setAsDefault: boolean = false
): Promise<void> {
  const configDir = join(projectPath, ".ornn", "config");
  const configPath = join(configDir, "settings.toml");

  // Read existing config
  const existingConfig = await readConfig(projectPath);
  
  // Merge providers
  const existingProviders = existingConfig?.providers || {};
  
  // Add or update the new provider
  existingProviders[newProvider.provider] = newProvider;
  
  // Convert to array for generation
  const providersArray = Object.values(existingProviders);
  
  // Determine default provider
  const defaultProvider = setAsDefault 
    ? newProvider.provider 
    : (existingConfig?.llm?.default_provider || newProvider.provider);

  // Generate and write config
  const content = generateConfigContent(
    projectPath,
    providersArray,
    defaultProvider,
    existingConfig?.ornn?.log_level || DEFAULT_LOG_LEVEL,
    {
      autoOptimize: existingConfig?.tracking?.auto_optimize ?? true,
      userConfirm: existingConfig?.tracking?.user_confirm ?? false,
      runtimeSync: existingConfig?.tracking?.runtime_sync ?? true,
    }
  );

  await writeFile(configPath, content);
}

/**
 * Generate .env.local content for API keys
 * Appends new provider API key to existing file
 */
export async function generateEnvContent(
  projectPath: string,
  provider: string,
  apiKey: string
): Promise<string> {
  const envPath = join(projectPath, ".env.local");
  
  let existingContent = "";
  try {
    if (existsSync(envPath)) {
      existingContent = await readFile(envPath, "utf-8");
    }
  } catch {
    // File doesn't exist or can't be read
  }

  const envVarName = getProviderEnvVarName(provider);
  
  // Check if this provider already exists in the file
  const providerRegex = new RegExp(`^${envVarName}=.*$`, "m");
  const newLine = `${envVarName}=${apiKey}`;
  
  let newContent: string;
  if (providerRegex.test(existingContent)) {
    // Update existing line
    newContent = existingContent.replace(providerRegex, newLine);
  } else {
    // Append new line
    const header = existingContent.includes("# Ornn Skills Environment Configuration")
      ? ""
      : `# Ornn Skills Environment Configuration\n# Generated on ${new Date().toISOString()}\n\n# LLM Provider API Keys\n`;
    
    newContent = existingContent + (existingContent.endsWith("\n") || existingContent === "" ? "" : "\n") + 
      (header ? header : "") + 
      `${newLine}\n`;
  }

  return newContent;
}

/**
 * Write or append API key to .env.local
 */
export async function writeEnvFile(
  projectPath: string,
  provider: string,
  apiKey: string
): Promise<void> {
  const envPath = join(projectPath, ".env.local");
  const content = await generateEnvContent(projectPath, provider, apiKey);
  await writeFile(envPath, content);
}

/**
 * Get environment variable name for a provider
 */
export function getProviderEnvVarName(provider: string): string {
  const providerUpper = provider.toUpperCase().replace(/[^A-Z0-9]/g, "_");
  return `ORNN_${providerUpper}_API_KEY`;
}

/**
 * List all configured providers
 */
export async function listConfiguredProviders(projectPath: string): Promise<ProviderConfig[]> {
  const config = await readConfig(projectPath);
  if (!config?.providers) {
    return [];
  }
  // Map snake_case TOML fields to camelCase TypeScript properties
  return Object.values(config.providers).map((provider: unknown) => {
    const p = provider as Record<string, string>;
    return {
      provider: p.provider,
      modelName: p.model_name || p.modelName,
      apiKeyEnvVar: p.api_key_env_var || p.apiKeyEnvVar,
    };
  });
}

/**
 * Get default provider
 */
export async function getDefaultProvider(projectPath: string): Promise<string | null> {
  const config = await readConfig(projectPath);
  return config?.llm?.default_provider || null;
}

/**
 * Set default provider
 */
export async function setDefaultProvider(
  projectPath: string,
  providerId: string
): Promise<boolean> {
  const config = await readConfig(projectPath);
  if (!config) {
    return false;
  }

  // Check if provider exists
  if (!config.providers?.[providerId]) {
    const availableProviders = Object.keys(config.providers || {});
    logger.error(
      `Provider "${providerId}" not found in configuration. ` +
      (availableProviders.length > 0
        ? `Available providers: ${availableProviders.join(', ')}.`
        : 'No providers configured yet.')
    );
    logger.info(`To configure providers, run: ornn config`);
    return false;
  }

  // Update config
  const providersArray = Object.values(config.providers);
  const content = generateConfigContent(
    projectPath,
    providersArray,
    providerId,
    config.ornn?.log_level || DEFAULT_LOG_LEVEL,
    {
      autoOptimize: config.tracking?.auto_optimize ?? true,
      userConfirm: config.tracking?.user_confirm ?? false,
      runtimeSync: config.tracking?.runtime_sync ?? true,
    }
  );

  const configPath = join(projectPath, ".ornn", "config", "settings.toml");
  await writeFile(configPath, content);
  
  return true;
}

export interface DashboardProviderConfig {
  provider: string;
  modelName: string;
  apiKeyEnvVar: string;
  apiKey?: string;
  hasApiKey?: boolean;
}

export interface DashboardConfig {
  autoOptimize: boolean;
  userConfirm: boolean;
  runtimeSync: boolean;
  defaultProvider: string;
  logLevel: string;
  providers: DashboardProviderConfig[];
}

export interface ProviderConnectivityResult {
  provider: string;
  modelName: string;
  ok: boolean;
  message: string;
  durationMs: number;
}

export async function readDashboardConfig(projectPath: string): Promise<DashboardConfig> {
  const config = await readConfig(projectPath);
  const providers = await listConfiguredProviders(projectPath);
  const envVars = await readProjectEnv(projectPath);
  return {
    autoOptimize: config?.tracking?.auto_optimize ?? true,
    userConfirm: config?.tracking?.user_confirm ?? false,
    runtimeSync: config?.tracking?.runtime_sync ?? true,
    defaultProvider: config?.llm?.default_provider ?? '',
    logLevel: config?.ornn?.log_level ?? DEFAULT_LOG_LEVEL,
    providers: providers.map((provider) => ({
      ...provider,
      hasApiKey: Boolean(envVars[provider.apiKeyEnvVar] || process.env[provider.apiKeyEnvVar]),
    })),
  };
}

async function writeProjectEnvVar(
  projectPath: string,
  envVarName: string,
  value: string
): Promise<void> {
  const envPath = join(projectPath, ".env.local");
  const existingContent = existsSync(envPath) ? await readFile(envPath, "utf-8") : "";
  const providerRegex = new RegExp(`^${envVarName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}=.*$`, "m");
  const newLine = `${envVarName}=${value}`;
  let nextContent = existingContent;

  if (providerRegex.test(existingContent)) {
    nextContent = existingContent.replace(providerRegex, newLine);
  } else {
    nextContent =
      existingContent +
      (existingContent && !existingContent.endsWith("\n") ? "\n" : "") +
      `${newLine}\n`;
  }

  await writeFile(envPath, nextContent, "utf-8");
}

export async function writeDashboardConfig(
  projectPath: string,
  payload: DashboardConfig
): Promise<void> {
  const configDir = join(projectPath, ".ornn", "config");
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }
  const existing = await readConfig(projectPath);
  const existingDefaultProvider = existing?.llm?.default_provider || "";
  const providers = payload.providers.map((p) => ({
    provider: p.provider,
    modelName: p.modelName,
    apiKeyEnvVar: p.apiKeyEnvVar,
  }));
  const defaultProvider =
    providers.find((p) => p.provider === payload.defaultProvider)?.provider ||
    providers.find((p) => p.provider === existingDefaultProvider)?.provider ||
    providers[0]?.provider ||
    existingDefaultProvider;

  const content = generateConfigContent(
    projectPath,
    providers,
    defaultProvider,
    payload.logLevel || existing?.ornn?.log_level || DEFAULT_LOG_LEVEL,
    {
      autoOptimize: payload.autoOptimize,
      userConfirm: payload.userConfirm,
      runtimeSync: payload.runtimeSync,
    }
  );
  await writeFile(join(configDir, "settings.toml"), content, "utf-8");

  for (const provider of payload.providers) {
    if (provider.apiKey && provider.apiKey.trim()) {
      await writeProjectEnvVar(projectPath, provider.apiKeyEnvVar, provider.apiKey.trim());
    }
  }
}

function parseEnvFile(content: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, "");
    if (key) env[key] = val;
  }
  return env;
}

async function readProjectEnv(projectPath: string): Promise<Record<string, string>> {
  const envPath = join(projectPath, ".env.local");
  if (!existsSync(envPath)) return {};
  try {
    const content = await readFile(envPath, "utf-8");
    return parseEnvFile(content);
  } catch {
    return {};
  }
}

export async function checkProvidersConnectivity(
  projectPath: string,
  providersInput?: DashboardProviderConfig[]
): Promise<ProviderConnectivityResult[]> {
  const envVars = await readProjectEnv(projectPath);
  const providers = providersInput && providersInput.length > 0
    ? providersInput
    : (await readDashboardConfig(projectPath)).providers;

  const results: ProviderConnectivityResult[] = [];
  for (const providerConfig of providers) {
    const start = Date.now();
    const apiKey =
      providerConfig.apiKey?.trim() ||
      envVars[providerConfig.apiKeyEnvVar] ||
      process.env[providerConfig.apiKeyEnvVar] ||
      "";
    if (!apiKey) {
      results.push({
        provider: providerConfig.provider,
        modelName: providerConfig.modelName,
        ok: false,
        message: `Missing API key env var: ${providerConfig.apiKeyEnvVar}`,
        durationMs: Date.now() - start,
      });
      continue;
    }

    try {
      const client = createLiteLLMClient({
        provider: providerConfig.provider,
        modelName: providerConfig.modelName,
        apiKey,
        maxTokens: 8,
      });
      await client.completion({
        prompt: "ping",
        maxTokens: 8,
        temperature: 0,
        timeout: 10000,
      });
      results.push({
        provider: providerConfig.provider,
        modelName: providerConfig.modelName,
        ok: true,
        message: "OK",
        durationMs: Date.now() - start,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({
        provider: providerConfig.provider,
        modelName: providerConfig.modelName,
        ok: false,
        message,
        durationMs: Date.now() - start,
      });
    }
  }

  return results;
}
