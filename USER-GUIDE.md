# OrnnSkills 用户使用指南

**版本**: 0.1.8  
**最后更新**: 2026-03-27

---

## 📖 目录

- [快速入门](#快速入门)
- [核心概念](#核心概念)
- [命令参考](#命令参考)
- [常见工作流](#常见工作流)
- [故障排除](#故障排除)
- [最佳实践](#最佳实践)

---

## 🚀 快速入门

### 5分钟快速上手

#### 1. 安装 OrnnSkills

```bash
npm install -g ornn-skills
```

#### 2. 初始化项目

在项目根目录运行初始化命令：

```bash
cd your-project
ornn init
```

初始化向导会引导你完成：

- 选择 LLM Provider (默认: deepseek)
- 选择模型 (默认: deepseek-reasoner)
- 输入 API Key

`ornn init` 还会把当前项目登记到全局项目注册表。后续 `ornn daemon start`/`ornn start` 会统一监控所有已登记项目，不需要在每个项目目录里重复启动守护进程。

#### 3. 启动后台守护进程

```bash
ornn daemon start
```

守护进程将自动：

- 加载所有已通过 `ornn init` 登记的项目
- 监听主 Agent (Codex/Claude Code) 的执行
- 采集 skill 调用轨迹
- 自动优化 shadow skills

#### 4. 查看状态

```bash
ornn skills status
```

---

## 🧠 核心概念

### Shadow Skill (影子技能)

OrnnSkills 为每个项目维护一份全局 skill 的"影子副本"。

```
~/.skills/code-review/          ← 全局原始 skill (不被修改)
  └── SKILL.md

your-project/.ornn/skills/      ← 项目级影子副本 (自动优化)
  └── code-review/
      ├── current.md           ← 当前生效版本
      └── journal.ndjson        ← 演化历史
```

**特点**：

- 每个项目独立的 shadow skill
- 不污染全局 skill
- 自动优化，持续改进

### Evolution Journal (演化日志)

记录每次优化的详细信息：

```json
{
  "revision": 12,
  "timestamp": "2026-03-27T10:30:00Z",
  "change_type": "append_context",
  "reason": "补充项目特定的错误处理上下文",
  "applied_by": "auto"
}
```

### Freeze/Unfreeze (冻结/解冻)

- **冻结**: 暂停自动优化，但 skill 仍可使用
- **解冻**: 恢复自动优化

---

## 📚 命令参考

### ornn init

初始化项目配置。

```bash
ornn init [options]

选项:
  --force    强制重新初始化（会保留已有数据）

示例:
  ornn init                    # 交互式初始化
  ornn init --force            # 强制重新初始化
```

说明:
初始化会创建 `.ornn/` 并将当前项目写入全局注册表

### ornn daemon

管理后台守护进程。

```bash
ornn daemon <subcommand>

子命令:
  start     启动全局守护进程（监控所有已登记项目）
  stop      停止守护进程
  status    查看守护进程状态

示例:
  ornn daemon start            # 启动全局守护进程
  ornn daemon stop             # 停止
  ornn daemon status           # 查看状态
```

### ornn skills status

查看 shadow skills 状态。

```bash
ornn skills status [options]

选项:
  -p, --project <path>    项目路径 (默认: 当前目录)
  -s, --skill <id>       查看特定 skill 详情

示例:
  ornn skills status              # 查看所有 skills
  ornn skills status -s code-review  # 查看特定 skill
```

**输出示例**：

```
Shadow Skills in /path/to/project:

Skill ID                Status      Revision  Last Optimized
─────────────────────────────────────────────────────────────────────
code-review             active      12        2026/3/27
git-workflow            frozen      5         2026/3/25

For detailed status of a specific skill:
  ornn skills status --skill <skill-id>
```

### ornn skills log

查看 skill 的演化历史。

```bash
ornn skills log <skill-id> [options]

选项:
  -n, --limit <number>      显示记录数 (默认: 20)
  -t, --type <type>         按类型过滤 (append_context, tighten_trigger, etc.)
  --since <date>            显示指定日期之后的记录
  --until <date>            显示指定日期之前的记录
  --search <keyword>        搜索原因字段
  --applied-by <source>     按来源过滤 (auto|manual)

示例:
  ornn skills log code-review                # 最近20条记录
  ornn skills log code-review -n 50         # 最近50条
  ornn skills log code-review -t add_fallback  # 只看 add_fallback 类型
  ornn skills log code-review --since 2026-03-01  # 3月以来的记录
```

**输出示例**：

```
📋 Evolution log for "code-review"
   Filters: type: append_context

🤖 rev_0012 - 2026/3/27 10:30:00
   Type: APPEND_CONTEXT
   Reason: 补充项目特定的错误处理上下文
   Sessions: 3

🤖 rev_0011 - 2026/3/26 15:20:00
   Type: TIGHTEN_TRIGGER
   Reason: 收紧触发条件，减少在小型PR中触发
   Sessions: 5

Showing 2 record(s)
```

### ornn skills rollback

回滚到指定版本。

```bash
ornn skills rollback <skill-id> [options]

选项:
  -t, --to <revision>    回滚到指定版本号
  -s, --snapshot         回滚到最新快照
  -i, --initial          回滚到初始版本
  -p, --project <path>   项目路径

示例:
  ornn skills rollback code-review --to 10    # 回滚到 rev_10
  ornn skills rollback code-review --snapshot  # 回滚到最新快照
  ornn skills rollback code-review --initial   # 回滚到初始版本
```

**⚠️ 重要提示**：

- 回滚操作不可逆，请谨慎执行
- 建议先使用 `ornn skills log` 查看历史
- 使用 `--snapshot` 更安全，因为它总是指向已验证的版本

### ornn skills freeze

暂停自动优化。

```bash
ornn skills freeze <skill-id> [options]

选项:
  -p, --project <path>    项目路径
  --all                   冻结所有 skills

示例:
  ornn skills freeze code-review     # 冻结单个 skill
  ornn skills freeze --all           # 冻结所有 skills
```

### ornn skills unfreeze

恢复自动优化。

```bash
ornn skills unfreeze <skill-id> [options]

选项:
  -p, --project <path>    项目路径
  --all                   解冻所有 skills

示例:
  ornn skills unfreeze code-review    # 解冻单个 skill
  ornn skills unfreeze --all          # 解冻所有 skills
```

### ornn skills diff

查看当前版本与 origin 的差异。

```bash
ornn skills diff <skill-id> [options]

选项:
  -f, --from <revision>    比较起始版本
  -t, --to <revision>      比较目标版本 (默认: 当前)
  -p, --project <path>     项目路径

示例:
  ornn skills diff code-review              # 当前 vs origin
  ornn skills diff code-review --from 5    # rev_5 vs 当前
  ornn skills diff code-review --from 5 --to 10  # rev_5 vs rev_10
```

### ornn skills sync

重新同步 origin skill。

```bash
ornn skills sync <skill-id> [options]

选项:
  -p, --project <path>    项目路径

示例:
  ornn skills sync code-review    # 重新同步
```

**适用场景**：

- 全局 skill 更新后，想获取新内容
- 与 origin 差异过大需要重新基准

### ornn logs

查看 OrnnSkills 日志（需要先查看 [故障排除](#故障排除) 了解日志位置）。

---

## 🔄 常见工作流

### 工作流1: 日常使用

```bash
# 1. 启动项目
cd my-project

# 2. 检查 daemon 状态
ornn daemon status

# 3. 如果没运行，启动它
ornn daemon start

# 4. 正常使用你的主 Agent (Codex/Claude)
# ... OrnnSkills 在后台自动运行 ...

# 5. 查看优化情况
ornn skills status
```

### 工作流2: 优化效果评估

```bash
# 1. 查看某个 skill 的演化历史
ornn skills log code-review

# 2. 查看具体变化
ornn skills diff code-review --from 5

# 3. 检查当前状态
ornn skills status -s code-review
```

### 工作流3: 回滚问题优化

```bash
# 1. 发现优化有问题，先冻结
ornn skills freeze code-review

# 2. 查看可用的快照
ornn skills rollback code-review

# 3. 回滚到上一个稳定的快照
ornn skills rollback code-review --snapshot

# 4. 或者回滚到指定版本
ornn skills rollback code-review --to 10

# 5. 如果确认没问题，可以解冻
ornn skills unfreeze code-review
```

### 工作流4: Origin 更新后同步

```bash
# 1. 更新全局 skill
# ... 在 ~/.skills/ 中更新 skill ...

# 2. 查看当前与 origin 的差异
ornn skills diff code-review

# 3. 如果确定要同步
ornn skills sync code-review

# 4. 查看同步后的状态
ornn skills status -s code-review
```

### 工作流5: 批量管理

```bash
# 1. 冻结所有 skills（发布前）
ornn skills freeze --all

# 2. 发布后解冻
ornn skills unfreeze --all

# 3. 查看所有 skills 状态
ornn skills status
```

---

## 🔧 故障排除

### 问题1: "daemon not running"

**错误信息**：

```
Error: .ornn directory not found
```

**解决方案**：

1. 运行 `ornn init` 初始化项目
2. 运行 `ornn daemon start` 启动全局守护进程

---

### 问题2: "Shadow skill not found"

**错误信息**：

```
Shadow skill "xxx" not found
```

**可能原因**：

1. Skill 尚未被主 Agent 使用过
2. Skill ID 拼写错误

**解决方案**：

```bash
# 1. 检查所有可用的 skills
ornn skills status

# 2. 确认 skill ID 拼写正确

# 3. 在主 Agent 中使用该 skill，OrnnSkills 会自动创建 shadow
```

---

### 问题3: "Permission denied"

**错误信息**：

```
Error: Permission denied
```

**解决方案**：

```bash
# 确保 .ornn 目录有正确的权限
chmod -R 755 .ornn/
```

---

### 问题4: 优化效果不如预期

**诊断步骤**：

```bash
# 1. 查看详细的演化日志
ornn skills log <skill-id> -n 50

# 2. 查看特定版本的变化
ornn skills diff <skill-id> --from <revision>

# 3. 检查是否被冻结
ornn skills status -s <skill-id>
```

**解决方案**：

1. 如果优化方向不对，使用 `rollback` 回滚
2. 使用 `freeze` 暂停自动优化
3. 手动编辑 `.ornn/skills/<skill-id>/current.md`

---

### 问题5: API Key 无效

**错误信息**：

```
Error: Invalid API key
```

**解决方案**：

1. 检查 `.env.local` 文件中的 API Key
2. 确认 API Key 有效且未过期
3. 重新运行 `ornn init` 更新配置

---

### 问题6: 想查看详细日志

**日志位置**：

- 全局日志: `~/.ornn/logs/`
- 项目日志: `.ornn/logs/` (如果配置了)

**查看错误日志**：

```bash
cat ~/.ornn/logs/error.log
tail -100 ~/.ornn/logs/error.log
```

**补充排查**：

- Dashboard 日志看板读取的是 `~/.ornn/logs/` 下最新的 `combined*.log` 文件。
- 如果 `combined.log` 已经轮转成 `combined1.log`、`combined2.log` 等，优先检查最新修改时间的文件，而不是只盯 `combined.log`。

---

## ✅ 最佳实践

### 1. 定期检查状态

建议每周运行一次 `ornn skills status`，确保优化正常进行。

### 2. 重要发布前冻结

在重要版本发布前，使用 `ornn skills freeze --all` 暂停所有优化，避免不可预期的变化。

### 3. 利用快照回滚

回滚时优先使用 `--snapshot` 选项，因为快照是经过验证的稳定版本。

### 4. 保持耐心

自动优化是一个持续的过程，效果可能需要几天甚至几周才能明显体现。系统会收集足够的证据后才进行优化，确保改动稳妥。

### 5. 定期备份

建议定期备份 `.ornn/` 目录，特别是 `skills/` 子目录。

```bash
# 备份
cp -r .ornn .ornn.backup-$(date +%Y%m%d)

# 恢复
cp -r .ornn.backup-20260327/* .ornn/
```

---

## 📞 获取帮助

- 查看 README: `cat README.md`
- 查看命令帮助: `ornn --help` 或 `ornn <command> --help`
- 查看设计文档: `cat docs/DESIGN.md`
- 查看问题追踪: [GitHub Issues]

---

**祝您使用愉快！🎉**
