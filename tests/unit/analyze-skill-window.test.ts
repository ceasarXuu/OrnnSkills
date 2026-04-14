import { describe, expect, it, vi } from 'vitest';
import { analyzeSkillWindow } from '../../src/core/analyze-skill-window/index.js';
import type { EvaluationResult } from '../../src/types/index.js';
import type { SkillCallWindow } from '../../src/core/skill-call-window/index.js';

const baseWindow: SkillCallWindow = {
  windowId: 'sess-1::test-skill',
  skillId: 'test-skill',
  runtime: 'codex',
  sessionId: 'sess-1',
  closeReason: 'window_threshold_reached',
  startedAt: '2026-04-14T00:00:00.000Z',
  lastTraceAt: '2026-04-14T00:00:10.000Z',
  traces: [],
};

const patchEvaluation: EvaluationResult = {
  should_patch: true,
  change_type: 'prune_noise',
  target_section: 'TODO',
  reason: 'Repeated noise should be pruned.',
  source_sessions: ['sess-1'],
  confidence: 0.91,
  rule_name: 'llm_window_analysis',
};

describe('analyzeSkillWindow', () => {
  it('fails early when skill content is missing', async () => {
    const analyzeWindow = vi.fn();

    const result = await analyzeSkillWindow({
      analyzeWindow,
      projectPath: '/tmp/project',
      window: baseWindow,
      skillContent: '',
      mode: 'auto',
    });

    expect(result).toMatchObject({
      kind: 'missing_skill_content',
      reasonCode: 'missing_skill_content',
    });
    expect(analyzeWindow).not.toHaveBeenCalled();
  });

  it('normalizes no_optimization into a stable branch with user-facing detail', async () => {
    const analyzeWindow = vi.fn().mockResolvedValue({
      success: true,
      decision: 'no_optimization',
      model: 'deepseek/deepseek-chat',
      evaluation: {
        ...patchEvaluation,
        should_patch: false,
        change_type: undefined,
      },
      userMessage: '当前窗口不需要优化。',
      tokenUsage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    });

    const result = await analyzeSkillWindow({
      analyzeWindow,
      projectPath: '/tmp/project',
      window: baseWindow,
      skillContent: '# Skill',
      mode: 'auto',
    });

    expect(result).toMatchObject({
      kind: 'no_optimization',
      detail: expect.stringContaining('Repeated noise should be pruned.'),
    });
  });

  it('downgrades incomplete patch context into need_more_context', async () => {
    const analyzeWindow = vi.fn().mockResolvedValue({
      success: true,
      decision: 'apply_optimization',
      model: 'deepseek/deepseek-chat',
      evaluation: {
        ...patchEvaluation,
        target_section: undefined,
      },
      nextWindowHint: {
        suggestedTraceDelta: 6,
        suggestedTurnDelta: 2,
        waitForEventTypes: ['tool_result'],
        mode: 'event_driven',
      },
      tokenUsage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    });

    const result = await analyzeSkillWindow({
      analyzeWindow,
      projectPath: '/tmp/project',
      window: baseWindow,
      skillContent: '# Skill',
      mode: 'manual',
    });

    expect(result).toMatchObject({
      kind: 'need_more_context',
      cause: 'incomplete_patch_context',
      detail: expect.stringContaining('缺少 target_section'),
    });
  });

  it('returns ready_for_optimization for executable patch recommendations', async () => {
    const analyzeWindow = vi.fn().mockResolvedValue({
      success: true,
      decision: 'apply_optimization',
      model: 'deepseek/deepseek-chat',
      evaluation: patchEvaluation,
      tokenUsage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    });

    const result = await analyzeSkillWindow({
      analyzeWindow,
      projectPath: '/tmp/project',
      window: baseWindow,
      skillContent: '# Skill',
      mode: 'auto',
    });

    expect(result).toMatchObject({
      kind: 'ready_for_optimization',
      evaluation: patchEvaluation,
    });
  });
});
