/**
 * PoC Test: PatchGenerator 测试
 * 验证纯 LLM 的 skill 优化生成能力
 */

// 加载 .env.local 环境变量
import { config } from "dotenv";
config({ path: ".env.local" });

import { ChatOpenAI } from "@langchain/openai";

/**
 * 创建 LLM 实例
 */
function createLLM() {
  const apiKey = process.env.DEEPSEEK_API_KEY || process.env.deepseek_api_key;

  if (!apiKey) {
    throw new Error("未设置 API Key");
  }

  return new ChatOpenAI({
    modelName: "deepseek-chat",
    apiKey,
    temperature: 0.1, // 生成任务使用较低 temperature
    maxTokens: 4000,
    configuration: {
      baseURL: "https://api.deepseek.com/v1",
    },
  });
}

/**
 * 测试 1: 简单 Skill 优化
 */
async function testSimpleSkillOptimization(): Promise<void> {
  console.log("\n🧪 Test 1: 简单 Skill 优化\n");

  const currentSkill = `## Skill: File Writer

Write content to a file.

### Instructions
Use the write_file tool to write content.

### Parameters
- path: file path
- content: file content`;

  const problemDescription = "Skill 没有处理文件权限错误的情况";

  try {
    const llm = createLLM();

    const systemPrompt = `你是一位专业的 Skill 优化工程师。

任务：根据问题描述，优化 skill 内容。

优化原则：
1. 保持 skill 的核心功能不变
2. 修复识别出的问题
3. 添加必要的错误处理
4. 保持格式规范

直接输出优化后的完整 skill 内容，不要添加解释。`;

    const humanPrompt = `当前 Skill:
${currentSkill}

问题描述:
${problemDescription}

请生成优化后的 skill 内容：`;

    const response = await llm.invoke([
      { role: "system", content: systemPrompt },
      { role: "user", content: humanPrompt },
    ]);

    console.log("   生成的 Skill:");
    console.log("   ", response.content);

    // 验证是否包含关键改进
    const content = response.content.toString();
    const hasErrorHandling =
      content.toLowerCase().includes("error") ||
      content.toLowerCase().includes("权限") ||
      content.toLowerCase().includes("permission");

    console.log(`\n   ✓ 包含错误处理: ${hasErrorHandling}`);
  } catch (error) {
    console.error(
      "   ✗ 测试失败:",
      error instanceof Error ? error.message : String(error)
    );
  }
}

/**
 * 测试 2: 复杂 Skill 重构
 */
async function testComplexSkillRefactoring(): Promise<void> {
  console.log("\n🧪 Test 2: 复杂 Skill 重构\n");

  const currentSkill = `## Skill: API Caller

Call external APIs.

### Instructions
Make HTTP requests to external APIs.

### Example
\`\`\`
GET https://api.example.com/data
\`\`\``;

  const problemDescription = `
1. 没有说明如何处理 API 超时
2. 没有说明如何处理 rate limiting
3. 没有说明如何设置 headers
4. 示例过于简单，不够实用
`;

  try {
    const llm = createLLM();

    const systemPrompt = `你是一位专业的 Skill 优化工程师。

任务：全面重构 skill，解决多个问题。

重构要求：
1. 添加详细的参数说明
2. 添加错误处理指南
3. 提供多个实用示例
4. 添加最佳实践说明

直接输出优化后的完整 skill 内容。`;

    const humanPrompt = `当前 Skill:
${currentSkill}

问题描述:
${problemDescription}

请生成优化后的 skill 内容：`;

    const response = await llm.invoke([
      { role: "system", content: systemPrompt },
      { role: "user", content: humanPrompt },
    ]);

    console.log("   生成的 Skill (前 800 字符):");
    console.log("   ", response.content.toString().slice(0, 800), "...");

    // 验证改进点
    const content = response.content.toString();
    const hasTimeout = content.toLowerCase().includes("timeout");
    const hasRateLimit = content.toLowerCase().includes("rate limit");
    const hasHeaders = content.toLowerCase().includes("header");

    console.log(`\n   ✓ 包含超时处理: ${hasTimeout}`);
    console.log(`   ✓ 包含 Rate Limit: ${hasRateLimit}`);
    console.log(`   ✓ 包含 Headers: ${hasHeaders}`);
  } catch (error) {
    console.error(
      "   ✗ 测试失败:",
      error instanceof Error ? error.message : String(error)
    );
  }
}

/**
 * 测试 3: Code Skill 优化
 */
async function testCodeSkillOptimization(): Promise<void> {
  console.log("\n🧪 Test 3: Code Skill 优化\n");

  const currentSkill = `## Skill: React Component Creator

Create React components.

### Instructions
Generate React component code.

### Example
\`\`\`tsx
function Button() {
  return <button>Click me</button>;
}
\`\`\``;

  const problemDescription = `
用户反馈：
1. 生成的组件没有类型定义
2. 没有 props 验证
3. 没有处理 loading 状态
4. 没有添加样式支持
`;

  try {
    const llm = createLLM();

    const systemPrompt = `你是一位专业的 React 开发专家。

任务：优化 React Component Creator skill。

优化要求：
1. 添加 TypeScript 类型定义
2. 添加 Props 接口和验证
3. 添加 Loading 状态处理
4. 添加样式方案（CSS Modules / styled-components / Tailwind）
5. 提供完整的示例

直接输出优化后的 skill 内容。`;

    const humanPrompt = `当前 Skill:
${currentSkill}

用户反馈:
${problemDescription}

请生成优化后的 skill 内容：`;

    const response = await llm.invoke([
      { role: "system", content: systemPrompt },
      { role: "user", content: humanPrompt },
    ]);

    console.log("   生成的 Skill (前 1000 字符):");
    console.log("   ", response.content.toString().slice(0, 1000), "...");

    // 验证改进
    const content = response.content.toString();
    const hasTypeScript =
      content.includes("interface") || content.includes("type ");
    const hasProps = content.toLowerCase().includes("props");
    const hasLoading = content.toLowerCase().includes("loading");

    console.log(`\n   ✓ 包含 TypeScript: ${hasTypeScript}`);
    console.log(`   ✓ 包含 Props: ${hasProps}`);
    console.log(`   ✓ 包含 Loading: ${hasLoading}`);
  } catch (error) {
    console.error(
      "   ✗ 测试失败:",
      error instanceof Error ? error.message : String(error)
    );
  }
}

/**
 * 测试 4: 对比固定策略 vs LLM 生成
 */
async function testComparison(): Promise<void> {
  console.log("\n🧪 Test 4: 固定策略 vs LLM 生成对比\n");

  const currentSkill = `## Skill: Data Processor

Process data files.

### Instructions
Read and process data from files.`;

  const problem = "需要支持多种数据格式：JSON、CSV、XML";

  console.log("   固定策略的问题:");
  console.log("   - 只能添加固定的 fallback 逻辑");
  console.log("   - 无法灵活处理多种格式");
  console.log("   - 模板化输出缺乏针对性\n");

  console.log("   LLM 生成的优势:");
  console.log("   - 根据具体问题动态生成解决方案");
  console.log("   - 可以综合考虑多个因素");
  console.log("   - 输出更具针对性和实用性\n");

  try {
    const llm = createLLM();

    const systemPrompt = `优化 skill，使其支持 JSON、CSV、XML 三种数据格式。

要求：
1. 自动检测文件格式
2. 为每种格式提供处理示例
3. 添加错误处理
4. 保持 skill 的简洁性

直接输出优化后的 skill 内容。`;

    const humanPrompt = `当前 Skill:
${currentSkill}

需求:
${problem}

请生成优化后的 skill 内容：`;

    const response = await llm.invoke([
      { role: "system", content: systemPrompt },
      { role: "user", content: humanPrompt },
    ]);

    console.log("   LLM 生成的 Skill:");
    console.log("   ", response.content.toString().slice(0, 800), "...");
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
  console.log("║          PatchGenerator 测试 (纯 LLM)                      ║");
  console.log("╚════════════════════════════════════════════════════════════╝");

  const apiKey = process.env.DEEPSEEK_API_KEY || process.env.deepseek_api_key;
  if (!apiKey) {
    console.log("\n⚠️  未设置 API Key，跳过测试");
    console.log("   请设置 DEEPSEEK_API_KEY 或 deepseek_api_key 环境变量\n");
    return;
  }

  try {
    await testSimpleSkillOptimization();
    await testComplexSkillRefactoring();
    await testCodeSkillOptimization();
    await testComparison();

    console.log("\n✅ 所有测试完成\n");
  } catch (error) {
    console.error("\n❌ 测试失败:", error);
    process.exit(1);
  }
}

// 运行测试
runTests();
