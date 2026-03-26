/**
 * ClaudeObserver 测试脚本
 *
 * 测试 ClaudeObserver 的基本功能
 */

import { ClaudeObserver } from '../src/core/observer/claude-observer.js';
import { createChildLogger } from '../src/utils/logger.js';

const logger = createChildLogger('claude-observer-test');

/**
 * 运行测试
 */
async function runTest() {
  logger.info('Starting ClaudeObserver test');

  // 创建 observer
  const observer = new ClaudeObserver();

  // 注册 trace 回调
  observer.onTrace((trace) => {
    logger.info('Trace received', {
      trace_id: trace.trace_id,
      event_type: trace.event_type,
      session_id: trace.session_id,
    });

    // 打印详细内容
    if (trace.user_input) {
      logger.info('User input', { content: trace.user_input.slice(0, 100) });
    }
    if (trace.assistant_output) {
      logger.info('Assistant output', { content: trace.assistant_output.slice(0, 100) });
    }
  });

  // 查找一个测试文件
  const testFile = process.argv[2];
  if (testFile) {
    logger.info(`Processing test file: ${testFile}`);
    try {
      observer.processSessionFile(testFile);
    } catch (error) {
      logger.error('Failed to process test file', { error });
    }
  } else {
    // 启动监听模式
    logger.info('Starting observer in watch mode');
    observer.start();

    // 运行 30 秒后停止
    logger.info('Observer running for 30 seconds...');
    await new Promise(resolve => setTimeout(resolve, 30000));

    logger.info('Stopping observer');
    await observer.stop();
  }

  logger.info('Test completed');
}

// 运行测试
runTest().catch(error => {
  logger.error('Test failed', { error });
  process.exit(1);
});
