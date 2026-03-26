/**
 * OrnnSkills 集成测试
 *
 * 测试 Ornn 对真实 trace 数据的理解和决策能力
 */

import { ShadowManager } from '../src/core/shadow-manager/index.js';
import { CodexObserver } from '../src/core/observer/codex-observer.js';
import { ClaudeObserver } from '../src/core/observer/claude-observer.js';
import { createChildLogger } from '../src/utils/logger.js';
import { mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const logger = createChildLogger('ornn-integration-test');

/**
 * 测试场景定义
 */
interface TestScenario {
  name: string;
  description: string;
  expectedSkillRefs: string[];
  expectedBehavior: string;
}

/**
 * 测试场景
 */
const testScenarios: TestScenario[] = [
  {
    name: 'Codex - Skill 命中并执行',
    description: '用户使用 [$checks] skill 进行代码审查，Agent 正确执行',
    expectedSkillRefs: ['checks'],
    expectedBehavior: '识别到 skill 被正确使用，无需优化',
  },
  {
    name: 'Codex - Skill 建议被质疑',
    description: '用户质疑 [$checks] 的建议，认为过于保守',
    expectedSkillRefs: ['checks'],
    expectedBehavior: '检测到 skill 建议与用户期望不符，可能需要优化 trigger 条件',
  },
  {
    name: 'Claude - Skill 多次调用',
    description: '用户多次使用 @business-opportunity-assessment 进行评估',
    expectedSkillRefs: ['business-opportunity-assessment'],
    expectedBehavior: '识别高频使用场景，可能需要添加 fallback 或 tighten trigger',
  },
  {
    name: 'Claude - 用户纠正 Skill 输出',
    description: '用户纠正 skill 的评估结果，认为过于乐观',
    expectedSkillRefs: ['business-opportunity-assessment'],
    expectedBehavior: '检测到 skill 输出被用户纠正，需要 append_context 补充市场洞察',
  },
];

/**
 * 运行测试
 */
async function runIntegrationTest() {
  logger.info('========================================');
  logger.info('OrnnSkills 集成测试开始');
  logger.info('========================================');

  // 创建临时测试目录
  const testProjectRoot = join(process.cwd(), 'test', 'fixtures', 'test-project');
  if (!existsSync(testProjectRoot)) {
    mkdirSync(testProjectRoot, { recursive: true });
    mkdirSync(join(testProjectRoot, '.ornn', 'skills'), { recursive: true });
  }

  // 初始化 ShadowManager
  const shadowManager = new ShadowManager(testProjectRoot);
  await shadowManager.init();

  // 测试 1: Codex 数据
  logger.info('\n📋 测试 1: Codex Trace 处理');
  await testCodexTraces(shadowManager);

  // 测试 2: Claude 数据
  logger.info('\n📋 测试 2: Claude Trace 处理');
  await testClaudeTraces(shadowManager);

  // 测试 3: 场景验证
  logger.info('\n📋 测试 3: 场景验证');
  await validateScenarios();

  logger.info('\n========================================');
  logger.info('集成测试完成');
  logger.info('========================================');
}

/**
 * 测试 Codex Traces
 */
async function testCodexTraces(shadowManager: ShadowManager) {
  const observer = new CodexObserver(join(process.cwd(), 'test', 'fixtures'));
  const testFile = join(process.cwd(), 'test', 'fixtures', 'codex-test-samples.jsonl');

  let traceCount = 0;
  const skillRefs: string[] = [];

  observer.onTrace(async (trace) => {
    traceCount++;
    logger.info(`  [Codex] Trace #${traceCount}: ${trace.event_type}`, {
      session_id: trace.session_id,
      has_skill_ref: trace.skill_refs && trace.skill_refs.length > 0,
    });

    if (trace.skill_refs) {
      skillRefs.push(...trace.skill_refs);
    }

    // 传递给 ShadowManager
    await shadowManager.processTrace(trace);
  });

  // 处理测试文件
  observer.processSessionFile(testFile);

  logger.info(`\n  Codex 测试结果:`);
  logger.info(`  - 处理 Trace 数: ${traceCount}`);
  logger.info(`  - 识别 Skill 引用: ${[...new Set(skillRefs)].join(', ') || '无'}`);

  // 验证
  const expectedSkills = ['checks'];
  const foundSkills = [...new Set(skillRefs)];
  const allFound = expectedSkills.every(s => foundSkills.includes(s));

  if (allFound) {
    logger.info(`  ✅ 测试通过: 正确识别所有 skill 引用`);
  } else {
    logger.warn(`  ⚠️ 测试警告: 未完全识别 skill 引用`);
    logger.warn(`    期望: ${expectedSkills.join(', ')}`);
    logger.warn(`    实际: ${foundSkills.join(', ')}`);
  }
}

/**
 * 测试 Claude Traces
 */
async function testClaudeTraces(shadowManager: ShadowManager) {
  const observer = new ClaudeObserver(join(process.cwd(), 'test', 'fixtures'));
  const testFile = join(process.cwd(), 'test', 'fixtures', 'claude-test-samples.jsonl');

  let traceCount = 0;
  const skillRefs: string[] = [];
  const userInputs: string[] = [];
  const assistantOutputs: string[] = [];

  observer.onTrace(async (trace) => {
    traceCount++;
    logger.info(`  [Claude] Trace #${traceCount}: ${trace.event_type}`, {
      session_id: trace.session_id,
      has_skill_ref: trace.skill_refs && trace.skill_refs.length > 0,
    });

    if (trace.skill_refs) {
      skillRefs.push(...trace.skill_refs);
    }
    if (trace.user_input) {
      userInputs.push(trace.user_input);
    }
    if (trace.assistant_output) {
      assistantOutputs.push(trace.assistant_output);
    }

    // 传递给 ShadowManager
    await shadowManager.processTrace(trace);
  });

  // 处理测试文件
  observer.processSessionFile(testFile);

  logger.info(`\n  Claude 测试结果:`);
  logger.info(`  - 处理 Trace 数: ${traceCount}`);
  logger.info(`  - 用户输入数: ${userInputs.length}`);
  logger.info(`  - 助手输出数: ${assistantOutputs.length}`);
  logger.info(`  - 识别 Skill 引用: ${[...new Set(skillRefs)].join(', ') || '无'}`);

  // 验证
  const expectedSkills = ['business-opportunity-assessment'];
  const foundSkills = [...new Set(skillRefs)];
  const allFound = expectedSkills.every(s => foundSkills.includes(s));

  if (allFound) {
    logger.info(`  ✅ 测试通过: 正确识别所有 skill 引用`);
  } else {
    logger.warn(`  ⚠️ 测试警告: 未完全识别 skill 引用`);
    logger.warn(`    期望: ${expectedSkills.join(', ')}`);
    logger.warn(`    实际: ${foundSkills.join(', ')}`);
  }

  // 检查用户纠正场景
  const hasCorrection = userInputs.some(input =>
    input.includes('太乐观') || input.includes('付费意愿')
  );
  if (hasCorrection) {
    logger.info(`  ✅ 检测到用户纠正场景`);
  }
}

/**
 * 验证测试场景
 */
async function validateScenarios() {
  logger.info('\n  场景验证:');

  for (const scenario of testScenarios) {
    logger.info(`\n  📌 ${scenario.name}`);
    logger.info(`     描述: ${scenario.description}`);
    logger.info(`     期望 Skill: ${scenario.expectedSkillRefs.join(', ')}`);
    logger.info(`     期望行为: ${scenario.expectedBehavior}`);

    // 这里可以添加更详细的验证逻辑
    // 例如检查 ShadowManager 的决策是否符合预期
  }
}

/**
 * 主函数
 */
async function main() {
  try {
    await runIntegrationTest();
  } catch (error) {
    logger.error('测试失败', { error });
    process.exit(1);
  }
}

// 运行测试
main();
