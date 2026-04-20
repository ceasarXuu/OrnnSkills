import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createTaskEpisodeStore } from '../../src/core/task-episode/index.js';
import type { TaskEpisodeSnapshot, TaskEpisodeTraceContext } from '../../src/core/task-episode/index.js';
import type { Trace } from '../../src/types/index.js';

function makeTrace(index: number): Trace {
  return {
    trace_id: `trace-${index}`,
    session_id: 'session-long-run',
    turn_id: `turn-${index}`,
    runtime: 'codex',
    event_type: 'tool_call',
    tool_name: 'exec_command',
    tool_args: { cmd: `echo ${index}` },
    status: 'success',
    timestamp: new Date(Date.UTC(2026, 3, 20, 8, 0, index)).toISOString(),
    metadata: { skill_id: 'test-skill' },
  };
}

function readSnapshot(projectRoot: string): TaskEpisodeSnapshot {
  return JSON.parse(
    readFileSync(join(projectRoot, '.ornn', 'state', 'task-episodes.json'), 'utf-8')
  ) as TaskEpisodeSnapshot;
}

describe('TaskEpisodeStore retention', () => {
  const projectRoot = join(tmpdir(), `ornn-task-episode-store-${Date.now()}`);
  const context: TaskEpisodeTraceContext = {
    skillId: 'test-skill',
    shadowId: 'codex::test-skill@/tmp/project',
    runtime: 'codex',
  };

  beforeEach(() => {
    rmSync(projectRoot, { recursive: true, force: true });
    mkdirSync(join(projectRoot, '.ornn', 'state'), { recursive: true });
  });

  afterEach(() => {
    if (existsSync(projectRoot)) {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('keeps task episode persistence bounded after long-running sessions close', () => {
    const store = createTaskEpisodeStore(projectRoot);
    const sessionTraces: Trace[] = [];

    for (let index = 1; index <= 320; index += 1) {
      const trace = makeTrace(index);
      sessionTraces.push(trace);
      store.recordTrace(trace, context, [...sessionTraces]);
    }

    store.markAnalysisState('session-long-run', 'test-skill', 'codex', 'completed');

    const snapshot = readSnapshot(projectRoot);
    expect(snapshot.episodes).toHaveLength(1);
    expect(snapshot.episodes[0]).toMatchObject({
      state: 'closed',
      analysisStatus: 'completed',
      stats: expect.objectContaining({
        totalTraceCount: 320,
        totalTurnCount: 320,
        mappedTraceCount: 320,
      }),
      retention: expect.objectContaining({
        archivedTraceCount: expect.any(Number),
        archivedTurnCount: expect.any(Number),
      }),
    });
    expect(snapshot.episodes[0].traceRefs.length).toBeLessThanOrEqual(120);
    expect(snapshot.episodes[0].traceRefs).toContain('trace-1');
    expect(snapshot.episodes[0].traceRefs).toContain('trace-320');
    expect(snapshot.episodes[0].turnIds.length).toBeLessThanOrEqual(120);
    expect(snapshot.episodes[0].retention?.archivedTraceCount ?? 0).toBeGreaterThan(0);
    expect(snapshot.episodes[0].skillSegments[0]?.mappedTraceIds.length ?? 0).toBeLessThanOrEqual(80);
    expect(snapshot.episodes[0].skillSegments[0]?.mappedTraceIds).toContain('trace-1');
    expect(snapshot.episodes[0].skillSegments[0]?.mappedTraceIds).toContain('trace-320');
    expect(
      snapshot.episodes[0].skillSegments[0]?.retention?.archivedMappedTraceCount ?? 0
    ).toBeGreaterThan(0);
  });
});
