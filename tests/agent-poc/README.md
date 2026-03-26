# Agent PoC 测试

本目录包含 OrnnSkills Agent 架构的可行性验证测试。

## 测试目的

验证以下技术方案的可行性：
1. **LangChain + LiteLLM** 作为 Agent 框架和 Provider Adapter
2. **纯 LLM** 的 Evaluator（替代规则引擎）
3. **纯 LLM** 的 PatchGenerator（替代固定策略）
4. **多模型策略**（不同任务使用不同模型）

## 测试文件说明

| 文件 | 测试内容 |
|------|----------|
| `test-llm-config.ts` | LLM Provider 配置测试 |
| `test-evaluator-agent.ts` | Evaluator Agent 能力测试 |
| `test-patch-generator.ts` | PatchGenerator 能力测试 |
| `test-multi-model.ts` | 多模型策略测试 |

## 前置条件

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

```bash
# 复制示例文件
cp .env.local.example .env.local

# 编辑 .env.local，填入你的 API Key
# 推荐优先使用 DeepSeek（性价比高）
```

### 3. .env.local 配置示例

```bash
# DeepSeek (推荐 - 性价比高)
DEEPSEEK_API_KEY=sk-your-deepseek-api-key

# 或 OpenAI
OPENAI_API_KEY=sk-your-openai-api-key

# 或 Anthropic
ANTHROPIC_API_KEY=sk-ant-your-anthropic-api-key

# LangSmith 监控 (可选)
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=ls-your-langsmith-api-key
```

## 运行测试

### 运行单个测试

```bash
# LLM 配置测试
npm run test:llm-config

# Evaluator Agent 测试
npm run test:evaluator

# PatchGenerator 测试
npm run test:patch-gen

# 多模型策略测试
npm run test:multi-model
```

### 运行所有测试

```bash
npm run test:agent-poc
```

## 测试内容详解

### 1. LLM 配置测试

验证内容：
- ✅ LiteLLM 基本连接
- ✅ 多 Provider 支持（DeepSeek、OpenAI、Anthropic）
- ✅ 结构化输出（JSON 格式）

### 2. Evaluator Agent 测试

验证内容：
- ✅ 基础 Trace 分析能力
- ✅ 复杂场景理解（多轮对话、意图识别）
- ✅ 模糊场景判断（重试 vs 错误）
- ✅ 结构化输出验证（Zod Schema）

### 3. PatchGenerator 测试

验证内容：
- ✅ 简单 Skill 优化
- ✅ 复杂 Skill 重构
- ✅ Code Skill 优化（TypeScript、Props、Loading）
- ✅ 对比固定策略 vs LLM 生成

### 4. 多模型策略测试

验证内容：
- ✅ 不同任务路由到不同模型
- ✅ 成本对比分析
- ✅ 任务复杂度评估

## 预期结果

所有测试应该：
1. 成功连接到 LLM Provider
2. 正确理解 traces 语义
3. 生成合理的优化建议
4. 输出符合预期的结构化数据

## 注意事项

1. **API 费用**：测试会消耗少量 API tokens，建议使用 DeepSeek（成本低）
2. **网络要求**：需要能访问对应的 LLM API
3. **超时设置**：默认 30 秒超时，可根据网络情况调整
4. **环境变量**：所有测试都通过 `.env.local` 文件加载环境变量

## 故障排除

### 问题：未找到 .env.local 文件

```
⚠️  未找到 .env.local 文件
   请执行: cp .env.local.example .env.local
   然后编辑 .env.local 填入你的 API Key
```

**解决**：
```bash
cp .env.local.example .env.local
# 编辑 .env.local 填入你的 API Key
```

### 问题：未设置 API Key

```
⚠️  跳过测试: 未设置 API Key
   请复制 .env.local.example 为 .env.local 并填入你的 API Key
```

**解决**：
1. 确保 `.env.local` 文件存在
2. 确保文件中设置了至少一个 API Key
3. 确保 API Key 格式正确（以 `sk-` 或 `sk-ant-` 开头）

### 问题：API 连接失败

**解决**：
1. 检查网络连接
2. 检查 API Key 是否正确
3. 检查是否有足够的 API 额度

## 测试结论

根据测试结果，评估：
- LLM 是否能准确理解 traces
- 生成质量是否满足要求
- 响应时间是否可接受
- 成本是否在预算范围内

如果测试通过，可以继续进行正式代码开发。
