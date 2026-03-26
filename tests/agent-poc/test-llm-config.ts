/**
 * PoC Test: LLM Provider 配置测试
 * 验证 LangChain + LiteLLM 的基本连接能力
 */

// 加载 .env.local 环境变量
import { config } from "dotenv";
config({ path: ".env.local" });

import { ChatOpenAI } from "@langchain/openai";

// 测试配置
interface TestConfig {
  provider: string;
  modelName: string;
  apiKey?: string;
  baseUrl?: string;
}

/**
 * 创建 LLM 实例
 * 使用 OpenAI 兼容接口，通过 baseURL 指向不同 Provider
 */
function createLLM(config: TestConfig) {
  return new ChatOpenAI({
    modelName: config.modelName,
    apiKey: config.apiKey,
    temperature: 0.2,
    maxTokens: 500,
    timeout: 30000,
    configuration: {
      baseURL: config.baseUrl,
    },
  });
}

/**
 * 测试 1: 基础连接测试
 */
async function testBasicConnection(): Promise<void> {
  console.log("\n🧪 Test 1: 基础连接测试\n");

  // 从环境变量读取 API Key（支持大小写）
  const apiKey = process.env.DEEPSEEK_API_KEY || process.env.deepseek_api_key;

  if (!apiKey) {
    console.log("⚠️  跳过测试: 未设置 DEEPSEEK_API_KEY");
    console.log("   请复制 .env.local.example 为 .env.local 并填入你的 API Key");
    return;
  }

  console.log(`   Provider: deepseek`);
  console.log(`   Model: deepseek-chat`);

  try {
    const llm = createLLM({
      provider: "deepseek",
      modelName: "deepseek-chat",
      apiKey,
      baseUrl: "https://api.deepseek.com/v1",
    });

    console.log("   ✓ LLM 实例创建成功");

    // 发送简单测试消息
    const startTime = Date.now();
    const response = await llm.invoke(
      "Hello, say 'DeepSeek connection successful'"
    );
    const latency = Date.now() - startTime;

    console.log(`   ✓ 调用成功 (${latency}ms)`);
    console.log(`   Response: ${response.content}`);
  } catch (error) {
    console.error(
      "   ✗ 测试失败:",
      error instanceof Error ? error.message : String(error)
    );
    throw error;
  }
}

/**
 * 测试 2: 多 Provider 支持测试
 */
async function testMultiProvider(): Promise<void> {
  console.log("\n🧪 Test 2: 多 Provider 支持测试\n");

  const providers = [
    {
      name: "deepseek",
      model: "deepseek-chat",
      key: process.env.DEEPSEEK_API_KEY || process.env.deepseek_api_key,
      baseUrl: "https://api.deepseek.com/v1",
    },
    {
      name: "openai",
      model: "gpt-3.5-turbo",
      key: process.env.OPENAI_API_KEY || process.env.openai_api_key,
      baseUrl: undefined,
    },
  ];

  for (const { name, model, key, baseUrl } of providers) {
    if (!key) {
      console.log(`   ⚠️  跳过 ${name}: 未设置 API Key`);
      continue;
    }

    try {
      const llm = createLLM({
        provider: name,
        modelName: model,
        apiKey: key,
        baseUrl,
      });

      const response = await llm.invoke("Say 'OK'");
      console.log(`   ✓ ${name}: ${response.content}`);
    } catch (error) {
      console.error(
        `   ✗ ${name}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

/**
 * 测试 3: 结构化输出测试
 */
async function testStructuredOutput(): Promise<void> {
  console.log("\n🧪 Test 3: 结构化输出测试\n");

  const apiKey = process.env.DEEPSEEK_API_KEY || process.env.deepseek_api_key;
  if (!apiKey) {
    console.log("⚠️  跳过测试: 未设置 DEEPSEEK_API_KEY");
    console.log("   请复制 .env.local.example 为 .env.local 并填入你的 API Key");
    return;
  }

  try {
    const llm = createLLM({
      provider: "deepseek",
      modelName: "deepseek-chat",
      apiKey,
      baseUrl: "https://api.deepseek.com/v1",
    });

    const prompt = `分析以下情况，以 JSON 格式返回：
情况：用户执行了一个 skill，但结果不符合预期，需要手动修正。

请返回：
{
  "shouldOptimize": boolean,
  "confidence": number (0-1),
  "reason": string
}`;

    const response = await llm.invoke(prompt);
    console.log("   Raw response:");
    console.log("   ", response.content);

    // 尝试解析 JSON
    try {
      const jsonMatch = response.content.toString().match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        console.log("   ✓ JSON 解析成功:");
        console.log("   ", JSON.stringify(parsed, null, 2));
      }
    } catch (e) {
      console.log("   ⚠️  JSON 解析失败，需要更严格的格式控制");
    }
  } catch (error) {
    console.error(
      "   ✗ 测试失败:",
      error instanceof Error ? error.message : String(error)
    );
  }
}

/**
 * 运行所有测试
 */
async function runTests(): Promise<void> {
  console.log(
    "╔════════════════════════════════════════════════════════════╗"
  );
  console.log("║     LLM Provider 配置测试 (LangChain + OpenAI SDK)         ║");
  console.log("╚════════════════════════════════════════════════════════════╝");

  // 检查是否有 .env.local 文件
  const fs = await import("fs");
  if (!fs.existsSync(".env.local")) {
    console.log("\n⚠️  未找到 .env.local 文件");
    console.log("   请执行: cp .env.local.example .env.local");
    console.log("   然后编辑 .env.local 填入你的 API Key\n");
  }

  try {
    await testBasicConnection();
    await testMultiProvider();
    await testStructuredOutput();

    console.log("\n✅ 所有测试完成\n");
  } catch (error) {
    console.error("\n❌ 测试失败:", error);
    process.exit(1);
  }
}

// 运行测试
runTests();
