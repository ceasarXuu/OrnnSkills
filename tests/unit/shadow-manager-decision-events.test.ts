import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createShadowManager } from '../../src/core/shadow-manager/index.js';
import { createJournalManager } from '../../src/core/journal/index.js';
import type { EvaluationResult, Trace } from '../../src/types/index.js';
import type { DecisionEventRecord } from '../../src/core/decision-events/index.js';

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

function readDecisionEvents(projectRoot: string): DecisionEventRecord[] {
  const path = join(projectRoot, '.ornn', 'state', 'decision-events.ndjson');
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf-8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as DecisionEventRecord);
}

function makeTrace(traceId: string, projectRoot: string): Trace {
  return {
    trace_id: traceId,
    session_id: 'sess-1',
    turn_id: 'turn-1',
    runtime: 'codex',
    event_type: 'tool_call',
    tool_name: 'exec_command',
    tool_args: { cmd: `cat ${projectRoot}/.agents/skills/test-skill/SKILL.md` },
    status: 'success',
    timestamp: new Date('2026-04-11T08:00:00.000Z').toISOString(),
    metadata: { skill_id: 'test-skill' },
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

    evaluatorMock.evaluate.mockReset();
    patchGeneratorMock.generate.mockReset();
  });

  afterEach(() => {
    rmSync(testProjectPath, { recursive: true, force: true });
  });

  it('records no-patch evaluation events with a stable scope id', async () => {
    evaluatorMock.evaluate.mockReturnValue({
      should_patch: false,
      reason: 'Current evidence is not enough yet',
      source_sessions: ['sess-1'],
      confidence: 0.62,
      rule_name: 'collect_more_evidence',
    });

    const manager = createShadowManager(testProjectPath);
    await manager.init();

    await manager.processTrace(makeTrace('trace-no-patch', testProjectPath));

    const events = readDecisionEvents(testProjectPath);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      tag: 'evaluation_result',
      skillId: 'test-skill',
      runtime: 'codex',
      status: 'no_patch_needed',
      windowId: 'sess-1::test-skill',
      sessionId: 'sess-1',
      traceId: 'trace-no-patch',
      ruleName: 'collect_more_evidence',
      confidence: 0.62,
    });
  });

  it('records analysis requested and patch applied events for successful optimizations', async () => {
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

    await manager.processTrace(makeTrace('trace-patch', testProjectPath));

    const events = readDecisionEvents(testProjectPath);
    expect(events.map((event) => event.tag)).toEqual(['analysis_requested', 'patch_applied']);
    expect(events[0]).toMatchObject({
      skillId: 'test-skill',
      runtime: 'codex',
      windowId: 'sess-1::test-skill',
      status: 'ready',
      traceId: 'trace-patch',
      sessionId: 'sess-1',
      ruleName: 'repeated-drift',
      changeType: 'prune_noise',
    });
    expect(events[1]).toMatchObject({
      skillId: 'test-skill',
      runtime: 'codex',
      windowId: 'sess-1::test-skill',
      status: 'success',
      traceId: 'trace-patch',
      sessionId: 'sess-1',
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
    evaluatorMock.evaluate.mockReturnValue({
      should_patch: true,
      change_type: 'prune_noise',
      target_section: 'TODO',
      reason: 'Tool step was skipped repeatedly',
      source_sessions: ['sess-1'],
      confidence: 0.91,
      rule_name: 'repeated-drift',
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

    await manager.processTrace(makeTrace('trace-failed', testProjectPath));

    const events = readDecisionEvents(testProjectPath);
    expect(events.map((event) => event.tag)).toEqual(['analysis_requested', 'analysis_failed']);
    expect(events[1]).toMatchObject({
      skillId: 'test-skill',
      runtime: 'codex',
      windowId: 'sess-1::test-skill',
      status: 'failed',
      traceId: 'trace-failed',
      sessionId: 'sess-1',
      changeType: 'prune_noise',
    });
    expect(events[1].detail).toContain('strategy execution failed');
  });

  it('does not enter error state when prune-noise evaluation lacks target section', async () => {
    evaluatorMock.evaluate.mockReturnValue({
      should_patch: true,
      change_type: 'prune_noise',
      reason: 'Tool step was skipped repeatedly',
      source_sessions: ['sess-1'],
      confidence: 0.91,
      rule_name: 'repeated-drift',
    });

    const manager = createShadowManager(testProjectPath);
    await manager.init();

    await manager.processTrace(makeTrace('trace-missing-section', testProjectPath));

    expect(patchGeneratorMock.generate).not.toHaveBeenCalled();

    const events = readDecisionEvents(testProjectPath);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      tag: 'evaluation_result',
      skillId: 'test-skill',
      runtime: 'codex',
      windowId: 'sess-1::test-skill',
      status: 'continue_collecting',
      traceId: 'trace-missing-section',
      sessionId: 'sess-1',
      ruleName: 'repeated-drift',
      changeType: 'prune_noise',
    });
    expect(events[0].detail).toContain('缺少 target_section');
  });
});
