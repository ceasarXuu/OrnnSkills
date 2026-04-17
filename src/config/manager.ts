/**
 * Configuration Manager
 * Manages multi-provider configuration with append/override logic
 */

import { createLiteLLMClient } from "../llm/litellm-client.js";
import { GLOBAL_DASHBOARD_ENV_PATH, readEnvFile } from "./env-file.js";
import {
  readDashboardConfig,
  type DashboardProviderConfig,
} from "./dashboard-config.js";

export type {
  DashboardConfig,
  DashboardProviderConfig,
  OrnnConfig,
  ProviderConfig,
} from "./dashboard-config.js";
export {
  generateConfigContent,
  getDefaultProvider,
  listConfiguredProviders,
  readConfig,
  readDashboardConfig,
  setDefaultProvider,
  writeConfig,
  writeDashboardConfig,
} from "./dashboard-config.js";
export type { DashboardPromptOverrides } from "./prompt-overrides.js";
export {
  DEFAULT_DASHBOARD_PROMPT_OVERRIDES,
  resolveDashboardPromptOverrides,
} from "./prompt-overrides.js";
export { generateEnvContent, getProviderEnvVarName, writeEnvFile } from "./env-file.js";

export interface ProviderConnectivityResult {
  provider: string;
  modelName: string;
  ok: boolean;
  message: string;
  durationMs: number;
}

export async function checkProvidersConnectivity(
  projectPath?: string,
  providersInput?: DashboardProviderConfig[]
): Promise<ProviderConnectivityResult[]> {
  const envVars = await readEnvFile(GLOBAL_DASHBOARD_ENV_PATH());
  const providers =
    providersInput && providersInput.length > 0
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
        throw new Error("Connectivity probe returned no content");
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
