# OrnnSkills 测试套件

## 测试文件结构

```
test/
├── fixtures/                          # 测试数据
│   ├── codex-test-samples.jsonl       # Codex trace 样本
│   ├── claude-test-samples.jsonl      # Claude trace 样本
│   └── user-suggestion-samples.jsonl  # 用户建议样本
├── ornn-skill-analysis-test.ts        # Skill 调用分析测试
├── ornn-user-suggestion-test.ts       # 用户建议分析测试
├── ornn-integration-test.ts           # 集成测试
└── TEST-README.md                     # 本文档
```

## 测试场景

### 1. Skill 调用分析测试

**文件**: `ornn-skill-analysis-test.ts`

**测试目标**:
1. 识别哪一步发生了 skill 调用
2. 识别调用了什么 skills
3. 获取 skill 内容
4. 判断 skill 调用的反馈结果（成功/失败/被质疑）

**测试数据**:
- `codex-test-samples.jsonl`: [$checks] skill 被调用后用户质疑建议
- `claude-test-samples.jsonl`: @business-opportunity-assessment 多次调用并纠正

**运行**:
```bash
npx tsx test/ornn-skill-analysis-test.ts
```

### 2. 用户建议分析测试

**文件**: `ornn-user-suggestion-test.ts`

**测试目标**:
1. 识别用户主动给出的建议
2. 判断建议类型（流程改进/技能增强/最佳实践）
3. 评估建议价值（正向/负向/中性）
4. 生成优化信号

**测试场景**:
1. **流程改进**: "以后重构代码时，可以先问一下用户的具体需求..."
2. **安全建议**: "登录接口必须要做防暴力破解..."
3. **技能增强**: "建议以后使用 [$code-review] 时，还要检查性能、安全..."

**运行**:
```bash
npx tsx test/ornn-user-suggestion-test.ts
```

### 3. 集成测试

**文件**: `ornn-integration-test.ts`

**测试目标**:
验证 ShadowManager 对 trace 的处理流程

**运行**:
```bash
npx tsx test/ornn-integration-test.ts
```

## 测试结果示例

### 用户建议分析测试结果

```
💡 发现用户建议:
   时间: 2026-03-18T10:01:00.000Z
   类型: workflow_improvement
   目标: 重构代码
   建议: 以后重构代码时，可以先问一下用户的具体需求...
   价值: positive (置信度: 0.8)
   🎯 优化信号:
      类型: add_fallback
      描述: 用户建议改进工作流程...
      优先级: medium

📊 统计:
   总建议数: 3
   正向建议: 2
   负向建议: 0
   中性建议: 1

🔧 优化信号分布:
   add_fallback: 1
   new_skill_needed: 1
```

## 优化信号类型

| 信号类型 | 说明 | 触发场景 |
|---------|------|---------|
| `append_context` | 补充上下文 | Skill 输出被部分纠正 |
| `tighten_trigger` | 收紧触发条件 | Skill 建议被完全拒绝 |
| `add_fallback` | 添加回退逻辑 | 流程改进建议 |
| `prune_noise` | 减少噪音 | Skill 输出过于冗长 |
| `new_skill_needed` | 需要新技能 | 最佳实践建议 |

## 扩展测试

### 添加新的测试样本

1. 在 `test/fixtures/` 创建新的 JSONL 文件
2. 参考现有格式，包含完整的 trace 流程
3. 在对应的测试文件中添加测试场景

### 添加新的测试场景

1. 在 `testScenarios` 数组中添加场景定义
2. 实现对应的分析逻辑
3. 运行测试验证

## 注意事项

1. 测试数据使用模拟的 trace 数据，不依赖真实环境
2. Skill 内容读取需要本地存在对应的 skill 文件
3. 建议分析基于关键词匹配，实际生产环境应使用 LLM 进行语义分析
