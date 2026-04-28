/**
 * OrnnSkills 调整后的 Observer 测试
 *
 * 验证调整后的 Observer 对真实数据的处理能力
 */

import { createChildLogger } from '../src/utils/logger.js';
import { CodexObserver } from '../src/core/observer/codex-observer.js';
import { ClaudeObserver } from '../src/core/observer/claude-observer.js';

const logger = createChildLogger('observer-adjusted-test');

/**
 * 测试 CodexObserver
 */
async function testCodexObserver() {
  logger.info('\n========================================');
  logger.info('测试 CodexObserver（调整后）');
  logger.info('========================================');

  const observer = new CodexObserver();
  const testFile = '/Users/xuzhang/.codex/sessions/2026/03/04/rollout-2026-03-04T01-57-13-019cb4d8-ce36-7c23-ab6a-825915630978.jsonl';
  logger.info(`测试文件: ${testFile}`);

  let sessionMetaReceived = false;
  let activatedSkills: string[] = [];
  let userFeedbackEvents: any[] = [];

  observer.onTrace((trace) => {
    // 检查 session_meta 中的 activatedSkills
    if (trace.event_type === 'status' && trace.content) {
      const content = trace.content as any;
      if (content.activatedSkills) {
        sessionMetaReceived = true;
        activatedSkills = content.activatedSkills;
        logger.info('✅ 从 session_meta 提取到 activatedSkills:', content.activatedSkills);
      }
    }

    // 检查用户反馈分析
    if (trace.event_type === 'user_input' && trace.metadata?.feedbackType) {
      userFeedbackEvents.push({
        feedbackType: trace.metadata.feedbackType,
        confidence: trace.metadata.feedbackConfidence,
        reason: trace.metadata.feedbackReason,
      });
      logger.info('✅ 检测到用户反馈:', {
        type: trace.metadata.feedbackType,
        confidence: trace.metadata.feedbackConfidence,
      });
    }
  });

  observer.processSessionFile(testFile);

  logger.info('\n📊 CodexObserver 测试结果:');
  logger.info(`   - Session Meta 处理: ${sessionMetaReceived ? '✅' : '❌'}`);
  logger.info(`   - 激活的 Skills: ${activatedSkills.length > 0 ? activatedSkills.join(', ') : '无'}`);
  logger.info(`   - 用户反馈事件: ${userFeedbackEvents.length}`);
}

/**
 * 测试 ClaudeObserver
 */
async function testClaudeObserver() {
  logger.info('\n========================================');
  logger.info('测试 ClaudeObserver（调整后）');
  logger.info('========================================');

  const observer = new ClaudeObserver();
  const testFile = '/Users/xuzhang/.claude/projects/-Users-xuzhang-kuko/044a16f8-5c19-49b0-920d-e5b5a5f887c6.jsonl';

  let userInputCount = 0;
  let userFeedbackEvents: any[] = [];
  let skillRefsFound: string[] = [];

  observer.onTrace((trace) => {
    if (trace.event_type === 'user_input') {
      userInputCount++;

      // 检查 skill 引用
      if (trace.skill_refs && trace.skill_refs.length > 0) {
        skillRefsFound.push(...trace.skill_refs);
        logger.info('✅ 检测到 Skill 引用:', trace.skill_refs);
      }

      // 检查用户反馈分析
      if (trace.metadata?.feedbackType) {
        userFeedbackEvents.push({
          feedbackType: trace.metadata.feedbackType,
          confidence: trace.metadata.feedbackConfidence,
          reason: trace.metadata.feedbackReason,
        });
        logger.info('✅ 检测到用户反馈:', {
          type: trace.metadata.feedbackType,
          confidence: trace.metadata.feedbackConfidence,
        });
      }
    }
  });

  observer.processSessionFile(testFile);

  logger.info('\n📊 ClaudeObserver 测试结果:');
  logger.info(`   - 用户输入数: ${userInputCount}`);
  logger.info(`   - Skill 引用: ${[...new Set(skillRefsFound)].join(', ') || '无'}`);
  logger.info(`   - 用户反馈事件: ${userFeedbackEvents.length}`);
}

/**
 * 运行测试
 */
async function runAdjustedTest() {
  logger.info('========================================');
  logger.info('Observer 调整后测试');
  logger.info('========================================');

  await testCodexObserver();
  await testClaudeObserver();

  logger.info('\n========================================');
  logger.info('测试完成');
  logger.info('========================================');
  logger.info('\n调整内容总结:');
  logger.info('1. ✅ CodexObserver 从 base_instructions 提取 activatedSkills');
  logger.info('2. ✅ CodexObserver 分析用户反馈（rejection/suggestion/partial_acceptance/acceptance）');
  logger.info('3. ✅ ClaudeObserver 过滤代码装饰器（@dataclass, @prisma 等）');
  logger.info('4. ✅ ClaudeObserver 分析用户反馈');
}

// 运行测试
runAdjustedTest().catch(error => {
  logger.error('测试失败', { error });
  process.exit(1);
});
