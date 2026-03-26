# OrnnSkills 监听-理解-优化链路测试方案

## 测试架构设计

### 整体链路

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        测试链路架构                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Layer 1: 监听层 (Observer)                                                  │
│  ┌─────────────────────┐    ┌─────────────────────┐                         │
│  │   CodexObserver     │    │   ClaudeObserver    │                         │
│  │   - 文件监听        │    │   - 文件监听        │                         │
│  │   - 原始数据提取    │    │   - 原始数据提取    │                         │
│  │   - Skill引用识别   │    │   - Skill引用识别   │                         │
│  └──────────┬──────────┘    └──────────┬──────────┘                         │
│             │                          │                                    │
│             └──────────┬───────────────┘                                    │
│                        ▼                                                    │
│  Layer 2: 理解层 (Trace Analyzer)                                           │
│  ┌─────────────────────────────────────────────────┐                       │
│  │         TraceSkillMapper (LLM-based)            │                       │
│  │  - 语义理解 trace 内容                          │                       │
│  │  - 关联 skill 与 trace                          │                       │
│  │  - 提取用户意图                                 │                       │
│  └──────────────────────┬──────────────────────────┘                       │
│                         │                                                   │
│                         ▼                                                   │
│  Layer 3: 决策层 (Evaluator)                                                │
│  ┌─────────────────────────────────────────────────┐                       │
│  │           Evaluator Agent (LLM-based)           │                       │
│  │  - 分析 skill 执行效果                          │                       │
│  │  - 判断是否需要优化                             │                       │
│  │  - 生成优化建议                                 │                       │
│  └──────────────────────┬──────────────────────────┘                       │
│                         │                                                   │
│                         ▼                                                   │
│  Layer 4: 优化层 (Patch Generator)                                          │
│  ┌─────────────────────────────────────────────────┐                       │
│  │        PatchGenerator Agent (LLM-based)         │                       │
│  │  - 生成优化后的 skill 内容                      │                       │
│  │  - 验证优化结果                                 │                       │
│  └─────────────────────────────────────────────────┘                       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 测试分层

### 测试 1: Observer 层测试

**目标**: 验证 Observer 正确提取原始数据

**测试点**:
1. 文件监听是否正常触发
2. 原始 trace 是否正确解析
3. skill 引用是否正确提取（格式匹配）
4. 是否遵守"不分析"约束

**测试数据**: 真实 trace 文件

### 测试 2: Trace 理解测试

**目标**: 验证 TraceSkillMapper 正确理解 trace 语义

**测试点**:
1. 是否正确识别用户意图
2. 是否正确关联 skill
3. 是否正确提取反馈信号

**测试数据**: 构造的典型场景 trace

### 测试 3: 优化决策测试

**目标**: 验证 Evaluator 正确判断是否需要优化

**测试点**:
1. 成功场景 - 不触发优化
2. 失败场景 - 触发优化
3. 边界场景 - 置信度判断

**测试数据**: 带标注的 trace + skill 组合

### 测试 4: 端到端链路测试

**目标**: 验证完整链路

**测试点**:
1. Trace → Observer → Analyzer → Evaluator → PatchGenerator
2. 各层数据传递是否正确
3. 最终输出是否符合预期

## 测试数据设计

### 场景 1: Codex - Skill 成功执行

```jsonl
// session_meta
{"type":"session_meta","timestamp":"2026-03-20T10:00:00Z","payload":{"base_instructions":{"text":"You are Codex... [$code-review] ..."},"cwd":"/project"}}

// 用户调用 skill
{"type":"response_item","timestamp":"2026-03-20T10:01:00Z","payload":{"type":"message","role":"user","content":"请用 [$code-review] 检查这段代码"}}

// Agent 执行
{"type":"response_item","timestamp":"2026-03-20T10:01:05Z","payload":{"type":"message","role":"assistant","content":"我来检查代码..."}}

// 用户接受
{"type":"response_item","timestamp":"2026-03-20T10:02:00Z","payload":{"type":"message","role":"user","content":"好的，谢谢"}}
```

**预期**: 识别为成功执行，不触发优化

### 场景 2: Codex - Skill 建议被质疑

```jsonl
// 用户调用 skill
{"type":"response_item","timestamp":"2026-03-20T10:01:00Z","payload":{"type":"message","role":"user","content":"用 [$checks] 检查这段代码"}}

// Agent 给出建议
{"type":"response_item","timestamp":"2026-03-20T10:01:05Z","payload":{"type":"message","role":"assistant","content":"建议添加 try-catch..."}}

// 用户质疑
{"type":"response_item","timestamp":"2026-03-20T10:02:00Z","payload":{"type":"message","role":"user","content":"这个 try-catch 没必要吧，这里不会抛出异常"}}
```

**预期**: 识别为建议被质疑，触发优化（tighten trigger）

### 场景 3: Claude - Skill 多次调用

```jsonl
{"type":"user","timestamp":"2026-03-20T10:00:00Z","message":{"content":"@business-opportunity-assessment 评估这个想法"}}
{"type":"assistant","timestamp":"2026-03-20T10:00:05Z","message":{"content":"评估结果：..."}}
{"type":"user","timestamp":"2026-03-20T10:05:00Z","message":{"content":"再详细分析一下市场规模"}}
{"type":"assistant","timestamp":"2026-03-20T10:05:10Z","message":{"content":"市场规模分析：..."}}
```

**预期**: 识别为高频使用，可能需要添加 fallback

### 场景 4: Claude - 用户主动建议

```jsonl
{"type":"user","timestamp":"2026-03-20T10:00:00Z","message":{"content":"@code-review 检查这段代码"}}
{"type":"assistant","timestamp":"2026-03-20T10:00:05Z","message":{"content":"代码检查完成..."}}
{"type":"user","timestamp":"2026-03-20T10:01:00Z","message":{"content":"以后检查代码时，记得也要看一下性能问题"}}
```

**预期**: 识别为用户建议，触发优化（append context）

## 测试实现

### 文件结构

```
test/
├── pipeline/                          # 链路测试
│   ├── observer-test.ts               # Observer 层测试
│   ├── trace-analyzer-test.ts         # Trace 理解测试
│   ├── evaluator-test.ts              # 优化决策测试
│   └── end-to-end-test.ts             # 端到端测试
├── fixtures/                          # 测试数据
│   ├── codex/
│   │   ├── success-scenario.jsonl     # 成功场景
│   │   ├── rejected-scenario.jsonl    # 被质疑场景
│   │   └── suggestion-scenario.jsonl  # 用户建议场景
│   └── claude/
│       ├── multi-call-scenario.jsonl  # 多次调用场景
│       └── correction-scenario.jsonl  # 用户纠正场景
└── TEST-PIPELINE-DESIGN.md            # 本文档
```

### 测试框架

使用统一的测试框架：

```typescript
// 测试基类
abstract class PipelineTest {
  abstract name: string;
  abstract run(): Promise<TestResult>;
  
  protected assert(condition: boolean, message: string): void {
    if (!condition) throw new Error(`Assertion failed: ${message}`);
  }
}

// 测试结果
interface TestResult {
  testName: string;
  passed: boolean;
  duration: number;
  details: Record<string, unknown>;
  error?: string;
}
```

## 执行计划

1. **Phase 1**: 实现 Observer 层测试
2. **Phase 2**: 实现 Trace 理解测试（需要 LLM）
3. **Phase 3**: 实现优化决策测试（需要 LLM）
4. **Phase 4**: 实现端到端测试

## 成功标准

| 测试层 | 成功率要求 | 关键指标 |
|--------|-----------|----------|
| Observer | 100% | 数据提取准确率 |
| Trace Analyzer | >85% | 意图识别准确率 |
| Evaluator | >80% | 优化判断准确率 |
| End-to-End | >75% | 完整链路成功率 |
