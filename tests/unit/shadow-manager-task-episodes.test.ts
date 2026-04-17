import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createShadowManager } from '../../src/core/shadow-manager/index.js';
import { createTaskEpisodeStore } from '../../src/core/task-episode/index.js';
import type { Trace } from '../../src/types/index.js';
import type { DecisionEventRecord } from '../../src/core/decision-events/index.js';
import type { TaskEpisodeSnapshot } from '../../src/core/task-episode/index.js';

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

function makeTrace(index: number, projectRoot: string): Trace {
  return {
    trace_id: `trace-${index}`,
    session_id: 'sess-1',
    turn_id: `turn-${index}`,
    runtime: 'codex',
    event_type: 'tool_call',
    tool_name: 'exec_command',
    tool_args: { cmd: `cat ${projectRoot}/.agents/skills/test-skill/SKILL.md` },
    status: 'success',
    timestamp: new Date(Date.UTC(2026, 3, 11, 8, 0, index)).toISOString(),
    metadata: { skill_id: 'test-skill' },
  };
}

function makeMixedTrace(index: number, projectRoot: string, mapped: boolean): Trace {
  return {
    trace_id: `mixed-trace-${index}`,
    session_id: 'sess-mixed',
    turn_id: `mixed-turn-${index}`,
    runtime: 'codex',
    event_type: mapped ? 'tool_call' : 'assistant_output',
    tool_name: mapped ? 'exec_command' : undefined,
    tool_args: mapped ? { cmd: `cat ${projectRoot}/.agents/skills/test-skill/SKILL.md` } : undefined,
    assistant_output: mapped ? undefined : `Intermediate output ${index}`,
    status: 'success',
    timestamp: new Date(Date.UTC(2026, 3, 11, 9, 0, index)).toISOString(),
    metadata: mapped ? { skill_id: 'test-skill' } : undefined,
  };
}

function makeEpisodeTrace(skillId: string, traceId: string, turnId: string, timestamp: string): Trace {
  return {
    trace_id: traceId,
    session_id: 'sess-shared',
    turn_id: turnId,
    runtime: 'codex',
    event_type: 'tool_call',
    tool_name: 'exec_command',
    tool_args: { cmd: `echo ${skillId}` },
    status: 'success',
    timestamp,
    metadata: { skill_id: skillId },
  };
}

function readTaskEpisodes(projectRoot: string): TaskEpisodeSnapshot {
  return JSON.parse(
    readFileSync(join(projectRoot, '.ornn', 'state', 'task-episodes.json'), 'utf-8')
  ) as TaskEpisodeSnapshot;
}

function readDecisionEvents(projectRoot: string): DecisionEventRecord[] {
  const path = join(projectRoot, '.ornn', 'state', 'decision-events.ndjson');
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf-8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as DecisionEventRecord);
}

describe('ShadowManager task episodes', () => {
  const testProjectPath = join(tmpdir(), `ornn-shadow-manager-episodes-${Date.now()}`);

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

  it('persists task episodes and emits probe events once a window reaches the initial threshold', async () => {
    analyzeWindowMock.mockResolvedValue({
      success: true,
      model: 'deepseek/deepseek-chat',
      decision: 'need_more_context',
      userMessage: '当前窗口证据仍不足，继续等待更多上下文。',
      nextWindowHint: {
        suggestedTraceDelta: 12,
        suggestedTurnDelta: 2,
        waitForEventTypes: ['tool_result'],
        mode: 'event_driven',
      },
      tokenUsage: {
        promptTokens: 90,
        completionTokens: 40,
        totalTokens: 130,
      },
    });

    const manager = createShadowManager(testProjectPath);
    await manager.init();

    for (let index = 1; index <= 10; index += 1) {
      await manager.processTrace(makeTrace(index, testProjectPath));
    }

    const snapshot = readTaskEpisodes(testProjectPath);
    expect(snapshot.episodes).toHaveLength(1);
    expect(snapshot.episodes[0]).toMatchObject({
      runtime: 'codex',
      state: 'collecting',
      analysisStatus: 'collecting',
      sessionIds: ['sess-1'],
      traceRefs: expect.arrayContaining(['trace-1', 'trace-10']),
      turnIds: expect.arrayContaining(['turn-1', 'turn-10']),
      stats: {
        totalTraceCount: 10,
        totalTurnCount: 10,
        mappedTraceCount: 10,
        tracesSinceLastProbe: 0,
        turnsSinceLastProbe: 0,
      },
      probeState: expect.objectContaining({
        probeCount: 1,
        lastProbeTraceIndex: 10,
        lastProbeTurnIndex: 10,
        nextProbeTraceDelta: 12,
        nextProbeTurnDelta: 2,
        waitForEventTypes: ['tool_result'],
        mode: 'event_driven',
      }),
    });

    const events = readDecisionEvents(testProjectPath);
    expect(events.map((event) => event.tag)).toEqual(['analysis_requested', 'evaluation_result']);

    const evaluationEvent = events.find((event) => event.tag === 'evaluation_result');
    expect(evaluationEvent).toMatchObject({
      skillId: 'test-skill',
      runtime: 'codex',
      windowId: 'sess-1::test-skill',
      sessionId: 'sess-1',
      traceId: 'trace-10',
      status: 'continue_collecting',
      businessCategory: 'core_flow',
      businessTag: 'analysis_waiting_more_context',
    });
  });

  it('marks the current episode as completed after a successful patch', async () => {
    analyzeWindowMock.mockResolvedValue({
      success: true,
      model: 'deepseek/deepseek-chat',
      decision: 'apply_optimization',
      userMessage: '需要删掉多余的回显说明。',
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
      await manager.processTrace(makeTrace(index, testProjectPath));
    }

    const snapshot = readTaskEpisodes(testProjectPath);
    expect(snapshot.episodes).toHaveLength(1);
    expect(snapshot.episodes[0]).toMatchObject({
      state: 'closed',
      analysisStatus: 'completed',
    });
    expect(snapshot.episodes[0].skillSegments[0]).toMatchObject({
      status: 'closed',
      lastRelatedTraceId: 'trace-10',
    });
  });

  it('triggers the first probe once the surrounding session window reaches the threshold even if only some traces map to the skill', async () => {
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

    for (let index = 1; index <= 10; index += 1) {
      const mapped = index === 1 || index === 10;
      await manager.processTrace(makeMixedTrace(index, testProjectPath, mapped));
    }

    const snapshot = readTaskEpisodes(testProjectPath);
    expect(snapshot.episodes).toHaveLength(1);
    expect(snapshot.episodes[0]).toMatchObject({
      sessionIds: ['sess-mixed'],
      traceRefs: expect.arrayContaining(['mixed-trace-1', 'mixed-trace-10', 'mixed-trace-5']),
      turnIds: expect.arrayContaining(['mixed-turn-1', 'mixed-turn-10', 'mixed-turn-5']),
      stats: {
        totalTraceCount: 10,
        totalTurnCount: 10,
        mappedTraceCount: 2,
        tracesSinceLastProbe: 0,
        turnsSinceLastProbe: 0,
      },
      probeState: expect.objectContaining({
        probeCount: 1,
        lastProbeTraceIndex: 10,
        lastProbeTurnIndex: 10,
      }),
    });

    const events = readDecisionEvents(testProjectPath).filter((event) => event.sessionId === 'sess-mixed');
    expect(events.some((event) => event.tag === 'analysis_requested')).toBe(true);
    expect(events.some((event) => event.tag === 'evaluation_result')).toBe(true);
  });

  it('re-checks probe readiness when later context traces grow an existing episode window', async () => {
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

    await manager.processTrace(makeMixedTrace(1, testProjectPath, true));
    for (let index = 2; index <= 10; index += 1) {
      await manager.processTrace(makeMixedTrace(index, testProjectPath, false));
    }

    const snapshot = readTaskEpisodes(testProjectPath);
    expect(snapshot.episodes).toHaveLength(1);
    expect(snapshot.episodes[0]).toMatchObject({
      sessionIds: ['sess-mixed'],
      stats: {
        totalTraceCount: 10,
        totalTurnCount: 10,
        mappedTraceCount: 1,
        tracesSinceLastProbe: 0,
        turnsSinceLastProbe: 0,
      },
      probeState: expect.objectContaining({
        probeCount: 1,
        lastProbeTraceIndex: 10,
        lastProbeTurnIndex: 10,
      }),
    });

    const events = readDecisionEvents(testProjectPath).filter((event) => event.sessionId === 'sess-mixed');
    expect(events.some((event) => event.tag === 'analysis_requested')).toBe(true);
    expect(events.some((event) => event.tag === 'evaluation_result')).toBe(true);
  });

  it('attaches an unmapped context trace only to the most recently active episode in a shared session', () => {
    const store = createTaskEpisodeStore(testProjectPath);
    const traceA = makeEpisodeTrace('skill-a', 'trace-a-1', 'turn-a-1', '2026-04-11T09:00:01.000Z');
    const traceB = makeEpisodeTrace('skill-b', 'trace-b-1', 'turn-b-1', '2026-04-11T09:00:02.000Z');
    const contextTrace: Trace = {
      trace_id: 'trace-context-1',
      session_id: 'sess-shared',
      turn_id: 'turn-context-1',
      runtime: 'codex',
      event_type: 'assistant_output',
      assistant_output: 'shared assistant output after skill-b',
      status: 'success',
      timestamp: '2026-04-11T09:00:03.000Z',
    };

    store.recordTrace(
      traceA,
      { skillId: 'skill-a', shadowId: 'skill-a@/tmp/project#codex', runtime: 'codex' },
      [traceA]
    );
    store.recordTrace(
      traceB,
      { skillId: 'skill-b', shadowId: 'skill-b@/tmp/project#codex', runtime: 'codex' },
      [traceB]
    );

    store.recordContextTrace(contextTrace);

    const snapshot = readTaskEpisodes(testProjectPath);
    expect(snapshot.episodes).toHaveLength(2);

    const skillAEpisode = snapshot.episodes.find((episode) =>
      episode.skillSegments.some((segment) => segment.skillId === 'skill-a')
    );
    const skillBEpisode = snapshot.episodes.find((episode) =>
      episode.skillSegments.some((segment) => segment.skillId === 'skill-b')
    );

    expect(skillAEpisode?.traceRefs).not.toContain('trace-context-1');
    expect(skillBEpisode?.traceRefs).toContain('trace-context-1');
  });

  it('does not backfill traces that happened before an episode started', () => {
    const store = createTaskEpisodeStore(testProjectPath);
    const traceA = makeEpisodeTrace('skill-a', 'trace-a-1', 'turn-a-1', '2026-04-11T09:00:01.000Z');
    const traceB = makeEpisodeTrace('skill-b', 'trace-b-1', 'turn-b-1', '2026-04-11T09:00:02.000Z');

    store.recordTrace(
      traceB,
      { skillId: 'skill-b', shadowId: 'skill-b@/tmp/project#codex', runtime: 'codex' },
      [traceA, traceB]
    );

    const snapshot = readTaskEpisodes(testProjectPath);
    expect(snapshot.episodes).toHaveLength(1);
    expect(snapshot.episodes[0]?.traceRefs).toEqual(['trace-b-1']);
    expect(snapshot.episodes[0]?.skillSegments[0]?.relatedTraceIds).toEqual(['trace-b-1']);
  });
});
