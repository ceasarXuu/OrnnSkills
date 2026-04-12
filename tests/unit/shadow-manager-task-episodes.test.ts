import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createShadowManager } from '../../src/core/shadow-manager/index.js';
import type { EvaluationResult, Trace } from '../../src/types/index.js';
import type { DecisionEventRecord } from '../../src/core/decision-events/index.js';
import type { TaskEpisodeSnapshot } from '../../src/core/task-episode/index.js';

const { evaluatorMock, patchGeneratorMock } = vi.hoisted(() => ({
  evaluatorMock: {
    evaluate: vi.fn<[Trace[]], EvaluationResult | null>(),
  },
  patchGeneratorMock: {
    generate: vi.fn(),
  },
}));

vi.mock('../../src/core/evaluator/index.js', () => ({
  evaluator: evaluatorMock,
}));

vi.mock('../../src/core/patch-generator/index.js', () => ({
  patchGenerator: patchGeneratorMock,
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

    evaluatorMock.evaluate.mockReset();
    patchGeneratorMock.generate.mockReset();
  });

  afterEach(() => {
    rmSync(testProjectPath, { recursive: true, force: true });
  });

  it('persists task episodes and emits probe events once a window reaches the initial threshold', async () => {
    evaluatorMock.evaluate.mockReturnValue(null);

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
      }),
    });

    const events = readDecisionEvents(testProjectPath);
    expect(events.some((event) => event.tag === 'episode_probe_requested')).toBe(true);
    expect(events.some((event) => event.tag === 'episode_probe_result')).toBe(true);

    const probeResult = events.find((event) => event.tag === 'episode_probe_result');
    expect(probeResult).toMatchObject({
      skillId: 'test-skill',
      runtime: 'codex',
      windowId: 'sess-1::test-skill',
      sessionId: 'sess-1',
      traceId: 'trace-10',
      status: 'continue_collecting',
    });
  });

  it('marks the current episode as completed after a successful patch', async () => {
    evaluatorMock.evaluate.mockReturnValue({
      should_patch: true,
      change_type: 'prune_noise',
      target_section: 'TODO',
      reason: 'Tool step was skipped repeatedly',
      source_sessions: ['sess-1'],
      confidence: 0.93,
      rule_name: 'repeated-drift',
    });
    patchGeneratorMock.generate.mockResolvedValue({
      success: true,
      patch: '@@ -1 +1 @@\n-old\n+new\n',
      newContent: '# Test Skill\n\nUpdated content.\n',
      changeType: 'prune_noise',
    });

    const manager = createShadowManager(testProjectPath);
    await manager.init();

    await manager.processTrace(makeTrace(1, testProjectPath));

    const snapshot = readTaskEpisodes(testProjectPath);
    expect(snapshot.episodes).toHaveLength(1);
    expect(snapshot.episodes[0]).toMatchObject({
      state: 'closed',
      analysisStatus: 'completed',
    });
    expect(snapshot.episodes[0].skillSegments[0]).toMatchObject({
      status: 'closed',
      lastRelatedTraceId: 'trace-1',
    });
  });
});
