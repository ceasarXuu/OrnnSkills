# Codex Trace 真实结构调研报告

## 调研日期
2026-03-23

## 调研目标
验证 Codex 本地 trace 文件的真实位置和格式，为 OrnnSkills Observer 层提供准确的数据源设计依据。

## 1. Trace 文件位置

Codex 在本地存储 traces 的多个位置：

| 文件类型 | 路径 | 格式 | 用途 |
|---------|------|------|------|
| **活跃会话** | `~/.codex/sessions/YYYY/MM/DD/*.jsonl` | JSONL | 活跃会话记录，按日期组织 |
| **归档会话** | `~/.codex/archived_sessions/*.jsonl` | JSONL | 用户手动归档的会话 |
| **会话索引** | `~/.codex/session_index.jsonl` | JSONL | 会话元数据索引（ID、名称、更新时间） |
| **历史记录** | `~/.codex/history.jsonl` | JSONL | 简化的历史查询记录 |
| **SQLite 日志** | `~/.codex/logs_1.sqlite` | SQLite | 结构化日志数据 |

### ⚠️ 重要发现

**`archived_sessions` 不是主要数据源！**

- `sessions/` 目录包含 73 个活跃会话文件
- `archived_sessions/` 目录只包含 16 个用户手动归档的会话
- 用户需要手动执行归档操作，会话才会进入 `archived_sessions`

### 活跃会话目录结构
```
~/.codex/sessions/
├── 2026/
│   ├── 01/          # 1月会话
│   ├── 02/          # 2月会话
│   └── 03/          # 3月会话
│       ├── 02/
│       ├── 03/
│       ├── 04/
│       ├── 05/
│       └── 08/
```

### 归档会话文件命名格式
```
rollout-{ISO日期}T{时间}-{UUID}.jsonl

示例：
rollout-2026-03-18T01-30-56-019cfcd9-c52d-7270-a188-017d7172715e.jsonl
```

## 2. Trace 事件类型结构

每个 `.jsonl` 文件包含多个 JSON 对象，每行一个事件：

### 2.1 session_meta（会话元数据）
```json
{
  "timestamp": "2026-03-17T17:30:57.538Z",
  "type": "session_meta",
  "payload": {
    "id": "019cfcd9-c52d-7270-a188-017d7172715e",
    "timestamp": "2026-03-17T17:30:57.538Z",
    "cwd": "/Users/xuzhang/Sub",
    "originator": "user",
    "cli_version": "0.115.0-alpha.27",
    "source": "codex",
    "model_provider": "openai",
    "base_instructions": "...",  // 系统指令（可能在归档文件中为空）
    "dynamic_tools": [...],      // 动态工具列表
    "git": {
      "branch": "main",
      "remote": "origin"
    }
  }
}
```

**关键字段**：
- `cwd`: 工作目录，用于关联项目
- `git.branch`: Git 分支信息
- `base_instructions`: 系统指令，包含 skills 使用说明

### 2.2 event_msg（事件消息）
```json
{
  "timestamp": "2026-03-17T17:30:57.545Z",
  "type": "event_msg",
  "payload": {
    "type": "turn_started" | "token_count" | "agent_reasoning" | ...,
    "turn_id": "...",
    "model_context_window": 258400,
    "collaboration_mode_kind": "..."
  }
}
```

**子类型**：
- `turn_started`: 新回合开始
- `token_count`: Token 使用统计
- `agent_reasoning`: Agent 推理过程（内容加密）
- `rate_limits`: 速率限制信息

### 2.3 response_item（响应项）
```json
{
  "timestamp": "2026-03-17T17:30:57.546Z",
  "type": "response_item",
  "payload": {
    "type": "message" | "function_call" | "function_call_output" | "reasoning",
    "role": "user" | "assistant" | "system",
    "content": [...],
    "name": "exec_command",  // function_call 时
    "arguments": {...},      // function_call 时
    "call_id": "..."
  }
}
```

**关键子类型**：
- `message`: 对话消息（user/assistant）
- `function_call`: 工具调用
- `function_call_output`: 工具调用结果
- `reasoning`: 推理过程（可能加密）

### 2.4 turn_context（回合上下文）
```json
{
  "timestamp": "2026-03-17T17:30:57.547Z",
  "type": "turn_context",
  "payload": {
    "turn_id": "...",
    "context": {...}
  }
}
```

## 3. Skills 引用发现

### 3.1 Skill 引用格式
Codex 在 trace 中使用以下格式引用 skills：

```
[$skillname]

示例：
[$checks]
[$skill-creator]
```

### 3.2 Skills 目录结构
```
~/.codex/skills/
├── .system/                    # 系统 skills
│   ├── skill-creator/
│   │   ├── SKILL.md           # 必需
│   │   └── references/
│   └── openai-docs/
├── find-skills -> ../../.agents/skills/find-skills  # 用户 skills（符号链接）
├── frontend-design -> ../../.agents/skills/frontend-design
└── ...
```

### 3.3 Skill 文件格式
每个 skill 包含：
- **SKILL.md**: 必需，包含 YAML frontmatter 和 Markdown 指令
- **agents/openai.yaml**: UI 元数据（可选）
- **references/**: 参考文档（可选）
- **scripts/**: 可执行脚本（可选）

## 4. Trace 到 Skill 的映射策略

### 4.1 显式引用映射
**信号**：`[$skillname]` 格式的文本引用

**检测方法**：
```typescript
const skillMatches = eventStr.match(/\[\$([^\]]+)\]/g);
```

**可靠性**：高，这是 Codex 显式引用 skill 的方式

### 4.2 工具调用模式映射
**信号**：特定工具调用与 skill 的关联

**常见工具**：
- `exec_command`: 执行命令
- `write_stdin`: 写入标准输入
- `update_plan`: 更新计划

**策略**：通过工具调用频率和参数推断 skill 使用

### 4.3 上下文映射
**信号**：会话元数据中的项目信息

**字段**：
- `cwd`: 工作目录
- `git.branch`: 分支
- `base_instructions`: 系统指令中可能包含 skill 提示

### 4.4 多信号融合
实际映射应采用多信号融合策略：

```typescript
interface SkillMapping {
  skillId: string;
  confidence: number;  // 0-1
  signals: {
    explicitReference: boolean;
    toolPattern: boolean;
    contextMatch: boolean;
  };
  sourceEvents: string[];  // 关联的事件 ID
}
```

## 5. Trace 预处理建议

### 5.1 需要保留的信息
1. **会话元数据**: `session_meta`（项目上下文）
2. **工具调用**: `function_call` / `function_call_output`（执行证据）
3. **用户输入**: `message` with `role: user`（需求信号）
4. **助手输出**: `message` with `role: assistant`（响应质量）
5. **Skill 引用**: 任何包含 `[$skillname]` 的事件

### 5.2 可以过滤的信息
1. **Token 统计**: `token_count` 事件（仅用于计费，与优化无关）
2. **速率限制**: `rate_limits` 事件（运行时信息）
3. **加密推理**: `agent_reasoning` with encrypted content（无法解析）
4. **重复的心跳**: 部分 `event_msg` 子类型

### 5.3 预处理后的数据结构
```typescript
interface PreprocessedTrace {
  sessionId: string;
  projectPath: string;
  gitBranch: string;
  timestamp: string;
  events: {
    type: 'user_input' | 'tool_call' | 'tool_result' | 'assistant_output' | 'skill_reference';
    timestamp: string;
    content: any;
    skillRefs?: string[];  // 检测到的 skill 引用
  }[];
  skillMappings: Map<string, number>;  // skill -> 置信度
}
```

## 6. 与 PRD 设计的差异

### 6.1 原始假设
PRD 中假设 trace 结构：
```json
{
  "trace_id": "",
  "runtime": "codex",
  "event_type": "user_input|assistant_output|tool_call|...",
  ...
}
```

### 6.2 实际情况
实际 Codex trace：
- 事件类型为 `session_meta` / `event_msg` / `response_item` / `turn_context`
- `event_type` 嵌套在 `payload.type` 中
- 包含大量运行时统计信息（token、速率限制等）

### 6.3 需要修正的设计
1. **Observer 解析逻辑**: 需要适配实际的事件类型层级
2. **Trace Schema**: 需要支持嵌套的 payload 结构
3. **过滤策略**: 需要明确哪些事件类型对 skill 优化有价值

## 7. Observer 实现建议

### 7.1 数据源选择
**推荐**: 监听 `~/.codex/sessions/` 目录
- 使用 glob 模式: `~/.codex/sessions/**/*.jsonl`
- 优点：包含所有活跃会话
- 缺点：需要递归监听子目录

**备选**: 同时监听 `archived_sessions` 作为补充

### 7.2 监听策略
```typescript
// 使用 chokidar 监听所有子目录
this.watcher = watch(join(codexHome, 'sessions', '**', '*.jsonl'), {
  persistent: true,
  ignoreInitial: false,
  awaitWriteFinish: {
    stabilityThreshold: 500,
    pollInterval: 100,
  },
});
```

### 7.3 文件处理流程
1. 检测到新文件或文件变化
2. 解析文件名提取 session ID
3. 读取 JSONL 内容
4. 预处理过滤无关事件
5. 提取 skill 引用
6. 转换为标准 Trace 格式
7. 发射给下游处理器

## 8. 结论与建议

### 8.1 关键修正
1. **主要数据源**: `~/.codex/sessions/**/*.jsonl` 而非 `archived_sessions`
2. **归档目录**: `archived_sessions` 只包含用户手动归档的会话
3. **目录结构**: 按日期分层组织（YYYY/MM/DD）

### 8.2 实现优先级
1. **P0**: 实现基于文件系统监听的 CodexObserver（监听 sessions 目录）
2. **P1**: 实现 Trace 预处理层，过滤无关信息
3. **P2**: 实现多信号 skill 映射算法
4. **P3**: 支持实时流式接入（`codex exec --json`）

### 8.3 技术风险
1. **格式变更**: Codex CLI 版本升级可能改变 trace 格式
2. **加密内容**: `agent_reasoning` 内容加密，无法获取完整推理过程
3. **性能**: 递归监听多层目录可能影响性能

---

**调研者**: OrnnSkills Agent
**状态**: 已完成
**重要更新**: 2026-03-23 - 修正了数据源路径（sessions 而非 archived_sessions）
