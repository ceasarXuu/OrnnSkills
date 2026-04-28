/**
 * OrnnSkills Skill Trace 真实分析
 *
 * 基于本机真实 trace 数据，分析 skill 的实际使用情况
 */

import { createChildLogger } from '../src/utils/logger.js';
import { readFileSync, existsSync } from 'node:fs';

const logger = createChildLogger('skill-trace-analysis');

/**
 * 从真实 trace 中提取 skill 相关信息
 */
function extractSkillInfoFromCodex(filePath: string) {
  logger.info(`\n📄 分析 Codex 文件: ${filePath.split('/').pop()}`);
  
  if (!existsSync(filePath)) {
    logger.warn('文件不存在');
    return null;
  }
  
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim());
  
  // 分析结果
  const result = {
    sessionMeta: null as any,
    skillMentions: [] as { source: string; skill: string; context: string }[],
    userInputs: [] as string[],
    assistantOutputs: [] as string[],
    toolCalls: [] as { tool: string; args: any }[],
  };
  
  for (const line of lines) {
    try {
      const event = JSON.parse(line);
      
      // 提取 session_meta（包含 base_instructions）
      if (event.type === 'session_meta') {
        result.sessionMeta = event.payload;
        
        // 从 base_instructions 中提取 skill 引用
        const instructions = event.payload?.base_instructions || '';
        const skillMatches = instructions.match(/\[\$([^\]]+)\]/g);
        if (skillMatches) {
          skillMatches.forEach((match: string) => {
            result.skillMentions.push({
              source: 'base_instructions',
              skill: match.slice(2, -1),
              context: instructions.slice(0, 200),
            });
          });
        }
      }
      
      // 提取 response_item
      if (event.type === 'response_item') {
        const payload = event.payload;
        
        if (payload.type === 'message') {
          const text = extractTextContent(payload.content);
          
          if (payload.role === 'user') {
            result.userInputs.push(text);
            
            // 从用户输入中提取 skill 引用
            const skillMatches = text.match(/\[\$([^\]]+)\]/g);
            if (skillMatches) {
              skillMatches.forEach((match: string) => {
                result.skillMentions.push({
                  source: 'user_input',
                  skill: match.slice(2, -1),
                  context: text.slice(0, 100),
                });
              });
            }
          } else if (payload.role === 'assistant') {
            result.assistantOutputs.push(text);
            
            // 从助手输出中提取 skill 引用
            const skillMatches = text.match(/\[\$([^\]]+)\]/g);
            if (skillMatches) {
              skillMatches.forEach((match: string) => {
                result.skillMentions.push({
                  source: 'assistant_output',
                  skill: match.slice(2, -1),
                  context: text.slice(0, 100),
                });
              });
            }
          }
        }
        
        // 提取工具调用
        if (payload.type === 'function_call') {
          result.toolCalls.push({
            tool: payload.name || payload.function?.name,
            args: payload.arguments,
          });
        }
      }
    } catch {
      // 忽略解析错误
    }
  }
  
  return result;
}

/**
 * 提取文本内容
 */
function extractTextContent(content: any): string {
  if (typeof content === 'string') {
    return content;
  }
  
  if (Array.isArray(content)) {
    return content
      .filter((c: any) => c.type === 'input_text' || c.type === 'output_text' || c.type === 'text')
      .map((c: any) => c.text || '')
      .join(' ');
  }
  
  return '';
}

/**
 * 分析 skill 使用模式
 */
function analyzeSkillPatterns(result: any) {
  logger.info('\n📊 Skill 使用分析:');
  
  // 统计 skill 提及来源
  const sourceCount = new Map<string, number>();
  const uniqueSkills = new Set<string>();
  
  for (const mention of result.skillMentions) {
    sourceCount.set(mention.source, (sourceCount.get(mention.source) || 0) + 1);
    uniqueSkills.add(mention.skill);
  }
  
  logger.info(`   唯一 Skill 数: ${uniqueSkills.size}`);
  logger.info(`   Skill 提及总数: ${result.skillMentions.length}`);
  logger.info(`   Skill 来源分布:`);
  for (const [source, count] of sourceCount) {
    logger.info(`     - ${source}: ${count}`);
  }
  
  // 显示 skill 详情
  if (result.skillMentions.length > 0) {
    logger.info(`\n   Skill 详情:`);
    const skillGroups = new Map<string, typeof result.skillMentions>();
    
    for (const mention of result.skillMentions) {
      if (!skillGroups.has(mention.skill)) {
        skillGroups.set(mention.skill, []);
      }
      skillGroups.get(mention.skill)!.push(mention);
    }
    
    for (const [skill, mentions] of skillGroups) {
      logger.info(`\n   [$${skill}]:`);
      mentions.forEach((m, i) => {
        logger.info(`     ${i + 1}. [${m.source}] ${m.context.slice(0, 60)}...`);
      });
    }
  }
  
  // 分析用户输入
  logger.info(`\n   用户输入数: ${result.userInputs.length}`);
  if (result.userInputs.length > 0) {
    logger.info(`   用户输入示例:`);
    result.userInputs.slice(0, 3).forEach((input: string, i: number) => {
      logger.info(`     ${i + 1}. ${input.slice(0, 80)}...`);
    });
  }
  
  // 分析工具调用
  logger.info(`\n   工具调用数: ${result.toolCalls.length}`);
  if (result.toolCalls.length > 0) {
    const toolCounts = new Map<string, number>();
    for (const call of result.toolCalls) {
      toolCounts.set(call.tool, (toolCounts.get(call.tool) || 0) + 1);
    }
    logger.info(`   工具分布:`);
    for (const [tool, count] of toolCounts) {
      logger.info(`     - ${tool}: ${count}`);
    }
  }
}

/**
 * 生成优化建议
 */
function generateOptimizationSuggestions(result: any) {
  logger.info('\n💡 优化建议:');
  
  // 分析用户反馈模式
  const corrections = result.userInputs.filter((input: string) => 
    /不对|错误|有问题|不合适|太乐观|不够|建议/.test(input)
  );
  
  if (corrections.length > 0) {
    logger.info(`   检测到 ${corrections.length} 条用户反馈/纠正:`);
    corrections.slice(0, 2).forEach((corr: string, i: number) => {
      logger.info(`     ${i + 1}. ${corr.slice(0, 80)}...`);
    });
    
    logger.info('\n   优化信号:');
    logger.info('   - 用户反馈可能暗示 skill 需要调整');
    logger.info('   - 建议: 分析反馈内容，生成 append_context 或 tighten_trigger 信号');
  }
  
  // 分析工具使用模式
  if (result.toolCalls.length > 100) {
    logger.info(`\n   高频工具使用 (${result.toolCalls.length} 次):`);
    logger.info('   - 可能暗示 skill 触发了大量操作');
    logger.info('   - 建议: 评估是否需要 prune_noise 或 add_fallback');
  }
}

/**
 * 运行分析
 */
async function runSkillTraceAnalysis() {
  logger.info('========================================');
  logger.info('OrnnSkills Skill Trace 真实分析');
  logger.info('========================================');
  
  // 分析包含 skill 引用的 Codex 文件
  const codexFiles = [
    '/Users/xuzhang/.codex/sessions/2026/03/04/rollout-2026-03-04T01-57-13-019cb4d8-ce36-7c23-ab6a-825915630978.jsonl',
    '/Users/xuzhang/.codex/sessions/2026/03/04/rollout-2026-03-04T21-52-18-019cb91e-f0c5-7c01-a305-21b82d3935ea.jsonl',
  ];
  
  for (const file of codexFiles) {
    const result = extractSkillInfoFromCodex(file);
    if (result) {
      analyzeSkillPatterns(result);
      generateOptimizationSuggestions(result);
    }
  }
  
  logger.info('\n========================================');
  logger.info('关键发现');
  logger.info('========================================');
  logger.info('1. Skill 引用主要出现在 base_instructions（系统指令）中');
  logger.info('2. 用户很少显式使用 [$skill] 语法');
  logger.info('3. Skill 通过 AGENTS.md 隐式注入到会话上下文');
  logger.info('4. 用户反馈是优化 skill 的重要信号源');
  logger.info('5. 工具调用频率可以反映 skill 的复杂度');
}

// 运行分析
runSkillTraceAnalysis().catch(error => {
  logger.error('分析失败', { error });
  process.exit(1);
});
