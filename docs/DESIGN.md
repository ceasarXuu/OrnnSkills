# Ornn Skills - 完整设计文档

**版本**: v2.0  
**更新日期**: 2026-03-24  
**状态**: 设计完成，准备开发

---

## 1. 项目概述

### 1.1 产品定位

Ornn Skills 是一个**项目级 Skill 自动优化系统**，通过监听 Codex/Claude Code 的执行 traces，利用 LLM 分析 Skill 的使用效果，并自动优化 Skill 内容。

### 1.2 核心特性

- **项目级隔离**: 每个项目独立的 `.ornn` 目录，不碰全局配置
- **按需启动**: 只有监听到 Skill 调用后才创建演化线程
- **版本管理**: 完整的 Skill 版本历史，支持回溯
- **多 Runtime 支持**: 同时支持 Codex 和 Claude Code

### 1.3 技术栈

| 层级 | 技术选型 |
|------|----------|
| **Agent 框架** | LangChain DeepAgent |
| **Provider 适配** | LiteLLM |
| **推荐模型** | deepseek-reasoner |
| **数据库** | SQLite |
| **CLI** | 简单日志输出（无 TUI） |

---

## 2. 架构设计

### 2.1 系统架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        Ornn Daemon                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐ │
│  │   Observer  │───►│   Router    │───►│ Skill Evolution     │ │
│  │             │    │  (LLM Agent)│    │ Thread (per skill)  │ │
│  └─────────────┘    └─────────────┘    └─────────────────────┘ │
│         │                  │                    │               │
│         │                  │                    ▼               │
│         │                  │           ┌─────────────────┐      │
│         │                  │           │  LLM Analyzer   │      │
│         │                  │           │  - Analyze      │      │
│         │                  │           │  - Optimize     │      │
│         │                  │           │  - Version      │      │
│         │                  │           └─────────────────┘      │
│         │                  │                    │               │
│         ▼                  ▼                    ▼               │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Storage Layer                         │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │   │
│  │  │  Journal    │  │   Skill     │  │    Config       │  │   │
│  │  │  (SQLite)   │  │  Versions   │  │   (TOML)        │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 目录结构

```
项目根目录/
├── .ornn/                          # Ornn 项目级数据
│   ├── config.toml                 # 项目配置（LLM、日志等）
│   ├── journal.db                  # SQLite 数据库
│   └── skills/                     # Skill 版本管理
│       └── {skill-id}/
│           ├── origin/             # 首次复制的 origin 备份
│           │   └── SKILL.md
│           └── versions/           # 历史版本
│               ├── v1/
│               │   ├── SKILL.md    # 版本内容（带版本头）
│               │   └── metadata.json
│               ├── v2/
│               └── latest -> v2/   # 软链接到最新版本
│
├── .codex/                         # Codex 配置（Ornn 不修改）
│   └── skills/
│       └── {skill-id}/
│           └── SKILL.md            # Ornn 部署的最新版本
│
└── .claude/                        # Claude 配置（Ornn 不修改）
    └── skills/
        └── {skill-id}/
            └── SKILL.md            # Ornn 部署的最新版本
```

### 2.3 数据流

```
1. Trace Detection
   ~/.codex/sessions/*.jsonl ──┐
                               ├──► Observer ──► Router
   ~/.claude/projects/*/*.jsonl─┘

2. Skill Routing (LLM Agent)
   Router 分析 trace 关联的 skills
   └──► 分配给对应的 Skill Evolution Thread

3. Evolution Trigger
   Skill Thread 积累 traces
   ├──► 10 轮对话触发
   └──► Skill 再次调用触发

4. LLM Analysis
   Analyzer 分析 traces + skill 原文
   └──► 生成优化建议

5. Version Management
   ├──► 创建新版本 v{N+1}
   ├──► 保存到 .ornn/skills/{skill}/versions/
   ├──► 更新 latest 软链接
   └──► 部署到 .codex/ 或 .claude/
```

---

## 3. 核心组件

### 3.1 Observer

**职责**: 监听 Codex/Claude 的 trace 文件

**监听路径**:
- Codex: `~/.codex/sessions/**/*/*.jsonl`（全局，需过滤）
- Claude: `~/.claude/projects/{project-name}/*.jsonl`（项目级）

**项目过滤**:
- Codex: 通过 `payload.cwd` 字段匹配当前项目
- Claude: 目录名匹配（`/Users/xuzhang/xxx` → `-Users-xuzhang-xxx`）

**约束**: 100% 保留原始数据，不做任何语义分析

### 3.2 Router (LLM Agent)

**职责**: 智能识别 trace 关联的 skills

**输入**: Trace + 会话上下文
**输出**: Skill ID 列表

**识别方式**:
1. **显式引用**: 格式匹配 `[$skill]` 或 `@skill`
2. **隐式关联**: LLM 分析上下文判断

**Prompt 核心**:
```markdown
判断这个 trace 与哪些 Skill 相关：
1. 显式引用了 Skill
2. 隐式关联（继续讨论之前 Skill 的话题）
3. 不相关

返回 JSON: ["skill-id-1", "skill-id-2"] 或 []
```

### 3.3 Skill Evolution Thread

**职责**: 管理单个 skill 的演化生命周期

**状态**:
```typescript
interface SkillEvolutionState {
  skillId: string;
  originPath: string;        // origin 来源
  runtime: 'codex' | 'claude';
  status: 'collecting' | 'analyzing';
  
  // 队列管理
  queue: Trace[];            // 未提交 traces
  submittedCount: number;    // 已提交计数
  invokeCount: number;       // skill 调用计数
  
  // 版本管理
  version: number;           // 当前版本
}
```

**触发条件**:
1. **轮数触发**: 累计 10 轮对话（5 用户 + 5 助手）
2. **再次调用触发**: Skill 被再次调用（invokeCount > submittedCount）

**版本管理**:
1. 首次调用时复制 origin 到 `.ornn/skills/{skill}/origin/`
2. 创建 v1（复制 origin）
3. 每次优化创建 v{N+1}
4. 更新 `latest` 软链接
5. 部署到 `.codex/` 或 `.claude/` 生效

### 3.4 LLM Analyzer

**职责**: 分析 traces 并生成优化建议

**输入**:
- Traces（10 轮或再次调用期间的所有 traces）
- Skill 原文（当前版本）
- Skill ID

**输出**:
```typescript
interface AnalysisResult {
  shouldOptimize: boolean;      // 是否需要优化
  reason: string;               // 优化原因
  modificationLocation: string; // 修改位置（如 ## Steps）
  suggestedContent: string;     // 建议的完整内容
  confidence: number;           // 置信度 0-1
}
```

**约束**:
- 只能修改已引用的 skills
- 不能建议新建 skills
- 必须具体到章节和行

**Prompt 核心**:
```markdown
## 严格约束
1. 只能修改已明确引用的 Skill
2. 绝对禁止建议新建 Skill
3. 所有建议必须具体到章节（如 ## Steps）
4. 提供修改后的 Markdown 内容

## 分析要求
1. 对比 Skill 原文和实际执行
2. 引用 Trace 中的具体证据
3. 指出 Skill 缺少什么导致执行效果不佳
```

---

## 4. 关键流程

### 4.1 首次启动流程

```bash
$ ornn

🚀 Ornn Skills - Skill Evolution System

First time setup:

? Select LLM Provider:
❯ deepseek
  openai
  anthropic

? Enter API Key: [hidden]

? Select Model:
❯ deepseek-reasoner
  deepseek-chat

✓ Configuration saved to .ornn/config.toml

[10:23:45] INFO: Connected to deepseek (deepseek-reasoner)
[10:23:45] INFO: Watching ~/.codex/sessions/
[10:23:45] INFO: Watching ~/.claude/projects/-Users-xuzhang-xxx/
[10:23:45] INFO: Ornn is running. Press Ctrl+C to stop.

Tracked Skills: 0 | Token Usage: 0 | Press Ctrl+C to stop
```

### 4.2 Skill 首次调用流程

```
[10:25:12] INFO: Detected skill call: code-review
[10:25:12] INFO: Copying origin from ~/.codex/skills/code-review
[10:25:12] INFO: Created backup at .ornn/skills/code-review/origin/
[10:25:12] INFO: Created v1 at .ornn/skills/code-review/versions/v1/
[10:25:12] INFO: Started tracking skill: code-review

Tracked Skills: 1 | Token Usage: 0 | Press Ctrl+C to stop
```

### 4.3 优化触发流程

**情况 1: 10 轮对话触发**
```
[10:35:30] INFO: code-review: 10 turns collected (5 user, 5 assistant)
[10:35:30] INFO: Analyzing code-review...
[10:35:32] INFO: Optimization suggested: steps too abstract
[10:35:32] INFO: Creating v2...
[10:35:32] INFO: Deployed to ~/.codex/skills/code-review/

Tracked Skills: 1 | Token Usage: 2,345 | Press Ctrl+C to stop
```

**情况 2: 再次调用触发**
```
[10:40:15] INFO: code-review: reinvoke detected
[10:40:15] INFO: Analyzing code-review...
[10:40:18] INFO: Optimization suggested: missing edge case handling
[10:40:18] INFO: Creating v3...
[10:40:18] INFO: Deployed to ~/.codex/skills/code-review/

Tracked Skills: 1 | Token Usage: 5,678 | Press Ctrl+C to stop
```

---

## 5. 数据模型

### 5.1 Skill 版本头格式

```markdown
<!-- Ornn Version: v3 -->
<!-- Origin: ~/.codex/skills/code-review -->
<!-- Runtime: codex -->
<!-- Project: /Users/xuzhang/OrnnSkills -->
<!-- Last Optimized: 2026-03-24T10:40:18Z -->
<!-- Optimization Reason: missing edge case handling -->

# Code Review Skill

...
```

### 5.2 Metadata 结构

```json
{
  "version": 3,
  "createdAt": "2026-03-24T10:40:18Z",
  "reason": "missing edge case handling",
  "traceIds": ["trace-1", "trace-2", "trace-3"],
  "previousVersion": 2,
  "analyzerModel": "deepseek-reasoner",
  "tokenUsage": {
    "prompt": 1500,
    "completion": 800,
    "total": 2300
  }
}
```

### 5.3 Config 结构

```toml
# .ornn/config.toml
[llm]
provider = "deepseek"
model_name = "deepseek-reasoner"
api_key = "sk-xxxxxxxx"

[ornn]
log_level = "info"
project_path = "/Users/xuzhang/OrnnSkills"

[tracking]
auto_optimize = true
user_confirm = false
```

---

## 6. 架构约束

### 6.1 核心约束

1. **项目级隔离**: Ornn 只管理当前项目，不碰全局配置
2. **按需启动**: 只有监听到 Skill 调用后才创建演化线程
3. **纯 LLM 方案**: 禁止使用关键词/规则引擎
4. **100% 保留**: Observer 层不做任何语义过滤
5. **只能修改**: Analyzer 只能修改已引用的 skills，不能新建

### 6.2 技术约束

1. **Skill 级别并行**: 不同 skills 可以同时分析
2. **Skill 内部串行**: 同一个 skill 同一时间只能有一个分析任务
3. **版本隔离**: 每次分析基于最新版本，已提交的不重复分析

---

## 7. 开发计划

### Phase 1: 基础设施 (Week 1)

- [ ] 项目初始化 (`ornn init`)
- [ ] 配置管理 (TOML + 交互式配置)
- [ ] LiteLLM 集成
- [ ] 日志系统

### Phase 2: Observer (Week 2)

- [ ] Codex Observer (全局监听 + cwd 过滤)
- [ ] Claude Observer (项目目录监听)
- [ ] Trace 解析器
- [ ] 文件监听 (chokidar)

### Phase 3: Router (Week 3)

- [ ] LLM Router Agent
- [ ] 显式引用提取
- [ ] 隐式关联识别
- [ ] Skill Evolution Thread 管理

### Phase 4: Skill Evolution (Week 4)

- [ ] Skill 首次调用处理
- [ ] Origin 备份
- [ ] 版本管理
- [ ] 部署到 runtime

### Phase 5: LLM Analyzer (Week 5)

- [ ] Analyzer Agent
- [ ] Prompt 工程
- [ ] 输出解析
- [ ] 版本创建

### Phase 6: 集成测试 (Week 6)

- [ ] 端到端测试
- [ ] 性能优化
- [ ] 文档完善

---

## 8. 参考文档

- [Session 存储调研](./SESSION-STORAGE-RESEARCH.md)
- [LiteLLM 集成调研](./LITELLM-RESEARCH.md)
- [Agent 迁移计划](./AGENT-MIGRATION-PLAN.md)
- [架构约束](./ARCHITECTURE_CONSTRAINTS.md)
- [测试报告](../test/TEST-REPORT.md)

---

**文档版本**: v2.0  
**最后更新**: 2026-03-24
