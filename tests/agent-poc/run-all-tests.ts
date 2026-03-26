/**
 * 运行所有 Agent PoC 测试
 */

import { execSync } from "child_process";
import { resolve } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, "..");

const tests = [
  { name: "LLM 配置测试", file: "test-llm-config.ts" },
  { name: "Evaluator Agent 测试", file: "test-evaluator-agent.ts" },
  { name: "PatchGenerator 测试", file: "test-patch-generator.ts" },
  { name: "多模型策略测试", file: "test-multi-model.ts" },
];

async function runTests() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║          OrnnSkills Agent PoC 测试套件                     ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  // 检查 API Key
  const hasApiKey =
    process.env.DEEPSEEK_API_KEY ||
    process.env.deepseek_api_key ||
    process.env.OPENAI_API_KEY ||
    process.env.openai_api_key ||
    process.env.ANTHROPIC_API_KEY ||
    process.env.anthropic_api_key;

  if (!hasApiKey) {
    console.log("⚠️  警告: 未设置任何 API Key");
    console.log("   部分测试将被跳过\n");
    console.log("   请设置以下环境变量之一:");
    console.log("   - DEEPSEEK_API_KEY 或 deepseek_api_key");
    console.log("   - OPENAI_API_KEY 或 openai_api_key");
    console.log("   - ANTHROPIC_API_KEY 或 anthropic_api_key\n");
  }

  const results: Array<{ name: string; success: boolean; error?: string }> = [];

  for (const test of tests) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`运行: ${test.name}`);
    console.log(`${"=".repeat(60)}\n`);

    try {
      const testPath = resolve(__dirname, test.file);
      execSync(`npx tsx "${testPath}"`, {
        stdio: "inherit",
        cwd: process.cwd(),
      });
      results.push({ name: test.name, success: true });
    } catch (error) {
      results.push({
        name: test.name,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // 输出总结
  console.log("\n" + "=".repeat(60));
  console.log("测试总结");
  console.log("=".repeat(60) + "\n");

  const passed = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  for (const result of results) {
    const icon = result.success ? "✅" : "❌";
    console.log(`${icon} ${result.name}`);
    if (result.error) {
      console.log(`   错误: ${result.error}`);
    }
  }

  console.log(`\n总计: ${passed} 通过, ${failed} 失败`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
