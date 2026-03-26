# OrnnSkills 架构约束文档

## 核心约束

### 1. 禁止关键词/规则引擎方案

**严格禁止**在 Observer 层使用任何基于关键词、正则表达式、规则引擎的识别方案。

#### 禁止的模式

```typescript
// ❌ 禁止：关键词匹配
if (/不对|错误|有问题/.test(text)) {
  return { type: 'rejection', confidence: 0.9 };
}

// ❌ 禁止：正则规则
const matches = text.match(/建议|推荐|应该/);

// ❌ 禁止：规则引擎
const rules = [
  { pattern: /好的|谢谢/, type: 'acceptance' },
  { pattern: /但是|不过/, type: 'partial' },
];
```

#### 原因

1. **性能问题**：大量正则匹配会显著降低处理速度
2. **准确性低**：无法理解语义，只能匹配表面形式
3. **维护困难**：规则需要不断调整，无法覆盖所有情况
4. **误报率高**：相同关键词在不同语境下含义相反

#### 正确的做法

Observer 层**只负责提取原始数据**，所有分析工作交给下游的 LLM 处理：

```typescript
// ✅ 正确：只提取原始内容
return {
  eventType: 'user_input',
  content: text,  // 原始内容，不做任何分析
  skillRefs: extractedSkills,  // 只提取明确的 skill 引用格式
};

// 分析工作由下游 LLM 完成
```

### 2. Observer 层职责

Observer 的唯一职责是：

1. **监听文件变化** - 使用 chokidar 监听 trace 文件
2. **解析原始数据** - 将 JSONL 解析为结构化对象
3. **格式转换** - 将不同格式的 trace 转换为统一格式
4. **提取明确信息** - 只提取格式明确的信息（如 `[$skill]`）
5. **发射原始 Trace** - 将原始数据发射给下游

**Observer 不做**：
- ❌ 语义分析
- ❌ 情感判断
- ❌ 意图识别
- ❌ 反馈分类
- ❌ 语义过滤（如删除某些内容）
- ❌ 截断语义内容（如只保留前 N 字符）

**Observer 必须 100% 保留**：
- ✅ 用户输入的完整内容
- ✅ 助手输出的完整内容
- ✅ 所有事件类型（包括未知类型）
- ✅ 所有元数据（只清理纯技术字段）

### 3. Skill 引用提取

唯一允许的正则提取是**格式明确的 skill 引用**：

```typescript
// ✅ 允许：提取格式明确的 skill 引用
// Codex: [$skillname]
const codexMatches = text.match(/\[\$([^\]]+)\]/g);

// Claude: @skillname（需要过滤代码装饰器）
const atMatches = text.match(/@(\w+)/g);
// 过滤掉已知的代码装饰器
const codeDecorators = ['dataclass', 'staticmethod', 'classmethod', 'property'];
```

### 4. 数据处理流程

```
Trace File → Observer → Raw Trace → LLM Analyzer → Insights
                ↑                           ↑
           只提取原始数据              语义理解、分析、决策
```

### 5. 性能考虑

- Observer 必须保持**高吞吐**和**低延迟**
- 任何可能降低性能的操作都应该移到下游
- LLM 分析可以异步进行，不阻塞 trace 收集

### 6. 测试约束

测试文件也必须遵守此约束：

```typescript
// ❌ 禁止在测试中使用关键词分析
function analyzeUserFeedback(text: string) {
  if (/不对/.test(text)) return 'rejection';  // 禁止
}

// ✅ 测试应该验证原始数据提取
function testObserver() {
  observer.onTrace((trace) => {
    assert(trace.content === originalText);  // 验证原始内容
    assert.deepEqual(trace.skillRefs, ['checks']);  // 验证 skill 提取
  });
}
```

## 相关文档

- [Observer 实现](./observer-implementation.md)
- [LLM 分析器设计](./llm-analyzer-design.md)
