# EVOSkills - Skill Evolution Agent

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)

EVOSkills 是一个后台常驻的元 Agent，它不会替代主 Agent 执行任务，而是持续观察主 Agent 的真实执行，并为每个项目维护一份来自全局 Skill 的影子副本（Shadow Skill），再基于 trace 对这份影子副本做小步、自动、可回滚的持续优化。

## 核心特性

- 🔍 **智能观察**: 从 Codex/OpenCode/Claude 等 Agent 采集执行 trace
- 🔄 **自动优化**: 基于真实执行数据自动优化 skill
- 📦 **影子副本**: 每个项目维护独立的 skill 副本，不污染全局
- 🔙 **可回滚**: 所有修改都有演化日志和 checkpoint，支持一键回滚
- 🚀 **无感运行**: 后台自动运行，无需手动干预

## 安装

```bash
npm install -g evo
```

## 快速开始

### 1. 初始化配置

```bash
evo init
```

### 2. 查看项目 shadow skills 状态

```bash
evo skills status
```

### 3. 查看某个 skill 的演化日志

```bash
evo skills log <skill-id>
```

### 4. 回滚到指定版本

```bash
evo skills rollback <skill-id> --to rev_8
```

### 5. 冻结/解冻自动优化

```bash
evo skills freeze <skill-id>
evo skills unfreeze <skill-id>
```

## 架构概览

```
Main Agent Runtime (Codex/OpenCode/Claude)
        ↓
    Observer Layer (Trace 采集)
        ↓
    Trace Store (NDJSON + SQLite)
        ↓
    Shadow Skill Manager
        ├─ Origin Registry (全局 skill 扫描)
        ├─ Shadow Registry (项目 skill 管理)
        ├─ Evolution Evaluator (优化评估)
        ├─ Patch Generator (补丁生成)
        └─ Journal Manager (演化日志)
        ↓
    Project Shadow Skills (.sea/skills/*)
```

## 项目结构

```
your-project/
└── .evo/
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
| `evo init` | 初始化配置 |
| `evo skills status` | 查看当前项目 shadow skills 状态 |
| `evo skills log <skill>` | 查看某个 skill 的演化日志 |
| `evo skills diff <skill>` | 查看当前内容与 origin 的 diff |
| `evo skills rollback <skill> --to <rev>` | 回滚到指定 revision |
| `evo skills freeze <skill>` | 暂停某个 skill 的自动优化 |
| `evo skills unfreeze <skill>` | 恢复自动优化 |
| `evo optimize <skill>` | 手动触发一次优化评估 |
| `evo skills rebase <skill>` | 重新同步 origin |

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

### 全局配置 (~/.evo/settings.toml)

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

### 项目配置 (.evo/config/settings.toml)

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

## 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 贡献

欢迎贡献！请阅读 [贡献指南](CONTRIBUTING.md) 了解详情。

## 支持

如有问题或建议，请提交 [Issue](https://github.com/ceasarXuu/EVOSkills/issues)