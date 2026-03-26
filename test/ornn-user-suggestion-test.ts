/**
 * OrnnSkills 用户建议分析测试
 *
 * 测试目标：识别用户主动给出的建议，并判断其价值（正向/负向）
 */

import { createChildLogger } from '../src/utils/logger.js';
import { CodexObserver } from '../src/core/observer/codex-observer.js';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';

const logger = createChildLogger('user-suggestion-test');

/**
 * 用户建议分析结果
 */
interface UserSuggestionAnalysis {
  // 基本信息
  timestamp: string;
  userInput: string;
  
  // 建议类型
  suggestionType: 'workflow_improvement' | 'skill_enhancement' | 'context_clarification' | 'best_practice' | 'unknown';
  
  // 建议内容
  suggestion: {
    target: string;        // 建议针对什么（skill、workflow、general）
    action: string;        // 建议做什么
    rationale?: string;    // 建议的理由
  };
  
  // 价值判断
  value: {
    type: 'positive' | 'negative' | 'neutral';
    confidence: number;
    reason: string;
  };
  
  // 优化信号
  optimizationSignal?: {
    type: 'append_context' | 'add_fallback' | 'tighten_trigger' | 'prune_noise' | 'new_skill_needed';
    targetSkill?: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
  };
}

/**
 * 判断是否为建议性输入
 */
function isSuggestion(input: string): boolean {
  const suggestionPatterns = [
    /^(建议|推荐|可以|应该|最好|需要)/,
    /^(注意|提醒|别忘了|记得)/,
    /(建议|推荐).*(以后|下次|未来)/,
    /(可以|应该).*(添加|包含|考虑)/,
    /(不够|不足|缺少|遗漏)/,
    /(更|更加).*(好|全面|深入|专业)/,
  ];
  
  return suggestionPatterns.some(pattern => pattern.test(input));
}

/**
 * 分析建议类型
 */
function analyzeSuggestionType(input: string): UserSuggestionAnalysis['suggestionType'] {
  if (/skill|技能/.test(input)) return 'skill_enhancement';
  if (/流程|步骤|先|然后/.test(input)) return 'workflow_improvement';
  if (/需求|目标|具体|上下文/.test(input)) return 'context_clarification';
  if (/最佳实践|标准|规范|安全|性能/.test(input)) return 'best_practice';
  return 'unknown';
}

/**
 * 提取建议目标
 */
function extractTarget(input: string): string {
  // 匹配 [$skillname] 或 @skillname
  const skillMatch = input.match(/\[\$([^\]]+)\]|@(\S+)/);
  if (skillMatch) {
    return skillMatch[1] || skillMatch[2];
  }
  
  // 匹配"以后...时"
  const workflowMatch = input.match(/以后(.+?)(时|的时候)/);
  if (workflowMatch) {
    return workflowMatch[1].trim();
  }
  
  return 'general';
}

/**
 * 提取建议动作
 */
function extractAction(input: string): string {
  // 提取"建议..."后面的内容
  const match = input.match(/(?:建议|推荐|可以|应该|最好|需要)[：:]?\s*(.+)/);
  if (match) {
    return match[1].slice(0, 100);
  }
  return input.slice(0, 100);
}

/**
 * 判断建议价值
 */
function evaluateValue(input: string): UserSuggestionAnalysis['value'] {
  const positiveSignals = [
    /更全面|更专业|更好|更完善/,
    /标准|最佳实践|安全|性能/,
    /添加|包含|考虑|检查/,
  ];
  
  const negativeSignals = [
    /不对|错误|不好|不行/,
    /不需要|没必要|过度/,
    /太复杂|太麻烦/,
  ];
  
  const hasPositive = positiveSignals.some(p => p.test(input));
  const hasNegative = negativeSignals.some(p => p.test(input));
  
  if (hasPositive && !hasNegative) {
    return {
      type: 'positive',
      confidence: 0.8,
      reason: '用户提供了建设性改进建议',
    };
  }
  
  if (hasNegative && !hasPositive) {
    return {
      type: 'negative',
      confidence: 0.7,
      reason: '用户认为某些做法不合适',
    };
  }
  
  return {
    type: 'neutral',
    confidence: 0.5,
    reason: '无法明确判断价值倾向',
  };
}

/**
 * 生成优化信号
 */
function generateOptimizationSignal(
  analysis: UserSuggestionAnalysis
): UserSuggestionAnalysis['optimizationSignal'] {
  const { suggestionType, suggestion, value } = analysis;
  
  // 技能增强类建议
  if (suggestionType === 'skill_enhancement' && suggestion.target !== 'general') {
    return {
      type: 'append_context',
      targetSkill: suggestion.target,
      description: `用户建议增强 ${suggestion.target} skill: ${suggestion.action}`,
      priority: value.type === 'positive' ? 'high' : 'medium',
    };
  }
  
  // 流程改进类建议
  if (suggestionType === 'workflow_improvement') {
    return {
      type: 'add_fallback',
      description: `用户建议改进工作流程: ${suggestion.action}`,
      priority: 'medium',
    };
  }
  
  // 上下文澄清类建议
  if (suggestionType === 'context_clarification') {
    return {
      type: 'tighten_trigger',
      description: `用户建议在执行前收集更多上下文: ${suggestion.action}`,
      priority: 'high',
    };
  }
  
  // 最佳实践类建议
  if (suggestionType === 'best_practice') {
    return {
      type: 'new_skill_needed',
      description: `用户建议引入最佳实践: ${suggestion.action}`,
      priority: 'medium',
    };
  }
  
  return undefined;
}

/**
 * 分析用户建议
 */
function analyzeUserSuggestion(
  timestamp: string,
  userInput: string
): UserSuggestionAnalysis | null {
  // 首先判断是否为建议
  if (!isSuggestion(userInput)) {
    return null;
  }
  
  const suggestionType = analyzeSuggestionType(userInput);
  const target = extractTarget(userInput);
  const action = extractAction(userInput);
  const value = evaluateValue(userInput);
  
  const analysis: UserSuggestionAnalysis = {
    timestamp,
    userInput: userInput.slice(0, 200),
    suggestionType,
    suggestion: {
      target,
      action,
    },
    value,
  };
  
  // 生成优化信号
  analysis.optimizationSignal = generateOptimizationSignal(analysis);
  
  return analysis;
}

/**
 * 分析 trace 文件中的用户建议
 */
async function analyzeUserSuggestions(filePath: string): Promise<UserSuggestionAnalysis[]> {
  const suggestions: UserSuggestionAnalysis[] = [];
  
  const observer = new CodexObserver(join(process.cwd(), 'test', 'fixtures'));
  
  observer.onTrace((trace) => {
    // 只分析用户输入
    if (trace.event_type === 'user_input' && trace.user_input) {
      const analysis = analyzeUserSuggestion(
        trace.timestamp,
        trace.user_input
      );
      
      if (analysis) {
        suggestions.push(analysis);
        
        logger.info(`\n💡 发现用户建议:`);
        logger.info(`   时间: ${analysis.timestamp}`);
        logger.info(`   类型: ${analysis.suggestionType}`);
        logger.info(`   目标: ${analysis.suggestion.target}`);
        logger.info(`   建议: ${analysis.suggestion.action.slice(0, 80)}...`);
        logger.info(`   价值: ${analysis.value.type} (置信度: ${analysis.value.confidence})`);
        
        if (analysis.optimizationSignal) {
          logger.info(`   🎯 优化信号:`);
          logger.info(`      类型: ${analysis.optimizationSignal.type}`);
          logger.info(`      描述: ${analysis.optimizationSignal.description.slice(0, 80)}...`);
          logger.info(`      优先级: ${analysis.optimizationSignal.priority}`);
        }
      }
    }
  });
  
  observer.processSessionFile(filePath);
  
  return suggestions;
}

/**
 * 打印分析报告
 */
function printReport(suggestions: UserSuggestionAnalysis[]) {
  logger.info('\n========================================');
  logger.info('用户建议分析报告');
  logger.info('========================================\n');
  
  // 按类型统计
  const typeCount = new Map<string, number>();
  const valueCount = { positive: 0, negative: 0, neutral: 0 };
  const optimizationTypes = new Map<string, number>();
  
  for (const s of suggestions) {
    typeCount.set(s.suggestionType, (typeCount.get(s.suggestionType) || 0) + 1);
    valueCount[s.value.type]++;
    
    if (s.optimizationSignal) {
      const type = s.optimizationSignal.type;
      optimizationTypes.set(type, (optimizationTypes.get(type) || 0) + 1);
    }
  }
  
  logger.info('📊 统计:');
  logger.info(`   总建议数: ${suggestions.length}`);
  logger.info(`   正向建议: ${valueCount.positive}`);
  logger.info(`   负向建议: ${valueCount.negative}`);
  logger.info(`   中性建议: ${valueCount.neutral}`);
  
  logger.info('\n📋 按类型分布:');
  for (const [type, count] of typeCount) {
    logger.info(`   ${type}: ${count}`);
  }
  
  logger.info('\n🔧 优化信号分布:');
  for (const [type, count] of optimizationTypes) {
    logger.info(`   ${type}: ${count}`);
  }
  
  // 高优先级建议
  const highPriority = suggestions.filter(
    s => s.optimizationSignal?.priority === 'high'
  );
  
  if (highPriority.length > 0) {
    logger.info('\n⭐ 高优先级建议:');
    for (const s of highPriority) {
      logger.info(`   - ${s.suggestion.target}: ${s.suggestion.action.slice(0, 60)}...`);
    }
  }
}

/**
 * 运行测试
 */
async function runUserSuggestionTest() {
  logger.info('========================================');
  logger.info('OrnnSkills 用户建议分析测试');
  logger.info('========================================\n');
  
  const testFile = join(process.cwd(), 'test', 'fixtures', 'user-suggestion-samples.jsonl');
  
  logger.info('📄 分析文件: user-suggestion-samples.jsonl');
  logger.info('   场景: 用户主动给出建议\n');
  
  const suggestions = await analyzeUserSuggestions(testFile);
  
  printReport(suggestions);
  
  // 验证
  logger.info('\n✅ 验证:');
  const expectedSuggestions = 3; // 文件中有 3 条建议
  if (suggestions.length >= expectedSuggestions) {
    logger.info(`   ✓ 正确识别 ${suggestions.length} 条用户建议`);
  } else {
    logger.warn(`   ⚠ 只识别 ${suggestions.length} 条，期望 ${expectedSuggestions} 条`);
  }
  
  const hasSkillEnhancement = suggestions.some(s => s.suggestionType === 'skill_enhancement');
  const hasWorkflowImprovement = suggestions.some(s => s.suggestionType === 'workflow_improvement');
  const hasBestPractice = suggestions.some(s => s.suggestionType === 'best_practice');
  
  if (hasSkillEnhancement) logger.info('   ✓ 识别到技能增强建议');
  if (hasWorkflowImprovement) logger.info('   ✓ 识别到流程改进建议');
  if (hasBestPractice) logger.info('   ✓ 识别到最佳实践建议');
  
  logger.info('\n========================================');
  logger.info('测试完成');
  logger.info('========================================');
}

// 运行测试
runUserSuggestionTest().catch(error => {
  logger.error('测试失败', { error });
  process.exit(1);
});
