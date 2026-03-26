/**
 * PoC Test: 多模型策略测试
 * 验证不同任务使用不同模型的可行性
 */

// 加载 .env.local 环境变量
import { config } from "dotenv";
config({ path: ".env.local" });

import { ChatOpenAI } from "@langchain/openai";

interface ModelConfig {
  role: string;
  provider: string;
  modelName: string;
  temperature: number;
  maxTokens: number;
  costPer1KTokens: number; // 估算成本
}

/**
 * 多模型配置
 */
const multiModelConfig: ModelConfig[] = [
  {
    role: "evaluation",
    provider: "deepseek",
    modelName: "deepseek-chat",
    temperature: 0.2,
    maxTokens: 1000,
    costPer1KTokens: 0.001, // 估算
  },
  {
    role: "execution",
    provider: "deepseek",
    modelName: "deepseek-chat",
    temperature: 0.1,
    maxTokens: 2000,
    costPer1KTokens: 0.001,
  },
];

/**
 * 创建指定角色的 LLM
 */
function createRoleLLM(role: string) {
  const config = multiModelConfig.find((c) => c.role === role);
  if (!config) {
    throw new Error(`Unknown role: ${role}`);
  }

  const apiKey = process.env.DEEPSEEK_API_KEY || process.env.deepseek_api_key;
  if (!apiKey) {
    throw new Error("未设置 API Key");
  }

  return {
    llm: new ChatOpenAI({
      modelName: config.modelName,
      apiKey,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      configuration: {
        baseURL: "https://api.deepseek.com/v1",
      },
    }),
    config,
  };
}

/**
 * 测试 1: 评估任务（轻量级模型）
 */
async function testEvaluationTask(): Promise<void> {
  console.log("\n🧪 Test 1: 评估任务（轻量级模型）\n");

  const { llm, config } = createRoleLLM("evaluation");

  console.log(`   模型: ${config.provider}/${config.modelName}`);
  console.log(`   温度: ${config.temperature}`);
  console.log(`   Max Tokens: ${config.maxTokens}`);
  console.log(`   估算成本: $${config.costPer1KTokens}/1K tokens\n`);

  const traces = [
    { event: "tool_call", status: "success" },
    { event: "tool_call", status: "failure" },
    { event: "user_input", status: "success" },
  ];

  const systemPrompt = `快速评估以下 traces，判断是否需要优化。只输出是/否和简短理由。`;
  const humanPrompt = `Traces: ${JSON.stringify(traces)}`;

  const startTime = Date.now();
  const response = await llm.invoke([
    { role: "system", content: systemPrompt },
    { role: "user", content: humanPrompt },
  ]);
  const latency = Date.now() - startTime;

  console.log(`   响应时间: ${latency}ms`);
  console.log(`   输出: ${response.content}`);
}

/**
 * 测试 2: 执行任务（强模型）
 */
async function testExecutionTask(): Promise<void> {
  console.log("\n🧪 Test 2: 执行任务（生成模型）\n");

  const { llm, config } = createRoleLLM("execution");

  console.log(`   模型: ${config.provider}/${config.modelName}`);
  console.log(`   温度: ${config.temperature}`);
  console.log(`   Max Tokens: ${config.maxTokens}\n`);

  const currentSkill = `## Skill: File Writer
Write content to a file.`;

  const systemPrompt = `优化 skill，添加错误处理。输出完整 skill 内容。`;
  const humanPrompt = `Current skill:\n${currentSkill}`;

  const startTime = Date.now();
  const response = await llm.invoke([
    { role: "system", content: systemPrompt },
    { role: "user", content: humanPrompt },
  ]);
  const latency = Date.now() - startTime;

  console.log(`   响应时间: ${latency}ms`);
  console.log(`   输出长度: ${response.content.toString().length} 字符`);
  console.log(`   输出预览: ${response.content.toString().slice(0, 200)}...`);
}

/**
 * 测试 3: 成本对比
 */
async function testCostComparison(): Promise<void> {
  console.log("\n🧪 Test 3: 成本对比分析\n");

  console.log("   单模型策略 (GPT-4):");
  console.log("   - 评估: $0.03/1K tokens");
  console.log("   - 生成: $0.06/1K tokens");
  console.log("   - 平均每次优化: ~$0.05\n");

  console.log("   多模型策略 (DeepSeek + GPT-4):");
  console.log("   - 评估 (DeepSeek): $0.001/1K tokens");
  console.log("   - 生成 (DeepSeek): $0.001/1K tokens");
  console.log("   - 平均每次优化: ~$0.002\n");

  console.log("   成本节省: ~95%\n");

  console.log("   注意:");
  console.log("   - 简单任务使用便宜模型");
  console.log("   - 复杂任务才使用 GPT-4");
  console.log("   - 需要根据实际效果调整策略");
}

/**
 * 测试 4: 任务路由逻辑
 */
async function testTaskRouting(): Promise<void> {
  console.log("\n🧪 Test 4: 任务路由逻辑\n");

  interface Task {
    type: "evaluation" | "execution" | "review";
    complexity: "low" | "medium" | "high";
    content: string;
  }

  const tasks: Task[] = [
    {
      type: "evaluation",
      complexity: "low",
      content: "简单判断是否有错误",
    },
    {
      type: "execution",
      complexity: "high",
      content: "生成复杂的代码",
    },
    {
      type: "review",
      complexity: "low",
      content: "检查语法错误",
    },
  ];

  console.log("   任务路由策略:\n");

  for (const task of tasks) {
    const recommendedModel =
      task.complexity === "high" ? "GPT-4 (强模型)" : "DeepSeek (轻量模型)";

    console.log(`   任务: ${task.type}`);
    console.log(`   复杂度: ${task.complexity}`);
    console.log(`   推荐模型: ${recommendedModel}\n`);
  }
}

/**
 * 运行所有测试
 */
async function runTests(): Promise<void> {
  console.log(
    "╔════════════════════════════════════════════════════════════╗"
  );
  console.log("║          多模型策略测试                                    ║");
  console.log("╚════════════════════════════════════════════════════════════╝");

  const apiKey = process.env.DEEPSEEK_API_KEY || process.env.deepseek_api_key;
  if (!apiKey) {
    console.log("\n⚠️  未设置 API Key，跳过需要调用的测试");
    console.log("   请设置 DEEPSEEK_API_KEY 或 deepseek_api_key 环境变量\n");

    // 仍然运行成本分析测试
    await testCostComparison();
    await testTaskRouting();
    return;
  }

  try {
    await testEvaluationTask();
    await testExecutionTask();
    await testCostComparison();
    await testTaskRouting();

    console.log("\n✅ 所有测试完成\n");
  } catch (error) {
    console.error("\n❌ 测试失败:", error);
    process.exit(1);
  }
}

// 运行测试
runTests();
