import { afterEach, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  generateConfigContent,
  getDefaultProvider,
  listConfiguredProviders,
  writeConfig,
} from "../../src/config/dashboard-config.js";

describe("dashboard config module", () => {
  const testDirs: string[] = [];

  afterEach(() => {
    for (const dir of testDirs.splice(0)) {
      if (existsSync(dir)) {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  it("omits prompt overrides section when every override is empty", () => {
    const content = generateConfigContent("/tmp/project", [
      {
        provider: "openai",
        modelName: "openai/gpt-4o-mini",
        apiKeyEnvVar: "OPENAI_API_KEY",
      },
    ]);

    expect(content).toContain('default_provider = "openai"');
    expect(content).not.toContain("[prompt_overrides]");
  });

  it("writes and reads legacy project providers through the dashboard config api", async () => {
    const projectPath = mkdtempSync(join(tmpdir(), "ornn-dashboard-config-"));
    testDirs.push(projectPath);

    await writeConfig(
      projectPath,
      {
        provider: "openai",
        modelName: "openai/gpt-4o-mini",
        apiKeyEnvVar: "OPENAI_API_KEY",
      },
      true
    );
    await writeConfig(
      projectPath,
      {
        provider: "deepseek",
        modelName: "deepseek/deepseek-chat",
        apiKeyEnvVar: "DEEPSEEK_API_KEY",
      },
      false
    );

    expect(await getDefaultProvider(projectPath)).toBe("openai");
    expect(await listConfiguredProviders(projectPath)).toEqual([
      {
        provider: "openai",
        modelName: "openai/gpt-4o-mini",
        apiKeyEnvVar: "OPENAI_API_KEY",
      },
      {
        provider: "deepseek",
        modelName: "deepseek/deepseek-chat",
        apiKeyEnvVar: "DEEPSEEK_API_KEY",
      },
    ]);
  });
});
