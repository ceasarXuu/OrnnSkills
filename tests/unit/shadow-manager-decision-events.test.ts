import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createShadowManager } from '../../src/core/shadow-manager/index.js';
import { createJournalManager } from '../../src/core/journal/index.js';
import type { Trace } from '../../src/types/index.js';
import type { DecisionEventRecord } from '../../src/core/decision-events/index.js';

const { analyzeWindowMock, patchGeneratorMock, decisionExplanationMock } = vi.hoisted(() => ({
  analyzeWindowMock: vi.fn(),
  patchGeneratorMock: {
    generate: vi.fn(),
  },
  decisionExplanationMock: vi.fn(),
}));

vi.mock('../../src/core/skill-call-analyzer/index.js', () => ({
  createSkillCallAnalyzer: () => ({
    analyzeWindow: analyzeWindowMock,
  }),
}));

vi.mock('../../src/core/patch-generator/index.js', () => ({
  patchGenerator: patchGeneratorMock,
}));

vi.mock('../../src/core/decision-explainer/index.js', () => ({
  generateDecisionExplanation: decisionExplanationMock,
}));

function readDecisionEvents(projectRoot: string): DecisionEventRecord[] {
  const path = join(projectRoot, '.ornn', 'state', 'decision-events.ndjson');
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf-8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as DecisionEventRecord);
}

function makeTrace(traceId: string, projectRoot: string, index = 0): Trace {
  return {
    trace_id: traceId,
    session_id: 'sess-1',
    turn_id: `turn-${index || 1}`,
    runtime: 'codex',
    event_type: 'tool_call',
    tool_name: 'exec_command',
    tool_args: { cmd: `cat ${projectRoot}/.agents/skills/test-skill/SKILL.md` },
    status: 'success',
    timestamp: new Date(Date.UTC(2026, 3, 11, 8, 0, index)).toISOString(),
    metadata: { skill_id: 'test-skill' },
  };
}

function makeMixedTrace(traceId: string, projectRoot: string, index: number, mapped: boolean): Trace {
  return {
    trace_id: traceId,
    session_id: 'sess-mixed',
    turn_id: `turn-${index}`,
    runtime: 'codex',
    event_type: mapped ? 'tool_call' : 'assistant_output',
    tool_name: mapped ? 'exec_command' : undefined,
    tool_args: mapped ? { cmd: `cat ${projectRoot}/.agents/skills/test-skill/SKILL.md` } : undefined,
    assistant_output: mapped ? undefined : `context ${index}`,
    status: 'success',
    timestamp: new Date(Date.UTC(2026, 3, 11, 9, 0, index)).toISOString(),
    metadata: mapped ? { skill_id: 'test-skill' } : undefined,
  };
}

describe('ShadowManager decision events', () => {
  const testProjectPath = join(tmpdir(), `ornn-shadow-manager-events-${Date.now()}`);

  beforeEach(() => {
    rmSync(testProjectPath, { recursive: true, force: true });
    mkdirSync(join(testProjectPath, '.ornn', 'state'), { recursive: true });
    mkdirSync(join(testProjectPath, '.agents', 'skills', 'test-skill'), { recursive: true });
    writeFileSync(
      join(testProjectPath, '.agents', 'skills', 'test-skill', 'SKILL.md'),
      '# Test Skill\n\nUse this skill in tests.\n',
      'utf-8'
    );

    analyzeWindowMock.mockReset();
    patchGeneratorMock.generate.mockReset();
    decisionExplanationMock.mockReset();
    decisionExplanationMock.mockResolvedValue({
      summary: 'Decision recorded for test-skill.',
      evidenceReadout: [],
      causalChain: [],
      decisionRationale: 'The observed traces support the decision.',
      recommendedAction: 'Continue with the recorded decision.',
      uncertainties: [],
      contradictions: [],
    });
  });

  afterEach(() => {
    rmSync(testProjectPath, { recursive: true, force: true });
  });

  it('records no-patch evaluation events with a stable scope id', async () => {
    analyzeWindowMock.mockResolvedValue({
      success: true,
      model: 'deepseek/deepseek-chat',
      decision: 'no_optimization',
      userMessage: 'Current evidence is not enough to justify optimization.',
      evaluation: {
        should_patch: false,
        reason: 'Current evidence is not enough yet',
        source_sessions: ['sess-1'],
        confidence: 0.62,
        rule_name: 'llm_window_analysis',
      },
      tokenUsage: {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      },
    });

    const manager = createShadowManager(testProjectPath);
    await manager.init();

    for (let index = 1; index <= 10; index += 1) {
      await manager.processTrace(makeTrace(`trace-no-patch-${index}`, testProjectPath, index));
    }

    const events = readDecisionEvents(testProjectPath);
    const evaluationEvent = events.find((event) => event.tag === 'evaluation_result');
    expect(evaluationEvent).toMatchObject({
      tag: 'evaluation_result',
      skillId: 'test-skill',
      runtime: 'codex',
      status: 'no_patch_needed',
      windowId: 'sess-1::test-skill',
      sessionId: 'sess-1',
      traceId: 'trace-no-patch-10',
      ruleName: 'llm_window_analysis',
      confidence: 0.62,
    });
  });

  it('records analysis requested and patch applied events for successful optimizations', async () => {
    analyzeWindowMock.mockResolvedValue({
      success: true,
      model: 'deepseek/deepseek-chat',
      decision: 'apply_optimization',
      userMessage: 'Tool step was skipped repeatedly',
      evaluation: {
        should_patch: true,
        change_type: 'prune_noise',
        target_section: 'TODO',
        reason: 'Tool step was skipped repeatedly',
        source_sessions: ['sess-1'],
        confidence: 0.93,
        rule_name: 'llm_window_analysis',
      },
      tokenUsage: {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      },
    });
    patchGeneratorMock.generate.mockResolvedValue({
      success: true,
      patch: '@@ -1 +1 @@\n-old\n+new\n',
      newContent: '# Test Skill\n\nUpdated content.\n',
      changeType: 'prune_noise',
    });

    const manager = createShadowManager(testProjectPath);
    await manager.init();

    for (let index = 1; index <= 10; index += 1) {
      await manager.processTrace(makeTrace(`trace-patch-${index}`, testProjectPath, index));
    }

    const events = readDecisionEvents(testProjectPath).filter((event) => event.traceId === 'trace-patch-10');
    expect(events.map((event) => event.tag)).toEqual(['analysis_requested', 'skill_feedback', 'patch_applied']);
    expect(events[0]).toMatchObject({
      skillId: 'test-skill',
      runtime: 'codex',
      windowId: 'sess-1::test-skill',
      status: 'window_ready',
      traceId: 'trace-patch-10',
      sessionId: 'sess-1',
      ruleName: null,
      changeType: null,
    });
    expect(events[1]).toMatchObject({
      skillId: 'test-skill',
      runtime: 'codex',
      windowId: 'sess-1::test-skill',
      status: 'patch_recommended',
      traceId: 'trace-patch-10',
      sessionId: 'sess-1',
      ruleName: 'llm_window_analysis',
      changeType: 'prune_noise',
    });
    expect(events[2]).toMatchObject({
      skillId: 'test-skill',
      runtime: 'codex',
      windowId: 'sess-1::test-skill',
      status: 'success',
      traceId: 'trace-patch-10',
      sessionId: 'sess-1',
      ruleName: 'llm_window_analysis',
      changeType: 'prune_noise',
    });

    const journal = createJournalManager(testProjectPath);
    await journal.init();
    expect(journal.getLatestRevision(`codex::test-skill@${testProjectPath}`)).toBe(1);
    expect(journal.getSnapshots(`codex::test-skill@${testProjectPath}`)).toEqual(
      expect.arrayContaining([expect.objectContaining({ revision: 0 })])
    );
    await journal.close();
  });

  it('records analysis failures when patch generation breaks', async () => {
    analyzeWindowMock.mockResolvedValue({
      success: true,
      model: 'deepseek/deepseek-chat',
      decision: 'apply_optimization',
      userMessage: 'Tool step was skipped repeatedly',
      evaluation: {
        should_patch: true,
        change_type: 'prune_noise',
        target_section: 'TODO',
        reason: 'Tool step was skipped repeatedly',
        source_sessions: ['sess-1'],
        confidence: 0.91,
        rule_name: 'llm_window_analysis',
      },
      tokenUsage: {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      },
    });
    patchGeneratorMock.generate.mockResolvedValue({
      success: false,
      patch: '',
      newContent: '',
      changeType: 'prune_noise',
      error: 'strategy execution failed',
    });

    const manager = createShadowManager(testProjectPath);
    await manager.init();

    for (let index = 1; index <= 10; index += 1) {
      await manager.processTrace(makeTrace(`trace-failed-${index}`, testProjectPath, index));
    }

    const events = readDecisionEvents(testProjectPath).filter((event) => event.traceId === 'trace-failed-10');
    expect(events.map((event) => event.tag)).toEqual(['analysis_requested', 'skill_feedback', 'analysis_failed']);
    expect(events[2]).toMatchObject({
      skillId: 'test-skill',
      runtime: 'codex',
      windowId: 'sess-1::test-skill',
      status: 'failed',
      traceId: 'trace-failed-10',
      sessionId: 'sess-1',
      changeType: 'prune_noise',
    });
    expect(events[2].detail).toContain('strategy execution failed');
  });

  it('falls back to continue_collecting when optimization recommendation lacks executable patch context', async () => {
    analyzeWindowMock.mockResolvedValue({
      success: true,
      model: 'deepseek/deepseek-chat',
      decision: 'apply_optimization',
      userMessage: 'Tool step was skipped repeatedly',
      evaluation: {
        should_patch: true,
        change_type: 'prune_noise',
        reason: 'Tool step was skipped repeatedly',
        source_sessions: ['sess-1'],
        confidence: 0.91,
        rule_name: 'llm_window_analysis',
      },
      nextWindowHint: {
        suggestedTraceDelta: 6,
        suggestedTurnDelta: 2,
        waitForEventTypes: ['tool_result'],
        mode: 'event_driven',
      },
      tokenUsage: {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      },
    });

    const manager = createShadowManager(testProjectPath);
    await manager.init();

    for (let index = 1; index <= 10; index += 1) {
      await manager.processTrace(makeTrace(`trace-missing-section-${index}`, testProjectPath, index));
    }

    expect(patchGeneratorMock.generate).not.toHaveBeenCalled();

    const events = readDecisionEvents(testProjectPath).filter(
      (event) => event.traceId === 'trace-missing-section-10'
    );
    expect(events).toHaveLength(2);
    expect(events[1]).toMatchObject({
      tag: 'evaluation_result',
      skillId: 'test-skill',
      runtime: 'codex',
      windowId: 'sess-1::test-skill',
      status: 'continue_collecting',
      traceId: 'trace-missing-section-10',
      sessionId: 'sess-1',
      ruleName: 'llm_window_analysis',
      changeType: 'prune_noise',
    });
    expect(events[1].detail).toContain('缺少 target_section');
  });

  it('records window trace counts from the scoped episode window instead of the full session backlog', async () => {
    analyzeWindowMock.mockResolvedValue({
      success: true,
      model: 'deepseek/deepseek-chat',
      decision: 'need_more_context',
      userMessage: '当前窗口证据仍不足，继续等待更多上下文。',
      nextWindowHint: {
        suggestedTraceDelta: 8,
        suggestedTurnDelta: 2,
        waitForEventTypes: [],
        mode: 'count_driven',
      },
      tokenUsage: {
        promptTokens: 90,
        completionTokens: 40,
        totalTokens: 130,
      },
    });

    const manager = createShadowManager(testProjectPath);
    await manager.init();

    for (let index = 1; index <= 9; index += 1) {
      await manager.processTrace(makeMixedTrace(`trace-pre-${index}`, testProjectPath, index, false));
    }
    await manager.processTrace(makeMixedTrace('trace-start', testProjectPath, 10, true));
    for (let index = 11; index <= 19; index += 1) {
      await manager.processTrace(makeMixedTrace(`trace-context-${index}`, testProjectPath, index, false));
    }

    const requested = readDecisionEvents(testProjectPath).find(
      (event) => event.tag === 'analysis_requested' && event.sessionId === 'sess-mixed'
    );
    expect(requested).toMatchObject({
      traceId: 'trace-context-19',
      traceCount: 10,
      sessionId: 'sess-mixed',
      windowId: 'sess-mixed::test-skill',
    });
  });
});
