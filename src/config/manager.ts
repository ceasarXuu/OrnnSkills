/**
 * Configuration Manager
 * Manages multi-provider configuration with append/override logic
 */

import { join } from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { parse } from "smol-toml";
import { logger } from "../utils/logger.js";
import { createLiteLLMClient } from "../llm/litellm-client.js";
import { resolveLLMSafetyOptions, type LLMSafetyOptions } from "../llm/request-guard.js";

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
  llm_safety?: {
    enabled?: boolean;
    window_ms?: number;
    max_requests_per_window?: number;
    max_concurrent_requests?: number;
    max_estimated_tokens_per_window?: number;
  };
}

const DEFAULT_LOG_LEVEL = "info";
const GLOBAL_DASHBOARD_CONFIG_DIR = () => join(homedir(), ".ornn", "config");
const GLOBAL_DASHBOARD_CONFIG_PATH = () => join(GLOBAL_DASHBOARD_CONFIG_DIR(), "settings.toml");
const GLOBAL_DASHBOARD_ENV_PATH = () => join(GLOBAL_DASHBOARD_CONFIG_DIR(), ".env.local");
const PROJECT_DASHBOARD_CONFIG_PATH = (projectPath: string) => join(projectPath, ".ornn", "config", "settings.toml");
const PROJECT_DASHBOARD_ENV_PATH = (projectPath: string) => join(projectPath, ".env.local");

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
  tracking: { autoOptimize?: boolean; userConfirm?: boolean; runtimeSync?: boolean } = {},
  llmSafety?: Partial<LLMSafetyOptions>
): string {
  const normalizedSafety = resolveLLMSafetyOptions(llmSafety);
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

[llm_safety]
enabled = ${normalizedSafety.enabled}
window_ms = ${normalizedSafety.windowMs}
max_requests_per_window = ${normalizedSafety.maxRequestsPerWindow}
max_concurrent_requests = ${normalizedSafety.maxConcurrentRequests}
max_estimated_tokens_per_window = ${normalizedSafety.maxEstimatedTokensPerWindow}
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
    },
    {
      enabled: existingConfig?.llm_safety?.enabled,
      windowMs: existingConfig?.llm_safety?.window_ms,
      maxRequestsPerWindow: existingConfig?.llm_safety?.max_requests_per_window,
      maxConcurrentRequests: existingConfig?.llm_safety?.max_concurrent_requests,
      maxEstimatedTokensPerWindow: existingConfig?.llm_safety?.max_estimated_tokens_per_window,
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
    },
    {
      enabled: config.llm_safety?.enabled,
      windowMs: config.llm_safety?.window_ms,
      maxRequestsPerWindow: config.llm_safety?.max_requests_per_window,
      maxConcurrentRequests: config.llm_safety?.max_concurrent_requests,
      maxEstimatedTokensPerWindow: config.llm_safety?.max_estimated_tokens_per_window,
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
  llmSafety: LLMSafetyOptions;
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

async function readTomlConfigFile(configPath: string): Promise<OrnnConfig | null> {
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

function normalizeProvidersFromConfig(config: OrnnConfig | null): ProviderConfig[] {
  if (!config?.providers) {
    return [];
  }

  return Object.values(config.providers).map((provider: unknown) => {
    const p = provider as Record<string, string>;
    return {
      provider: p.provider,
      modelName: p.model_name || p.modelName,
      apiKeyEnvVar: p.api_key_env_var || p.apiKeyEnvVar,
    };
  });
}

async function readLegacyProjectDashboardConfig(projectPath: string): Promise<DashboardConfig | null> {
  const config = await readTomlConfigFile(PROJECT_DASHBOARD_CONFIG_PATH(projectPath));
  const providers = normalizeProvidersFromConfig(config);
  if (!config || providers.length === 0) {
    return null;
  }

  const envVars = await readEnvFile(PROJECT_DASHBOARD_ENV_PATH(projectPath));
  return {
    autoOptimize: config.tracking?.auto_optimize ?? true,
    userConfirm: config.tracking?.user_confirm ?? false,
    runtimeSync: config.tracking?.runtime_sync ?? true,
    llmSafety: resolveLLMSafetyOptions({
      enabled: config.llm_safety?.enabled,
      windowMs: config.llm_safety?.window_ms,
      maxRequestsPerWindow: config.llm_safety?.max_requests_per_window,
      maxConcurrentRequests: config.llm_safety?.max_concurrent_requests,
      maxEstimatedTokensPerWindow: config.llm_safety?.max_estimated_tokens_per_window,
    }),
    defaultProvider: config.llm?.default_provider ?? '',
    logLevel: config.ornn?.log_level ?? DEFAULT_LOG_LEVEL,
    providers: providers.map((provider) => ({
      ...provider,
      apiKey: envVars[provider.apiKeyEnvVar] || '',
      hasApiKey: Boolean(envVars[provider.apiKeyEnvVar] || process.env[provider.apiKeyEnvVar]),
    })),
  };
}

function mergeDashboardConfigs(
  globalConfig: DashboardConfig,
  legacyConfig: DashboardConfig
): { mergedConfig: DashboardConfig; changed: boolean } {
  const mergedProviders = [...globalConfig.providers];
  let changed = false;

  for (const legacyProvider of legacyConfig.providers) {
    const existingIndex = mergedProviders.findIndex((provider) => provider.provider === legacyProvider.provider);
    if (existingIndex < 0) {
      mergedProviders.push({ ...legacyProvider });
      changed = true;
      continue;
    }

    const existing = mergedProviders[existingIndex];
    const nextProvider: DashboardProviderConfig = { ...existing };
    if (!nextProvider.modelName && legacyProvider.modelName) {
      nextProvider.modelName = legacyProvider.modelName;
      changed = true;
    }
    if (!nextProvider.apiKeyEnvVar && legacyProvider.apiKeyEnvVar) {
      nextProvider.apiKeyEnvVar = legacyProvider.apiKeyEnvVar;
      changed = true;
    }
    if ((!nextProvider.apiKey || !nextProvider.apiKey.trim()) && legacyProvider.apiKey?.trim()) {
      nextProvider.apiKey = legacyProvider.apiKey.trim();
      nextProvider.hasApiKey = true;
      changed = true;
    } else if (!nextProvider.hasApiKey && legacyProvider.hasApiKey) {
      nextProvider.hasApiKey = true;
      changed = true;
    }
    mergedProviders[existingIndex] = nextProvider;
  }

  let defaultProvider = globalConfig.defaultProvider;
  if (!defaultProvider && legacyConfig.defaultProvider) {
    defaultProvider = legacyConfig.defaultProvider;
    changed = true;
  }

  if (mergedProviders.length === 0 && legacyConfig.providers.length > 0) {
    changed = true;
  }

  return {
    mergedConfig: {
      ...globalConfig,
      defaultProvider,
      providers: mergedProviders,
    },
    changed,
  };
}

export async function readDashboardConfig(projectPath?: string): Promise<DashboardConfig> {
  const config = await readTomlConfigFile(GLOBAL_DASHBOARD_CONFIG_PATH());
  const providers = normalizeProvidersFromConfig(config);
  const envVars = await readEnvFile(GLOBAL_DASHBOARD_ENV_PATH());
  const globalConfig: DashboardConfig = {
    autoOptimize: config?.tracking?.auto_optimize ?? true,
    userConfirm: config?.tracking?.user_confirm ?? false,
    runtimeSync: config?.tracking?.runtime_sync ?? true,
    llmSafety: resolveLLMSafetyOptions({
      enabled: config?.llm_safety?.enabled,
      windowMs: config?.llm_safety?.window_ms,
      maxRequestsPerWindow: config?.llm_safety?.max_requests_per_window,
      maxConcurrentRequests: config?.llm_safety?.max_concurrent_requests,
      maxEstimatedTokensPerWindow: config?.llm_safety?.max_estimated_tokens_per_window,
    }),
    defaultProvider: config?.llm?.default_provider ?? '',
    logLevel: config?.ornn?.log_level ?? DEFAULT_LOG_LEVEL,
    providers: providers.map((provider) => ({
      ...provider,
      apiKey: envVars[provider.apiKeyEnvVar] || process.env[provider.apiKeyEnvVar] || '',
      hasApiKey: Boolean(envVars[provider.apiKeyEnvVar] || process.env[provider.apiKeyEnvVar]),
    })),
  };

  if (!projectPath) {
    return globalConfig;
  }

  const legacyConfig = await readLegacyProjectDashboardConfig(projectPath);
  if (!config && legacyConfig) {
    logger.info("Migrating legacy project dashboard config into global config", { projectPath });
    await writeDashboardConfig(undefined, legacyConfig);
    return legacyConfig;
  }

  if (!legacyConfig) {
    return globalConfig;
  }

  const { mergedConfig, changed } = mergeDashboardConfigs(globalConfig, legacyConfig);
  if (changed) {
    logger.info("Promoting legacy project dashboard provider config into global config", {
      projectPath,
      providerCount: mergedConfig.providers.length,
      defaultProvider: mergedConfig.defaultProvider,
    });
    await writeDashboardConfig(undefined, mergedConfig);
  }
  return mergedConfig;
}

async function writeEnvVarToPath(
  envPath: string,
  envVarName: string,
  value: string
): Promise<void> {
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
  projectPath: string | undefined,
  payload: DashboardConfig
): Promise<void> {
  void projectPath;
  const configDir = GLOBAL_DASHBOARD_CONFIG_DIR();
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }
  const existing = await readTomlConfigFile(GLOBAL_DASHBOARD_CONFIG_PATH());
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
    join(homedir(), ".ornn"),
    providers,
    defaultProvider,
    payload.logLevel || existing?.ornn?.log_level || DEFAULT_LOG_LEVEL,
    {
      autoOptimize: payload.autoOptimize,
      userConfirm: payload.userConfirm,
      runtimeSync: payload.runtimeSync,
    },
    payload.llmSafety
  );
  await writeFile(GLOBAL_DASHBOARD_CONFIG_PATH(), content, "utf-8");

  for (const provider of payload.providers) {
    if (provider.apiKey && provider.apiKey.trim()) {
      await writeEnvVarToPath(GLOBAL_DASHBOARD_ENV_PATH(), provider.apiKeyEnvVar, provider.apiKey.trim());
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

async function readEnvFile(envPath: string): Promise<Record<string, string>> {
  if (!existsSync(envPath)) return {};
  try {
    const content = await readFile(envPath, "utf-8");
    return parseEnvFile(content);
  } catch {
    return {};
  }
}

export async function checkProvidersConnectivity(
  projectPath?: string,
  providersInput?: DashboardProviderConfig[]
): Promise<ProviderConnectivityResult[]> {
  const envVars = await readEnvFile(GLOBAL_DASHBOARD_ENV_PATH());
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
      const probe = await client.probeConnectivity();
      if (!probe.hasContent && !probe.hasReasoningContent) {
        throw new Error('Connectivity probe returned no content');
      }
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
