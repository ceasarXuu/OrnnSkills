import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readProjectEvolutionLifecycle } from '../../src/dashboard/evolution-lifecycle-reader.js';
import type { TaskEpisode } from '../../src/core/task-episode/index.js';

function makeEpisode(overrides: Partial<TaskEpisode> = {}): TaskEpisode {
  return {
    episodeId: 'episode-1',
    projectPath: '/tmp/project',
    runtime: 'codex',
    sessionIds: ['session-1'],
    startedAt: '2026-05-13T00:00:00.000Z',
    lastActivityAt: '2026-05-13T00:01:00.000Z',
    state: 'open',
    traceRefs: ['trace-1', 'trace-2'],
    turnIds: ['turn-1'],
    skillSegments: [
      {
        segmentId: 'segment-1',
        skillId: 'skill-a',
        shadowId: 'codex:skill-a',
        runtime: 'codex',
        firstMappedTraceId: 'trace-1',
        lastRelatedTraceId: 'trace-2',
        mappedTraceIds: ['trace-1'],
        relatedTraceIds: ['trace-2'],
        startedAt: '2026-05-13T00:00:10.000Z',
        lastActivityAt: '2026-05-13T00:01:00.000Z',
        status: 'active',
      },
    ],
    stats: {
      totalTraceCount: 2,
      totalTurnCount: 1,
      mappedTraceCount: 1,
      tracesSinceLastProbe: 2,
      turnsSinceLastProbe: 1,
    },
    probeState: {
      probeCount: 1,
      lastProbeTraceIndex: 0,
      lastProbeTurnIndex: 0,
      nextProbeTraceDelta: 3,
      nextProbeTurnDelta: 2,
      waitForEventTypes: [],
      mode: 'count_driven',
      consecutiveNeedMoreCount: 0,
      consecutiveReadyCount: 1,
    },
    analysisStatus: 'ready_for_analysis',
    ...overrides,
  };
}

describe('dashboard evolution lifecycle reader', () => {
  const testDir = join(tmpdir(), `ornn-dashboard-evolution-${Date.now()}`);

  beforeEach(() => {
    mkdirSync(join(testDir, '.ornn', 'state'), { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('projects active episodes, pending proposals, applied revisions, and verification summary', () => {
    const appliedEpisode = makeEpisode({ episodeId: 'episode-applied' });
    const pendingEpisode = makeEpisode({
      episodeId: 'episode-pending',
      traceRefs: ['trace-3', 'trace-4'],
      sessionIds: ['session-2'],
    });
    writeFileSync(
      join(testDir, '.ornn', 'state', 'task-episodes.json'),
      JSON.stringify({ updatedAt: '2026-05-13T00:02:00.000Z', episodes: [appliedEpisode, pendingEpisode] }),
      'utf-8'
    );
    writeFileSync(
      join(testDir, '.ornn', 'state', 'decision-events.ndjson'),
      [
        JSON.stringify({
          id: 'event-applied',
          timestamp: '2026-05-13T00:03:00.000Z',
          tag: 'optimization_completed',
          episodeId: 'episode-applied',
          skillId: 'skill-a',
          runtime: 'codex',
          status: 'apply_optimization',
          changeType: 'tighten_trigger',
          confidence: 0.82,
          reason: 'Applied improvement',
        }),
        JSON.stringify({
          id: 'event-pending',
          timestamp: '2026-05-13T00:04:00.000Z',
          tag: 'optimization_completed',
          episodeId: 'episode-pending',
          skillId: 'skill-a',
          runtime: 'codex',
          status: 'apply_optimization',
          changeType: 'append_context',
          confidence: 0.76,
          reason: 'Pending proposal',
        }),
      ].join('\n'),
      'utf-8'
    );

    const versionDir = join(testDir, '.ornn', 'skills', 'codex', 'skill-a', 'versions', 'v2');
    mkdirSync(versionDir, { recursive: true });
    writeFileSync(
      join(versionDir, 'metadata.json'),
      JSON.stringify({
        version: 2,
        createdAt: '2026-05-13T00:05:00.000Z',
        reason: 'Applied improvement',
        traceIds: ['trace-1', 'trace-2'],
        previousVersion: 1,
        activityScopeId: 'episode-applied',
      }),
      'utf-8'
    );

    const lifecycle = readProjectEvolutionLifecycle(testDir);

    expect(lifecycle.summary).toEqual({
      activeEpisodes: 2,
      pendingProposals: 1,
      appliedRevisions: 1,
      failedRuns: 0,
      regressions: 0,
      verifiedImprovements: 0,
    });
    expect(lifecycle.runs.map((run) => [run.episodeId, run.status])).toEqual([
      ['episode-pending', 'proposed'],
      ['episode-applied', 'applied'],
    ]);
  });
});
