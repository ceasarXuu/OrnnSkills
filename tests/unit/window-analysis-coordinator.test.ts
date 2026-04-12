import { describe, expect, it, vi } from 'vitest';
import type { SkillCallAnalysisResult } from '../../src/core/skill-call-analyzer/index.js';
import { createSkillCallWindow } from '../../src/core/skill-call-window/index.js';
import { executeWindowAnalysis } from '../../src/core/window-analysis-coordinator/index.js';

describe('executeWindowAnalysis', () => {
  const window = createSkillCallWindow({
    windowId: 'window-1',
    skillId: 'test-skill',
    runtime: 'codex',
    sessionId: 'sess-1',
    closeReason: 'window_threshold_reached',
    traces: [],
  });

  it('normalizes evaluation and next hint when analyzer asks for more context', async () => {
    const analyzeWindow = vi.fn().mockResolvedValue({
      success: true,
      decision: 'need_more_context',
      model: 'deepseek/deepseek-chat',
      userMessage: 'Need a larger context window before deciding.',
      tokenUsage: {
        promptTokens: 10,
        completionTokens: 5,
        totalTokens: 15,
      },
    } satisfies SkillCallAnalysisResult);

    const result = await executeWindowAnalysis({
      analyzeWindow,
      projectPath: '/tmp/project',
      window,
      skillContent: '# Test Skill',
      timeoutMs: 1000,
    });

    expect(result.success).toBe(true);
    expect(result.decision).toBe('need_more_context');
    expect(result.evaluation).toMatchObject({
      should_patch: false,
      reason: 'Need a larger context window before deciding.',
      source_sessions: ['sess-1'],
      confidence: 0,
      rule_name: 'llm_window_analysis',
    });
    expect(result.nextWindowHint).toMatchObject({
      suggestedTraceDelta: 6,
      suggestedTurnDelta: 2,
      waitForEventTypes: [],
      mode: 'count_driven',
    });
  });

  it('preserves analyzer failures without fabricating success output', async () => {
    const analyzeWindow = vi.fn().mockResolvedValue({
      success: false,
      model: 'deepseek/deepseek-chat',
      errorCode: 'invalid_analysis_json',
      userMessage: '模型返回了内容，但格式不符合系统要求，所以这轮分析结果无法解析。',
      technicalDetail: 'invalid_analysis_json',
      tokenUsage: {
        promptTokens: 10,
        completionTokens: 0,
        totalTokens: 10,
      },
    } satisfies SkillCallAnalysisResult);

    const result = await executeWindowAnalysis({
      analyzeWindow,
      projectPath: '/tmp/project',
      window,
      skillContent: '# Test Skill',
      timeoutMs: 1000,
    });

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('invalid_analysis_json');
    expect(result.userMessage).toContain('格式不符合系统要求');
    expect(result.evaluation).toBeUndefined();
  });
});
