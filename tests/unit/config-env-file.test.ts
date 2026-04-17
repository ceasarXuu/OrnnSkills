import { afterEach, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  generateEnvContent,
  getProviderEnvVarName,
  parseEnvFile,
  readEnvFile,
  writeEnvFile,
} from "../../src/config/env-file.js";

describe("config env file", () => {
  const testDirs: string[] = [];

  afterEach(() => {
    for (const dir of testDirs.splice(0)) {
      if (existsSync(dir)) {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  it("builds a stable provider api key env var name", () => {
    expect(getProviderEnvVarName("together-ai")).toBe("ORNN_TOGETHER_AI_API_KEY");
  });

  it("appends or updates provider api keys in env content", async () => {
    const projectPath = mkdtempSync(join(tmpdir(), "ornn-env-content-"));
    testDirs.push(projectPath);

    writeFileSync(join(projectPath, ".env.local"), "ORNN_DEEPSEEK_API_KEY=old-key\n", "utf-8");

    const content = await generateEnvContent(projectPath, "deepseek", "new-key");
    expect(content).toContain("ORNN_DEEPSEEK_API_KEY=new-key");
    expect(content).not.toContain("old-key");
  });

  it("parses env files and reads them from disk", async () => {
    const projectPath = mkdtempSync(join(tmpdir(), "ornn-env-read-"));
    testDirs.push(projectPath);

    await writeEnvFile(projectPath, "openai", "sk-test-openai");
    writeFileSync(
      join(projectPath, ".custom.env"),
      "# comment\nFOO=bar\nQUOTED=\"value\"\nINVALID\n",
      "utf-8"
    );

    expect(parseEnvFile("# comment\nFOO=bar\nQUOTED='value'\n")).toEqual({
      FOO: "bar",
      QUOTED: "value",
    });
    expect(await readEnvFile(join(projectPath, ".custom.env"))).toEqual({
      FOO: "bar",
      QUOTED: "value",
    });
  });
});
