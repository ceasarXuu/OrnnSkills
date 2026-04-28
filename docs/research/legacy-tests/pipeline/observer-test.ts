/**
 * Observer 层测试
 *
 * 测试目标：验证 Observer 正确提取原始数据，不做任何语义分析
 */

import { createChildLogger } from '../../src/utils/logger.js';
import { CodexObserver } from '../../src/core/observer/codex-observer.js';
import { ClaudeObserver } from '../../src/core/observer/claude-observer.js';
import { join } from 'node:path';
import { strict as assert } from 'node:assert';

const logger = createChildLogger('observer-test');

/**
 * 测试结果
 */
interface TestResult {
  testName: string;
  passed: boolean;
  duration: number;
  details: Record<string, unknown>;
  error?: string;
}

/**
 * 测试套件
 */
class ObserverTestSuite {
  private results: TestResult[] = [];

  async runAll(): Promise<void> {
    logger.info('========================================');
    logger.info('Observer 层测试开始');
    logger.info('========================================');

    // Codex 测试
    await this.testCodexSuccessScenario();
    await this.testCodexRejectedScenario();
    await this.testCodexSuggestionScenario();

    // Claude 测试
    await this.testClaudeMultiCallScenario();
    await this.testClaudeCorrectionScenario();

    // 报告结果
    this.reportResults();
  }

  /**
   * 测试 Codex - 成功场景
   */
  private async testCodexSuccessScenario(): Promise<void> {
    const testName = 'Codex - 成功场景数据提取';
    const startTime = Date.now();

    try {
      const observer = new CodexObserver(join(process.cwd(), 'test', 'fixtures'));
      const testFile = join(process.cwd(), 'test', 'fixtures', 'codex', 'success-scenario.jsonl');

      const traces: any[] = [];
      observer.onTrace((trace) => {
        traces.push(trace);
      });

      observer.processSessionFile(testFile);

      // 验证提取的数据
      assert(traces.length > 0, '应该提取到 traces');

      // 验证 session_meta (status event)
      const sessionMeta = traces.find(t => t.event_type === 'status');
      assert(sessionMeta, '应该提取到 session_meta');
      assert(sessionMeta.skill_refs?.includes('code-review'), '应该识别到 code-review skill');

      // 验证 user_input
      const userInputs = traces.filter(t => t.event_type === 'user_input');
      assert(userInputs.length >= 1, '应该提取到用户输入');

      // 验证 skill_refs
      const skillRefs = traces.flatMap(t => t.skill_refs || []);
      assert(skillRefs.includes('code-review'), '应该提取到 code-review 引用');

      // 验证：没有语义分析（metadata 中没有 feedbackType）
      const userInputWithAnalysis = traces.find(
        t => t.event_type === 'user_input' && t.metadata?.feedbackType
      );
      assert(!userInputWithAnalysis, 'Observer 不应该进行语义分析');

      this.results.push({
        testName,
        passed: true,
        duration: Date.now() - startTime,
        details: {
          totalTraces: traces.length,
          userInputs: userInputs.length,
          skillRefs: [...new Set(skillRefs)],
        },
      });

      logger.info(`✅ ${testName} - 通过`);
    } catch (error) {
      this.results.push({
        testName,
        passed: false,
        duration: Date.now() - startTime,
        details: {},
        error: error instanceof Error ? error.message : String(error),
      });
      logger.error(`❌ ${testName} - 失败`, { error });
    }
  }

  /**
   * 测试 Codex - 被质疑场景
   */
  private async testCodexRejectedScenario(): Promise<void> {
    const testName = 'Codex - 被质疑场景数据提取';
    const startTime = Date.now();

    try {
      const observer = new CodexObserver(join(process.cwd(), 'test', 'fixtures'));
      const testFile = join(process.cwd(), 'test', 'fixtures', 'codex', 'rejected-scenario.jsonl');

      const traces: any[] = [];
      observer.onTrace((trace) => {
        traces.push(trace);
      });

      observer.processSessionFile(testFile);

      // 验证提取了所有消息
      const userInputs = traces.filter(t => t.event_type === 'user_input');
      const assistantOutputs = traces.filter(t => t.event_type === 'assistant_output');

      assert(userInputs.length >= 2, '应该提取到多次用户输入');
      assert(assistantOutputs.length >= 1, '应该提取到助手回复');

      // 验证包含质疑内容（原始文本）
      const hasRejectionContent = userInputs.some(t =>
        t.user_input?.includes('try-catch') && t.user_input?.includes('没必要')
      );
      assert(hasRejectionContent, '应该保留质疑的原始文本');

      // 验证：没有进行反馈分类
      const hasFeedbackClassification = traces.some(
        t => t.metadata?.feedbackType || t.metadata?.feedbackConfidence
      );
      assert(!hasFeedbackClassification, 'Observer 不应该进行反馈分类');

      this.results.push({
        testName,
        passed: true,
        duration: Date.now() - startTime,
        details: {
          userInputs: userInputs.length,
          assistantOutputs: assistantOutputs.length,
          hasRejectionContent,
        },
      });

      logger.info(`✅ ${testName} - 通过`);
    } catch (error) {
      this.results.push({
        testName,
        passed: false,
        duration: Date.now() - startTime,
        details: {},
        error: error instanceof Error ? error.message : String(error),
      });
      logger.error(`❌ ${testName} - 失败`, { error });
    }
  }

  /**
   * 测试 Codex - 用户建议场景
   */
  private async testCodexSuggestionScenario(): Promise<void> {
    const testName = 'Codex - 用户建议场景数据提取';
    const startTime = Date.now();

    try {
      const observer = new CodexObserver(join(process.cwd(), 'test', 'fixtures'));
      const testFile = join(process.cwd(), 'test', 'fixtures', 'codex', 'suggestion-scenario.jsonl');

      const traces: any[] = [];
      observer.onTrace((trace) => {
        traces.push(trace);
      });

      observer.processSessionFile(testFile);

      // 验证提取了用户建议
      const userInputs = traces.filter(t => t.event_type === 'user_input');
      const lastUserInput = userInputs[userInputs.length - 1];

      assert(lastUserInput, '应该提取到最后一条用户输入');
      assert(
        lastUserInput.user_input?.includes('以后') || lastUserInput.user_input?.includes('记得'),
        '应该保留用户建议的原始文本'
      );

      // 验证：没有进行建议类型分类
      assert(!lastUserInput.metadata?.suggestionType, 'Observer 不应该进行建议类型分类');

      this.results.push({
        testName,
        passed: true,
        duration: Date.now() - startTime,
        details: {
          userInputs: userInputs.length,
          lastInputPreview: lastUserInput.user_input?.slice(0, 100),
        },
      });

      logger.info(`✅ ${testName} - 通过`);
    } catch (error) {
      this.results.push({
        testName,
        passed: false,
        duration: Date.now() - startTime,
        details: {},
        error: error instanceof Error ? error.message : String(error),
      });
      logger.error(`❌ ${testName} - 失败`, { error });
    }
  }

  /**
   * 测试 Claude - 多次调用场景
   */
  private async testClaudeMultiCallScenario(): Promise<void> {
    const testName = 'Claude - 多次调用场景数据提取';
    const startTime = Date.now();

    try {
      const observer = new ClaudeObserver(join(process.cwd(), 'test', 'fixtures'));
      const testFile = join(process.cwd(), 'test', 'fixtures', 'claude', 'multi-call-scenario.jsonl');

      const traces: any[] = [];
      observer.onTrace((trace) => {
        traces.push(trace);
      });

      observer.processSessionFile(testFile);

      // 验证提取了所有交互
      const userInputs = traces.filter(t => t.event_type === 'user_input');
      const assistantOutputs = traces.filter(t => t.event_type === 'assistant_output');

      assert(userInputs.length >= 3, '应该提取到 3 次用户输入');
      assert(assistantOutputs.length >= 3, '应该提取到 3 次助手回复');

      // 验证 skill 引用
      const firstUserInput = userInputs[0];
      assert(
        firstUserInput.skill_refs?.includes('business-opportunity-assessment'),
        '应该提取到 skill 引用'
      );

      // 验证：没有进行调用频率分析
      const hasFrequencyAnalysis = traces.some(
        t => t.metadata?.callFrequency || t.metadata?.isHighFrequency
      );
      assert(!hasFrequencyAnalysis, 'Observer 不应该进行调用频率分析');

      this.results.push({
        testName,
        passed: true,
        duration: Date.now() - startTime,
        details: {
          userInputs: userInputs.length,
          assistantOutputs: assistantOutputs.length,
          skillRefs: firstUserInput.skill_refs,
        },
      });

      logger.info(`✅ ${testName} - 通过`);
    } catch (error) {
      this.results.push({
        testName,
        passed: false,
        duration: Date.now() - startTime,
        details: {},
        error: error instanceof Error ? error.message : String(error),
      });
      logger.error(`❌ ${testName} - 失败`, { error });
    }
  }

  /**
   * 测试 Claude - 用户纠正场景
   */
  private async testClaudeCorrectionScenario(): Promise<void> {
    const testName = 'Claude - 用户纠正场景数据提取';
    const startTime = Date.now();

    try {
      const observer = new ClaudeObserver(join(process.cwd(), 'test', 'fixtures'));
      const testFile = join(process.cwd(), 'test', 'fixtures', 'claude', 'correction-scenario.jsonl');

      const traces: any[] = [];
      observer.onTrace((trace) => {
        traces.push(trace);
      });

      observer.processSessionFile(testFile);

      // 验证提取了纠正内容
      const userInputs = traces.filter(t => t.event_type === 'user_input');
      const correctionInput = userInputs.find(t =>
        t.user_input?.includes('太乐观') || t.user_input?.includes('付费能力')
      );

      assert(correctionInput, '应该提取到用户纠正的原始文本');

      // 验证：没有进行纠正类型分类
      assert(!correctionInput.metadata?.correctionType, 'Observer 不应该进行纠正类型分类');

      this.results.push({
        testName,
        passed: true,
        duration: Date.now() - startTime,
        details: {
          userInputs: userInputs.length,
          correctionPreview: correctionInput.content?.slice(0, 100),
        },
      });

      logger.info(`✅ ${testName} - 通过`);
    } catch (error) {
      this.results.push({
        testName,
        passed: false,
        duration: Date.now() - startTime,
        details: {},
        error: error instanceof Error ? error.message : String(error),
      });
      logger.error(`❌ ${testName} - 失败`, { error });
    }
  }

  /**
   * 报告测试结果
   */
  private reportResults(): void {
    logger.info('\n========================================');
    logger.info('Observer 层测试报告');
    logger.info('========================================');

    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);

    logger.info(`\n总计: ${this.results.length} 个测试`);
    logger.info(`✅ 通过: ${passed}`);
    logger.info(`❌ 失败: ${failed}`);
    logger.info(`⏱️  总耗时: ${totalDuration}ms`);

    logger.info('\n详细结果:');
    for (const result of this.results) {
      const status = result.passed ? '✅' : '❌';
      logger.info(`  ${status} ${result.testName} (${result.duration}ms)`);
      if (!result.passed && result.error) {
        logger.info(`     错误: ${result.error}`);
      }
    }

    if (failed > 0) {
      process.exit(1);
    }
  }
}

// 运行测试
const suite = new ObserverTestSuite();
suite.runAll().catch(error => {
  logger.error('测试套件执行失败', { error });
  process.exit(1);
});
