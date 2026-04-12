# Claude Code & OpenCode Trace 调研报告

## 概述

本报告记录了 Claude Code 和 OpenCode 两个 Agent 宿主的 trace/log 存储位置、格式和结构，用于指导 OrnnSkills 的 Observer 实现。

---

## 1. Claude Code

### 1.1 存储位置

Claude Code 在本地存储数据的多个位置：

| 文件类型 | 路径 | 格式 | 用途 |
|---------|------|------|------|
| **项目级会话** | `~/.claude/projects/{project-name}/{session-id}.jsonl` | JSONL | 按项目组织的完整会话记录 |
| **全局历史** | `~/.claude/history.jsonl` | JSONL | 所有会话的简要历史记录 |
| **调试日志** | `~/.claude/debug/{session-id}.txt` | 文本 | 调试日志，包含 API 调用、错误信息等 |
| **Skills** | `~/.claude/skills/{skill-name}/skill.md` | Markdown | 全局安装的 skills |
| **状态/配置** | `~/.claude/settings.json` | JSON | 用户设置和配置 |
| **统计缓存** | `~/.claude/stats-cache.json` | JSON | 使用统计和缓存数据 |

### 1.2 项目级会话文件结构

**路径格式**: `~/.claude/projects/{encoded-project-path}/{session-id}.jsonl`

**示例**:
- `~/.claude/projects/-Users-xuzhang-kuko/056fc47f-32b7-4274-a241-290a2991ca31.jsonl`

**文件数量**: 约 295 个 JSONL 文件分布在各个项目目录中

### 1.3 JSONL 事件格式

Claude Code 的 trace 文件使用 JSONL 格式，每行一个事件对象。主要事件类型：

#### 1.3.1 队列操作事件
```json
{
  "type": "queue-operation",
  "operation": "dequeue",
  "timestamp": "2026-01-31T12:47:46.202Z",
  "sessionId": "056fc47f-32b7-4274-a241-290a2991ca31"
}
```

#### 1.3.2 文件历史快照
```json
{
  "type": "file-history-snapshot",
  "messageId": "44a122c7-335a-4ddf-ba48-5c7f3bcda25d",
  "snapshot": {
    "messageId": "44a122c7-335a-4ddf-ba48-5c7f3bcda25d",
    "trackedFileBackups": {},
    "timestamp": "2026-01-31T12:47:46.214Z"
  },
  "isSnapshotUpdate": false
}
```

#### 1.3.3 用户输入事件
```json
{
  "parentUuid": null,
  "isSidechain": false,
  "userType": "external",
  "cwd": "/Users/xuzhang/kuko",
  "sessionId": "056fc47f-32b7-4274-a241-290a2991ca31",
  "version": "2.1.23",
  "gitBranch": "main",
  "type": "user",
  "message": {
    "role": "user",
    "content": "帮我分析一个 SaaS 产品的商业模式"
  },
  "uuid": "44a122c7-335a-4ddf-ba48-5c7f3bcda25d",
  "timestamp": "2026-01-31T12:47:46.214Z",
  "permissionMode": "bypassPermissions"
}
```

#### 1.3.4 助手输出事件
```json
{
  "parentUuid": "44a122c7-335a-4ddf-ba48-5c7f3bcda25d",
  "isSidechain": false,
  "userType": "external",
  "cwd": "/Users/xuzhang/kuko",
  "sessionId": "056fc47f-32b7-4274-a241-290a2991ca31",
  "version": "2.1.23",
  "gitBranch": "main",
  "type": "assistant",
  "uuid": "3716f432-c9a3-4cf8-ba8e-b69bf2a64235",
  "timestamp": "2026-01-31T12:47:52.031Z",
  "message": {
    "id": "c86fab1a-8e29-4e6b-8971-388be82de1b7",
    "container": null,
    "model": "<synthetic>",
    "role": "assistant",
    "stop_reason": "stop_sequence",
    "type": "message",
    "usage": {
      "input_tokens": 0,
      "output_tokens": 0,
      "cache_creation_input_tokens": 0,
      "cache_read_input_tokens": 0
    },
    "content": [
      {
        "type": "text",
        "text": "API Error: 401 {...}"
      }
    ]
  },
  "error": "authentication_failed",
  "isApiErrorMessage": true
}
```

#### 1.3.5 摘要事件
```json
{
  "type": "summary",
  "summary": "用户询问 SaaS 商业模式...",
  "leafUuid": "3716f432-c9a3-4cf8-ba8e-b69bf2a64235"
}
```

### 1.4 事件类型总结

| 事件类型 | 说明 | 是否保留 |
|---------|------|---------|
| `queue-operation` | 队列操作（dequeue/enqueue） | ❌ 过滤 |
| `file-history-snapshot` | 文件历史快照 | ❌ 过滤 |
| `user` | 用户输入 | ✅ 保留 |
| `assistant` | 助手输出 | ✅ 保留 |
| `summary` | 会话摘要 | ⚠️ 可选 |
| `tool_use` | 工具调用（推测存在） | ✅ 保留 |
| `tool_result` | 工具结果（推测存在） | ✅ 保留 |

### 1.5 Skill 存储结构

Claude Code 的 skills 存储在 `~/.claude/skills/{skill-name}/skill.md`：

```
~/.claude/skills/
├── business-opportunity-assessment/
│   └── skill.md
├── data-analysis/
│   └── skill.md
└── ...
```

**Skill 格式示例**:
```yaml
---
name: business-opportunity-assessment
description: 七维度"好生意"评估模型
---

# Business Opportunity Assessment

## 技能概述
...
```

### 1.6 与 Codex 的差异

| 特性 | Claude Code | Codex |
|------|-------------|-------|
| **存储位置** | `~/.claude/projects/{project}/` | `~/.codex/sessions/YYYY/MM/DD/` |
| **文件组织** | 按项目分组 | 按日期分组 |
| **事件类型** | `user`, `assistant`, `summary` | `session_meta`, `response_item`, `event_msg` |
| **项目信息** | 事件内嵌 `cwd`, `gitBranch` | `session_meta` 事件单独存储 |
| **Skill 路径** | `~/.claude/skills/{name}/skill.md` | `~/.codex/skills/{name}/` |

---

## 2. OpenCode

### 2.1 存储位置

OpenCode 采用分布式存储策略，数据分布在多个位置：

| 文件类型 | 路径 | 格式 | 用途 |
|---------|------|------|------|
| **全局配置** | `~/.config/opencode/opencode.json` | JSON | 全局配置（MCP、Providers 等） |
| **全局 Skills** | `~/.config/opencode/skills/{skill-name}/skill.md` | Markdown | 全局安装的 skills |
| **项目配置** | `{project}/.opencode/` | 目录 | 项目级配置和 agents |
| **项目 Agents** | `{project}/.opencode/agents/{agent-name}.md` | Markdown | 项目级 agents |

### 2.2 全局配置结构

**路径**: `~/.config/opencode/opencode.json`

```json
{
  "$schema": "https://opencode.ai/config.json",
  "share": "manual",
  "mcp": {
    "playwright": {
      "type": "local",
      "enabled": true,
      "command": ["npx", "-y", "@executeautomation/playwright-mcp-server"]
    },
    "github": {
      "type": "local",
      "enabled": true,
      "command": ["npx", "-y", "@modelcontextprotocol/server-github"],
      "environment": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_TOKEN}"
      }
    }
  }
}
```

### 2.3 项目级结构

**路径**: `{project}/.opencode/`

```
{project}/.opencode/
├── agents/                    # 项目级 agents
│   ├── accessibility-auditor.md
│   ├── ai-engineer.md
│   └── ...
├── node_modules/              # 依赖
├── package.json               # 项目配置
└── bun.lock                   # 锁文件
```

### 2.4 Agent/Skill 格式

OpenCode 的 agents 和 skills 使用相同的 Markdown 格式：

```yaml
---
name: Accessibility Auditor
description: Expert accessibility specialist...
mode: subagent
color: '#6B7280'
---

# Accessibility Auditor Agent Personality

You are **AccessibilityAuditor**, an expert accessibility specialist...
```

### 2.5 Trace/Log 存储

**重要发现**: OpenCode 默认不将 trace 持久化到本地文件系统。

通过调研发现：
1. **无本地 JSONL 文件**: 未找到类似 Codex/Claude 的 `.jsonl` trace 文件
2. **内部数据库存储**: Sessions 存储在内部数据库中，不在文件系统暴露
3. **导出功能**: 提供 `opencode export [sessionID]` 命令手动导出会话为 JSON
4. **Session 管理**: 提供 `opencode session` 子命令管理会话

**`opencode export` 命令详解**:

```bash
# 交互式导出（选择会话）
opencode export

# 直接导出指定 session
opencode export <session-id>
```

**导出流程**:
1. 执行命令后显示交互式会话列表（如果有多个会话）
2. 用户选择要导出的会话
3. 导出为 JSON 格式到 stdout

**示例会话列表**:
```
◆  Select session to export
│  ● Code Reviewer 高风险项审查项目整体代码 (3/23/2026, 7:28:42 AM • 43DKjj13)
│  ○ Review project for high-risk issues (@Code Reviewer subagent)
```

**获取 Trace 的方式**:
1. **手动导出**: `opencode export <session-id>` → 输出 JSON
2. **Plugin 事件**: 通过 Plugin API 实时捕获事件
3. **Server API**: 通过 `opencode serve` 启动的服务获取

**⚠️ 搁置说明**: 由于 OpenCode 需要特殊的获取方式（Plugin 开发），建议 **Phase 2** 再实现，优先完成 Codex 和 Claude Code 的支持。

### 2.6 与 Codex/Claude 的差异

| 特性 | OpenCode | Codex/Claude |
|------|----------|--------------|
| **Trace 存储** | 内存/数据库，不持久化到文件 | JSONL 文件 |
| **获取方式** | 手动导出 / Plugin / API | 直接读取文件 |
| **项目结构** | 分布式（全局 + 项目级） | 集中式 |
| **Agents** | 项目级 `.opencode/agents/` | 全局 skills |
| **配置** | JSON 配置文件 | 命令行参数为主 |

---

## 3. 预处理策略建议

### 3.1 Claude Code 预处理

**监听路径**: `~/.claude/projects/**/*.jsonl`

**保留的事件类型**:
- `user` - 提取 `message.content`, `cwd`, `gitBranch`
- `assistant` - 提取 `message.content`, `usage`, `error`
- `tool_use` / `tool_result` - 如有，提取工具调用信息

**过滤的事件类型**:
- `queue-operation` - 内部队列管理，无关
- `file-history-snapshot` - 文件备份信息，无关
- `summary` - 摘要信息，可选保留

**提取的字段**:
```typescript
interface PreprocessedClaudeTrace {
  sessionId: string;
  messageId: string;
  timestamp: string;
  type: 'user' | 'assistant' | 'tool_use' | 'tool_result';
  content: string;
  cwd: string;
  gitBranch?: string;
  error?: string;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}
```

### 3.2 OpenCode 预处理

由于 OpenCode 不持久化 trace 到文件，建议实现方式：

**方案 1: Plugin 方式（推荐）**
- 开发 OpenCode Plugin 实时捕获事件
- 通过 Plugin API 将事件发送到 OrnnSkills

**方案 2: 导出方式**
- 定期执行 `opencode export` 导出会话
- 解析导出的 JSON 数据

**方案 3: Server API 方式**
- 启动 `opencode serve` 获取 API 访问
- 通过 HTTP API 查询会话数据

---

## 4. 实现建议

### 4.1 ClaudeObserver 实现要点

1. **监听路径**: `~/.claude/projects/**/*.jsonl`
2. **项目识别**: 从文件路径提取项目名称（解码 URL encoding）
3. **事件解析**: 处理 `user`, `assistant` 等主要事件类型
4. **增量读取**: 支持文件追加时的增量处理
5. **Skill 引用**: 从消息内容中提取 skill 引用（格式待确认）

### 4.2 OpenCodeObserver 实现要点

1. **优先级**: Phase 2 实现，依赖 Plugin 开发
2. **架构**: 采用 Plugin 实时推送模式
3. **备选**: 支持手动导出文件的解析

### 4.3 统一 Trace 格式

无论来源是 Codex、Claude 还是 OpenCode，预处理后统一为：

```typescript
interface UnifiedTrace {
  trace_id: string;
  runtime: 'codex' | 'claude' | 'opencode';
  session_id: string;
  turn_id: string;
  event_type: 'user_input' | 'assistant_output' | 'tool_call' | 'tool_result' | 'status';
  timestamp: string;
  content: unknown;
  project_context?: {
    cwd: string;
    git_branch?: string;
  };
  skill_refs?: string[];
}
```

---

## 5. 附录

### 5.1 Claude Code 目录结构

```
~/.claude/
├── agents/                    # Agents 配置
├── cache/                     # 缓存数据
├── debug/                     # 调试日志（*.txt）
├── file-history/              # 文件历史
├── history.jsonl              # 全局历史记录
├── ide/                       # IDE 集成配置
├── paste-cache/               # 粘贴板缓存
├── plugins/                   # 插件
├── projects/                  # 项目级会话（重点）
│   ├── -Users-xuzhang-kuko/
│   │   ├── 056fc47f-... .jsonl
│   │   └── ...
│   └── ...
├── session-env/               # 会话环境
├── settings.json              # 用户设置
├── skills/                    # 全局 Skills（重点）
│   ├── business-opportunity-assessment/
│   │   └── skill.md
│   └── ...
├── stats-cache.json           # 统计缓存
├── tasks/                     # 任务数据
├── telemetry/                 # 遥测数据
├── todos/                     # Todo 数据
└── workflows/                 # 工作流
```

### 5.2 OpenCode 目录结构

```
~/.config/opencode/
├── agents/                    # 全局 Agents
├── opencode.json              # 全局配置
├── projects/                  # 项目索引
│   └── kuko/                  # 项目数据
├── skills/                    # 全局 Skills（重点）
│   ├── find-skills/
│   │   └── skill.md
│   └── ...
└── workflows/                 # 全局工作流

{project}/.opencode/
├── agents/                    # 项目级 Agents（重点）
│   ├── accessibility-auditor.md
│   └── ...
├── docs/                      # 项目文档
├── node_modules/              # 依赖
└── package.json               # 项目配置
```

---

## 6. 总结与优先级

### 6.1 三种 Runtime 对比

| Agent | Trace 位置 | 格式 | 获取难度 | 推荐方案 | 优先级 |
|-------|-----------|------|---------|---------|--------|
| **Codex** | `~/.codex/sessions/YYYY/MM/DD/*.jsonl` | JSONL | ⭐ 简单 | 文件监听 | **P0 - 已实现** |
| **Claude** | `~/.claude/projects/{project}/*.jsonl` | JSONL | ⭐ 简单 | 文件监听 | **P1 - 待实现** |
| **OpenCode** | 内存/数据库，需导出 | JSON | ⭐⭐⭐ 复杂 | Plugin/API | **P2 - 搁置** |

### 6.2 优先级说明

**P0 - Codex** ✅
- 已完成 CodexObserver 实现
- 监听 `~/.codex/sessions/**/*.jsonl`
- 已实现预处理层

**P1 - Claude Code** 📋
- 文件系统存储，易于监听
- 事件格式清晰（`user`, `assistant` 等）
- 约 295 个历史会话文件可供测试
- **下一步实现目标**

**P2 - OpenCode** ⏸️
- 需要 Plugin 开发或定期导出
- 实现复杂度较高
- 建议后续版本支持

### 6.3 下一步行动

1. **实现 ClaudeObserver** (当前优先级)
   - 监听 `~/.claude/projects/**/*.jsonl`
   - 处理 `user`, `assistant` 事件类型
   - 提取 `cwd`, `gitBranch` 等项目上下文

2. **统一预处理输出**
   - 确保 Codex 和 Claude 的输出格式一致
   - 统一为 `UnifiedTrace` 接口

3. **OpenCode 后续规划**
   - 调研 Plugin API 文档
   - 设计实时事件推送架构
   - Phase 2 实现
