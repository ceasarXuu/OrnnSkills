# Session 存储路径调研报告

**调研日期**: 2026-03-24  
**调研目标**: 明确 Codex 和 Claude Code 的 session/trace 存储路径，指导 Ornn 路由层设计

---

## 1. Codex

### 1.1 存储路径

```
~/.codex/
├── sessions/                    # 所有 session 存储在这里（全局）
│   └── YYYY/MM/DD/              # 按日期组织
│       └── rollout-{timestamp}-{uuid}.jsonl
├── archived_sessions/           # 归档的 sessions
└── session_index.jsonl          # session 索引
```

### 1.2 项目标识

**关键字段**: `session_meta.payload.cwd`

```json
{
  "type": "session_meta",
  "payload": {
    "cwd": "/Users/xuzhang/OrnnSkills",  // ← 项目路径
    "base_instructions": "..."
  }
}
```

### 1.3 监听策略

- **监听路径**: `~/.codex/sessions/**/*/*.jsonl`（递归监听）
- **项目过滤**: 读取 `payload.cwd` 判断是否属于当前项目
- **注意**: 需要监听全局目录，但只处理当前项目的 traces

### 1.4 示例路径

```
/Users/xuzhang/.codex/sessions/2026/03/18/rollout-2026-03-18T02-19-25-019cfd06-2b63-7733-9fa9-cb53facf5938.jsonl
```

---

## 2. Claude Code

### 2.1 存储路径

```
~/.claude/
└── projects/                    # 按项目分目录
    └── {project-name}/          # 项目目录（路径中的 / 替换为 -）
        ├── sessions-index.json  # session 索引
        └── {uuid}.jsonl         # session 文件
```

### 2.2 项目命名规则

- 项目路径中的 `/` 替换为 `-`
- 示例: `/Users/xuzhang` → `-Users-xuzhang`
- 示例: `/Users/xuzhang/Sub` → `-Users-xuzhang-Sub`

### 2.3 项目标识

**索引文件**: `sessions-index.json`

```json
{
  "version": 1,
  "entries": [
    {
      "sessionId": "6af2b6bd-a9bd-4fcb-8103-b204c41cdb6a",
      "fullPath": "/Users/xuzhang/.claude/projects/-Users-xuzhang/6af2b6bd-a9bd-4fcb-8103-b204c41cdb6a.jsonl",
      "projectPath": "/Users/xuzhang",  // ← 项目路径
      "firstPrompt": "check",
      "summary": "Rate limit check...",
      "messageCount": 4,
      "created": "2026-01-14T18:58:15.529Z",
      "modified": "2026-01-14T23:00:19.140Z"
    }
  ]
}
```

### 2.4 监听策略

- **监听路径**: `~/.claude/projects/{project-name}/*.jsonl`
- **项目过滤**: 直接监听对应项目目录，无需额外过滤
- **注意**: 每个项目有独立的目录，天然隔离

### 2.5 示例路径

```
/Users/xuzhang/.claude/projects/-Users-xuzhang/b6baf6ff-cc12-4b53-9b2c-b1115f49c31b.jsonl
```

---

## 3. 对比总结

| 特性 | Codex | Claude Code |
|------|-------|-------------|
| **存储位置** | `~/.codex/sessions/`（全局） | `~/.claude/projects/{project}/`（按项目） |
| **目录结构** | 按日期组织 | 按项目组织 |
| **项目标识** | `payload.cwd` | 目录名 + `projectPath` |
| **文件命名** | `rollout-{timestamp}-{uuid}.jsonl` | `{uuid}.jsonl` |
| **索引文件** | `session_index.jsonl` | `sessions-index.json` |
| **监听方式** | 全局监听 + 过滤 | 直接监听项目目录 |

---

## 4. 对 Ornn 路由层的设计指导

### 4.1 监听策略

```typescript
class OrnnDaemon {
  private projectPath: string;

  async startWatching(): Promise<void> {
    // 1. Codex: 监听全局，按 cwd 过滤
    this.watchCodex();
    
    // 2. Claude: 直接监听项目目录
    this.watchClaude();
  }

  private watchCodex(): void {
    const codexPath = join(homedir(), '.codex', 'sessions');
    
    watch(codexPath, { recursive: true }, (filePath) => {
      if (!filePath.endsWith('.jsonl')) return;
      
      const trace = parseCodexTrace(filePath);
      
      // 过滤：只处理当前项目的 trace
      if (trace.metadata?.cwd === this.projectPath) {
        this.router.onTrace(trace);
      }
    });
  }

  private watchClaude(): void {
    // 项目目录名：/Users/xuzhang/OrnnSkills → -Users-xuzhang-OrnnSkills
    const projectName = this.projectPath.replace(/\//g, '-');
    const claudePath = join(homedir(), '.claude', 'projects', projectName);
    
    watch(claudePath, (filePath) => {
      // 排除索引文件
      if (!filePath.endsWith('.jsonl') || filePath.includes('index')) return;
      
      const trace = parseClaudeTrace(filePath);
      this.router.onTrace(trace);
    });
  }
}
```

### 4.2 关键注意点

1. **Codex**:
   - 必须递归监听 `sessions/` 下的所有子目录
   - 必须通过 `payload.cwd` 过滤，不能处理其他项目的 traces
   - 注意性能：全局目录可能包含大量历史 sessions

2. **Claude Code**:
   - 项目目录名转换：`/` → `-`
   - 排除 `sessions-index.json` 等非 trace 文件
   - 如果项目目录不存在，说明该项目没有 Claude 使用记录

3. **通用**:
   - 两个 runtime 的 trace 格式不同，需要不同的解析器
   - 建议同时监听两个 runtime，支持混合使用场景

---

## 5. 验证命令

### Codex

```bash
# 查看 session 存储结构
ls -la ~/.codex/sessions/

# 查看具体 session 的项目路径
cat ~/.codex/sessions/2026/03/18/rollout-xxx.jsonl | jq '.payload.cwd'

# 查找特定项目的 sessions
grep -r '"cwd": "/Users/xuzhang/OrnnSkills"' ~/.codex/sessions/2026/
```

### Claude Code

```bash
# 查看项目目录结构
ls -la ~/.claude/projects/

# 查看 sessions 索引
cat ~/.claude/projects/-Users-xuzhang/sessions-index.json | jq '.entries[].projectPath'

# 查看具体 session
ls ~/.claude/projects/-Users-xuzhang/*.jsonl
```

---

## 6. 附录

### 调研原始数据

**Codex**:
- 调研时间: 2026-03-24
- 调研命令: `ls -la ~/.codex/sessions/`, `cat ... | jq '.payload.cwd'`
- 关键发现: `payload.cwd` 字段标识项目路径

**Claude Code**:
- 调研时间: 2026-03-24
- 调研命令: `ls -la ~/.claude/projects/`, `cat sessions-index.json`
- 关键发现: 按项目分目录存储，目录名转换规则

---

**文档版本**: v1.0  
**最后更新**: 2026-03-24
