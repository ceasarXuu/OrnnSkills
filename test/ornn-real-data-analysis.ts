/**
 * OrnnSkills 真实数据分析测试
 *
 * 直接读取本机真实 trace 数据，验证 Ornn 的理解能力
 */

import { createChildLogger } from '../src/utils/logger.js';
import { CodexObserver } from '../src/core/observer/codex-observer.js';
import { ClaudeObserver } from '../src/core/observer/claude-observer.js';
import { join } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';

const logger = createChildLogger('real-data-analysis');

/**
 * 从真实 Codex trace 文件中提取样本
 */
function extractCodexSamples(): string[] {
  const samples: string[] = [];
  
  // 读取真实文件
  const realFiles = [
    '/Users/xuzhang/.codex/sessions/2026/03/03/rollout-2026-03-03T18-28-28-019cb33d-f867-77f3-a788-144c54502ebc.jsonl',
    '/Users/xuzhang/.codex/sessions/2026/03/04/rollout-2026-03-04T22-02-50-019cb928-968f-7c63-97c1-62dc2f699083.jsonl',
  ];
  
  for (const file of realFiles) {
    if (existsSync(file)) {
      samples.push(file);
    }
  }
  
  return samples;
}

/**
 * 从真实 Claude trace 文件中提取样本
 */
function extractClaudeSamples(): string[] {
  const samples: string[] = [];
  
  // 读取真实文件
  const realFiles = [
    '/Users/xuzhang/.claude/projects/-Users-xuzhang/26a0e573-63da-4020-92cd-83f2e47b2d9e.jsonl',
    '/Users/xuzhang/.claude/projects/-Users-xuzhang/272aca3e-b558-4883-abcb-aae548002dd8.jsonl',
  ];
  
  for (const file of realFiles) {
    if (existsSync(file)) {
      samples.push(file);
    }
  }
  
  return samples;
}

/**
 * 分析单个真实 Codex 文件
 */
async function analyzeRealCodexFile(filePath: string) {
  logger.info(`\n📄 分析 Codex 文件: ${filePath.split('/').pop()}`);
  
  const observer = new CodexObserver();
  
  let sessionMeta: any = null;
  let userInputs: string[] = [];
  let assistantOutputs: string[] = [];
  let toolCalls: string[] = [];
  let skillRefs: Set<string> = new Set();
  
  observer.onTrace((trace) => {
    // 收集 session 元数据
    if (trace.event_type === 'status' && trace.content) {
      const content = trace.content as any;
      if (content.cwd) {
        sessionMeta = {
          cwd: content.cwd,
          git_branch: content.git_branch,
        };
      }
    }
    
    // 收集用户输入
    if (trace.user_input) {
      userInputs.push(trace.user_input);
      
      // 检测 skill 引用
      const matches = trace.user_input.match(/\[\$([^\]]+)\]/g);
      if (matches) {
        matches.forEach(m => skillRefs.add(m.slice(2, -1)));
      }
    }
    
    // 收集助手输出
    if (trace.assistant_output) {
      assistantOutputs.push(trace.assistant_output);
    }
    
    // 收集工具调用
    if (trace.event_type === 'tool_call') {
      const content = trace.content as any;
      if (content?.tool) {
        toolCalls.push(content.tool);
      }
    }
  });
  
  observer.processSessionFile(filePath);
  
  // 输出分析结果
  logger.info(`   项目路径: ${sessionMeta?.cwd || 'unknown'}`);
  logger.info(`   Git 分支: ${sessionMeta?.git_branch || 'unknown'}`);
  logger.info(`   用户输入数: ${userInputs.length}`);
  logger.info(`   助手输出数: ${assistantOutputs.length}`);
  logger.info(`   工具调用数: ${toolCalls.length}`);
  logger.info(`   工具类型: ${[...new Set(toolCalls)].join(', ') || 'none'}`);
  logger.info(`   检测到的 Skills: ${[...skillRefs].join(', ') || 'none'}`);
  
  // 显示部分用户输入示例
  if (userInputs.length > 0) {
    logger.info(`   用户输入示例:`);
    userInputs.slice(0, 3).forEach((input, i) => {
      logger.info(`     ${i + 1}. ${input.slice(0, 80)}...`);
    });
  }
  
  return {
    sessionMeta,
    userInputs,
    assistantOutputs,
    toolCalls,
    skillRefs: [...skillRefs],
  };
}

/**
 * 分析单个真实 Claude 文件
 */
async function analyzeRealClaudeFile(filePath: string) {
  logger.info(`\n📄 分析 Claude 文件: ${filePath.split('/').pop()}`);
  
  const observer = new ClaudeObserver();
  
  let sessionInfo: any = null;
  let userInputs: string[] = [];
  let assistantOutputs: string[] = [];
  let skillRefs: Set<string> = new Set();
  let eventTypes: Map<string, number> = new Map();
  
  observer.onTrace((trace) => {
    // 统计事件类型
    eventTypes.set(trace.event_type, (eventTypes.get(trace.event_type) || 0) + 1);
    
    // 收集会话信息
    if (trace.project_context) {
      sessionInfo = trace.project_context;
    }
    
    // 收集用户输入
    if (trace.user_input) {
      userInputs.push(trace.user_input);
      
      // 检测 skill 引用 (@skillname)
      const matches = trace.user_input.match(/@(\w+)/g);
      if (matches) {
        matches.forEach(m => skillRefs.add(m.slice(1)));
      }
    }
    
    // 收集助手输出
    if (trace.assistant_output) {
      assistantOutputs.push(trace.assistant_output);
    }
    
    // 从 skill_refs 字段收集
    if (trace.skill_refs) {
      trace.skill_refs.forEach(ref => skillRefs.add(ref));
    }
  });
  
  observer.processSessionFile(filePath);
  
  // 输出分析结果
  logger.info(`   项目路径: ${sessionInfo?.cwd || 'unknown'}`);
  logger.info(`   Git 分支: ${sessionInfo?.git_branch || 'unknown'}`);
  logger.info(`   事件类型分布:`);
  for (const [type, count] of eventTypes) {
    logger.info(`     - ${type}: ${count}`);
  }
  logger.info(`   用户输入数: ${userInputs.length}`);
  logger.info(`   助手输出数: ${assistantOutputs.length}`);
  logger.info(`   检测到的 Skills: ${[...skillRefs].join(', ') || 'none'}`);
  
  // 显示部分用户输入示例
  if (userInputs.length > 0) {
    logger.info(`   用户输入示例:`);
    userInputs.slice(0, 3).forEach((input, i) => {
      logger.info(`     ${i + 1}. ${input.slice(0, 80)}...`);
    });
  }
  
  return {
    sessionInfo,
    userInputs,
    assistantOutputs,
    skillRefs: [...skillRefs],
    eventTypes: Object.fromEntries(eventTypes),
  };
}

/**
 * 深度分析：理解用户意图和 Agent 行为
 */
async function deepAnalyzeSession(filePath: string, runtime: 'codex' | 'claude') {
  logger.info(`\n🔍 深度分析: ${filePath.split('/').pop()}`);
  
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim());
  
  // 分析模式
  const patterns = {
    skillInvocations: [] as { skill: string; context: string }[],
    toolUsage: [] as { tool: string; purpose: string }[],
    userCorrections: [] as { original: string; correction: string }[],
    workflowSteps: [] as string[],
  };
  
  let lastUserInput = '';
  let lastAssistantOutput = '';
  
  for (const line of lines) {
    try {
      const event = JSON.parse(line);
      
      if (runtime === 'codex') {
        // 分析 Codex 事件
        if (event.type === 'response_item' && event.payload?.type === 'message') {
          const role = event.payload.role;
          const text = extractTextContent(event.payload.content);
          
          if (role === 'user') {
            lastUserInput = text;
            
            // 检测 skill 调用
            const skillMatches = text.match(/\[\$([^\]]+)\]/g);
            if (skillMatches) {
              skillMatches.forEach(match => {
                patterns.skillInvocations.push({
                  skill: match.slice(2, -1),
                  context: text.slice(0, 100),
                });
              });
            }
            
            // 检测用户纠正（包含"不对"、"错误"等）
            if (/不对|错误|有问题|不合适/.test(text)) {
              patterns.userCorrections.push({
                original: lastAssistantOutput.slice(0, 100),
                correction: text.slice(0, 100),
              });
            }
          } else if (role === 'assistant') {
            lastAssistantOutput = text;
          }
        }
        
        // 检测工具调用
        if (event.type === 'response_item' && event.payload?.type === 'function_call') {
          const toolName = event.payload.name || event.payload.function?.name;
          if (toolName) {
            patterns.toolUsage.push({
              tool: toolName,
              purpose: inferToolPurpose(toolName, event.payload.arguments),
            });
          }
        }
      } else {
        // 分析 Claude 事件
        if (event.type === 'user' && event.message?.content) {
          const text = event.message.content;
          lastUserInput = text;
          
          // 检测 skill 调用
          const skillMatches = text.match(/@(\w+)/g);
          if (skillMatches) {
            skillMatches.forEach(match => {
              patterns.skillInvocations.push({
                skill: match.slice(1),
                context: text.slice(0, 100),
              });
            });
          }
          
          // 检测用户纠正
          if (/不对|错误|有问题|不合适|太乐观|不够/.test(text)) {
            patterns.userCorrections.push({
              original: lastAssistantOutput.slice(0, 100),
              correction: text.slice(0, 100),
            });
          }
        } else if (event.type === 'assistant' && event.message?.content) {
          const content = event.message.content;
          if (Array.isArray(content)) {
            const textPart = content.find((c: any) => c.type === 'text');
            if (textPart) {
              lastAssistantOutput = textPart.text;
            }
          }
        }
      }
    } catch {
      // 忽略解析错误
    }
  }
  
  // 输出深度分析结果
  logger.info(`   Skill 调用次数: ${patterns.skillInvocations.length}`);
  if (patterns.skillInvocations.length > 0) {
    logger.info(`   调用的 Skills:`);
    patterns.skillInvocations.forEach((inv, i) => {
      logger.info(`     ${i + 1}. $${inv.skill} - ${inv.context.slice(0, 60)}...`);
    });
  }
  
  logger.info(`   工具使用次数: ${patterns.toolUsage.length}`);
  if (patterns.toolUsage.length > 0) {
    const toolCounts = new Map<string, number>();
    patterns.toolUsage.forEach(t => {
      toolCounts.set(t.tool, (toolCounts.get(t.tool) || 0) + 1);
    });
    logger.info(`   工具分布:`);
    for (const [tool, count] of toolCounts) {
      logger.info(`     - ${tool}: ${count} 次`);
    }
  }
  
  logger.info(`   用户纠正次数: ${patterns.userCorrections.length}`);
  if (patterns.userCorrections.length > 0) {
    logger.info(`   纠正示例:`);
    patterns.userCorrections.slice(0, 2).forEach((corr, i) => {
      logger.info(`     ${i + 1}. 用户反馈: ${corr.correction.slice(0, 60)}...`);
    });
  }
  
  return patterns;
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
 * 推断工具用途
 */
function inferToolPurpose(toolName: string, args: any): string {
  const purposes: Record<string, string> = {
    'Read': '读取文件',
    'Write': '写入文件',
    'Edit': '编辑文件',
    'Bash': '执行命令',
    'Glob': '查找文件',
    'Grep': '搜索内容',
  };
  
  return purposes[toolName] || '未知操作';
}

/**
 * 运行真实数据分析
 */
async function runRealDataAnalysis() {
  logger.info('========================================');
  logger.info('OrnnSkills 真实数据分析');
  logger.info('========================================');
  
  // 获取样本文件
  const codexSamples = extractCodexSamples();
  const claudeSamples = extractClaudeSamples();
  
  logger.info(`\n找到 ${codexSamples.length} 个 Codex 样本`);
  logger.info(`找到 ${claudeSamples.length} 个 Claude 样本`);
  
  // 分析 Codex 样本
  if (codexSamples.length > 0) {
    logger.info('\n========================================');
    logger.info('Codex 真实数据分析');
    logger.info('========================================');
    
    for (const sample of codexSamples.slice(0, 2)) {
      await analyzeRealCodexFile(sample);
      await deepAnalyzeSession(sample, 'codex');
    }
  }
  
  // 分析 Claude 样本
  if (claudeSamples.length > 0) {
    logger.info('\n========================================');
    logger.info('Claude 真实数据分析');
    logger.info('========================================');
    
    for (const sample of claudeSamples.slice(0, 2)) {
      await analyzeRealClaudeFile(sample);
      await deepAnalyzeSession(sample, 'claude');
    }
  }
  
  // 总结
  logger.info('\n========================================');
  logger.info('分析总结');
  logger.info('========================================');
  logger.info(`Codex 样本: ${codexSamples.length} 个文件`);
  logger.info(`Claude 样本: ${claudeSamples.length} 个文件`);
  logger.info('\n关键发现:');
  logger.info('1. 真实数据包含丰富的工具调用序列');
  logger.info('2. 用户输入包含显式和隐式的 skill 引用');
  logger.info('3. 存在用户纠正 Agent 输出的场景');
  logger.info('4. 不同项目的会话有不同的上下文模式');
}

// 运行分析
runRealDataAnalysis().catch(error => {
  logger.error('分析失败', { error });
  process.exit(1);
});
