/**
 * LLM Skill 分析测试 V2
 *
 * 测试目标：验证 LLM 能否基于 trace + skill 原文给出具体的改进意见
 *
 * 关键约束：
 * 1. 必须提供被调用的 skills 原文
 * 2. 只能修改已明确引用的 skills
 * 3. 不能建议新建 skills
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { config } from 'dotenv';
import { logger } from '../../src/utils/logger.js';

// 加载环境变量
config({ path: join(process.cwd(), '.env.local') });

// DeepSeek API 配置
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || process.env.deepseek_api_key;
const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';

/**
 * 优化后的 Prompt 模板
 * 严格约束：只能修改已引用的 skills，不能新建
 */
const BASE_PROMPT = `你是一个 Skill 优化助手。请分析下面的 Agent 执行 Trace 和 Skill 原文，给出 Skill 的改进意见。

## 严格约束（必须遵守）

1. **只能修改已明确引用的 Skills**
   - 下面提供了本次 Trace 中明确引用的 Skill 原文
   - 你只能针对这些已存在的 Skill 给出修改意见
   - **绝对禁止**建议新建 Skill 或创建复合 Skill

2. **所有建议必须具体到 Skill 文档的章节和行**
   - 要指出：在 Skill 的哪个章节（如 ## Steps）添加/修改什么内容
   - 要提供：修改后的具体文本（Markdown 格式）
   - 要说明：为什么这样修改能解决观察到的问题

3. **基于证据的改进**
   - 必须引用 Trace 中的具体证据（如用户反馈、执行结果）
   - 必须对比 Skill 原文和实际执行情况
   - 指出 Skill 原文缺少什么导致执行效果不佳

## 输入数据

### 1. Trace 数据（Agent 执行记录）
\`\`\`jsonl
{traceData}
\`\`\`

### 2. 引用的 Skills 原文
{skillContents}

## 你的任务

1. **识别调用的 Skills**：从 Trace 中识别哪些 Skills 被明确引用了
2. **分析执行效果**：对比 Skill 原文和实际执行，分析效果（成功/部分成功/需要改进）
3. **给出具体修改方案**：
   - 针对每个被引用的 Skill，指出具体修改位置
   - 提供修改后的 Skill 文档片段
   - 引用 Trace 证据说明为什么需要这样修改

## 输出格式

请用中文输出分析结果：

### 识别的 Skills
- Skill 名称: [name]
- 引用位置: [trace 中的位置]
- 调用次数: [N]

### Skill 执行分析

#### Skill: [skill-name]

**Skill 原文摘要**:
[简要总结当前 Skill 文档的内容]

**实际执行情况**:
[根据 Trace 描述实际发生了什么]

**问题诊断**:
[对比原文和执行，指出问题所在]
- 问题1: [具体问题]
- 证据: [引用 trace 中的内容]

**修改方案**:

**位置**: [章节，如 ## Steps]
**修改类型**: [添加/修改/删除]
**修改内容**:
\`\`\`markdown
[提供修改后的具体内容]
\`\`\`

**修改理由**:
[说明为什么这个修改能解决观察到的问题]

### 总结
[总结所有修改的预期效果]
`;

/**
 * 调用 DeepSeek API
 */
async function callDeepSeek(prompt: string): Promise<string> {
  if (!DEEPSEEK_API_KEY) {
    throw new Error('DEEPSEEK_API_KEY not found in environment');
  }

  const response = await fetch(DEEPSEEK_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'deepseek-reasoner',
      messages: [
        { role: 'user', content: prompt },
      ],
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || '';
}

/**
 * 加载 trace 数据
 */
function loadTraceData(filePath: string): string {
  return readFileSync(filePath, 'utf-8');
}

/**
 * 加载 skill 原文
 */
function loadSkillContents(skillDir: string): string {
  const skillPath = join(skillDir, 'SKILL.md');
  try {
    const content = readFileSync(skillPath, 'utf-8');
    return `\`\`\`markdown\n${content}\n\`\`\``;
  } catch {
    return '[Skill 文件未找到]';
  }
}

/**
 * 评估 LLM 分析结果
 */
function evaluateAnalysis(analysis: string): {
  hasSkillIdentification: boolean;
  hasEffectAnalysis: boolean;
  hasSpecificModification: boolean;
  noNewSkillSuggestion: boolean;
  score: number;
} {
  const hasSkillIdentification = /skill|技能/i.test(analysis) &&
    (/识别|调用|名称/i.test(analysis));

  const hasEffectAnalysis = /效果|评估|成功|失败|问题诊断/i.test(analysis);

  const hasSpecificModification = /修改方案|修改内容|位置.*##/i.test(analysis) &&
    analysis.includes('```markdown');

  const noNewSkillSuggestion = !/(新建|创建|新增).*skill|复合skill|创建.*脚本/i.test(analysis);

  let score = 0;
  if (hasSkillIdentification) score += 2;
  if (hasEffectAnalysis) score += 2;
  if (hasSpecificModification) score += 3;
  if (noNewSkillSuggestion) score += 3;

  return {
    hasSkillIdentification,
    hasEffectAnalysis,
    hasSpecificModification,
    noNewSkillSuggestion,
    score,
  };
}

/**
 * 运行测试
 */
async function runTest(): Promise<void> {
  logger.info('========================================');
  logger.info('LLM Skill 分析测试 V2 开始');
  logger.info('（包含 Skill 原文，只能修改已引用 Skills）');
  logger.info('========================================');

  const traceFile = join(process.cwd(), 'test', 'fixtures', 'codex', 'success-scenario.jsonl');
  const skillDir = join(process.cwd(), 'test', 'fixtures', 'skills', 'code-review');

  try {
    // 1. 加载 trace 数据
    logger.info('加载 trace 数据...');
    const traceData = loadTraceData(traceFile);
    logger.info(`加载了 ${traceData.split('\n').length} 行 trace 数据`);

    // 2. 加载 skill 原文
    logger.info('加载 skill 原文...');
    const skillContents = loadSkillContents(skillDir);
    logger.info(`Skill 原文长度: ${skillContents.length} 字符`);

    // 3. 构建 prompt
    const prompt = BASE_PROMPT
      .replace('{traceData}', traceData)
      .replace('{skillContents}', skillContents);
    logger.info('Prompt 构建完成');
    logger.info(`Prompt 长度: ${prompt.length} 字符`);

    // 4. 调用 LLM
    logger.info('调用 DeepSeek API...');
    const startTime = Date.now();
    const analysis = await callDeepSeek(prompt);
    const duration = Date.now() - startTime;

    logger.info(`API 调用完成，耗时: ${duration}ms`);

    // 5. 输出分析结果
    console.log('\n========================================');
    console.log('LLM 分析结果');
    console.log('========================================\n');
    console.log(analysis);

    // 6. 评估结果
    const evaluation = evaluateAnalysis(analysis);

    console.log('\n========================================');
    console.log('评估结果');
    console.log('========================================');
    console.log(`✅ 识别 Skills: ${evaluation.hasSkillIdentification ? '是' : '否'}`);
    console.log(`✅ 效果分析: ${evaluation.hasEffectAnalysis ? '是' : '否'}`);
    console.log(`✅ 具体修改方案: ${evaluation.hasSpecificModification ? '是' : '否'}`);
    console.log(`✅ 无新建 Skill 建议: ${evaluation.noNewSkillSuggestion ? '是' : '否'}`);
    console.log(`\n总分: ${evaluation.score}/10`);

    if (evaluation.score >= 8) {
      console.log('\n🎉 测试通过！LLM 能够基于 Skill 原文给出具体的修改意见');
    } else if (evaluation.score >= 5) {
      console.log('\n⚠️ 测试部分通过，需要进一步优化');
    } else {
      console.log('\n❌ 测试未通过');
    }

    // 7. 保存结果
    const resultPath = join(process.cwd(), 'test', 'output', 'llm-analysis-result-v2.md');
    const { mkdirSync, writeFileSync } = await import('node:fs');
    try {
      mkdirSync(join(process.cwd(), 'test', 'output'), { recursive: true });
    } catch {}

    const resultContent = `# LLM Skill 分析测试结果 V2

**测试时间**: ${new Date().toISOString()}
**耗时**: ${duration}ms
**评分**: ${evaluation.score}/10

## 评估维度

- **识别 Skills**: ${evaluation.hasSkillIdentification ? '✅' : '❌'}
- **效果分析**: ${evaluation.hasEffectAnalysis ? '✅' : '❌'}
- **具体修改方案**: ${evaluation.hasSpecificModification ? '✅' : '❌'}
- **无新建 Skill 建议**: ${evaluation.noNewSkillSuggestion ? '✅' : '❌'}

## LLM 分析结果

${analysis}

## 原始 Trace 数据

\`\`\`jsonl
${traceData}
\`\`\`

## Skill 原文

${skillContents}
`;

    writeFileSync(resultPath, resultContent);
    logger.info(`结果已保存到: ${resultPath}`);

  } catch (error) {
    logger.error('测试失败', { error });
    console.error('\n❌ 测试失败:', error);
    process.exit(1);
  }
}

// 运行测试
runTest();
