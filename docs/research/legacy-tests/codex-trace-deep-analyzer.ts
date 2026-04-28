/**
 * Codex Trace 深度分析测试脚本
 * 深入分析 skills 引用和 trace 结构
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
        // 忽略解析错误
      }
    }
  }

  return events;
}

/**
 * 分析 session_meta 中的关键信息
 */
function analyzeSessionMeta(events: CodexTraceEvent[]): any {
  const metaEvent = events.find(e => e.type === 'session_meta');
  if (!metaEvent) return null;

  const payload = metaEvent.payload;
  return {
    id: payload.id,
    timestamp: payload.timestamp,
    cwd: payload.cwd,
    originator: payload.originator,
    cli_version: payload.cli_version,
    model_provider: payload.model_provider,
    hasBaseInstructions: !!payload.base_instructions,
    baseInstructionsLength: payload.base_instructions?.length || 0,
    hasDynamicTools: !!payload.dynamic_tools && payload.dynamic_tools.length > 0,
    dynamicToolsCount: payload.dynamic_tools?.length || 0,
    hasGit: !!payload.git,
    gitBranch: payload.git?.branch,
  };
}

/**
 * 从 base_instructions 中提取 skills 相关信息
 */
function extractSkillsFromInstructions(events: CodexTraceEvent[]): {
  skillsPath: string | null;
  skillsMentions: string[];
} {
  const metaEvent = events.find(e => e.type === 'session_meta');
  const instructions = String(metaEvent?.payload?.base_instructions || '');

  const skillsMentions: string[] = [];
  let skillsPath: string | null = null;

  // 查找 skills 路径引用
  const pathMatches = instructions.match(/\$CODEX_HOME\/skills\/[^\s\]\)]+/g);
  if (pathMatches) {
    skillsPath = pathMatches[0];
  }

  // 查找所有 skills 提及
  const skillMatches = instructions.match(/\[\$[^\]]+\]\([^)]+\/skills\/[^)]+\)/g);
  if (skillMatches) {
    skillsMentions.push(...skillMatches.slice(0, 5));
  }

  return { skillsPath, skillsMentions };
}

/**
 * 分析 function_call 详情
 */
function analyzeFunctionCalls(events: CodexTraceEvent[]): any[] {
  const functionCalls = events.filter(
    e => e.type === 'response_item' && e.payload?.type === 'function_call'
  );

  return functionCalls.map(fc => ({
    timestamp: fc.timestamp,
    name: fc.payload.name,
    call_id: fc.payload.call_id,
    arguments: fc.payload.arguments,
    argumentsPreview: fc.payload.arguments ?
      JSON.stringify(fc.payload.arguments).substring(0, 100) + '...' :
      'N/A'
  }));
}

/**
 * 分析用户输入和助手输出
 */
function analyzeConversation(events: CodexTraceEvent[]): {
  userInputs: string[];
  assistantOutputs: string[];
} {
  const userInputs: string[] = [];
  const assistantOutputs: string[] = [];

  for (const event of events) {
    if (event.type === 'response_item') {
      if (event.payload?.type === 'message' && event.payload?.role === 'user') {
        const content = event.payload.content;
        if (typeof content === 'string') {
          userInputs.push(content.substring(0, 200));
        } else if (Array.isArray(content)) {
          const text = content.find((c: any) => c.type === 'input_text')?.text;
          if (text) userInputs.push(text.substring(0, 200));
        }
      }

      if (event.payload?.type === 'message' && event.payload?.role === 'assistant') {
        const content = event.payload.content;
        if (typeof content === 'string') {
          assistantOutputs.push(content.substring(0, 200));
        } else if (Array.isArray(content)) {
          const text = content.find((c: any) => c.type === 'output_text')?.text;
          if (text) assistantOutputs.push(text.substring(0, 200));
        }
      }
    }
  }

  return { userInputs, assistantOutputs };
}

/**
 * 检查是否使用了 skill
 */
function detectSkillUsage(events: CodexTraceEvent[]): {
  hasExplicitSkillUsage: boolean;
  skillReferences: string[];
  reasoningAboutSkills: string[];
} {
  const skillReferences: string[] = [];
  const reasoningAboutSkills: string[] = [];

  for (const event of events) {
    const eventStr = JSON.stringify(event);

    // 检查是否有 [$skillname] 格式的引用
    const skillMatches = eventStr.match(/\[\$[^\]]+\]/g);
    if (skillMatches) {
      skillReferences.push(...skillMatches);
    }

    // 检查 reasoning 中是否提到 skills
    if (event.payload?.text && event.payload.text.toLowerCase().includes('skill')) {
      reasoningAboutSkills.push(event.payload.text.substring(0, 150));
    }
  }

  return {
    hasExplicitSkillUsage: skillReferences.length > 0,
    skillReferences: [...new Set(skillReferences)],
    reasoningAboutSkills
  };
}

/**
 * 主测试函数
 */
async function main() {
  const codexDir = path.join(process.env.HOME || '', '.codex');
  const archivedSessionsDir = path.join(codexDir, 'archived_sessions');

  console.log('=== Codex Trace 深度分析 ===\n');

  // 读取最新的几个 session 文件
  const sessionFiles = fs.readdirSync(archivedSessionsDir)
    .filter(f => f.endsWith('.jsonl'))
    .sort()
    .reverse()
    .slice(0, 3);

  for (const sessionFile of sessionFiles) {
    const sessionPath = path.join(archivedSessionsDir, sessionFile);
    console.log(`\n--- 分析 Session: ${sessionFile} ---`);

    const events = await readArchivedSession(sessionPath);

    // 1. Session Meta 分析
    console.log('\n1. Session Meta 信息:');
    const meta = analyzeSessionMeta(events);
    if (meta) {
      console.log(`   - ID: ${meta.id}`);
      console.log(`   - 工作目录: ${meta.cwd}`);
      console.log(`   - 模型提供商: ${meta.model_provider}`);
      console.log(`   - CLI 版本: ${meta.cli_version}`);
      console.log(`   - 有基础指令: ${meta.hasBaseInstructions}`);
      console.log(`   - 指令长度: ${meta.baseInstructionsLength} 字符`);
      console.log(`   - 动态工具数量: ${meta.dynamicToolsCount}`);
      console.log(`   - Git 分支: ${meta.gitBranch || 'N/A'}`);
    }

    // 2. Skills 路径分析
    console.log('\n2. Skills 引用分析:');
    const skillsInfo = extractSkillsFromInstructions(events);
    console.log(`   - Skills 路径: ${skillsInfo.skillsPath || '未找到'}`);
    console.log(`   - Skills 提及: ${skillsInfo.skillsMentions.length > 0 ? skillsInfo.skillsMentions.join(', ') : '无'}`);

    // 3. Skill 使用检测
    console.log('\n3. Skill 使用检测:');
    const skillUsage = detectSkillUsage(events);
    console.log(`   - 显式 Skill 使用: ${skillUsage.hasExplicitSkillUsage}`);
    console.log(`   - Skill 引用: ${skillUsage.skillReferences.join(', ') || '无'}`);

    // 4. Function Calls 分析
    console.log('\n4. Function Calls 分析:');
    const functionCalls = analyzeFunctionCalls(events);
    console.log(`   - 总调用次数: ${functionCalls.length}`);

    // 统计工具使用
    const toolCounts = new Map<string, number>();
    for (const fc of functionCalls) {
      toolCounts.set(fc.name, (toolCounts.get(fc.name) || 0) + 1);
    }
    console.log('   - 工具使用统计:');
    for (const [tool, count] of toolCounts.entries()) {
      console.log(`     * ${tool}: ${count} 次`);
    }

    // 5. 对话分析
    console.log('\n5. 对话分析:');
    const conversation = analyzeConversation(events);
    console.log(`   - 用户输入数量: ${conversation.userInputs.length}`);
    console.log(`   - 助手输出数量: ${conversation.assistantOutputs.length}`);

    if (conversation.userInputs.length > 0) {
      console.log('   - 首条用户输入:');
      console.log(`     ${conversation.userInputs[0].substring(0, 100)}...`);
    }

    console.log('\n' + '='.repeat(60));
  }

  console.log('\n=== 分析完成 ===');
}

// 运行测试
main().catch(console.error);
