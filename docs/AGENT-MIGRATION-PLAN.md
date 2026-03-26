# OrnnSkills Agent 架构迁移计划（已更新）

**更新日期**: 2026-03-23  
**更新内容**: 基于可行性测试验证，更新架构设计和实现细节

---

## 1. 概述

### 1.1 迁移目标

将 OrnnSkills 从**规则引擎架构**彻底迁移到**纯 LLM Agent 架构**。测试已验证：LLM 能够基于 trace + skill 原文给出具体的改进意见，无需规则引擎。

### 1.2 核心约束（已验证）

- **框架约束**: 必须使用 LangChain 生态
- **Agent 框架**: 基于 LangChain DeepAgent 架构
- **Provider 适配**: 使用 **LiteLLM** 作为 Provider Adapter
- **架构原则**: 纯 LLM 方案，完全替换规则引擎
- **关键验证**: 
  - ✅ LLM 能理解 trace 中的 skill 调用
  - ✅ LLM 能对比 skill 原文和实际执行
  - ✅ LLM 能给出具体到章节和行的修改方案

### 1.3 技术栈组合

| 层级 | 技术选型 | 职责 |
|------|----------|------|
| **Agent 框架** | LangChain DeepAgent | Agent 编排、Chain 组合 |
| **Provider Adapter** | LiteLLM | 统一调用 100+ LLM Provider |
| **模型选择** | deepseek-reasoner | 测试验证效果最佳 |
| **输出验证** | Zod | 结构化输出校验 |

### 1.4 测试验证结论

**测试场景**: 基于真实 trace + skill 原文的优化建议  
**测试结果**: 10/10 分 - 完全满足要求

| 能力 | 验证结果 |
|------|----------|
| 识别 skill 调用 | ✅ 能从 trace 中识别 `[$code-review]` |
| 对比分析 | ✅ 能对比 skill 原文和实际执行效果 |
| 问题诊断 | ✅ 能指出"步骤过于抽象"等具体问题 |
| 具体修改 | ✅ 能给出具体到 `## Steps` 章节的修改 |
| 无越界建议 | ✅ 不提议新建 skills，只修改已引用的 |

**关键发现**:
1. 必须提供 **skill 原文** + **trace 数据**，否则 LLM 无法准确评估
2. 必须明确约束 **只能修改已引用的 skills**，不能新建
3. **deepseek-reasoner** 效果优于 deepseek-chat，推理更细致

---

## 2. 架构设计

### 2.1 目标架构图

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           OrnnSkills Daemon                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐      │
│  │  Trace Observer │───►│  Journal Store  │───►│  Skill Analyzer │      │
│  │   (File Watch)  │    │   (SQLite)      │    │  (LLM-based)    │      │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘      │
│                                                         │                │
│                                                         ▼                │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    AgentExecutor (DeepAgent)                     │    │
│  │  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │    │
│  │  │  Evaluator  │───►│   Planner   │───►│   Executor  │         │    │
│  │  │  (LLM Agent)│    │  (LLM Agent)│    │  (LLM Agent)│         │    │
│  │  └─────────────┘    └─────────────┘    └─────────────┘         │    │
│  │         │                  │                  │                 │    │
│  │         └──────────────────┴──────────────────┘                 │    │
│  │                            │                                    │    │
│  │                            ▼                                    │    │
│  │                      ┌─────────────┐                            │    │
│  │                      │  Reviewer   │                            │    │
│  │                      │ (LLM Agent) │                            │    │
│  │                      └─────────────┘                            │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                │                                         │
│                                ▼                                         │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐      │
│  │ PatchGenerator  │───►│ Shadow Registry │───►│  Origin Sync    │      │
│  │   (LLM-based)   │    │   (Storage)     │    │   (Optional)    │      │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘      │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 关键组件设计

#### 2.2.1 Skill Analyzer（新增）

**职责**: 分析 trace 和 skill 原文，判断是否需要优化  
**输入**: 
- traces（包含 skill 调用记录）
- skill 原文（从 shadow registry 读取）
- 调用关系（哪个 trace 调用了哪个 skill）

**输出**: AnalysisResult
```typescript
interface AnalysisResult {
  skillId: string;              // 被分析的 skill
  shouldOptimize: boolean;      // 是否需要优化
  confidence: number;           // 置信度 0-1
  problemDescription: string;   // 问题描述
  modificationLocation: string; // 修改位置（如 ## Steps）
  suggestedContent: string;     // 建议的修改内容
  reasoning: string;            // 推理过程
}
```

**Prompt 设计要点**（已验证）:
```markdown
## 严格约束（必须遵守）

1. **只能修改已明确引用的 Skills**
   - 下面提供了本次 Trace 中明确引用的 Skill 原文
   - 你只能针对这些已存在的 Skill 给出修改意见
   - **绝对禁止**建议新建 Skill 或创建复合 Skill

2. **所有建议必须具体到 Skill 文档的章节和行**
   - 要指出：在 Skill 的哪个章节（如 ## Steps）添加/修改什么内容
   - 要提供：修改后的具体文本（Markdown 格式）

3. **基于证据的改进**
   - 必须引用 Trace 中的具体证据
   - 必须对比 Skill 原文和实际执行情况
```

#### 2.2.2 Evaluator Agent

**职责**: 深度分析 Skill Analyzer 的结果，制定优化策略  
**输入**: AnalysisResult + 历史优化记录  
**输出**: EvaluationResult（是否执行优化、优先级、风险评估）

**模型**: deepseek-reasoner（测试验证效果最佳）

#### 2.2.3 Executor Agent

**职责**: 执行具体的 skill 修改  
**输入**: EvaluationResult + skill 原文  
**输出**: 优化后的 skill 内容

**关键约束**:
- 只能修改 Analyzer 指出的位置
- 保持 skill 原有结构和风格
- 生成 diff 供用户确认

---

## 3. 数据流设计

### 3.1 核心数据流

```
Trace File → Observer → Journal Store → Skill Analyzer
                                              ↓
                                    ┌─────────────────┐
                                    │  加载相关 Skill 原文  │
                                    │  （从 Shadow Registry）│
                                    └─────────────────┘
                                              ↓
                                    ┌─────────────────┐
                                    │  LLM Analysis   │
                                    │  - 识别调用      │
                                    │  - 对比原文      │
                                    │  - 诊断问题      │
                                    │  - 给出修改      │
                                    └─────────────────┘
                                              ↓
                                    ┌─────────────────┐
                                    │  Evaluator      │
                                    │  - 评估优先级    │
                                    │  - 风险评估      │
                                    └─────────────────┘
                                              ↓
                                    ┌─────────────────┐
                                    │  Executor       │
                                    │  - 生成 Patch    │
                                    │  - 用户确认      │
                                    └─────────────────┘
```

### 3.2 关键数据结构

#### TraceSkillMapping（新增）
```typescript
interface TraceSkillMapping {
  traceId: string;           // trace 唯一标识
  sessionId: string;         // 会话 ID
  skillRefs: string[];       // trace 中引用的 skills
  timestamp: string;         // 时间戳
  status: 'pending' | 'analyzed' | 'optimized';
}
```

#### SkillAnalysisState（新增）
```typescript
interface SkillAnalysisState {
  skillId: string;           // skill 标识
  status: 'idle' | 'analyzing' | 'optimizing';  // 当前状态
  queue: Trace[];            // 待分析 traces（批量聚合）
  version: number;           // 当前版本号
  currentAnalysisId: string | null;  // 当前分析任务ID
  lastAnalyzedAt: string;    // 上次分析时间
}
```

### 3.3 并发控制设计

#### 核心原则
- **Skill 级别隔离**: 每个 skill 有独立的锁和队列
- **并行处理**: 不同 skills 可以同时分析（`code-review` 和 `test-writer` 并行）
- **串行约束**: 同一个 skill 同一时间只能有一个分析任务

#### 实现方案

```typescript
// src/core/analysis/skill-analysis-manager.ts
class SkillAnalysisManager {
  // skillId -> 状态（每个 skill 独立）
  private skillStates: Map<string, SkillAnalysisState> = new Map();

  /**
   * 添加 trace（skill 级别隔离）
   */
  async addTrace(skillId: string, trace: Trace): Promise<void> {
    // 获取或创建 skill 状态
    let state = this.skillStates.get(skillId);
    if (!state) {
      state = {
        skillId,
        status: 'idle',
        queue: [],
        version: 0,
        currentAnalysisId: null,
        lastAnalyzedAt: new Date().toISOString(),
      };
      this.skillStates.set(skillId, state);
    }

    // 添加到该 skill 的队列
    state.queue.push(trace);

    // 触发分析（如果空闲）
    if (state.status === 'idle') {
      this.triggerAnalysis(skillId);
    }
    // 如果正在分析，新 trace 会留在队列中，等当前分析完成后再次触发
  }

  /**
   * 触发分析（skill 级别）
   */
  private async triggerAnalysis(skillId: string): Promise<void> {
    const state = this.skillStates.get(skillId);
    if (!state || state.queue.length === 0) return;

    // 获取锁（将状态改为 analyzing）
    state.status = 'analyzing';
    state.currentAnalysisId = generateId();

    // 取出待分析的 traces（批量处理）
    const traces = [...state.queue];
    state.queue = []; // 清空队列

    try {
      // 执行分析
      await this.analyzeSkill(skillId, traces, state.version);
      
      // 分析完成，释放锁
      state.status = 'idle';
      state.currentAnalysisId = null;
      state.version += 1; // 版本号 +1
      state.lastAnalyzedAt = new Date().toISOString();

      // 检查是否有新 trace 到达
      if (state.queue.length > 0) {
        // 有新 trace，再次触发分析
        this.triggerAnalysis(skillId);
      }

    } catch (error) {
      // 发生错误，释放锁
      state.status = 'idle';
      state.currentAnalysisId = null;
      throw error;
    }
  }

  /**
   * 并行分析多个 skills
   */
  async analyzeMultipleSkills(skillIds: string[]): Promise<void> {
    // 不同 skills 并行执行
    await Promise.all(
      skillIds.map(skillId => this.triggerAnalysis(skillId))
    );
  }
}
```

#### 并发场景示例

```
时间线:
T1: code-review 被调用
    → 触发 code-review 分析（状态: analyzing）

T2: test-writer 被调用（并行）
    → 触发 test-writer 分析（状态: analyzing）
    → code-review 和 test-writer 同时分析，互不干扰

T3: code-review 再次被调用（排队）
    → code-review 正在分析中，新 trace 加入 queue
    → 等待第一次分析完成后，自动触发第二次分析

T4: git-commit 被调用（并行）
    → 触发 git-commit 分析
    → 现在有 3 个 skill 同时分析：code-review, test-writer, git-commit
```

#### 状态流转

```
Skill A (code-review):
idle → analyzing → idle → analyzing → idle
  ↑      ↑          ↑      ↑
 trace1 完成      trace2+3 完成

Skill B (test-writer):
idle → analyzing → idle
  ↑      ↑
 trace4 完成

Skill A 和 Skill B 完全并行，互不干扰
```

#### 设计决策

| 问题 | 决策 | 理由 |
|------|------|------|
| 锁的粒度 | Skill 级别 | 不同 skills 可以并行 |
| 批量策略 | 队列聚合 | 收集多个 traces 后批量分析 |
| 触发时机 | 空闲时立即触发 | 快速响应，同时避免并发冲突 |
| 版本管理 | 版本号递增 | 可追溯，防止冲突 |
```

#### SkillAnalysis（新增）
```typescript
interface SkillAnalysis {
  id: string;
  skillId: string;           // skill 标识
  traceIds: string[];        // 相关的 traces
  originalContent: string;   // 原始 skill 内容
  analysisResult: AnalysisResult;
  createdAt: string;
  status: 'pending' | 'approved' | 'rejected' | 'applied';
}
```

---

## 4. 技术实现

### 4.1 依赖引入

```json
{
  "dependencies": {
    "@langchain/core": "^0.3.x",
    "@langchain/community": "^0.3.x",
    "langchain": "^0.3.x",
    "litellm": "^1.0.x",
    "zod": "^3.23.x"
  }
}
```

### 4.2 LLM 配置（基于测试结果）

```typescript
// src/llm/config.ts
import { ChatLiteLLM } from "@langchain/community/chat_models/litellm";

export interface LLMConfig {
  provider: string;
  modelName: string;
  apiKey?: string;
  maxTokens?: number;
}

// 基于测试：deepseek-reasoner 效果最佳
export const DEFAULT_ANALYZER_CONFIG: LLMConfig = {
  provider: "deepseek",
  modelName: "deepseek-reasoner",  // 测试验证效果最佳
  maxTokens: 4000,
};

export function createAnalyzerLLM(config: LLMConfig = DEFAULT_ANALYZER_CONFIG) {
  return new ChatLiteLLM({
    model: `${config.provider}/${config.modelName}`,
    apiKey: config.apiKey,
    maxTokens: config.maxTokens,
  });
}
```

### 4.3 Skill Analyzer 实现（核心）

```typescript
// src/agents/skill-analyzer/index.ts
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { z } from "zod";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { Trace } from "../../types/index.js";

// 输出 Schema
const AnalysisResultSchema = z.object({
  skillId: z.string(),
  shouldOptimize: z.boolean(),
  confidence: z.number().min(0).max(1),
  problemDescription: z.string(),
  modificationLocation: z.string(),  // 如 "## Steps"
  suggestedContent: z.string(),      // 修改后的内容
  reasoning: z.string(),
});

export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;

// Prompt 模板（已验证有效）
const analyzerPrompt = ChatPromptTemplate.fromMessages([
  ["system", `你是 Skill 优化助手。请分析 Trace 和 Skill 原文，给出改进意见。

## 严格约束
1. 只能修改已明确引用的 Skill
2. 所有建议必须具体到章节（如 ## Steps）
3. 提供修改后的 Markdown 内容
4. 绝对禁止建议新建 Skill

## 分析要求
1. 对比 Skill 原文和实际执行
2. 引用 Trace 中的具体证据
3. 指出 Skill 缺少什么导致执行效果不佳
4. 给出可执行的修改方案`],
  ["human", `## Trace 数据
{traceData}

## Skill 原文
{skillContent}

请分析并给出改进意见：`],
]);

/**
 * 创建 Skill Analyzer
 */
export function createSkillAnalyzer(llm: BaseChatModel) {
  return async (
    traces: Trace[],
    skillContent: string,
    skillId: string
  ): Promise<AnalysisResult> => {
    const chain = analyzerPrompt.pipe(llm);
    
    const response = await chain.invoke({
      traceData: JSON.stringify(traces, null, 2),
      skillContent,
    });
    
    // 解析并验证输出
    const content = response.content.toString();
    // 提取 JSON 部分并解析
    const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || 
                      content.match(/{[\s\S]*}/);
    
    if (!jsonMatch) {
      throw new Error("Failed to extract JSON from LLM response");
    }
    
    return AnalysisResultSchema.parse(JSON.parse(jsonMatch[1] || jsonMatch[0]));
  };
}
```

---

## 5. 迁移步骤（更新）

### Phase 1: 基础设施（Week 1）

```
Day 1-2: 引入依赖
  - npm install @langchain/core @langchain/community langchain litellm zod
  
Day 3-4: 实现 LLM Factory
  - src/llm/config.ts
  - 支持 deepseek-reasoner（测试验证）
  
Day 5: 配置管理
  - 支持从 settings.toml 读取 LLM 配置
  - 默认配置指向 deepseek-reasoner
```

### Phase 2: Skill Analyzer（Week 2-3）

```
Week 2:
  Day 1-2: 实现 Skill Analyzer
    - 基于测试验证的 Prompt
    - 输出 Schema 验证
    
  Day 3-4: 集成到数据流
    - Observer → Journal Store → Skill Analyzer
    - 加载相关 Skill 原文
    
  Day 5: 测试验证
    - 使用测试 fixtures 验证
    - 确保输出符合预期

Week 3:
  Day 1-2: 实现 Trace-Skill 关联
    - TraceSkillMapping 表
    - 自动提取 trace 中的 skill 引用
    
  Day 3-4: 批量分析支持
    - 支持分析多个 traces
    - 聚合分析结果
    
  Day 5: Prompt 优化
    - 根据测试结果调优
```

### Phase 3: Evaluator + Executor（Week 4-5）

```
Week 4:
  Day 1-2: Evaluator Agent
    - 评估 Analyzer 结果
    - 优先级排序
    
  Day 3-4: Executor Agent
    - 生成具体 Patch
    - Diff 计算
    
  Day 5: 集成测试

Week 5:
  Day 1-2: 用户确认流程
    - 展示修改建议
    - 用户确认/拒绝
    
  Day 3-4: Shadow Registry 更新
    - 应用优化后的 skill
    - 版本管理
    
  Day 5: 端到端测试
```

### Phase 4: 工作流编排（Week 6）

```
Day 1-2: AgentExecutor 编排
  - Evaluator → Planner → Executor → Reviewer
  
Day 3-4: 异步处理
  - 后台分析任务
  - 结果通知
  
Day 5: 性能优化
  - 并发控制
  - 缓存策略
```

---

## 6. 测试策略（基于验证经验）

### 6.1 单元测试

```typescript
// test/agents/skill-analyzer.test.ts
describe('SkillAnalyzer', () => {
  it('should identify skill calls from trace', async () => {
    const trace = loadFixture('codex/success-scenario.jsonl');
    const skillContent = loadFixture('skills/code-review/SKILL.md');
    
    const result = await analyzer([trace], skillContent, 'code-review');
    
    expect(result.skillId).toBe('code-review');
    expect(result.confidence).toBeGreaterThan(0.7);
  });
  
  it('should not suggest creating new skills', async () => {
    const result = await analyzer(traces, skillContent, 'code-review');
    
    expect(result.suggestedContent).not.toMatch(/新建|创建.*skill/i);
  });
  
  it('should provide specific modification location', async () => {
    const result = await analyzer(traces, skillContent, 'code-review');
    
    expect(result.modificationLocation).toMatch(/^##\s/);
  });
});
```

### 6.2 集成测试

```typescript
// test/integration/analysis-pipeline.test.ts
describe('Analysis Pipeline', () => {
  it('should complete full analysis workflow', async () => {
    // 1. Observer 检测到 trace
    // 2. 提取 skill 引用
    // 3. 加载 skill 原文
    // 4. LLM 分析
    // 5. 验证输出格式
  });
});
```

---

## 7. 配置示例

### 7.1 最小配置（推荐）

```toml
[llm]
provider = "deepseek"
model_name = "deepseek-reasoner"
api_key = "sk-xxxxxxxxxxxxxxxx"
max_tokens = 4000

[agent]
max_iterations = 3
timeout_ms = 60000
```

### 7.2 多模型配置（高级）

```toml
[llm.models.analyzer]
provider = "deepseek"
model_name = "deepseek-reasoner"  # 分析用强模型

[llm.models.executor]
provider = "deepseek"
model_name = "deepseek-chat"      # 执行用轻量模型
```

---

## 8. 成功指标（更新）

| 指标 | 当前值 | 目标值 | 测量方式 |
|------|--------|--------|----------|
| 分析准确率 | - | 85%+ | 人工标注对比 |
| 修改可执行率 | - | 90%+ | 生成的修改能直接应用 |
| 无越界建议率 | - | 95%+ | 不提议新建 skills |
| 平均分析时间 | - | <10s | 单条 trace 分析耗时 |
| 用户接受率 | - | 70%+ | 用户确认的优化比例 |

---

## 9. 附录

### 9.1 测试验证记录

**测试日期**: 2026-03-23  
**测试模型**: deepseek-reasoner  
**测试场景**: code-review skill 优化  
**测试结果**: 10/10 分

**关键发现**:
1. 必须同时提供 trace + skill 原文
2. 必须约束只能修改已引用的 skills
3. deepseek-reasoner 推理能力显著优于 chat 版本

### 9.2 参考文档

- [测试报告 V2](../test/LLM-SKILL-ANALYSIS-REPORT-V2.md)
- [架构约束](../docs/ARCHITECTURE_CONSTRAINTS.md)
- [LangChain JS](https://js.langchain.com/)
- [LiteLLM](https://docs.litellm.ai/)
