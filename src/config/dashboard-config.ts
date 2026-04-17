import { existsSync, mkdirSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { parse } from "smol-toml";

import { resolveLLMSafetyOptions, type LLMSafetyOptions } from "../llm/request-guard.js";
import { logger } from "../utils/logger.js";
import {
  GLOBAL_DASHBOARD_ENV_PATH,
  PROJECT_DASHBOARD_ENV_PATH,
  readEnvFile,
  writeEnvVarToPath,
} from "./env-file.js";
import {
  DEFAULT_DASHBOARD_PROMPT_OVERRIDES,
  hasPromptOverrides,
  normalizePromptOverridesFromConfig,
  resolveDashboardPromptOverrides,
  type DashboardPromptOverrides,
} from "./prompt-overrides.js";

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
  prompt_overrides?: {
    skill_call_analyzer?: string;
    skillCallAnalyzer?: string;
    decision_explainer?: string;
    decisionExplainer?: string;
    readiness_probe?: string;
    readinessProbe?: string;
  };
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
  promptOverrides: DashboardPromptOverrides;
  defaultProvider: string;
  logLevel: string;
  providers: DashboardProviderConfig[];
}

const DEFAULT_LOG_LEVEL = "info";
const GLOBAL_DASHBOARD_CONFIG_DIR = () => join(homedir(), ".ornn", "config");
const GLOBAL_DASHBOARD_CONFIG_PATH = () => join(GLOBAL_DASHBOARD_CONFIG_DIR(), "settings.toml");
const PROJECT_DASHBOARD_CONFIG_PATH = (projectPath: string) =>
  join(projectPath, ".ornn", "config", "settings.toml");

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
    const rawProvider = provider as Record<string, string>;
    return {
      provider: rawProvider.provider,
      modelName: rawProvider.model_name || rawProvider.modelName,
      apiKeyEnvVar: rawProvider.api_key_env_var || rawProvider.apiKeyEnvVar,
    };
  });
}

async function readLegacyProjectDashboardConfig(
  projectPath: string
): Promise<DashboardConfig | null> {
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
    promptOverrides: normalizePromptOverridesFromConfig(config),
    defaultProvider: config.llm?.default_provider ?? "",
    logLevel: config.ornn?.log_level ?? DEFAULT_LOG_LEVEL,
    providers: providers.map((provider) => ({
      ...provider,
      apiKey: envVars[provider.apiKeyEnvVar] || "",
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
    const existingIndex = mergedProviders.findIndex(
      (provider) => provider.provider === legacyProvider.provider
    );
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

  const promptOverrides = resolveDashboardPromptOverrides(globalConfig.promptOverrides);
  for (const [key, value] of Object.entries(legacyConfig.promptOverrides) as Array<
    [keyof DashboardPromptOverrides, string]
  >) {
    if (!promptOverrides[key] && value.trim()) {
      promptOverrides[key] = value.trim();
      changed = true;
    }
  }

  if (mergedProviders.length === 0 && legacyConfig.providers.length > 0) {
    changed = true;
  }

  return {
    mergedConfig: {
      ...globalConfig,
      defaultProvider,
      promptOverrides,
      providers: mergedProviders,
    },
    changed,
  };
}

export async function readConfig(projectPath: string): Promise<OrnnConfig | null> {
  return readTomlConfigFile(PROJECT_DASHBOARD_CONFIG_PATH(projectPath));
}

export function generateConfigContent(
  projectPath: string,
  providers: ProviderConfig[],
  defaultProvider?: string,
  logLevel: string = DEFAULT_LOG_LEVEL,
  tracking: { autoOptimize?: boolean; userConfirm?: boolean; runtimeSync?: boolean } = {},
  llmSafety?: Partial<LLMSafetyOptions>,
  promptOverrides: DashboardPromptOverrides = DEFAULT_DASHBOARD_PROMPT_OVERRIDES
): string {
  const normalizedSafety = resolveLLMSafetyOptions(llmSafety);
  const normalizedPromptOverrides = resolveDashboardPromptOverrides(promptOverrides);
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

  if (hasPromptOverrides(normalizedPromptOverrides)) {
    config += `
[prompt_overrides]
skill_call_analyzer = ${JSON.stringify(normalizedPromptOverrides.skillCallAnalyzer)}
decision_explainer = ${JSON.stringify(normalizedPromptOverrides.decisionExplainer)}
readiness_probe = ${JSON.stringify(normalizedPromptOverrides.readinessProbe)}
`;
  }

  return config.trim();
}

export async function writeConfig(
  projectPath: string,
  newProvider: ProviderConfig,
  setAsDefault: boolean = false
): Promise<void> {
  const configDir = join(projectPath, ".ornn", "config");
  const configPath = PROJECT_DASHBOARD_CONFIG_PATH(projectPath);
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }
  const existingConfig = await readConfig(projectPath);
  const existingProviders = Object.fromEntries(
    normalizeProvidersFromConfig(existingConfig).map((provider) => [provider.provider, provider])
  );

  existingProviders[newProvider.provider] = newProvider;
  const providersArray = Object.values(existingProviders);
  const defaultProvider = setAsDefault
    ? newProvider.provider
    : existingConfig?.llm?.default_provider || newProvider.provider;

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
    },
    normalizePromptOverridesFromConfig(existingConfig)
  );

  await writeFile(configPath, content);
}

export async function listConfiguredProviders(projectPath: string): Promise<ProviderConfig[]> {
  return normalizeProvidersFromConfig(await readConfig(projectPath));
}

export async function getDefaultProvider(projectPath: string): Promise<string | null> {
  const config = await readConfig(projectPath);
  return config?.llm?.default_provider || null;
}

export async function setDefaultProvider(
  projectPath: string,
  providerId: string
): Promise<boolean> {
  const config = await readConfig(projectPath);
  if (!config) {
    return false;
  }

  if (!config.providers?.[providerId]) {
    const availableProviders = Object.keys(config.providers || {});
    logger.error(
      `Provider "${providerId}" not found in configuration. ` +
        (availableProviders.length > 0
          ? `Available providers: ${availableProviders.join(", ")}.`
          : "No providers configured yet.")
    );
    logger.info("To configure providers, run: ornn config");
    return false;
  }

  const providersArray = normalizeProvidersFromConfig(config);
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
    },
    normalizePromptOverridesFromConfig(config)
  );

  await writeFile(PROJECT_DASHBOARD_CONFIG_PATH(projectPath), content);
  return true;
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
    promptOverrides: normalizePromptOverridesFromConfig(config),
    defaultProvider: config?.llm?.default_provider ?? "",
    logLevel: config?.ornn?.log_level ?? DEFAULT_LOG_LEVEL,
    providers: providers.map((provider) => ({
      ...provider,
      apiKey: envVars[provider.apiKeyEnvVar] || process.env[provider.apiKeyEnvVar] || "",
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
  const providers = payload.providers.map((provider) => ({
    provider: provider.provider,
    modelName: provider.modelName,
    apiKeyEnvVar: provider.apiKeyEnvVar,
  }));
  const defaultProvider =
    providers.find((provider) => provider.provider === payload.defaultProvider)?.provider ||
    providers.find((provider) => provider.provider === existingDefaultProvider)?.provider ||
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
    payload.llmSafety,
    resolveDashboardPromptOverrides(payload.promptOverrides)
  );
  await writeFile(GLOBAL_DASHBOARD_CONFIG_PATH(), content, "utf-8");

  for (const provider of payload.providers) {
    if (provider.apiKey && provider.apiKey.trim()) {
      await writeEnvVarToPath(
        GLOBAL_DASHBOARD_ENV_PATH(),
        provider.apiKeyEnvVar,
        provider.apiKey.trim()
      );
    }
  }
}
