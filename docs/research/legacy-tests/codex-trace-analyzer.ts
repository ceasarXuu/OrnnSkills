/**
 * Codex Trace 分析测试脚本
 * 用于分析 Codex 本地日志文件的真实数据结构
 */

import * as fs from 'fs';
import * as path from 'path';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';

interface CodexTraceEvent {
  timestamp: string;
  type: string;
  payload: any;
}

interface SessionInfo {
  id: string;
  thread_name: string;
  updated_at: string;
}

/**
 * 读取 Codex archived_sessions 中的 JSONL 文件
 */
async function readArchivedSession(filePath: string): Promise<CodexTraceEvent[]> {
  const events: CodexTraceEvent[] = [];
  const fileStream = createReadStream(filePath);
  const rl = createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    if (line.trim()) {
      try {
        const event = JSON.parse(line);
        events.push(event);
      } catch (e) {
        console.error('解析 JSON 失败:', line.substring(0, 100));
      }
    }
  }

  return events;
}

/**
 * 读取 session_index.jsonl
 */
async function readSessionIndex(filePath: string): Promise<SessionInfo[]> {
  const sessions: SessionInfo[] = [];
  const fileStream = createReadStream(filePath);
  const rl = createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    if (line.trim()) {
      try {
        const session = JSON.parse(line);
        sessions.push(session);
      } catch (e) {
        // 忽略解析错误
      }
    }
  }

  return sessions;
}

/**
 * 分析 trace 事件类型分布
 */
function analyzeEventTypes(events: CodexTraceEvent[]): Map<string, number> {
  const typeCount = new Map<string, number>();

  for (const event of events) {
    const type = event.type || 'unknown';
    typeCount.set(type, (typeCount.get(type) || 0) + 1);
  }

  return typeCount;
}

/**
 * 提取 function_call 事件
 */
function extractFunctionCalls(events: CodexTraceEvent[]): any[] {
  return events
    .filter(e => e.type === 'response_item' && e.payload?.type === 'function_call')
    .map(e => e.payload);
}

/**
 * 提取 agent_reasoning 事件
 */
function extractAgentReasoning(events: CodexTraceEvent[]): any[] {
  return events
    .filter(e => e.type === 'event_msg' && e.payload?.type === 'agent_reasoning')
    .map(e => e.payload);
}

/**
 * 分析 trace 中是否包含 skill 相关信息
 */
function analyzeSkillReferences(events: CodexTraceEvent[]): {
  hasSkillReference: boolean;
  skillMentions: string[];
  toolCalls: string[];
} {
  const skillMentions: string[] = [];
  const toolCalls: string[] = [];
  let hasSkillReference = false;

  for (const event of events) {
    const text = JSON.stringify(event).toLowerCase();

    // 检查是否提到 skill
    if (text.includes('skill') || text.includes('技能')) {
      hasSkillReference = true;
    }

    // 提取 function_call 中的工具名
    if (event.type === 'response_item' && event.payload?.type === 'function_call') {
      const toolName = event.payload.name || event.payload.function?.name;
      if (toolName) {
        toolCalls.push(toolName);
      }
    }

    // 提取 reasoning 中的文本
    if (event.payload?.text) {
      const reasoningText = event.payload.text;
      if (reasoningText.toLowerCase().includes('skill')) {
        skillMentions.push(reasoningText.substring(0, 200));
      }
    }
  }

  return { hasSkillReference, skillMentions, toolCalls };
}

/**
 * 主测试函数
 */
async function main() {
  const codexDir = path.join(process.env.HOME || '', '.codex');
  const archivedSessionsDir = path.join(codexDir, 'archived_sessions');
  const sessionIndexPath = path.join(codexDir, 'session_index.jsonl');

  console.log('=== Codex Trace 分析测试 ===\n');

  // 1. 读取 session index
  console.log('1. 读取 Session Index...');
  const sessions = await readSessionIndex(sessionIndexPath);
  console.log(`   共有 ${sessions.length} 个会话记录\n`);

  // 显示最近的 5 个会话
  console.log('   最近的 5 个会话:');
  sessions.slice(0, 5).forEach((s, i) => {
    console.log(`   ${i + 1}. [${s.id}] ${s.thread_name}`);
  });
  console.log();

  // 2. 读取最新的 archived session
  const sessionFiles = fs.readdirSync(archivedSessionsDir)
    .filter(f => f.endsWith('.jsonl'))
    .sort()
    .reverse();

  if (sessionFiles.length === 0) {
    console.log('没有找到 archived session 文件');
    return;
  }

  const latestSessionFile = sessionFiles[0];
  const sessionPath = path.join(archivedSessionsDir, latestSessionFile);

  console.log(`2. 分析最新的 Session: ${latestSessionFile}`);
  const events = await readArchivedSession(sessionPath);
  console.log(`   共有 ${events.length} 个事件\n`);

  // 3. 分析事件类型分布
  console.log('3. 事件类型分布:');
  const typeCount = analyzeEventTypes(events);
  for (const [type, count] of typeCount.entries()) {
    console.log(`   - ${type}: ${count}`);
  }
  console.log();

  // 4. 提取 function calls
  const functionCalls = extractFunctionCalls(events);
  console.log(`4. Function Call 数量: ${functionCalls.length}`);
  if (functionCalls.length > 0) {
    console.log('   工具调用列表:');
    const uniqueTools = [...new Set(functionCalls.map(fc => fc.name || fc.function?.name).filter(Boolean))];
    uniqueTools.slice(0, 10).forEach(tool => {
      console.log(`   - ${tool}`);
    });
  }
  console.log();

  // 5. 提取 agent reasoning
  const reasonings = extractAgentReasoning(events);
  console.log(`5. Agent Reasoning 数量: ${reasonings.length}`);
  if (reasonings.length > 0) {
    console.log('   示例 Reasoning:');
    reasonings.slice(0, 3).forEach((r, i) => {
      console.log(`   ${i + 1}. ${r.text?.substring(0, 100) || 'N/A'}...`);
    });
  }
  console.log();

  // 6. 分析 skill 引用
  console.log('6. Skill 引用分析:');
  const skillAnalysis = analyzeSkillReferences(events);
  console.log(`   - 是否包含 Skill 引用: ${skillAnalysis.hasSkillReference}`);
  console.log(`   - Skill Mentions 数量: ${skillAnalysis.skillMentions.length}`);
  console.log(`   - 不同工具调用数量: ${[...new Set(skillAnalysis.toolCalls)].length}`);
  console.log();

  // 7. 显示原始事件样本
  console.log('7. 原始事件样本 (前 3 个):');
  events.slice(0, 3).forEach((event, i) => {
    console.log(`\n   事件 ${i + 1}:`);
    console.log(`   - 类型: ${event.type}`);
    console.log(`   - 时间戳: ${event.timestamp}`);
    console.log(`   - Payload 键: ${Object.keys(event.payload || {}).join(', ')}`);
  });

  console.log('\n=== 分析完成 ===');
}

// 运行测试
main().catch(console.error);
