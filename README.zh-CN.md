# OrnnSkills - Skill Evolution Agent

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)

[English](README.md) | [中文](README.zh-CN.md)

OrnnSkills 是一个后台常驻的元 Agent，它不会替代主 Agent 执行任务，而是持续观察主 Agent 的真实执行，并为每个项目维护一份来自全局 Skill 的影子副本（Shadow Skill），再基于 trace 对这份影子副本做小步、自动、可回滚的持续优化。

## 核心特性

- 🔍 **智能观察**: 从 Codex/OpenCode/Claude 等 Agent 采集执行 trace
- 🎯 **精准映射**: 智能将 trace 映射到对应的 skill，支持 6 种映射策略
- 🔄 **自动优化**: 基于真实执行数据自动优化 skill
- 📦 **影子副本**: 每个项目维护独立的 skill 副本，不污染全局
- 🔙 **可回滚**: 所有修改都有演化日志和 checkpoint，支持一键回滚
- 🚀 **无感运行**: 后台自动运行，无需手动干预

## 安装

```bash
npm install -g ornn-skills
```

## 快速开始

### 1. 初始化配置

```bash
ornn init
```

### 2. 查看项目 shadow skills 状态

```bash
ornn skills status
```

### 3. 查看某个 skill 的演化日志

```bash
ornn skills log <skill-id>
```

### 4. 回滚到指定版本

```bash
ornn skills rollback <skill-id> --to rev_8
```

### 5. 冻结/解冻自动优化

```bash
ornn skills freeze <skill-id>
ornn skills unfreeze <skill-id>
```

## 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                     Main Agent Runtime                       │
│                  (Codex/OpenCode/Claude)                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    TraceSkillObserver                        │
│  - 监听 trace 事件                                            │
│  - 实时映射 trace 到 skill                                    │
│  - 按 skill 聚合 traces                                      │
│  - 触发评估回调                                               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    TraceSkillMapper                          │
│  - 6 种映射策略                                               │
│  - 路径提取                                                   │
│  - 语义推断                                                   │
│  - 置信度计算                                                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  OptimizationPipeline                        │
│  - 获取按 skill 分组的 traces                                 │
│  - 调用 Evaluator 评估                                        │
│  - 生成优化任务                                               │
│  - 触发 Patch Generator                                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                Shadow Skill Manager                          │
│  ├─ Origin Registry (全局 skill 扫描)                         │
│  ├─ Shadow Registry (项目 skill 管理)                        │
│  ├─ Evolution Evaluator (优化评估)                            │
│  ├─ Patch Generator (补丁生成)                                │
│  └─ Journal Manager (演化日志)                                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    Project Shadow Skills (.ornn/skills/*)
```

### Trace-Skill 映射

系统使用 6 种策略将 trace 映射到对应的 skill：

| 策略 | 触发条件 | 置信度 | 说明 |
|------|----------|--------|------|
| 策略1 | `tool_call` 读取 skill 文件 | 0.95 | 最可靠的映射方式 |
| 策略2 | `tool_call` 执行 skill 相关操作 | 0.85 | 从工具参数推断 |
| 策略3 | `file_change` 修改 skill 文件 | 0.9 | 文件变化明确指向 skill |
| 策略4 | `metadata` 包含 skill_id | 0.98 | 显式的 skill 标识 |
| 策略5 | `assistant_output` 引用 skill | 0.6 | 从输出内容推断 |
| 策略6 | `user_input` 请求 skill | 0.5 | 从用户输入推断 |

### 自动优化闭环

系统实现了完整的自动优化闭环：

1. **Trace 采集**: 从 Agent 运行时采集执行 trace
2. **Trace-Skill 映射**: 将 trace 智能映射到对应的 skill
3. **评估**: 分析 trace 模式，识别优化机会
4. **生成任务**: 创建优化任务
5. **执行优化**: 应用补丁到 shadow skill
6. **记录日志**: 保存演化历史和快照

### 配置

#### Trace-Skill 映射配置

```toml
[mapper]
min_confidence = 0.5  # 最低置信度阈值
persist_mappings = true  # 是否保存映射关系到数据库

[observer]
buffer_size = 10  # 缓冲区大小
flush_interval = 5000  # 定时刷新间隔（毫秒）

[pipeline]
auto_optimize = true  # 是否启用自动优化
min_confidence = 0.7  # 优化任务的最低置信度
```

## 项目结构

```
your-project/
└── .ornn/
    ├── skills/
    │   └── <skill-id>/
    │       ├── current.md      # 当前 shadow skill 内容
    │       ├── meta.json       # 元数据
    │       ├── journal.ndjson  # 演化日志
    │       └── snapshots/      # 快照
    │           ├── rev_0005.md
    │           └── rev_0010.md
    ├── state/
    │   ├── sessions.db         # SQLite 数据库
    │   ├── traces.ndjson       # 原始 trace
    │   └── runtime_state.json  # 运行时状态
    └── config/
        └── settings.toml       # 项目配置
```

## CLI 命令

| 命令 | 描述 |
|------|------|
| `ornn init` | 初始化配置 |
| `ornn skills status` | 查看当前项目 shadow skills 状态 |
| `ornn skills log <skill>` | 查看某个 skill 的演化日志 |
| `ornn skills diff <skill>` | 查看当前内容与 origin 的 diff |
| `ornn skills rollback <skill> --to <rev>` | 回滚到指定 revision |
| `ornn skills freeze <skill>` | 暂停某个 skill 的自动优化 |
| `ornn skills unfreeze <skill>` | 恢复自动优化 |
| `ornn optimize <skill>` | 手动触发一次优化评估 |
| `ornn skills rebase <skill>` | 重新同步 origin |

## 自动优化策略

系统会自动执行以下类型的优化：

- ✅ **append_context**: 补充项目特定上下文
- ✅ **tighten_trigger**: 收紧适用条件
- ✅ **add_fallback**: 补写高频 fallback
- ✅ **prune_noise**: 删除低价值噪音描述

以下操作默认不自动执行：

- ❌ 大段重写整个 skill
- ❌ 删除大量核心步骤
- ❌ 改变 skill 的总体目标
- ❌ 回写到全局 origin

## 配置

### 全局配置 (~/.ornn/settings.toml)

```toml
[origin_paths]
paths = ["~/.skills", "~/.claude/skills"]

[observer]
enabled_runtimes = ["codex", "opencode", "claude"]
trace_retention_days = 30

[evaluator]
min_signal_count = 3
min_source_sessions = 2
min_confidence = 0.7

[patch]
allowed_types = ["append_context", "tighten_trigger", "add_fallback", "prune_noise"]
cooldown_hours = 24
max_patches_per_day = 3

[journal]
snapshot_interval = 5
max_snapshots = 20

[daemon]
auto_start = true
log_level = "info"
```

### 项目配置 (.ornn/config/settings.toml)

```toml
[project]
name = "my-project"
auto_optimize = true

[skills]
# 特定 skill 的配置覆盖
[skills.my-skill]
auto_optimize = false  # 冻结此 skill
```

## 开发

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

### 构建

```bash
npm run build
```

### 测试

```bash
npm test
```

### 代码检查

```bash
npm run lint
npm run format
```

## 技术栈

- **TypeScript**: 类型安全的 JavaScript
- **Node.js**: 运行时环境
- **Commander.js**: CLI 框架
- **SQLite**: 本地数据库
- **Winston**: 日志系统
- **Vitest**: 测试框架

## 文档

- [PRD - 产品需求文档](docs/PRD.md)
- [工程计划](docs/ENGINEERING_PLAN.md)
- [Trace-Skill 映射功能文档](docs/TRACE-SKILL-MAPPING.md)
- [用户使用指南](USER-GUIDE.md)

## 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 贡献

欢迎贡献！请阅读 [贡献指南](CONTRIBUTING.md) 了解详情。
