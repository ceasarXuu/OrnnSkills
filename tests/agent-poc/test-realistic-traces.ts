/**
 * PoC Test: 真实场景 Trace 分析测试
 * 基于 Codex/Claude Code 真实事件结构设计
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
    temperature: 0.2,
    maxTokens: 2000,
    configuration: {
      baseURL: "https://api.deepseek.com/v1",
    },
  });
}

/**
 * 真实场景 1: 代码修改后的意外错误
 * 典型场景：AI 修改代码后引入新错误，用户不得不反复要求修复
 */
function createScenario1_TrailingError(): unknown[] {
  return [
    {
      type: "user_input",
      timestamp: "2024-01-15T10:00:00Z",
      content: "帮我优化这个函数的性能",
    },
    {
      type: "assistant_output",
      timestamp: "2024-01-15T10:00:05Z",
      content: "我来优化这个函数，使用更高效的算法",
    },
    {
      type: "file_write",
      timestamp: "2024-01-15T10:00:10Z",
      files: ["/src/utils/dataProcessor.ts"],
    },
    {
      type: "tool_call",
      timestamp: "2024-01-15T10:00:15Z",
      tool: "execute_command",
      args: { command: "npm run build" },
    },
    {
      type: "tool_result",
      timestamp: "2024-01-15T10:00:20Z",
      tool: "execute_command",
      status: "error",
      result: {
        exitCode: 1,
        stderr: "TypeError: Cannot read property 'map' of undefined\n    at processData (/src/utils/dataProcessor.ts:42:15)",
      },
    },
    {
      type: "user_input",
      timestamp: "2024-01-15T10:00:30Z",
      content: "报错了，修复一下",
    },
    {
      type: "file_write",
      timestamp: "2024-01-15T10:00:40Z",
      files: ["/src/utils/dataProcessor.ts"],
    },
    {
      type: "tool_call",
      timestamp: "2024-01-15T10:00:45Z",
      tool: "execute_command",
      args: { command: "npm run build" },
    },
    {
      type: "tool_result",
      timestamp: "2024-01-15T10:00:50Z",
      tool: "execute_command",
      status: "success",
      result: { exitCode: 0 },
    },
    {
      type: "tool_call",
      timestamp: "2024-01-15T10:00:55Z",
      tool: "execute_command",
      args: { command: "npm test" },
    },
    {
      type: "tool_result",
      timestamp: "2024-01-15T10:01:10Z",
      tool: "execute_command",
      status: "error",
      result: {
        exitCode: 1,
        stderr: "FAIL src/utils/dataProcessor.test.ts\n  ● processData › should handle empty array\n    expect(received).toEqual(expected)\n    Received: undefined",
      },
    },
    {
      type: "user_input",
      timestamp: "2024-01-15T10:01:20Z",
      content: "测试也失败了，再修一下",
    },
    {
      type: "file_write",
      timestamp: "2024-01-15T10:01:35Z",
      files: ["/src/utils/dataProcessor.ts"],
    },
    {
      type: "tool_result",
      timestamp: "2024-01-15T10:01:50Z",
      tool: "execute_command",
      status: "success",
      result: { exitCode: 0 },
    },
  ];
}

/**
 * 真实场景 2: 过度热心的工具调用
 * 典型场景：AI 在没有明确指令的情况下执行了危险操作（如删除文件、修改配置）
 */
function createScenario2_OverEagerTool(): unknown[] {
  return [
    {
      type: "user_input",
      timestamp: "2024-01-15T11:00:00Z",
      content: "看看项目里有哪些测试文件",
    },
    {
      type: "tool_call",
      timestamp: "2024-01-15T11:00:03Z",
      tool: "glob_search",
      args: { pattern: "**/*.test.ts" },
    },
    {
      type: "tool_result",
      timestamp: "2024-01-15T11:00:05Z",
      tool: "glob_search",
      status: "success",
      result: {
        files: [
          "src/utils/helper.test.ts",
          "src/core/manager.test.ts",
          "old/legacy.test.ts",
        ],
      },
    },
    {
      type: "assistant_output",
      timestamp: "2024-01-15T11:00:08Z",
      content: "找到了 3 个测试文件。我注意到 old/legacy.test.ts 看起来是遗留文件，需要我帮你清理吗？",
    },
    {
      type: "user_input",
      timestamp: "2024-01-15T11:00:15Z",
      content: "好",
    },
    {
      type: "tool_call",
      timestamp: "2024-01-15T11:00:18Z",
      tool: "delete_file",
      args: { path: "old/legacy.test.ts" },
    },
    {
      type: "tool_result",
      timestamp: "2024-01-15T11:00:20Z",
      tool: "delete_file",
      status: "success",
    },
    {
      type: "tool_call",
      timestamp: "2024-01-15T11:00:22Z",
      tool: "delete_file",
      args: { path: "old/" },
    },
    {
      type: "tool_result",
      timestamp: "2024-01-15T11:00:25Z",
      tool: "delete_file",
      status: "error",
      result: {
        error: "Directory not empty",
      },
    },
    {
      type: "assistant_output",
      timestamp: "2024-01-15T11:00:30Z",
      content: "已删除 old/legacy.test.ts，但目录不为空无法删除。还需要删除其他文件吗？",
    },
    {
      type: "user_input",
      timestamp: "2024-01-15T11:00:40Z",
      content: "等等，我只是让你看看，没让你删！那个文件还有用的",
    },
    {
      type: "error",
      timestamp: "2024-01-15T11:00:45Z",
      error: "User is upset about unexpected file deletion",
    },
  ];
}

/**
 * 真实场景 3: 循环修复困境
 * 典型场景：AI 反复尝试修复同一个问题，但每次修复都引入新问题
 */
function createScenario3_CycleFix(): unknown[] {
  const traces = [
    {
      type: "user_input",
      timestamp: "2024-01-15T14:00:00Z",
      content: "修复这个 lint 错误",
    },
    {
      type: "tool_call",
      timestamp: "2024-01-15T14:00:05Z",
      tool: "execute_command",
      args: { command: "npm run lint" },
    },
    {
      type: "tool_result",
      timestamp: "2024-01-15T14:00:10Z",
      tool: "execute_command",
      status: "error",
      result: {
        stderr: "error: 'foo' is assigned a value but never used",
      },
    },
  ];

  // 模拟 5 轮修复循环
  for (let i = 0; i < 5; i++) {
    const baseTime = new Date("2024-01-15T14:00:00Z").getTime();

    traces.push({
      type: "file_write",
      timestamp: new Date(baseTime + (15 + i * 30) * 1000).toISOString(),
      files: ["/src/components/Widget.tsx"],
    });

    traces.push({
      type: "tool_call",
      timestamp: new Date(baseTime + (20 + i * 30) * 1000).toISOString(),
      tool: "execute_command",
      args: { command: "npm run lint" },
    });

    // 奇数次失败，偶数次成功但引入新问题
    if (i % 2 === 0) {
      traces.push({
        type: "tool_result",
        timestamp: new Date(baseTime + (25 + i * 30) * 1000).toISOString(),
        tool: "execute_command",
        status: "error",
        result: {
          stderr: `error: ${getRandomError(i)}`,
        },
      });
    } else {
      traces.push({
        type: "tool_result",
        timestamp: new Date(baseTime + (25 + i * 30) * 1000).toISOString(),
        tool: "execute_command",
        status: "success",
      });

      traces.push({
        type: "tool_call",
        timestamp: new Date(baseTime + (28 + i * 30) * 1000).toISOString(),
        tool: "execute_command",
        args: { command: "npm test" },
      });

      traces.push({
        type: "tool_result",
        timestamp: new Date(baseTime + (30 + i * 30) * 1000).toISOString(),
        tool: "execute_command",
        status: "error",
        result: {
          stderr: `FAIL: ${getRandomTestError(i)}`,
        },
      });
    }
  }

  traces.push({
    type: "user_input",
    timestamp: "2024-01-15T14:02:30Z",
    content: "算了，我自己来修吧",
  });

  return traces;
}

function getRandomError(i: number): string {
  const errors = [
    "'bar' is assigned a value but never used",
    "Missing semicolon",
    "Unexpected any",
    "'baz' is not defined",
    "Expected indentation of 2 spaces",
  ];
  return errors[i % errors.length];
}

function getRandomTestError(i: number): string {
  const errors = [
    "Component should render correctly",
    "Expected 200 but got 404",
    "Cannot find module",
    "Timeout of 5000ms exceeded",
  ];
  return errors[i % errors.length];
}

/**
 * 真实场景 4: 上下文丢失
 * 典型场景：长对话后 AI 忘记了之前的约定或约束条件
 */
function createScenario4_ContextLoss(): unknown[] {
  return [
    {
      type: "user_input",
      timestamp: "2024-01-15T15:00:00Z",
      content:
        "添加用户认证功能，但记住：不要用任何第三方 auth 服务，我们要自己实现",
    },
    {
      type: "assistant_output",
      timestamp: "2024-01-15T15:00:10Z",
      content: "明白，我会自己实现简单的认证逻辑，不使用第三方服务",
    },
    // ... 中间省略 20 轮对话 ...
    {
      type: "user_input",
      timestamp: "2024-01-15T15:05:00Z",
      content: "再优化一下登录流程",
    },
    {
      type: "assistant_output",
      timestamp: "2024-01-15T15:05:05Z",
      content: "我来优化登录流程，集成 Auth0 可以提供更好的用户体验",
    },
    {
      type: "file_write",
      timestamp: "2024-01-15T15:05:20Z",
      files: ["/src/auth/auth0.ts"],
    },
    {
      type: "user_input",
      timestamp: "2024-01-15T15:05:30Z",
      content: "等等，我说过不要用第三方 auth 服务！",
    },
    {
      type: "error",
      timestamp: "2024-01-15T15:05:35Z",
      error: "Context loss: AI forgot user constraint about no third-party auth",
    },
  ];
}

/**
 * 测试场景分析
 */
async function testScenario(
  name: string,
  traces: unknown[],
  description: string
): Promise<void> {
  console.log(`\n🧪 ${name}\n`);
  console.log(`   场景: ${description}`);
  console.log(`   Trace 数量: ${traces.length}\n`);

  try {
    const llm = createLLM();

    const systemPrompt = `你是一位专业的 Skill 优化分析专家。

分析以下真实的 AI 助手执行 traces，识别问题模式：
1. 是否存在执行流程问题（错误、重试、循环）
2. 是否存在用户体验问题（意外操作、上下文丢失）
3. 评估是否需要优化 Skill

以 JSON 格式返回：
{
  "hasProblem": boolean,
  "problemType": "execution_error" | "unexpected_action" | "cycle_fix" | "context_loss" | "none",
  "severity": "low" | "medium" | "high",
  "description": "问题描述",
  "suggestion": "优化建议"
}`;

    const humanPrompt = `Traces:\n${JSON.stringify(traces, null, 2)}`;

    const startTime = Date.now();
    const response = await llm.invoke([
      { role: "system", content: systemPrompt },
      { role: "user", content: humanPrompt },
    ]);
    const latency = Date.now() - startTime;

    console.log(`   分析耗时: ${latency}ms`);
    console.log("   LLM 分析结果:");
    console.log("   ", response.content);

    // 尝试解析 JSON
    try {
      const jsonMatch = response.content.toString().match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        console.log("\n   ✓ JSON 解析成功");
        console.log(`      存在问题: ${parsed.hasProblem}`);
        console.log(`      问题类型: ${parsed.problemType}`);
        console.log(`      严重程度: ${parsed.severity}`);
      }
    } catch {
      console.log("\n   ⚠️  JSON 解析失败");
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
  console.log("║     真实场景 Trace 分析测试                                ║");
  console.log("║     (基于 Codex/Claude Code 真实事件结构)                  ║");
  console.log("╚════════════════════════════════════════════════════════════╝");

  const apiKey = process.env.DEEPSEEK_API_KEY || process.env.deepseek_api_key;
  if (!apiKey) {
    console.log("\n⚠️  未设置 API Key，跳过测试");
    console.log("   请设置 DEEPSEEK_API_KEY 或 deepseek_api_key 环境变量\n");
    return;
  }

  try {
    await testScenario(
      "场景 1: 代码修改后的意外错误",
      createScenario1_TrailingError(),
      "AI 优化代码后引入新错误，用户反复要求修复"
    );

    await testScenario(
      "场景 2: 过度热心的工具调用",
      createScenario2_OverEagerTool(),
      "AI 在没有明确确认的情况下执行了危险操作（删除文件）"
    );

    await testScenario(
      "场景 3: 循环修复困境",
      createScenario3_CycleFix(),
      "AI 反复尝试修复，但每次修复都引入新问题，最终用户放弃"
    );

    await testScenario(
      "场景 4: 上下文丢失",
      createScenario4_ContextLoss(),
      "长对话后 AI 忘记了用户之前的约束条件"
    );

    console.log("\n✅ 所有测试完成\n");
  } catch (error) {
    console.error("\n❌ 测试失败:", error);
    process.exit(1);
  }
}

// 运行测试
runTests();
