# EVO Skills 用户使用指南

## 什么是 EVO Skills？

EVO Skills 是一个后台运行的智能助手，它会自动观察你使用 AI Agent（比如 Codex、OpenCode、Claude）的过程，然后帮你优化你的 skill 文件。

简单来说：
- 你正常使用 AI Agent 干活
- EVO Skills 在后台默默观察
- 它发现你经常手动补充某些步骤，就会自动把这些步骤加到你的 skill 里
- 下次遇到类似情况，AI Agent 就能自动完成，不用你再手动补充了

---

## 安装

```bash
npm install -g evo-skills
```

---

## 快速开始

### 1. 查看当前项目有哪些 shadow skills

```bash
evo skills status
```

输出示例：
```
Shadow Skills in /path/to/project:

Skill ID                Status      Revision  Last Optimized
──────────────────────────────────────────────────────────────
coding-standards        active      3         2026-03-15
api-design              active      1         Never
testing                 frozen      5         2026-03-10
```

### 2. 查看某个 skill 的详细状态

```bash
evo skills status --skill coding-standards
```

输出示例：
```
Shadow Skill: coding-standards
Status: active
Current Revision: 3
Created: 2026-03-01T10:00:00Z
Last Optimized: 2026-03-15T14:30:00Z
Snapshots: 2

Recent Snapshots:
  rev_0001 - 2026-03-01T10:00:00Z
  rev_0003 - 2026-03-15T14:30:00Z
```

---

## 常用命令详解

### 查看演化日志

看看这个 skill 被自动优化了多少次，每次改了什么。

```bash
# 查看最近 20 条记录
evo skills log coding-standards

# 只看最近 5 条
evo skills log coding-standards --limit 5

# 只看"添加 fallback"类型的修改
evo skills log coding-standards --type add_fallback
```

输出示例：
```
Evolution log for "coding-standards":

🤖 rev_0003 - 2026/3/15 14:30:00
   Type: ADD_FALLBACK
   Reason: User manually supplemented "run linter" in 3 sessions after agent output
   Sessions: 3

👤 rev_0002 - 2026/3/10 09:15:00
   Type: PRUNE_NOISE
   Reason: Removed redundant section that was always skipped
   Sessions: 5

🤖 rev_0001 - 2026/3/5 16:45:00
   Type: APPEND_CONTEXT
   Reason: Added project-specific context for TypeScript projects
   Sessions: 2
```

说明：
- 🤖 表示自动优化
- 👤 表示手动修改
- Sessions 表示有多少个对话 session 参与了这次优化

---

### 查看 diff（对比差异）

看看当前的 shadow skill 和原始版本有什么不同。

```bash
# 与原始 origin skill 对比
evo skills diff coding-standards --origin

# 与某个历史版本对比
evo skills diff coding-standards --revision 1
```

输出示例：
```
Diff between origin and shadow for "coding-standards":

--- origin/coding-standards
+++ shadow/coding-standards
@@ -10,6 +10,10 @@
 ## Steps
 1. Write the code
 2. Run tests
+3. Run linter
+4. Check for type errors
+
+## Fallback
+- If linter fails, fix the issues and retry
```

---

### 回滚到之前的版本

如果某次自动优化改坏了，可以回滚到之前的版本。

```bash
# 先看看有哪些可用的版本
evo skills rollback coding-standards

# 回滚到第 2 个版本
evo skills rollback coding-standards --to 2

# 回滚到最新的快照
evo skills rollback coding-standards --snapshot

# 回滚到最初的版本（从 origin 复制过来的样子）
evo skills rollback coding-standards --initial
```

输出示例：
```
Available snapshots for "coding-standards":

  rev_0001 - 2026-03-01T10:00:00Z
  rev_0003 - 2026-03-15T14:30:00Z

Usage:
  sea skills rollback coding-standards --to <revision>
  sea skills rollback coding-standards --snapshot
  sea skills rollback coding-standards --initial
```

---

### 冻结/解冻自动优化

有时候你不想让某个 skill 被自动修改，可以冻结它。

```bash
# 冻结（暂停自动优化）
evo skills freeze coding-standards

# 解冻（恢复自动优化）
evo skills unfreeze coding-standards
```

冻结后：
- EVO Skills 不会再自动修改这个 skill
- 但你仍然可以在 AI Agent 中使用它
- 状态会显示为 `frozen`

---

## 工作原理

### Shadow Skill 是什么？

当你在一个项目中首次使用某个全局 skill 时，EVO Skills 会自动在这个项目里创建一个"影子副本"（shadow skill）。

```
全局 skill: ~/.skills/coding-standards.md
    ↓ 首次使用
项目 shadow: your-project/.evo/skills/coding-standards/current.md
```

之后，EVO Skills 会：
- 观察你在这个项目中如何使用这个 skill
- 基于观察到的模式自动优化 shadow skill
- 原始的全局 skill 不会被修改

### 自动优化的类型

EVO Skills 支持以下几种自动优化：

1. **add_fallback** - 添加 fallback 说明
   - 当你经常在 AI 输出后手动补充某个步骤时
   - 系统会自动把这个步骤加到 skill 里

2. **prune_noise** - 删除冗余内容
   - 当某个 section 经常被跳过时
   - 系统会自动删除它

3. **append_context** - 补充项目上下文
   - 当发现项目有特殊需求时
   - 系统会自动补充相关说明

4. **tighten_trigger** - 收紧触发条件
   - 当 skill 在不该触发的时候被触发时
   - 系统会自动调整触发条件

### 自动优化的限制

为了安全，自动优化有以下限制：

- 每个 skill 每天最多优化 3 次
- 两次优化之间至少间隔 24 小时
- 只允许小步修改，不会大幅重写
- 不会修改全局的 origin skill
- 所有修改都可以回滚

---

## 项目目录结构

使用 SEA Skills 后，你的项目会多出一个 `.sea` 目录：

```
your-project/
├── .evo/
│   ├── skills/
│   │   └── coding-standards/
│   │       ├── current.md      # 当前生效的 shadow skill
│   │       ├── meta.json       # 元数据
│   │       ├── journal.ndjson  # 演化日志
│   │       └── snapshots/      # 快照
│   │           ├── rev_0001.md
│   │           └── rev_0003.md
│   ├── state/
│   │   ├── sessions.db         # SQLite 数据库
│   │   └── traces.ndjson       # 执行轨迹
│   └── config/
│       └── settings.toml       # 项目配置（可选）
└── ...你的其他文件
```

---

## 配置

### 全局配置

配置文件位置：`~/.evo/settings.toml`

```toml
[origin_paths]
paths = ["~/.skills", "~/.claude/skills"]

[evaluator]
min_signal_count = 3        # 至少出现 3 次信号才触发优化
min_source_sessions = 2     # 至少来自 2 个不同的 session
min_confidence = 0.7        # 置信度至少 70%

[patch]
allowed_types = ["append_context", "add_fallback", "prune_noise"]
cooldown_hours = 24         # 两次优化间隔至少 24 小时
max_patches_per_day = 3     # 每天最多优化 3 次
```

### 项目配置

在项目的 `.evo/config/settings.toml` 中可以覆盖全局配置：

```toml
[project]
name = "my-project"
auto_optimize = true

[skills.coding-standards]
auto_optimize = false  # 冻结这个 skill

[skills.api-design]
allowed_patch_types = ["append_context"]  # 只允许补充上下文
```

---

## 常见问题

### Q: 我的 skill 被改坏了怎么办？

A: 使用回滚命令：

```bash
# 先看看有哪些版本
evo skills rollback <skill-id>

# 回滚到之前的好版本
evo skills rollback <skill-id> --to <revision>
```

### Q: 我不想让某个 skill 被自动修改

A: 冻结它：

```bash
evo skills freeze <skill-id>
```

### Q: 怎么看 SEA Skills 对我的 skill 做了什么？

A: 查看演化日志：

```bash
evo skills log <skill-id>
```

### Q: 自动优化太频繁了怎么办？

A: 修改配置文件 `~/.evo/settings.toml`：

```toml
[patch]
cooldown_hours = 48         # 增加冷却时间到 48 小时
max_patches_per_day = 1     # 每天最多优化 1 次
```

### Q: 我可以手动触发优化吗？

A: 目前只能通过 CLI 查看状态和回滚，自动优化是在后台进行的。如果需要手动优化，可以直接编辑 `.evo/skills/<skill-id>/current.md` 文件。

### Q: Shadow skill 和原始 skill 有什么关系？

A: Shadow skill 是从原始 skill 复制过来的，然后被自动优化。原始 skill 不会被修改。如果你想把 shadow skill 的优化同步回原始 skill，需要手动操作。

---

## 最佳实践

1. **先观察，再调整**
   - 让 SEA Skills 运行一段时间，观察它做了什么
   - 如果觉得优化合理，就保留
   - 如果觉得不合理，就回滚并冻结

2. **定期检查演化日志**
   - 每隔几天看看 `evo skills log`
   - 了解 SEA Skills 在做什么

3. **重要的 skill 考虑冻结**
   - 如果某个 skill 很重要，不希望被自动修改
   - 使用 `evo skills freeze` 冻结它

4. **利用项目配置**
   - 不同项目可能需要不同的优化策略
   - 在项目配置中覆盖全局配置

---

## 技术支持

如有问题或建议，请提交 Issue：
https://github.com/ceasarXuu/EVOSkills/issues

---

*最后更新：2026-03-20*