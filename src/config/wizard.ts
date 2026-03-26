/**
 * Configuration Wizard for first-time setup
 */

import { logger } from "../utils/logger.js";
import { SUPPORTED_PROVIDERS, getProviderConfig } from "./providers.js";
import { writeConfig, writeEnvFile } from "./generator.js";

export async function runConfigWizard(projectPath: string): Promise<void> {
  logger.info("🚀 Ornn Skills - Configuration Wizard\n");

  // Dynamically import inquirer to avoid ESM issues
  const { default: inquirer } = await import("inquirer");

  // Step 1: Select provider
  const { provider } = await inquirer.prompt<{ provider: string }>([
    {
      type: "list",
      name: "provider",
      message: "Select LLM Provider:",
      choices: SUPPORTED_PROVIDERS.map((p) => ({
        name: `${p.name} (${p.apiKeyUrl})`,
        value: p.id,
      })),
    },
  ]);

  // Step 2: Select model based on provider
  const providerConfig = getProviderConfig(provider);
  if (!providerConfig) {
    throw new Error(`Unknown provider: ${provider}. Please select a valid provider.`);
  }

  const { modelName } = await inquirer.prompt<{ modelName: string }>([
    {
      type: "list",
      name: "modelName",
      message: "Select Model:",
      choices: providerConfig.models.map((model) => ({
        name: model,
        value: model,
      })),
    },
  ]);

  // Step 3: Enter API key
  const { apiKey } = await inquirer.prompt<{ apiKey: string }>([
    {
      type: "password",
      name: "apiKey",
      message: "Enter API Key:",
      mask: "*",
      validate: (input: string): boolean | string => {
        if (!input || input.length < 10) {
          return "Please enter a valid API key";
        }
        return true;
      },
    },
  ]);

  // Step 4: Write config (without API key for security)
  await writeConfig(projectPath, {
    projectPath,
    provider,
    modelName,
  });
  logger.info(`✓ Configuration saved to .ornn/config.toml`);

  // Step 5: Write API key to .env.local
  await writeEnvFile(projectPath, provider, apiKey);
  logger.info(`✓ API key saved to .env.local`);

  // Step 6: Display security notice
  logger.info("\n⚠️  Security Notice:");
  logger.info("   Your API key has been saved to .env.local");
  logger.info("   Make sure to add .env.local to your .gitignore!");
  logger.info("\n   To load the environment variables, run:");
  logger.info(`   source .env.local`);
  logger.info("\n   Or use a tool like 'dotenv' to load it automatically.");
}
