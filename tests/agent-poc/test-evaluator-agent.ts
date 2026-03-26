/**
 * PoC Test: Evaluator Agent 测试
 * 验证纯 LLM 的 trace 分析能力
 */

// 加载 .env.local 环境变量
import { config } from "dotenv";
config({ path: ".env.local" });

import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";

// 模拟 Trace 类型
interface Trace {
  trace_id: string;
  session_id: string;
  event_type: string;
  timestamp: string;
  user_input?: string;
  assistant_output?: string;
  tool_name?: string;
  tool_result?: unknown;
  status: "success" | "failure" | "retry";
}

// 评估结果 Schema
const EvaluationResultSchema = z.object({
  shouldOptimize: z.boolean(),
  confidence: z.number().min(0).max(1),
  problemDescription: z.string(),
  optimizationSuggestion: z.string(),
  priority: z.enum(["low", "medium", "high"]),
  reasoning: z.string(),
});

type EvaluationResult = z.infer<typeof EvaluationResultSchema>;

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
    temperature: 0.2,
    maxTokens: 2000,
    configuration: {
      baseURL: "https://api.deepseek.com/v1",
    },
  });
}

/**
 * 模拟 traces 数据
 */
function createMockTraces(): Trace[] {
  return [
    {
      trace_id: "trace-001",
      session_id: "session-001",
      event_type: "tool_call",
      timestamp: "2024-01-15T10:00:00Z",
      tool_name: "read_file",
      tool_result: { success: true, content: "file content" },
      status: "success",
    },
    {
      trace_id: "trace-002",
      session_id: "session-001",
      event_type: "tool_call",
      timestamp: "2024-01-15T10:01:00Z",
      tool_name: "write_file",
      tool_result: { success: false, error: "Permission denied" },
      status: "failure",
    },
    {
      trace_id: "trace-003",
      session_id: "session-001",
      event_type: "user_input",
      timestamp: "2024-01-15T10:02:00Z",
      user_input: "请使用 sudo 权限重试",
      status: "success",
    },
    {
      trace_id: "trace-004",
      session_id: "session-001",
      event_type: "tool_call",
      timestamp: "2024-01-15T10:03:00Z",
      tool_name: "execute_command",
      tool_result: { success: true, output: "file written" },
      status: "success",
    },
  ];
}

/**
 * 测试 1: 基础 Trace 分析
 */
async function testBasicTraceAnalysis(): Promise<void> {
  console.log("\n🧪 Test 1: 基础 Trace 分析\n");

  try {
    const llm = createLLM();
    const traces = createMockTraces();

    const systemPrompt = `你是一位专业的 Skill 优化评估专家。分析以下 traces，判断是否需要优化。

分析维度：
1. 执行流程是否顺畅
2. 是否存在失败或异常
3. 用户是否频繁干预
4. 是否有优化空间

以 JSON 格式返回：
{
  "shouldOptimize": boolean,
  "confidence": number (0-1),
  "problemDescription": "问题描述",
  "optimizationSuggestion": "优化建议",
  "priority": "low" | "medium" | "high",
  "reasoning": "推理过程"
}`;

    const humanPrompt = `Traces:\n${JSON.stringify(traces, null, 2)}`;

    const response = await llm.invoke([
      { role: "system", content: systemPrompt },
      { role: "user", content: humanPrompt },
    ]);

    console.log("   LLM Response:");
    console.log("   ", response.content);

    // 解析 JSON
    const jsonMatch = response.content.toString().match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const validated = EvaluationResultSchema.parse(parsed);

      console.log("\n   ✓ 结构化输出验证成功:");
      console.log(`      shouldOptimize: ${validated.shouldOptimize}`);
      console.log(`      confidence: ${validated.confidence}`);
      console.log(`      priority: ${validated.priority}`);
      console.log(`      reasoning: ${validated.reasoning.slice(0, 100)}...`);
    }
  } catch (error) {
    console.error(
      "   ✗ 测试失败:",
      error instanceof Error ? error.message : String(error)
    );
  }
}

/**
 * 测试 2: 复杂场景分析
 */
async function testComplexScenario(): Promise<void> {
  console.log("\n🧪 Test 2: 复杂场景分析\n");

  const complexTraces: Trace[] = [
    {
      trace_id: "trace-101",
      session_id: "session-002",
      event_type: "user_input",
      timestamp: "2024-01-15T11:00:00Z",
      user_input: "帮我创建一个 React 组件",
      status: "success",
    },
    {
      trace_id: "trace-102",
      session_id: "session-002",
      event_type: "assistant_output",
      timestamp: "2024-01-15T11:00:30Z",
      assistant_output: "创建了一个 Button 组件",
      status: "success",
    },
    {
      trace_id: "trace-103",
      session_id: "session-002",
      event_type: "user_input",
      timestamp: "2024-01-15T11:01:00Z",
      user_input: "不对，我需要的是 Modal 组件",
      status: "success",
    },
    {
      trace_id: "trace-104",
      session_id: "session-002",
      event_type: "assistant_output",
      timestamp: "2024-01-15T11:01:30Z",
      assistant_output: "创建了一个 Modal 组件",
      status: "success",
    },
    {
      trace_id: "trace-105",
      session_id: "session-002",
      event_type: "user_input",
      timestamp: "2024-01-15T11:02:00Z",
      user_input: "Modal 需要有遮罩层和关闭按钮",
      status: "success",
    },
    {
      trace_id: "trace-106",
      session_id: "session-002",
      event_type: "assistant_output",
      timestamp: "2024-01-15T11:02:30Z",
      assistant_output: "添加了遮罩层和关闭按钮",
      status: "success",
    },
  ];

  try {
    const llm = createLLM();

    const systemPrompt = `分析以下 traces，识别问题模式。

这个 skill 用于创建 React 组件。请分析：
1. 用户意图是否被正确理解
2. 是否存在反复修改的情况
3. 初始输出是否满足需求
4. 如何改进 skill 以减少迭代次数

以 JSON 格式返回分析结果。`;

    const humanPrompt = `Traces:\n${JSON.stringify(complexTraces, null, 2)}`;

    const response = await llm.invoke([
      { role: "system", content: systemPrompt },
      { role: "user", content: humanPrompt },
    ]);

    console.log("   LLM Response:");
    console.log("   ", response.content.slice(0, 500), "...");

    // 验证能否提取关键信息
    const content = response.content.toString();
    const hasShouldOptimize = content.includes("shouldOptimize");
    const hasConfidence = content.includes("confidence");

    console.log(`\n   ✓ 包含 shouldOptimize: ${hasShouldOptimize}`);
    console.log(`   ✓ 包含 confidence: ${hasConfidence}`);
  } catch (error) {
    console.error(
      "   ✗ 测试失败:",
      error instanceof Error ? error.message : String(error)
    );
  }
}

/**
 * 测试 3: 对比规则引擎 vs LLM
 */
async function testComparison(): Promise<void> {
  console.log("\n🧪 Test 3: 规则引擎 vs LLM 能力对比\n");

  // 一个模糊的场景：用户多次重试，但最终成功
  const ambiguousTraces: Trace[] = [
    {
      trace_id: "trace-201",
      session_id: "session-003",
      event_type: "tool_call",
      timestamp: "2024-01-15T12:00:00Z",
      tool_name: "api_call",
      tool_result: { error: "Timeout" },
      status: "failure",
    },
    {
      trace_id: "trace-202",
      session_id: "session-003",
      event_type: "tool_call",
      timestamp: "2024-01-15T12:00:05Z",
      tool_name: "api_call",
      tool_result: { error: "Timeout" },
      status: "failure",
    },
    {
      trace_id: "trace-203",
      session_id: "session-003",
      event_type: "tool_call",
      timestamp: "2024-01-15T12:00:10Z",
      tool_name: "api_call",
      tool_result: { success: true, data: "..." },
      status: "success",
    },
  ];

  console.log("   场景: API 调用超时，重试后成功");
  console.log("   规则引擎: 可能误判为需要优化（有失败记录）");
  console.log("   LLM 应该: 理解这是正常的重试机制，不需要优化\n");

  try {
    const llm = createLLM();

    const systemPrompt = `分析以下 traces。这是一个 API 调用场景。

关键问题：
- 两次失败后重试成功
- 这是正常的重试机制，还是 skill 的问题？

请判断是否需要优化，并说明理由。`;

    const humanPrompt = `Traces:\n${JSON.stringify(ambiguousTraces, null, 2)}`;

    const response = await llm.invoke([
      { role: "system", content: systemPrompt },
      { role: "user", content: humanPrompt },
    ]);

    console.log("   LLM 分析结果:");
    console.log("   ", response.content);
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
  console.log("║          Evaluator Agent 测试 (纯 LLM)                     ║");
  console.log("╚════════════════════════════════════════════════════════════╝");

  const apiKey = process.env.DEEPSEEK_API_KEY || process.env.deepseek_api_key;
  if (!apiKey) {
    console.log("\n⚠️  未设置 API Key，跳过测试");
    console.log("   请设置 DEEPSEEK_API_KEY 或 deepseek_api_key 环境变量\n");
    return;
  }

  try {
    await testBasicTraceAnalysis();
    await testComplexScenario();
    await testComparison();

    console.log("\n✅ 所有测试完成\n");
  } catch (error) {
    console.error("\n❌ 测试失败:", error);
    process.exit(1);
  }
}

// 运行测试
runTests();
