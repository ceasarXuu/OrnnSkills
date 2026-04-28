/**
 * OrnnSkills Skill 调用分析测试
 *
 * 测试目标：
 * 1. 识别哪一步发生了 skill 调用
 * 2. 识别调用了什么 skills
 * 3. 获取 skill 内容
 * 4. 判断 skill 调用的反馈结果（成功/失败/被质疑）
 */

import { createChildLogger } from '../src/utils/logger.js';
import { CodexObserver } from '../src/core/observer/codex-observer.js';
import { ClaudeObserver } from '../src/core/observer/claude-observer.js';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';

const logger = createChildLogger('skill-analysis-test');

/**
 * Skill 调用分析结果
 */
interface SkillInvocationAnalysis {
  // 调用信息
  invocationStep: number;
  timestamp: string;
  skillName: string;
  skillRef: string;  // [$skillname] 或 @skillname
  
  // Skill 内容（从文件读取）
  skillContent?: string;
  skillDescription?: string;
  
  // 调用上下文
  userIntent: string;  // 用户为什么调用这个 skill
  agentAction: string; // Agent 如何执行
  
  // 反馈结果
  feedbackType: 'success' | 'partial' | 'rejected' | 'unknown';
  feedbackReason?: string;
  userCorrection?: string;  // 用户的纠正/反馈
  
  // 优化信号
  optimizationSignal?: {
    type: 'append_context' | 'tighten_trigger' | 'add_fallback' | 'prune_noise';
    reason: string;
    confidence: number;
  };
}

/**
 * 测试场景定义
 */
const testScenarios = [
  {
    name: 'Codex - [$checks] Skill 调用与质疑',
    file: 'codex-test-samples.jsonl',
    expectedInvocations: [
      {
        step: 1,
        skill: 'checks',
        userIntent: '检查代码质量',
        expectedFeedback: 'rejected',
        rejectionReason: '用户认为不需要 try-catch',
      }
    ]
  },
  {
    name: 'Claude - @business-opportunity-assessment 多次调用与纠正',
    file: 'claude-test-samples.jsonl',
    expectedInvocations: [
      {
        step: 1,
        skill: 'business-opportunity-assessment',
        userIntent: '评估 SaaS 想法',
        expectedFeedback: 'partial',
        correctionContent: '独立开发者付费意愿低',
      }
    ]
  }
];

/**
 * 分析单个 trace 文件
 */
async function analyzeTraceFile(filePath: string, runtime: 'codex' | 'claude'): Promise<SkillInvocationAnalysis[]> {
  const analyses: SkillInvocationAnalysis[] = [];
  const traces: any[] = [];
  
  // 读取并解析 trace 文件
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim());
  
  for (const line of lines) {
    try {
      traces.push(JSON.parse(line));
    } catch {
      // 忽略解析错误
    }
  }
  
  logger.info(`\n📄 分析文件: ${filePath}`);
  logger.info(`   共 ${traces.length} 条 trace`);
  
  // 使用 Observer 处理
  const observer = runtime === 'codex' 
    ? new CodexObserver(join(process.cwd(), 'test', 'fixtures'))
    : new ClaudeObserver(join(process.cwd(), 'test', 'fixtures'));
  
  let stepCounter = 0;
  let currentSkill: string | null = null;
  let userIntent = '';
  
  observer.onTrace((trace) => {
    stepCounter++;
    
    // 检测 skill 引用
    const skillRefs = trace.skill_refs || [];
    
    if (skillRefs.length > 0) {
      // 发现 skill 调用
      currentSkill = skillRefs[0];
      
      if (trace.user_input) {
        userIntent = trace.user_input;
      }
      
      logger.info(`\n   [Step ${stepCounter}] 发现 Skill 调用`);
      logger.info(`   - Skill: ${currentSkill}`);
      logger.info(`   - 引用格式: ${runtime === 'codex' ? '[$' + currentSkill + ']' : '@' + currentSkill}`);
      logger.info(`   - 用户意图: ${userIntent.slice(0, 80)}...`);
      
      // 尝试读取 skill 内容
      const skillContent = loadSkillContent(currentSkill, runtime);
      
      analyses.push({
        invocationStep: stepCounter,
        timestamp: trace.timestamp,
        skillName: currentSkill,
        skillRef: runtime === 'codex' ? `[$${currentSkill}]` : `@${currentSkill}`,
        skillContent: skillContent?.slice(0, 500),
        skillDescription: extractSkillDescription(skillContent),
        userIntent: userIntent,
        agentAction: '',
        feedbackType: 'unknown',
      });
    }
    
    // 检测用户反馈（在 skill 调用之后）
    if (currentSkill && trace.user_input) {
      const feedback = analyzeUserFeedback(trace.user_input);
      if (feedback.type !== 'unknown') {
        const lastAnalysis = analyses[analyses.length - 1];
        if (lastAnalysis && lastAnalysis.skillName === currentSkill) {
          lastAnalysis.feedbackType = feedback.type;
          lastAnalysis.feedbackReason = feedback.reason;
          lastAnalysis.userCorrection = trace.user_input;
          
          logger.info(`   - 用户反馈: ${feedback.type}`);
          logger.info(`   - 反馈原因: ${feedback.reason}`);
          
          // 生成优化信号
          lastAnalysis.optimizationSignal = generateOptimizationSignal(
            lastAnalysis.skillName,
            feedback.type,
            feedback.reason
          );
        }
      }
    }
    
    // 记录 Agent 响应
    if (currentSkill && trace.assistant_output) {
      const lastAnalysis = analyses[analyses.length - 1];
      if (lastAnalysis && lastAnalysis.skillName === currentSkill) {
        lastAnalysis.agentAction = trace.assistant_output.slice(0, 200);
      }
    }
  });
  
  // 处理文件
  observer.processSessionFile(filePath);
  
  return analyses;
}

/**
 * 加载 skill 内容
 */
function loadSkillContent(skillName: string, runtime: 'codex' | 'claude'): string | undefined {
  try {
    const skillPath = runtime === 'codex'
      ? join(process.env.HOME || '', '.codex', 'skills', skillName, 'skill.md')
      : join(process.env.HOME || '', '.claude', 'skills', skillName, 'skill.md');
    
    return readFileSync(skillPath, 'utf-8');
  } catch {
    return undefined;
  }
}

/**
 * 提取 skill 描述
 */
function extractSkillDescription(content?: string): string | undefined {
  if (!content) return undefined;
  
  // 匹配 YAML frontmatter 中的 description
  const match = content.match(/description:\s*(.+)/);
  return match ? match[1].trim() : undefined;
}

/**
 * 分析用户反馈
 */
function analyzeUserFeedback(userInput: string): { type: 'success' | 'partial' | 'rejected' | 'unknown'; reason: string } {
  const input = userInput.toLowerCase();
  
  // 拒绝信号
  if (input.includes('不对') || input.includes('错误') || input.includes('不需要') || 
      input.includes('太乐观') || input.includes('不正确')) {
    return { type: 'rejected', reason: '用户明确表示不同意' };
  }
  
  // 部分接受信号
  if (input.includes('但是') || input.includes('不过') || input.includes('我觉得') ||
      input.includes('可能') || input.includes('或许')) {
    return { type: 'partial', reason: '用户提出修正或补充' };
  }
  
  // 接受信号
  if (input.includes('好的') || input.includes('谢谢') || input.includes('明白了') ||
      input.includes('ok') || input.includes('没问题')) {
    return { type: 'success', reason: '用户表示接受' };
  }
  
  return { type: 'unknown', reason: '无法判断' };
}

/**
 * 生成优化信号
 */
function generateOptimizationSignal(
  skillName: string,
  feedbackType: string,
  reason: string
): { type: string; reason: string; confidence: number } | undefined {
  if (feedbackType === 'rejected') {
    return {
      type: 'tighten_trigger',
      reason: `Skill ${skillName} 的建议被用户拒绝，可能需要收紧适用条件`,
      confidence: 0.8,
    };
  }
  
  if (feedbackType === 'partial') {
    return {
      type: 'append_context',
      reason: `Skill ${skillName} 的输出被用户部分纠正，需要补充上下文`,
      confidence: 0.7,
    };
  }
  
  return undefined;
}

/**
 * 打印分析报告
 */
function printAnalysisReport(analyses: SkillInvocationAnalysis[]) {
  logger.info('\n📊 Skill 调用分析报告');
  logger.info('======================\n');
  
  for (const analysis of analyses) {
    logger.info(`🔹 调用 #${analysis.invocationStep}`);
    logger.info(`   Skill 名称: ${analysis.skillName}`);
    logger.info(`   引用格式: ${analysis.skillRef}`);
    logger.info(`   时间戳: ${analysis.timestamp}`);
    
    if (analysis.skillDescription) {
      logger.info(`   Skill 描述: ${analysis.skillDescription}`);
    }
    
    logger.info(`   用户意图: ${analysis.userIntent.slice(0, 100)}...`);
    logger.info(`   Agent 行动: ${analysis.agentAction.slice(0, 100)}...`);
    
    logger.info(`   反馈结果: ${analysis.feedbackType}`);
    if (analysis.feedbackReason) {
      logger.info(`   反馈原因: ${analysis.feedbackReason}`);
    }
    
    if (analysis.userCorrection) {
      logger.info(`   用户纠正: ${analysis.userCorrection.slice(0, 100)}...`);
    }
    
    if (analysis.optimizationSignal) {
      logger.info(`   💡 优化建议:`);
      logger.info(`      类型: ${analysis.optimizationSignal.type}`);
      logger.info(`      原因: ${analysis.optimizationSignal.reason}`);
      logger.info(`      置信度: ${analysis.optimizationSignal.confidence}`);
    }
    
    logger.info('');
  }
}

/**
 * 运行测试
 */
async function runSkillAnalysisTest() {
  logger.info('========================================');
  logger.info('OrnnSkills Skill 调用分析测试');
  logger.info('========================================\n');
  
  const fixturesDir = join(process.cwd(), 'test', 'fixtures');
  
  // 测试 1: Codex
  logger.info('🧪 测试 1: Codex Skill 调用分析');
  const codexAnalyses = await analyzeTraceFile(
    join(fixturesDir, 'codex-test-samples.jsonl'),
    'codex'
  );
  printAnalysisReport(codexAnalyses);
  
  // 测试 2: Claude
  logger.info('\n🧪 测试 2: Claude Skill 调用分析');
  const claudeAnalyses = await analyzeTraceFile(
    join(fixturesDir, 'claude-test-samples.jsonl'),
    'claude'
  );
  printAnalysisReport(claudeAnalyses);
  
  // 总结
  logger.info('\n========================================');
  logger.info('测试总结');
  logger.info('========================================');
  logger.info(`Codex: 识别 ${codexAnalyses.length} 次 Skill 调用`);
  logger.info(`Claude: 识别 ${claudeAnalyses.length} 次 Skill 调用`);
  
  const totalOptimizations = [...codexAnalyses, ...claudeAnalyses].filter(
    a => a.optimizationSignal
  ).length;
  logger.info(`生成优化信号: ${totalOptimizations} 个`);
}

// 运行测试
runSkillAnalysisTest().catch(error => {
  logger.error('测试失败', { error });
  process.exit(1);
});
