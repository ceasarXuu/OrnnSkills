# OrnnSkills TODO

## 超长文件拆分 Checklist

- [x] P1 `src/dashboard/data-reader.ts`
  当前顺序：
  1. `[x]` 抽出 `readers/skills-reader`
  2. `[x]` 抽出 `readers/trace-reader`
  3. `[x]` 抽出 `readers/decision-events-reader`
  4. `[x]` 抽出 `readers/agent-usage-reader`
  5. `[x]` 抽出 `readers/daemon-status-reader`
  6. `[x]` 保留 `data-reader.ts` 作为 facade
- [x] P1 `src/dashboard/server.ts`
  当前顺序：
  1. `[x]` 抽出 `routes/global-config-routes`
  2. `[x]` 抽出 `routes/project-config-routes`
  3. `[x]` 抽出 `routes/project-read-routes`
  4. `[x]` 抽出 `routes/project-skill-routes`
  5. `[x]` 抽出 `routes/project-version-routes`
  6. `[x]` 收口 `server.ts` 剩余路由装配
  2. `[x]` 抽出 `sse/hub`
  3. `[x]` 抽出 `services/project-onboarding`
  4. `[x]` 抽出 `services/skill-version`
- [ ] P1 `src/dashboard/ui.ts`
  当前顺序：
  1. `[x]` 抽出 `web/app-shell`
  2. `[x]` 抽出 `web/state`
  3. `[x]` 抽出 `web/panels/*`（已完成 `panels/cost-panel`、`panels/config-panel`、`panels/logs-panel`、`panels/overview-panel`、`panels/skills-panel`、`panels/activity-panel`）
  4. `[x]` 抽出 `web/render/*`（已完成 `render/skill-card`、`render/trace-bars`、`render/state-badge`、`render/metric-rows`、`render/cost-breakdown`、`render/activity-tables`）
  5. `[x]` 抽出 `web/styles`
  6. `[ ]` 抽出 `web/activity/*`（已完成 `activity/business-events`）
  7. `[ ]` 抽出 `web/config/*`
  8. `[ ]` 收口 `ui.ts` 为 facade
- [x] P1 `src/config/manager.ts`
  当前顺序：
  1. `[x]` 抽出 `dashboard-config`
  2. `[x]` 抽出 `env-file`
  3. `[x]` 抽出 `provider-connectivity`
  4. `[x]` 抽出 `prompt-overrides`
- [ ] P2 `src/storage/sqlite.ts`
  当前顺序：
  1. `[ ]` 抽出共享 DB adapter
  2. `[ ]` 抽出 `shadow-skill-repo`
  3. `[ ]` 抽出 `session-repo`
  4. `[ ]` 抽出 `origin-skill-repo`
  5. `[ ]` 抽出 `trace-skill-mapping-repo`
- [ ] P2 `src/core/journal/index.ts`
  当前顺序：
  1. `[ ]` 抽出 `trace-journal`
  2. `[ ]` 抽出 `shadow-history`
  3. `[ ]` 共用 `sqlite` 持久层接口
- [ ] P2 `src/core/observer/codex-observer.ts`
  当前顺序：
  1. `[ ]` 抽出 `session-file-reader`
  2. `[ ]` 抽出 `session-reconciler`
  3. `[ ]` 抽出 `event-preprocessor`
  4. `[ ]` 抽出 `trace-emitter`
- [ ] P2 `src/daemon/index.ts`
  当前顺序：
  1. `[ ]` 抽出 `project-runtime-registry`
  2. `[ ]` 抽出 `retry-queue`
  3. `[ ]` 抽出 `checkpoint-service`
  4. `[ ]` 抽出 `daemon-lifecycle`
- [ ] P2 `src/core/shadow-manager/index.ts`
  当前顺序：
  1. `[ ]` 抽出 `trace-ingest-service`
  2. `[ ]` 抽出 `episode-probe-service`
  3. `[ ]` 抽出 `optimization-runner`
  4. `[ ]` 抽出 `manual-optimize-service`
  5. `[ ]` 保留 `ShadowManager` 作为 facade

当前进行中：
- [ ] `src/dashboard/ui.ts` 第 6 步：抽出 `web/activity/*`（下一项：`activity/scope-detail`）

## 优先级总览

| 优先级 | 类别 | 事项 |
|--------|------|------|
| **P0 - 阻塞** | 架构升级 | 4. 从规则引擎迁移到 Agent 框架 |
| **P1 - 高** | 设计优化 | 1. 自动同步机制 |
| **P2 - 中** | 功能完善 | 2. ornn init 命令 |
| **P3 - 低** | 功能完善 | 3. 其他 CLI 命令 |
| **P4 - 维护** | Bug/性能/文档 | 后续迭代 |

---

## P0 - 阻塞优先级（架构核心）

### 4. 从规则引擎迁移到 Agent 框架

**为什么 P0：**
- 这是项目的核心差异化竞争力
- 当前规则引擎无法实现真正的"智能"优化
- 阻塞后续所有智能化功能的实现

**当前问题：**
- Evaluator 使用基于规则的统计方法评估 traces
- PatchGenerator 使用预定义的文本操作策略（append_context, prune_noise 等）
- 所有分析和判断都是硬编码的规则，无法处理复杂或新颖的情况
- 无法理解语义，只能做简单的文本操作

**目标：**
将需要分析、判断的部分从传统规则引擎迁移到 Agent/LLM 框架，实现真正的智能优化。

**需要改造的核心组件：**

1. **Evaluator（评估器）**
   - 当前：统计信号数量、计算置信度、阈值判断
   - 目标：使用 LLM 分析 traces，理解执行过程中的问题模式
   - 输入：traces + 当前 skill 内容
   - 输出：是否需要优化 + 问题描述 + 优化建议

2. **PatchGenerator（补丁生成器）**
   - 当前：5种固定的文本操作策略
   - 目标：使用 LLM 根据问题描述生成优化后的 skill 内容
   - 输入：当前 skill + 问题描述 + traces 上下文
   - 输出：优化后的完整 skill 内容 + 变更说明

3. **TraceSkillMapper（Trace 映射器）**
   - 当前：6种基于路径和关键词的映射策略
   - 目标：使用 LLM 理解 trace 的语义，智能映射到 skill
   - 输入：trace 内容
   - 输出：映射的 skill_id + 置信度 + 推理过程

**技术方案：**

```typescript
// 新的 Agent-based Evaluator
class AgentEvaluator {
  async evaluate(traces: Trace[], skillContent: string): Promise<EvaluationResult> {
    const prompt = `
      你是一位技能优化专家。请分析以下 skill 的执行 traces，判断是否需要优化。
      
      当前 Skill 内容：
      ${skillContent}
      
      执行 Traces：
      ${JSON.stringify(traces, null, 2)}
      
      请分析：
      1. 这个 skill 是否存在问题？
      2. 问题的根本原因是什么？
      3. 如何优化？
      
      以 JSON 格式返回：
      {
        "should_optimize": boolean,
        "confidence": number,
        "problem_description": string,
        "optimization_suggestion": string
      }
    `;
    
    return await this.llm.chat.completions.create({...});
  }
}

// 新的 Agent-based PatchGenerator
class AgentPatchGenerator {
  async generate(skillContent: string, evaluation: EvaluationResult): Promise<string> {
    const prompt = `
      请根据以下优化建议，生成优化后的 skill 内容。
      
      当前 Skill：
      ${skillContent}
      
      优化建议：
      ${evaluation.optimization_suggestion}
      
      请输出完整的优化后 skill 内容。
    `;
    
    return await this.llm.chat.completions.create({...});
  }
}
```

**技术架构：基于 LangChain DeepAgent**

本项目 Agent 架构应基于 **LangChain DeepAgent** 进行设计，充分利用其以下特性：

1. **模块化组件**
   - 使用 LangChain 的 `Runnable` 接口构建处理流程
   - 将 Evaluator、PatchGenerator、TraceSkillMapper 实现为独立的 Chain
   - 通过 `pipe` 操作符组合复杂流程

2. **工具调用（Tool Calling）**
   - Evaluator 作为 Agent，可以调用工具获取额外上下文
   - 例如：查询历史 traces、读取相关 skills、获取项目结构等
   - 使用 `@langchain/core/tools` 定义工具

3. **记忆与上下文管理**
   - 使用 `BufferMemory` 或 `ConversationBufferMemory` 维护对话历史
   - 将优化历史作为 few-shot examples 提供给 LLM
   - 实现长期记忆存储在 SQLite 中

4. **结构化输出**
   - 使用 `StructuredOutputParser` 或 `zod` 定义输出 schema
   - 确保 LLM 返回可解析的结构化数据
   - 实现输出验证和重试机制

5. **多 Agent 协作**
   - Evaluator Agent：分析问题
   - Planner Agent：制定优化计划
   - Executor Agent：执行具体修改
   - Reviewer Agent：审查优化结果
   - 使用 `AgentExecutor` 管理多 Agent 协作

6. **可观测性**
   - 集成 LangSmith 进行 trace 追踪
   - 监控 LLM 调用成本、延迟、成功率
   - 记录每次优化的完整链路

**参考架构：**

```typescript
import { ChatOpenAI } from "@langchain/openai";
import { AgentExecutor, createOpenAIFunctionsAgent } from "langchain/agents";
import { RunnableSequence } from "@langchain/core/runnables";

// 定义 Evaluator Agent
const evaluatorAgent = await createOpenAIFunctionsAgent({
  llm: new ChatOpenAI({ modelName: "gpt-4" }),
  tools: [queryTracesTool, readSkillTool, getProjectContextTool],
  prompt: evaluatorPrompt,
});

// 定义 PatchGenerator Chain
const patchGeneratorChain = RunnableSequence.from([
  {
    skill: (input) => input.skillContent,
    analysis: (input) => input.evaluation,
  },
  patchGeneratorPrompt,
  new ChatOpenAI({ modelName: "gpt-4" }),
  new StringOutputParser(),
]);

// 组合完整流程
const optimizationWorkflow = RunnableSequence.from([
  {
    evaluation: (input) => evaluatorAgent.invoke(input),
    skillContent: (input) => input.skillContent,
  },
  {
    optimizedSkill: (input) => 
      input.evaluation.shouldOptimize 
        ? patchGeneratorChain.invoke(input)
        : input.skillContent,
    evaluation: (input) => input.evaluation,
  },
]);
```

**LLM Provider Adapter 方案**

**原则：复用 LangChain 生态，避免重复自研**

LangChain 已经提供了完善的 LLM Provider Adapter，支持 100+ 种模型，无需自行开发：

| Provider | Package | 类名 | 适用场景 |
|----------|---------|------|----------|
| OpenAI | `@langchain/openai` | `ChatOpenAI` | 通用任务，GPT-4/3.5 |
| Anthropic | `@langchain/anthropic` | `ChatAnthropic` | 长上下文，Claude 3 |
| Google | `@langchain/google-genai` | `ChatGoogleGenerativeAI` | Gemini 系列 |
| DeepSeek | `@langchain/deepseek` | `ChatDeepSeek` | 国产模型，性价比高 |
| Ollama | `@langchain/community` | `Ollama` | 本地部署，隐私敏感 |
| Azure | `@langchain/azure-openai` | `AzureChatOpenAI` | 企业合规 |
| Mistral | `@langchain/mistralai` | `ChatMistralAI` | 欧洲模型 |

**统一接口设计：**

```typescript
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatDeepSeek } from "@langchain/deepseek";
import { Ollama } from "@langchain/community/llms/ollama";

// 配置类型
interface LLMConfig {
  provider: "openai" | "anthropic" | "deepseek" | "ollama" | "mistral";
  modelName: string;
  temperature?: number;
  apiKey?: string;
  baseUrl?: string;
}

// Factory 模式创建 LLM 实例
export function createLLM(config: LLMConfig): BaseChatModel {
  const { provider, modelName, temperature = 0, apiKey, baseUrl } = config;
  
  switch (provider) {
    case "openai":
      return new ChatOpenAI({ modelName, temperature, apiKey });
    case "anthropic":
      return new ChatAnthropic({ modelName, temperature, apiKey });
    case "deepseek":
      return new ChatDeepSeek({ modelName, temperature, apiKey, baseUrl });
    case "ollama":
      return new Ollama({ model: modelName, baseUrl: baseUrl ?? "http://localhost:11434" });
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

// 使用示例
const llm = createLLM({
  provider: "deepseek",
  modelName: "deepseek-chat",
  temperature: 0.2,
  apiKey: process.env.DEEPSEEK_API_KEY,
});

// 所有 provider 统一调用方式
const result = await llm.invoke("分析以下 skill 的问题...");
```

**多模型策略实现：**

```typescript
// 根据任务复杂度选择模型
export class MultiModelStrategy {
  private cheapModel: BaseChatModel;   // 用于简单任务（如 DeepSeek-V3）
  private strongModel: BaseChatModel;  // 用于复杂任务（如 GPT-4）
  
  constructor(cheapConfig: LLMConfig, strongConfig: LLMConfig) {
    this.cheapModel = createLLM(cheapConfig);
    this.strongModel = createLLM(strongConfig);
  }
  
  // 根据任务类型选择模型
  selectModel(taskType: "evaluation" | "generation" | "review"): BaseChatModel {
    switch (taskType) {
      case "evaluation":
        return this.cheapModel;  // 评估任务相对简单
      case "generation":
        return this.strongModel; // 生成任务需要高质量
      case "review":
        return this.cheapModel;  // 审查任务可以用轻量模型
      default:
        return this.cheapModel;
    }
  }
}
```

**实施步骤（建议顺序）：**
1. [ ] 集成 LangChain 依赖和基础配置
2. [ ] 实现 LLM Provider Factory
3. [ ] 改造 Evaluator → AgentEvaluator（MVP 版本）
4. [ ] 改造 PatchGenerator → AgentPatchGenerator（MVP 版本）
5. [ ] 添加输出验证和错误处理
6. [ ] 集成 LangSmith 监控
7. [ ] 实现多 Agent 协作流程
8. [ ] 改造 TraceSkillMapper

**待决策：**
- [x] ~~自研 Provider Adapter~~ → **使用 LangChain 官方 Adapter**
- [ ] 确定默认 Provider 和 Model（推荐 DeepSeek 或 OpenAI）
- [ ] 设计多模型策略配置（简单/复杂任务路由）
- [ ] 设计 prompt 模板和版本管理
- [ ] 处理 LLM 调用成本和速率限制
- [ ] 实现 LLM 输出的验证和回滚机制
- [ ] 集成 LangSmith 进行可观测性监控
- [ ] 设计多 Agent 协作流程

---

## P1 - 高优先级（用户体验）

### 1. 自动同步机制

**为什么 P1：**
- 当前必须手动 `ornn skills sync`，违背"无感运行"设计目标
- 影响用户核心体验
- 依赖 P0 完成后才能发挥最大价值

**当前问题：**
- Shadow skills 在 `.ornn/skills/` 下自动优化
- 但 Agent 引用的是 `~/.skills/` 或 `~/.claude/skills/` 下的 origin skills
- 用户必须手动运行 `ornn skills sync <skill-id>` 才能将优化应用到 origin

**目标：**
实现真正的无感优化，Agent 能自动使用最新优化后的 skills，无需用户手动干预。

**可能的解决方案：**

1. **符号链接方案（推荐）**
   - 将 origin skill 文件替换为指向 shadow skill 的符号链接
   - Agent 读取时实际读取的是优化后的 shadow skill
   - 需要处理不同操作系统的符号链接权限问题

2. **路径拦截方案**
   - 通过环境变量或配置让 Agent 优先读取 `.ornn/skills/` 目录
   - 例如：修改 `CLAUDE_SKILL_PATH` 或类似的环境变量
   - 需要 Agent 支持自定义 skill 路径

3. **自动同步方案**
   - 当 shadow skill 优化达到一定置信度时，自动执行 sync
   - 可以配置为：
     - 每次优化后自动 sync（激进）
     - 达到某个 revision 阈值后 sync（保守）
     - 每天定时 sync（平衡）

4. **Hook 方案**
   - 在 Agent 启动前自动执行 sync
   - 需要集成到 Agent 的启动流程中

**待决策：**
- [ ] 选择哪种方案作为默认行为
- [ ] 是否提供配置选项让用户选择同步策略
- [ ] 如何处理同步冲突（shadow 和 origin 都被修改）

---

## P2 - 中优先级（基础功能）

### 2. ornn init 命令

**为什么 P2：**
- 项目初始化是必要功能
- 但当前已有临时解决方案（手动创建目录）
- 不阻塞核心功能使用

**任务清单：**
- [ ] 创建项目配置目录结构（`.ornn/skills/`, `.ornn/state/`, `.ornn/config/`）
- [ ] 创建全局配置文件 `~/.ornn/settings.toml`
- [ ] 初始化 SQLite 数据库
- [ ] 扫描并导入 origin skills
- [ ] 创建初始 shadow skills

---

## P3 - 低优先级（增强功能）

### 3. 其他 CLI 命令

**为什么 P3：**
- 增强功能，非核心路径
- 已有基础命令可用

**任务清单：**
- [x] `ornn skills sync <skill-id>` - 将 shadow skill 同步回 origin
- [ ] `ornn skills list` - 列出所有 skills（origin + shadow）
- [ ] `ornn skills show <skill-id>` - 显示 skill 详情
- [x] `ornn daemon start/stop/status` - 守护进程管理

---

## P4 - 维护优先级（后续迭代）

### Bug 修复
- [ ] 修复 TypeScript 严格模式下的类型问题
- [ ] 添加更完善的错误处理和日志

### 性能优化
- [ ] 优化 SQLite 查询性能（添加索引）
- [ ] 减少内存占用（大文件处理）
- [ ] 并行处理多个 skill 的评估

### 文档
- [ ] 完善 API 文档
- [ ] 添加架构图
- [ ] 编写贡献指南

---

## 实施路线图建议

```
Phase 1 (P0): Agent 框架迁移
├── Week 1-2: LangChain 集成 + LLM Factory
├── Week 3-4: AgentEvaluator 实现
├── Week 5-6: AgentPatchGenerator 实现
└── Week 7-8: 测试优化 + LangSmith 集成

Phase 2 (P1): 自动同步机制
├── Week 9: 方案选型 + 原型实现
└── Week 10: 完善 + 测试

Phase 3 (P2-P3): 基础功能完善
├── Week 11: ornn init 命令
└── Week 12: 其他 CLI 命令

Phase 4 (P4): 优化与文档
└── 持续迭代
```
