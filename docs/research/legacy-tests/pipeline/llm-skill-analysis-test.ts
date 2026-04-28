/**
 * LLM Skill 分析测试
 * 
 * 测试目标：验证 LLM 能否基于原始 trace 数据给出 skill 改进意见
 * 
 * 测试方法：
 * 1. 取一段真实的 trace 数据
 * 2. 使用基础 prompt 让 LLM 分析
 * 3. 评估 LLM 能否正确：
 *    - 识别 skill 调用
 *    - 理解调用效果
 *    - 给出改进建议
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
 * 明确约束：只能修改 skill 文档，不能涉及代码修改
 */
const BASE_PROMPT = `你是一个 Skill 优化助手。请分析下面的 Agent 执行 Trace，给出 Skill 的改进意见。

## 重要约束（必须遵守）

1. **你的能力范围仅限于修改 Skill 文档**
   - Skill 是一个 Markdown 文档，包含指令和示例
   - 你可以编辑 Skill 的内容、结构、示例、约束条件
   - **你绝对不能**：修改代码、写脚本、修改配置文件、创建工具

2. **所有建议必须落实到 Skill 文档的具体修改**
   - 要说明：在 Skill 的哪个部分添加/修改什么内容
   - 要说明：修改后的 Skill 应该包含什么指令或示例
   - 不要给出抽象的"应该怎么做"，要给出"Skill 应该写什么"

3. **Skill 文档的典型结构**
   [Skill 是一个 Markdown 文档，包含以下章节]
   - # Skill 名称
   - ## 描述
   - ## 使用场景
   - ## 执行步骤
   - ## 约束条件
   - ## 示例

## 输入数据

这是一个 Codex Agent 的执行 Trace，包含：
1. session_meta: 会话元数据，包含 base_instructions（系统指令）
2. response_item: 用户输入和助手回复
3. tool_call: 工具调用记录（exec_command, web_search_call 等）

## 你的任务

1. 识别哪些 Skill 被调用了
2. 分析 Skill 调用的效果（成功/失败/被质疑/被建议改进）
3. **给出具体的 Skill 文档修改方案**：
   - 指出当前 Skill 文档缺少什么内容
   - 说明应该在 Skill 中添加什么指令或示例
   - 提供修改后的 Skill 文档片段（Markdown 格式）

## Trace 数据

\`\`\`jsonl
{traceData}
\`\`\`

## 输出格式

请用中文输出分析结果：

### 识别的 Skills
- Skill 名称: [name]
- 调用方式: [用户主动调用/系统自动注入]
- 调用次数: [N]

### 调用效果分析
- 效果评估: [成功/部分成功/被质疑/需要改进]
- 证据: [引用 trace 中的具体内容]
- 问题诊断: [为什么这个 skill 没有达到最佳效果]

### Skill 文档修改方案

#### Skill: [skill-name]

**当前问题**:
[描述当前 skill 文档存在的问题]

**修改建议**:
1. 在 [章节] 添加：[具体内容]
2. 修改 [章节]：[具体内容]
3. 添加示例：[具体示例]

**修改后的 Skill 文档片段**:
\`\`\`markdown
[提供修改后的 skill 文档内容，包含新增或修改的部分]
\`\`\`

**预期效果**:
[说明这样修改后，下次遇到类似场景时，Agent 会如何表现]
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
 * 加载并格式化 trace 数据
 */
function loadTraceData(filePath: string): string {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');
  
  // 格式化 trace 数据，保留关键信息
  const formattedLines = lines.map(line => {
    try {
      const event = JSON.parse(line);
      
      // 简化输出，只保留关键字段
      if (event.type === 'session_meta') {
        return JSON.stringify({
          type: event.type,
          timestamp: event.timestamp,
          payload: {
            cwd: event.payload?.cwd,
            base_instructions: typeof event.payload?.base_instructions === 'string' 
              ? event.payload.base_instructions.slice(0, 1000) + '...'
              : event.payload?.base_instructions?.text?.slice(0, 1000) + '...',
          },
        });
      }
      
      if (event.type === 'response_item' && event.payload?.type === 'message') {
        const content = Array.isArray(event.payload.content)
          ? event.payload.content.map((c: any) => c.text).join('\n')
          : event.payload.content;
        
        return JSON.stringify({
          type: event.type,
          timestamp: event.timestamp,
          payload: {
            type: event.payload.type,
            role: event.payload.role,
            content: typeof content === 'string' 
              ? content.slice(0, 500) + (content.length > 500 ? '...' : '')
              : content,
          },
        });
      }
      
      return line;
    } catch {
      return line;
    }
  });
  
  return formattedLines.join('\n');
}

/**
 * 评估 LLM 分析结果
 */
function evaluateAnalysis(analysis: string): {
  hasSkillIdentification: boolean;
  hasEffectAnalysis: boolean;
  hasImprovementSuggestions: boolean;
  score: number;
} {
  const hasSkillIdentification = /skill|技能/i.test(analysis) && 
    (/识别|调用|名称/i.test(analysis));
  
  const hasEffectAnalysis = /效果|评估|成功|失败|质疑|改进/i.test(analysis);
  
  const hasImprovementSuggestions = /建议|改进|优化|应该|可以/i.test(analysis) &&
    analysis.split('\n').filter(line => /^\d+\./.test(line.trim())).length >= 1;
  
  let score = 0;
  if (hasSkillIdentification) score += 3;
  if (hasEffectAnalysis) score += 3;
  if (hasImprovementSuggestions) score += 4;
  
  return {
    hasSkillIdentification,
    hasEffectAnalysis,
    hasImprovementSuggestions,
    score,
  };
}

/**
 * 运行测试
 */
async function runTest(): Promise<void> {
  logger.info('========================================');
  logger.info('LLM Skill 分析测试开始');
  logger.info('========================================');

  const traceFile = join(process.cwd(), 'test', 'fixtures', 'real-trace-sample.jsonl');
  
  try {
    // 1. 加载 trace 数据
    logger.info('加载 trace 数据...');
    const traceData = loadTraceData(traceFile);
    logger.info(`加载了 ${traceData.split('\n').length} 行 trace 数据`);
    
    // 2. 构建 prompt
    const prompt = BASE_PROMPT.replace('{traceData}', traceData);
    logger.info('Prompt 构建完成');
    logger.info(`Prompt 长度: ${prompt.length} 字符`);
    
    // 3. 调用 LLM
    logger.info('调用 DeepSeek API...');
    const startTime = Date.now();
    const analysis = await callDeepSeek(prompt);
    const duration = Date.now() - startTime;
    
    logger.info(`API 调用完成，耗时: ${duration}ms`);
    
    // 4. 输出分析结果
    console.log('\n========================================');
    console.log('LLM 分析结果');
    console.log('========================================\n');
    console.log(analysis);
    
    // 5. 评估结果
    const evaluation = evaluateAnalysis(analysis);
    
    console.log('\n========================================');
    console.log('评估结果');
    console.log('========================================');
    console.log(`✅ 识别 Skills: ${evaluation.hasSkillIdentification ? '是' : '否'}`);
    console.log(`✅ 效果分析: ${evaluation.hasEffectAnalysis ? '是' : '否'}`);
    console.log(`✅ 改进建议: ${evaluation.hasImprovementSuggestions ? '是' : '否'}`);
    console.log(`\n总分: ${evaluation.score}/10`);
    
    if (evaluation.score >= 7) {
      console.log('\n🎉 测试通过！LLM 能够有效分析 trace 并给出改进建议');
    } else if (evaluation.score >= 4) {
      console.log('\n⚠️ 测试部分通过，LLM 分析能力有待提升');
    } else {
      console.log('\n❌ 测试未通过，需要优化 prompt 或模型');
    }
    
    // 6. 保存结果
    const resultPath = join(process.cwd(), 'test', 'output', 'llm-analysis-result.md');
    const { mkdirSync } = await import('node:fs');
    try {
      mkdirSync(join(process.cwd(), 'test', 'output'), { recursive: true });
    } catch {}
    
    const resultContent = `# LLM Skill 分析测试结果

**测试时间**: ${new Date().toISOString()}
**耗时**: ${duration}ms
**评分**: ${evaluation.score}/10

## 评估维度

- **识别 Skills**: ${evaluation.hasSkillIdentification ? '✅' : '❌'}
- **效果分析**: ${evaluation.hasEffectAnalysis ? '✅' : '❌'}
- **改进建议**: ${evaluation.hasImprovementSuggestions ? '✅' : '❌'}

## LLM 分析结果

${analysis}

## 原始 Trace 数据（前 50 行）

\`\`\`jsonl
${traceData.split('\n').slice(0, 50).join('\n')}
\`\`\`
`;
    
    const { writeFileSync } = await import('node:fs');
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
