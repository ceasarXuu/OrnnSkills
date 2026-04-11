import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readAgentUsageStats, readDaemonStatus, readProjectSnapshot, readRecentDecisionEvents } from '../../src/dashboard/data-reader.js';

const testRoots: string[] = [];

afterEach(() => {
  for (const root of testRoots) {
    if (existsSync(root)) {
      rmSync(root, { recursive: true, force: true });
    }
  }
  testRoots.length = 0;
});

describe('dashboard decision event reader', () => {
  it('reads recent decision events from project state', () => {
    const projectRoot = join(tmpdir(), `ornn-dashboard-decisions-${Date.now()}`);
    testRoots.push(projectRoot);
    mkdirSync(join(projectRoot, '.ornn', 'state'), { recursive: true });

    writeFileSync(
      join(projectRoot, '.ornn', 'state', 'decision-events.ndjson'),
      [
        JSON.stringify({
          id: 'evt-1',
          timestamp: '2026-04-09T12:00:00.000Z',
          tag: 'analysis_requested',
          skillId: 'systematic-debugging',
          runtime: 'codex',
          status: 'pending',
          detail: 'probe says ready',
        }),
        JSON.stringify({
          id: 'evt-2',
          timestamp: '2026-04-09T12:01:00.000Z',
          tag: 'skill_evaluation',
          skillId: 'systematic-debugging',
          runtime: 'codex',
          status: 'no_patch_needed',
          detail: 'not enough evidence',
          confidence: 0.61,
          changeType: null,
          reason: 'No patch needed',
        }),
      ].join('\n') + '\n',
      'utf-8'
    );

    const events = readRecentDecisionEvents(projectRoot);
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      id: 'evt-2',
      tag: 'skill_evaluation',
      skillId: 'systematic-debugging',
      status: 'no_patch_needed',
      confidence: 0.61,
    });
    expect(events[1]).toMatchObject({
      id: 'evt-1',
      tag: 'analysis_requested',
      status: 'pending',
    });
  });

  it('reads project snapshot with decision events and agent usage stats', () => {
    const projectRoot = join(tmpdir(), `ornn-dashboard-snapshot-${Date.now()}`);
    testRoots.push(projectRoot);
    mkdirSync(join(projectRoot, '.ornn', 'state'), { recursive: true });

    writeFileSync(
      join(projectRoot, '.ornn', 'state', 'decision-events.ndjson'),
      JSON.stringify({
        id: 'evt-1',
        timestamp: '2026-04-09T12:00:00.000Z',
        tag: 'analysis_requested',
        skillId: 'systematic-debugging',
        runtime: 'codex',
        status: 'pending',
        detail: 'probe says ready',
      }) + '\n',
      'utf-8'
    );

    writeFileSync(
      join(projectRoot, '.ornn', 'state', 'agent-usage-summary.json'),
      JSON.stringify({
        updatedAt: '2026-04-09T12:02:00.000Z',
        scope: 'ornn_agent',
        callCount: 3,
        promptTokens: 1800,
        completionTokens: 420,
        totalTokens: 2220,
        byModel: {
          'deepseek/deepseek-reasoner': {
            callCount: 2,
            promptTokens: 1200,
            completionTokens: 300,
            totalTokens: 1500,
          },
        },
        byScope: {
          decision_explainer: {
            callCount: 1,
            promptTokens: 400,
            completionTokens: 100,
            totalTokens: 500,
          },
          skill_call_analyzer: {
            callCount: 1,
            promptTokens: 800,
            completionTokens: 200,
            totalTokens: 1000,
          },
          readiness_probe: {
            callCount: 1,
            promptTokens: 600,
            completionTokens: 120,
            totalTokens: 720,
          },
        },
      }),
      'utf-8'
    );

    const snapshot = readProjectSnapshot(projectRoot);
    expect(snapshot.decisionEvents).toHaveLength(1);
    expect(snapshot.agentUsage).toMatchObject({
      callCount: 3,
      totalTokens: 2220,
    });
  });

  it('returns empty agent usage stats when summary is absent', () => {
    const projectRoot = join(tmpdir(), `ornn-dashboard-usage-empty-${Date.now()}`);
    testRoots.push(projectRoot);
    mkdirSync(join(projectRoot, '.ornn', 'state'), { recursive: true });

    expect(readAgentUsageStats(projectRoot)).toMatchObject({
      callCount: 0,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      durationMsTotal: 0,
      avgDurationMs: 0,
      lastCallAt: null,
      byModel: {},
      byScope: {},
      bySkill: {},
    });
  });

  it('aggregates agent usage stats from ndjson with scope, skill, and latency metadata', () => {
    const projectRoot = join(tmpdir(), `ornn-dashboard-agent-usage-${Date.now()}`);
    testRoots.push(projectRoot);
    mkdirSync(join(projectRoot, '.ornn', 'state'), { recursive: true });

    writeFileSync(
      join(projectRoot, '.ornn', 'state', 'agent-usage.ndjson'),
      [
        JSON.stringify({
          id: 'u1',
          timestamp: '2026-04-10T01:00:00.000Z',
          scope: 'decision_explainer',
          eventId: 'e1',
          skillId: 'show-my-repo',
          model: 'deepseek/deepseek-reasoner',
          promptTokens: 1200,
          completionTokens: 340,
          totalTokens: 1540,
          durationMs: 1800,
        }),
        JSON.stringify({
          id: 'u2',
          timestamp: '2026-04-10T01:01:00.000Z',
          scope: 'skill_call_analyzer',
          eventId: 'e2',
          skillId: 'show-my-repo',
          model: 'deepseek/deepseek-reasoner',
          promptTokens: 4000,
          completionTokens: 900,
          totalTokens: 4900,
          durationMs: 3200,
        }),
        JSON.stringify({
          id: 'u3',
          timestamp: '2026-04-10T01:03:00.000Z',
          scope: 'readiness_probe',
          eventId: 'e3',
          skillId: 'summary-my-repo',
          model: 'deepseek/deepseek-chat',
          promptTokens: 600,
          completionTokens: 100,
          totalTokens: 700,
          durationMs: 1000,
        }),
      ].join('\n') + '\n',
      'utf-8'
    );

    const stats = readAgentUsageStats(projectRoot);
    expect(stats).toMatchObject({
      callCount: 3,
      promptTokens: 5800,
      completionTokens: 1340,
      totalTokens: 7140,
      durationMsTotal: 6000,
      avgDurationMs: 2000,
      lastCallAt: '2026-04-10T01:03:00.000Z',
    });
    expect(stats.byModel['deepseek/deepseek-reasoner']).toMatchObject({
      callCount: 2,
      totalTokens: 6440,
      durationMsTotal: 5000,
      lastCallAt: '2026-04-10T01:01:00.000Z',
    });
    expect(stats.byScope.decision_explainer).toMatchObject({
      callCount: 1,
      totalTokens: 1540,
    });
    expect(stats.byScope.skill_call_analyzer).toMatchObject({
      callCount: 1,
      totalTokens: 4900,
    });
    expect(stats.bySkill['show-my-repo']).toMatchObject({
      callCount: 2,
      totalTokens: 6440,
      durationMsTotal: 5000,
      lastCallAt: '2026-04-10T01:01:00.000Z',
    });
  });

  it('does not truncate cumulative agent usage totals when ndjson grows beyond the old snapshot window', () => {
    const projectRoot = join(tmpdir(), `ornn-dashboard-agent-usage-full-${Date.now()}`);
    testRoots.push(projectRoot);
    mkdirSync(join(projectRoot, '.ornn', 'state'), { recursive: true });

    const rows = Array.from({ length: 2505 }, (_, index) =>
      JSON.stringify({
        id: `u-${index}`,
        timestamp: '2026-04-10T01:00:00.000Z',
        scope: 'decision_explainer',
        eventId: `e-${index}`,
        skillId: 'show-my-repo',
        model: 'deepseek/deepseek-reasoner',
        promptTokens: 10,
        completionTokens: 2,
        totalTokens: 12,
        durationMs: 500,
      })
    );
    writeFileSync(join(projectRoot, '.ornn', 'state', 'agent-usage.ndjson'), rows.join('\n') + '\n', 'utf-8');

    const stats = readAgentUsageStats(projectRoot);
    expect(stats.callCount).toBe(2505);
    expect(stats.promptTokens).toBe(25050);
    expect(stats.completionTokens).toBe(5010);
    expect(stats.totalTokens).toBe(30060);
    expect(stats.durationMsTotal).toBe(1252500);
    expect(stats.bySkill['show-my-repo']?.callCount).toBe(2505);
  });

  it('backfills daemon activity from task episodes and patch history', () => {
    const projectRoot = join(tmpdir(), `ornn-dashboard-daemon-backfill-${Date.now()}`);
    testRoots.push(projectRoot);
    mkdirSync(join(projectRoot, '.ornn', 'state'), { recursive: true });

    writeFileSync(
      join(projectRoot, '.ornn', 'state', 'daemon-checkpoint.json'),
      JSON.stringify({
        isRunning: true,
        startedAt: '2026-04-10T22:00:00.000Z',
        processedTraces: 329,
        lastCheckpointAt: '2026-04-10T22:39:24.975Z',
        retryQueueSize: 0,
        optimizationStatus: {
          currentState: 'idle',
          currentSkillId: null,
          lastOptimizationAt: null,
          lastError: null,
          queueSize: 0,
        },
      }),
      'utf-8'
    );

    writeFileSync(
      join(projectRoot, '.ornn', 'state', 'task-episodes.json'),
      JSON.stringify({
        updatedAt: '2026-04-10T22:39:08.402Z',
        episodes: [
          {
            episodeId: 'episode-1',
            projectPath: projectRoot,
            runtime: 'codex',
            sessionIds: ['session-1'],
            startedAt: '2026-04-10T22:37:52.696Z',
            lastActivityAt: '2026-04-10T22:38:33.803Z',
            state: 'analyzing',
            traceRefs: ['trace-1'],
            turnIds: ['line_1'],
            skillSegments: [
              {
                segmentId: 'segment-1',
                skillId: 'systematic-debugging',
                shadowId: 'codex::systematic-debugging@/tmp/project',
                runtime: 'codex',
                firstMappedTraceId: 'trace-1',
                lastRelatedTraceId: 'trace-1',
                mappedTraceIds: ['trace-1'],
                relatedTraceIds: ['trace-1'],
                startedAt: '2026-04-10T22:37:52.696Z',
                lastActivityAt: '2026-04-10T22:38:33.803Z',
                status: 'active',
              },
            ],
            stats: {
              totalTraceCount: 70,
              totalTurnCount: 70,
              mappedTraceCount: 1,
              tracesSinceLastProbe: 0,
              turnsSinceLastProbe: 0,
            },
            probeState: {
              probeCount: 3,
              lastProbeTraceIndex: 70,
              lastProbeTurnIndex: 70,
              nextProbeTraceDelta: 20,
              nextProbeTurnDelta: 3,
              waitForEventTypes: [],
              mode: 'count_driven',
              consecutiveNeedMoreCount: 0,
              consecutiveReadyCount: 1,
            },
            analysisStatus: 'running',
          },
        ],
      }),
      'utf-8'
    );

    writeFileSync(
      join(projectRoot, '.ornn', 'state', 'decision-events.ndjson'),
      [
        JSON.stringify({
          id: 'patch-1',
          timestamp: '2026-04-10T12:16:20.214Z',
          tag: 'patch_applied',
          skillId: 'vercel-react-best-practices',
          runtime: 'codex',
          status: 'success',
          detail: 'revision=1',
        }),
        JSON.stringify({
          id: 'analysis-1',
          timestamp: '2026-04-10T22:38:53.914Z',
          tag: 'analysis_requested',
          skillId: 'systematic-debugging',
          runtime: 'codex',
          status: 'episode_ready',
          detail: 'episode=episode-1',
        }),
      ].join('\n') + '\n',
      'utf-8'
    );

    const daemon = readDaemonStatus(projectRoot);
    expect(daemon.optimizationStatus).toMatchObject({
      currentState: 'analyzing',
      currentSkillId: 'systematic-debugging',
      queueSize: 1,
      lastOptimizationAt: '2026-04-10T12:16:20.214Z',
    });
  });

  it('backfills daemon failure state from recent decision events when checkpoint is empty', () => {
    const projectRoot = join(tmpdir(), `ornn-dashboard-daemon-failure-${Date.now()}`);
    testRoots.push(projectRoot);
    mkdirSync(join(projectRoot, '.ornn', 'state'), { recursive: true });

    writeFileSync(
      join(projectRoot, '.ornn', 'state', 'decision-events.ndjson'),
      [
        JSON.stringify({
          id: 'analysis-1',
          timestamp: '2026-04-10T22:38:53.914Z',
          tag: 'analysis_failed',
          skillId: 'systematic-debugging',
          runtime: 'codex',
          status: 'failed',
          detail: 'llm unavailable',
        }),
      ].join('\n') + '\n',
      'utf-8'
    );

    const daemon = readDaemonStatus(projectRoot);
    expect(daemon.optimizationStatus).toMatchObject({
      currentState: 'error',
      currentSkillId: 'systematic-debugging',
      lastError: 'llm unavailable',
    });
  });

  it('backfills processed trace count from default trace store when checkpoint is stale', () => {
    const projectRoot = join(tmpdir(), `ornn-dashboard-daemon-trace-count-${Date.now()}`);
    testRoots.push(projectRoot);
    mkdirSync(join(projectRoot, '.ornn', 'state'), { recursive: true });

    writeFileSync(
      join(projectRoot, '.ornn', 'state', 'daemon-checkpoint.json'),
      JSON.stringify({
        isRunning: true,
        startedAt: '2026-04-10T22:00:00.000Z',
        processedTraces: 0,
        lastCheckpointAt: '2026-04-10T22:39:24.975Z',
        retryQueueSize: 0,
        optimizationStatus: {
          currentState: 'idle',
          currentSkillId: null,
          lastOptimizationAt: null,
          lastError: null,
          queueSize: 0,
        },
      }),
      'utf-8'
    );

    writeFileSync(
      join(projectRoot, '.ornn', 'state', 'default.ndjson'),
      [
        JSON.stringify({ trace_id: 'trace-1', runtime: 'codex', session_id: 'session-1', turn_id: 'turn-1', event_type: 'tool_call', timestamp: '2026-04-10T22:00:01.000Z', status: 'success' }),
        JSON.stringify({ trace_id: 'trace-2', runtime: 'codex', session_id: 'session-1', turn_id: 'turn-2', event_type: 'assistant_output', timestamp: '2026-04-10T22:00:02.000Z', status: 'success' }),
      ].join('\n') + '\n',
      'utf-8'
    );

    const daemon = readDaemonStatus(projectRoot);
    expect(daemon.processedTraces).toBe(2);
  });

  it('backfills processed trace count from session-scoped trace stores when checkpoint is stale', () => {
    const projectRoot = join(tmpdir(), `ornn-dashboard-daemon-session-trace-count-${Date.now()}`);
    testRoots.push(projectRoot);
    mkdirSync(join(projectRoot, '.ornn', 'state'), { recursive: true });

    writeFileSync(
      join(projectRoot, '.ornn', 'state', 'daemon-checkpoint.json'),
      JSON.stringify({
        isRunning: true,
        startedAt: '2026-04-10T22:00:00.000Z',
        processedTraces: 0,
        lastCheckpointAt: '2026-04-10T22:39:24.975Z',
        retryQueueSize: 0,
        optimizationStatus: {
          currentState: 'idle',
          currentSkillId: null,
          lastOptimizationAt: null,
          lastError: null,
          queueSize: 0,
        },
      }),
      'utf-8'
    );

    writeFileSync(
      join(projectRoot, '.ornn', 'state', 'session-a.ndjson'),
      JSON.stringify({ trace_id: 'trace-a', runtime: 'codex', session_id: 'session-a', turn_id: 'turn-1', event_type: 'tool_call', timestamp: '2026-04-10T22:00:01.000Z', status: 'success' }) + '\n',
      'utf-8'
    );
    writeFileSync(
      join(projectRoot, '.ornn', 'state', 'session-b.ndjson'),
      JSON.stringify({ trace_id: 'trace-b', runtime: 'codex', session_id: 'session-b', turn_id: 'turn-1', event_type: 'assistant_output', timestamp: '2026-04-10T22:00:02.000Z', status: 'success' }) + '\n',
      'utf-8'
    );

    const daemon = readDaemonStatus(projectRoot);
    expect(daemon.processedTraces).toBe(2);
  });
});
