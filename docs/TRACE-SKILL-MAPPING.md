# Trace-Skill 映射功能文档

## 概述

Trace-Skill 映射是 OrnnSkills 系统的核心功能，解决了"如何准确将 trace 映射到某个 skill"的关键问题。这个功能填补了自动优化闭环的最大缺口，使得系统能够：

1. 从采集的 traces 中识别涉及的 skill
2. 将相关 traces 聚合到对应的 shadow skill
3. 基于聚合的 traces 进行评估和优化

## 架构

```
┌─────────────────────────────────────────────────────────────┐
│                      Main Agent Host                         │
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
```

## 核心组件

### 1. TraceSkillMapper

负责将单个 trace 映射到对应的 skill。

#### 映射策略

| 策略 | 触发条件 | 置信度 | 说明 |
|------|----------|--------|------|
| 策略1 | `tool_call` 读取 skill 文件 | 0.95 | 最可靠的映射方式 |
| 策略2 | `tool_call` 执行 skill 相关操作 | 0.85 | 从工具参数推断 |
| 策略3 | `file_change` 修改 skill 文件 | 0.9 | 文件变化明确指向 skill |
| 策略4 | `metadata` 包含 skill_id | 0.98 | 显式的 skill 标识 |
| 策略5 | `assistant_output` 引用 skill | 0.6 | 从输出内容推断 |
| 策略6 | `user_input` 请求 skill | 0.5 | 从用户输入推断 |

#### 使用示例

```typescript
import { createTraceSkillMapper } from './src/core/trace-skill-mapper/index.js';
import type { Trace } from './src/types/index.js';

// 创建 mapper
const mapper = createTraceSkillMapper('/path/to/project');
await mapper.init();

// 注册已知的 skills
mapper.registerSkill({
  skill_id: 'my-skill',
  origin_path: '/home/user/.skills/my-skill',
  origin_version: 'abc123',
  source: 'local',
  installed_at: new Date().toISOString(),
  last_seen_at: new Date().toISOString(),
});

// 映射单个 trace
const trace: Trace = {
  trace_id: 'trace-1',
  runtime: 'codex',
  session_id: 'session-1',
  turn_id: 'turn-1',
  event_type: 'tool_call',
  tool_name: 'read_file',
  tool_args: { path: '/home/user/.skills/my-skill/current.md' },
  timestamp: new Date().toISOString(),
  status: 'success',
};

const mapping = mapper.mapTrace(trace);
console.log(mapping);
// 输出: { trace_id: 'trace-1', skill_id: 'my-skill', confidence: 0.95, ... }

// 批量映射并分组
const traces: Trace[] = [/* ... */];
const groups = mapper.mapAndGroupTraces(traces);
console.log(groups);
// 输出: [{ skill_id: 'my-skill', traces: [...], confidence: 0.95 }]
```

### 2. TraceSkillObserver

在 Observer 层集成映射功能，提供实时的 trace 处理和聚合。

#### 功能特性

- **实时处理**: 监听 trace 事件并实时映射
- **智能聚合**: 按 skill 聚合 traces
- **缓冲机制**: 支持配置缓冲区大小
- **定时刷新**: 定期刷新缓冲区触发评估

#### 使用示例

```typescript
import { createTraceSkillObserver } from './src/core/observer/trace-skill-observer.js';

// 创建 observer
const observer = createTraceSkillObserver('/path/to/project');
await observer.init();

// 设置回调函数
observer.onReady((group) => {
  console.log(`Skill ${group.skill_id} 有 ${group.traces.length} 条 traces`);
  console.log(`置信度: ${group.confidence}`);
  // 这里可以触发评估流程
});

// 处理 traces
const trace: Trace = { /* ... */ };
await observer.processTrace(trace);

// 或批量处理
const traces: Trace[] = [/* ... */];
await observer.processTraces(traces);

// 获取缓冲区状态
const status = observer.getBufferStatus();
console.log(status);
// 输出: [{ skill_id: 'my-skill', trace_count: 5 }]

// 清理
observer.close();
```

### 3. OptimizationPipeline

完整的自动优化闭环流程。

#### 流程

```
1. 获取最近的 traces
2. 调用 TraceSkillMapper 映射并分组
3. 对每个 skill 分组调用 Evaluator 评估
4. 生成优化任务
5. (可选) 调用 Patch Generator 执行优化
```

#### 使用示例

```typescript
import { createOptimizationPipeline } from './src/core/pipeline/index.js';

// 创建 pipeline
const pipeline = createOptimizationPipeline({
  projectRoot: '/path/to/project',
  autoOptimize: true,
  minConfidence: 0.7,
});

await pipeline.init();

// 手动执行一次
const tasks = await pipeline.runOnce();
console.log(`生成了 ${tasks.length} 个优化任务`);

// 启动后台循环（每分钟执行一次）
const timer = pipeline.startBackgroundLoop(60000);

// 获取状态
const state = pipeline.getState();
console.log(state);
// 输出: { isRunning: false, processedTraces: 100, generatedTasks: 5, ... }

// 清理
pipeline.close();
```

## 路径提取

TraceSkillMapper 支持从多种路径格式中提取 skill ID：

| 路径格式 | 示例 | 提取结果 |
|----------|------|----------|
| `.skills/` | `/home/user/.skills/my-skill/current.md` | `my-skill` |
| `.claude/skills/` | `~/.claude/skills/claude-skill/skill.md` | `claude-skill` |
| `.ornn/skills/` | `/project/.ornn/skills/shadow-skill/current.md` | `shadow-skill` |
| `.opencode/skills/` | `~/.opencode/skills/opencode-skill/` | `opencode-skill` |

## 配置选项

### TraceSkillMapper 配置

```typescript
{
  // 最低置信度阈值，低于此值的映射会被忽略
  minConfidence: 0.5,
  
  // 是否保存映射关系到数据库
  persistMappings: true,
}
```

### TraceSkillObserver 配置

```typescript
{
  // 缓冲区大小，达到此数量时触发刷新
  bufferSize: 10,
  
  // 定时刷新间隔（毫秒）
  flushInterval: 5000,
  
  // 最低置信度阈值
  minConfidence: 0.5,
}
```

### OptimizationPipeline 配置

```typescript
{
  // 项目根目录
  projectRoot: '/path/to/project',
  
  // 是否启用自动优化
  autoOptimize: true,
  
  // 最低置信度阈值
  minConfidence: 0.7,
}
```

## 数据库表结构

### trace_skill_mappings

存储 trace 到 skill 的映射关系。

```sql
CREATE TABLE trace_skill_mappings (
  trace_id TEXT NOT NULL,
  skill_id TEXT NOT NULL,
  shadow_id TEXT,
  confidence REAL NOT NULL,
  reason TEXT,
  mapped_at TEXT NOT NULL,
  PRIMARY KEY (trace_id, skill_id)
);
```

### origin_skills

存储已知的 origin skills。

```sql
CREATE TABLE origin_skills (
  skill_id TEXT PRIMARY KEY,
  origin_path TEXT NOT NULL,
  origin_version TEXT NOT NULL,
  source TEXT NOT NULL,
  installed_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);
```

## 最佳实践

1. **及时注册 skills**: 在使用 mapper 之前，先注册所有已知的 skills
2. **设置合适的置信度阈值**: 根据实际需求调整 `minConfidence`
3. **监控映射统计**: 定期检查 `getMappingStats()` 了解映射效果
4. **处理未映射的 traces**: 对于置信度低的 traces，可以记录日志供后续分析
5. **定期清理旧数据**: 使用 `cleanupOldMappings()` 清理过期的映射数据

## 故障排查

### 问题：trace 无法映射到 skill

**可能原因**:
1. skill 未注册
2. 路径格式不匹配
3. trace 不包含 skill 相关信息

**解决方案**:
1. 确保调用 `mapper.registerSkill()` 注册 skill
2. 检查路径是否符合支持的格式
3. 查看 `mapping.reason` 了解具体原因

### 问题：映射置信度低

**可能原因**:
1. 使用了推断策略（策略5、6）
2. trace 信息不完整

**解决方案**:
1. 优先使用显式的映射方式（策略1、4）
2. 确保 trace 包含足够的上下文信息

### 问题：缓冲区未刷新

**可能原因**:
1. traces 数量未达到 `bufferSize`
2. 定时器未启动

**解决方案**:
1. 调整 `bufferSize` 配置
2. 检查 `flushInterval` 是否正确设置
3. 手动调用 `flushBuffers()`
