import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createShadowManager } from '../../src/core/shadow-manager/index.js';
import type { EvaluationResult, Trace } from '../../src/types/index.js';
import type { DecisionEventRecord } from '../../src/core/decision-events/index.js';
import type { TaskEpisodeSnapshot } from '../../src/core/task-episode/index.js';

const {
  evaluatorMock,
  patchGeneratorMock,
  probeEpisodeMock,
  analyzeWindowMock,
  decisionExplanationMock,
} = vi.hoisted(() => ({
  evaluatorMock: {
    evaluate: vi.fn<[Trace[]], EvaluationResult | null>(),
  },
  patchGeneratorMock: {
    generate: vi.fn(),
  },
  probeEpisodeMock: vi.fn(),
  analyzeWindowMock: vi.fn(),
  decisionExplanationMock: vi.fn(),
}));

vi.mock('../../src/core/evaluator/index.js', () => ({
  evaluator: evaluatorMock,
}));

vi.mock('../../src/core/patch-generator/index.js', () => ({
  patchGenerator: patchGeneratorMock,
}));

vi.mock('../../src/core/readiness-probe/index.js', () => ({
  createReadinessProbeAnalyzer: () => ({
    probeEpisode: probeEpisodeMock,
  }),
}));

vi.mock('../../src/core/skill-call-analyzer/index.js', () => ({
  createSkillCallAnalyzer: () => ({
    analyzeWindow: analyzeWindowMock,
  }),
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
    timestamp: new Date(Date.UTC(2026, 3, 12, 1, 0, index)).toISOString(),
    metadata: { skill_id: 'test-skill' },
  };
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

function readTaskEpisodes(projectRoot: string): TaskEpisodeSnapshot {
  return JSON.parse(
    readFileSync(join(projectRoot, '.ornn', 'state', 'task-episodes.json'), 'utf-8')
  ) as TaskEpisodeSnapshot;
}

function readCheckpoint(projectRoot: string): {
  optimizationStatus?: {
    currentState?: string;
    currentSkillId?: string | null;
    lastOptimizationAt?: string | null;
    lastError?: string | null;
    queueSize?: number;
  };
} {
  return JSON.parse(
    readFileSync(join(projectRoot, '.ornn', 'state', 'daemon-checkpoint.json'), 'utf-8')
  ) as {
    optimizationStatus?: {
      currentState?: string;
      currentSkillId?: string | null;
      lastOptimizationAt?: string | null;
      lastError?: string | null;
      queueSize?: number;
    };
  };
}

describe('ShadowManager deep analysis recovery chain', () => {
  const testProjectPath = join(tmpdir(), `ornn-shadow-manager-deep-analysis-${Date.now()}`);

  beforeEach(() => {
    rmSync(testProjectPath, { recursive: true, force: true });
    mkdirSync(join(testProjectPath, '.ornn', 'state'), { recursive: true });
    mkdirSync(join(testProjectPath, '.agents', 'skills', 'test-skill'), { recursive: true });
    writeFileSync(
      join(testProjectPath, '.agents', 'skills', 'test-skill', 'SKILL.md'),
      '# Test Skill\n\nUse this skill in tests.\n',
      'utf-8'
    );

    evaluatorMock.evaluate.mockReset();
    patchGeneratorMock.generate.mockReset();
    probeEpisodeMock.mockReset();
    analyzeWindowMock.mockReset();
    decisionExplanationMock.mockReset();

    evaluatorMock.evaluate.mockReturnValue(null);
    probeEpisodeMock.mockResolvedValue({
      decision: 'ready_for_analysis',
      reason: 'Trace evidence is now sufficient',
      observedOutcomes: ['analysis-ready'],
      missingEvidence: [],
      nextProbeHint: {
        suggestedTraceDelta: 12,
        suggestedTurnDelta: 3,
        waitForEventTypes: [],
        mode: 'count_driven',
      },
      episodeAction: {
        closeCurrent: false,
        openNew: false,
      },
      skillFocus: ['test-skill'],
    });
    decisionExplanationMock.mockResolvedValue({
      summary: '这次调用不建议修改 skill。',
      evidenceReadout: ['时间线覆盖完整'],
      causalChain: ['没有观察到稳定的 skill 设计缺陷'],
      decisionRationale: '当前行为与 skill 指引一致。',
      recommendedAction: '继续观察后续调用窗口。',
      uncertainties: [],
      contradictions: [],
    });
  });

  afterEach(() => {
    rmSync(testProjectPath, { recursive: true, force: true });
  });

  async function processUntilReady(manager: ReturnType<typeof createShadowManager>) {
    for (let index = 1; index <= 10; index += 1) {
      await manager.processTrace(makeTrace(index, testProjectPath));
    }
  }

  it('runs deep analysis and records decision feedback when probe says no patch is needed', async () => {
    analyzeWindowMock.mockResolvedValue({
      success: true,
      model: 'deepseek/deepseek-chat',
      evaluation: {
        should_patch: false,
        reason: '调用窗口显示当前 skill 使用正确',
        source_sessions: ['sess-1'],
        confidence: 0.31,
        rule_name: 'agent_call_window_analysis',
      },
      tokenUsage: {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      },
    });

    const manager = createShadowManager(testProjectPath);
    await manager.init();
    await processUntilReady(manager);

    const scopedEvents = readDecisionEvents(testProjectPath).filter((event) => event.traceId === 'trace-10');
    expect(scopedEvents.map((event) => event.tag)).toEqual([
      'episode_probe_requested',
      'episode_probe_result',
      'analysis_requested',
      'evaluation_result',
      'skill_feedback',
    ]);
    expect(scopedEvents[2]).toMatchObject({
      tag: 'analysis_requested',
      status: 'episode_ready',
    });
    expect(scopedEvents[3]).toMatchObject({
      tag: 'evaluation_result',
      status: 'no_patch_needed',
      reason: '调用窗口显示当前 skill 使用正确',
    });
    expect(scopedEvents[4]).toMatchObject({
      tag: 'skill_feedback',
      status: 'no_patch_needed',
      detail: '这次调用不建议修改 skill。',
    });

    const snapshot = readTaskEpisodes(testProjectPath);
    expect(snapshot.episodes[0]).toMatchObject({
      state: 'closed',
      analysisStatus: 'completed',
    });

    const checkpoint = readCheckpoint(testProjectPath);
    expect(checkpoint.optimizationStatus).toMatchObject({
      currentState: 'idle',
      currentSkillId: null,
      queueSize: 0,
    });
  });

  it('uses deep analysis output to patch once probe declares the window ready', async () => {
    analyzeWindowMock.mockResolvedValue({
      success: true,
      model: 'deepseek/deepseek-chat',
      evaluation: {
        should_patch: true,
        change_type: 'prune_noise',
        reason: '需要删掉多余的回显说明',
        source_sessions: ['sess-1'],
        confidence: 0.91,
        rule_name: 'agent_call_window_analysis',
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
    await processUntilReady(manager);

    const scopedEvents = readDecisionEvents(testProjectPath).filter((event) => event.traceId === 'trace-10');
    expect(scopedEvents.map((event) => event.tag)).toEqual([
      'episode_probe_requested',
      'episode_probe_result',
      'analysis_requested',
      'skill_feedback',
      'patch_applied',
    ]);
    expect(scopedEvents.filter((event) => event.tag === 'analysis_requested')).toHaveLength(1);
    expect(scopedEvents[4]).toMatchObject({
      tag: 'patch_applied',
      status: 'success',
      changeType: 'prune_noise',
    });

    const checkpoint = readCheckpoint(testProjectPath);
    expect(checkpoint.optimizationStatus).toMatchObject({
      currentState: 'idle',
      currentSkillId: null,
      queueSize: 0,
    });
  });

  it('records analysis failure and checkpoint error when deep analysis itself fails', async () => {
    analyzeWindowMock.mockResolvedValue({
      success: false,
      model: 'deepseek/deepseek-chat',
      error: 'invalid_analysis_json',
      errorCode: 'invalid_analysis_json',
      userMessage: '模型返回了内容，但格式不符合系统要求，所以这轮分析结果无法解析。',
      technicalDetail: 'invalid_analysis_json',
      tokenUsage: {
        promptTokens: 100,
        completionTokens: 0,
        totalTokens: 100,
      },
    });

    const manager = createShadowManager(testProjectPath);
    await manager.init();
    await processUntilReady(manager);

    const scopedEvents = readDecisionEvents(testProjectPath).filter((event) => event.traceId === 'trace-10');
    expect(scopedEvents.map((event) => event.tag)).toEqual([
      'episode_probe_requested',
      'episode_probe_result',
      'analysis_requested',
      'analysis_failed',
    ]);
    expect(scopedEvents[3]).toMatchObject({
      tag: 'analysis_failed',
      detail: '模型返回了内容，但格式不符合系统要求，所以这轮分析结果无法解析。',
      reason: 'invalid_analysis_json',
    });

    const snapshot = readTaskEpisodes(testProjectPath);
    expect(snapshot.episodes[0]).toMatchObject({
      state: 'closed',
      analysisStatus: 'failed',
    });

    const checkpoint = readCheckpoint(testProjectPath);
    expect(checkpoint.optimizationStatus).toMatchObject({
      currentState: 'error',
      currentSkillId: 'test-skill',
      lastError: '模型返回了内容，但格式不符合系统要求，所以这轮分析结果无法解析。',
      queueSize: 0,
    });
  });
});
