/**
 * Unified configuration generation
 * Centralizes config template and generation logic
 */

import { join } from "node:path";
import { writeFile } from "node:fs/promises";

export interface ConfigOptions {
  projectPath: string;
  provider?: string;
  modelName?: string;
  logLevel?: string;
}

const DEFAULT_LOG_LEVEL = "info";

/**
 * Generate config.toml content (without API key for security)
 */
export function generateConfigContent(options: ConfigOptions): string {
  const { projectPath, provider, modelName, logLevel = DEFAULT_LOG_LEVEL } = options;

  let config = `[ornn]
version = "0.1.0"
log_level = "${logLevel}"
project_path = "${projectPath}"
`;

  if (provider && modelName) {
    config += `
[llm]
provider = "${provider}"
model_name = "${modelName}"
# API key should be set via environment variable: ORNN_LLM_API_KEY
max_tokens = 4000
`;
  }

  config += `
[tracking]
auto_optimize = true
user_confirm = false
`;

  return config.trim();
}

/**
 * Write config file to .ornn directory
 */
export async function writeConfig(
  projectPath: string,
  options: ConfigOptions
): Promise<void> {
  const configPath = join(projectPath, ".ornn", "config.toml");
  const content = generateConfigContent(options);
  await writeFile(configPath, content);
}

/**
 * Generate .env.local content for API key
 */
export function generateEnvContent(provider: string, apiKey: string): string {
  return `# Ornn Skills Environment Configuration
# Generated on ${new Date().toISOString()}

# LLM Provider Configuration
ORNN_LLM_PROVIDER=${provider}
ORNN_LLM_API_KEY=${apiKey}
`;
}

/**
 * Write .env.local file
 */
export async function writeEnvFile(
  projectPath: string,
  provider: string,
  apiKey: string
): Promise<void> {
  const envPath = join(projectPath, ".env.local");
  const content = generateEnvContent(provider, apiKey);
  await writeFile(envPath, content);
}
