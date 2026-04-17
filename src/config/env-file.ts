import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const GLOBAL_DASHBOARD_CONFIG_DIR = () => join(homedir(), ".ornn", "config");

export const GLOBAL_DASHBOARD_ENV_PATH = () => join(GLOBAL_DASHBOARD_CONFIG_DIR(), ".env.local");

export const PROJECT_DASHBOARD_ENV_PATH = (projectPath: string) =>
  join(projectPath, ".env.local");

export function getProviderEnvVarName(provider: string): string {
  const providerUpper = provider.toUpperCase().replace(/[^A-Z0-9]/g, "_");
  return `ORNN_${providerUpper}_API_KEY`;
}

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
    // Ignore missing or unreadable env file and regenerate below.
  }

  const envVarName = getProviderEnvVarName(provider);
  const providerRegex = new RegExp(`^${envVarName}=.*$`, "m");
  const newLine = `${envVarName}=${apiKey}`;

  if (providerRegex.test(existingContent)) {
    return existingContent.replace(providerRegex, newLine);
  }

  const header = existingContent.includes("# Ornn Skills Environment Configuration")
    ? ""
    : `# Ornn Skills Environment Configuration\n# Generated on ${new Date().toISOString()}\n\n# LLM Provider API Keys\n`;

  return (
    existingContent +
    (existingContent.endsWith("\n") || existingContent === "" ? "" : "\n") +
    (header ? header : "") +
    `${newLine}\n`
  );
}

export async function writeEnvFile(
  projectPath: string,
  provider: string,
  apiKey: string
): Promise<void> {
  const envPath = join(projectPath, ".env.local");
  const content = await generateEnvContent(projectPath, provider, apiKey);
  await writeFile(envPath, content);
}

export function parseEnvFile(content: string): Record<string, string> {
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

export async function readEnvFile(envPath: string): Promise<Record<string, string>> {
  if (!existsSync(envPath)) return {};
  try {
    const content = await readFile(envPath, "utf-8");
    return parseEnvFile(content);
  } catch {
    return {};
  }
}

export async function writeEnvVarToPath(
  envPath: string,
  envVarName: string,
  value: string
): Promise<void> {
  const existingContent = existsSync(envPath) ? await readFile(envPath, "utf-8") : "";
  const providerRegex = new RegExp(
    `^${envVarName.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}=.*$`,
    "m"
  );
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
