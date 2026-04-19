import { beforeEach, describe, expect, it, afterEach } from 'vitest';
import { existsSync, mkdirSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  readDaemonStatus,
  readGlobalLogs,
  readLogsSince,
  readProjectSnapshot,
  readProjectSnapshotVersion,
  readRecentTraces,
} from '../../src/dashboard/data-reader.js';

describe('dashboard data reader snapshot version', () => {
  const testDir = join(tmpdir(), 'ornn-dashboard-data-reader-' + Date.now());

  beforeEach(() => {
    mkdirSync(join(testDir, '.ornn', 'state'), { recursive: true });
    mkdirSync(join(testDir, '.ornn', 'shadows'), { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('changes when agent usage ndjson changes', async () => {
    const usagePath = join(testDir, '.ornn', 'state', 'agent-usage.ndjson');
    writeFileSync(usagePath, '', 'utf-8');

    const before = readProjectSnapshotVersion(testDir);

    await new Promise((resolve) => setTimeout(resolve, 5));
    writeFileSync(
      usagePath,
      JSON.stringify({
        timestamp: '2026-04-12T01:00:00.000Z',
        model: 'deepseek/deepseek-chat',
        scope: 'scope-1',
        promptTokens: 10,
        completionTokens: 5,
        totalTokens: 15,
        durationMs: 200,
      }) + '\n',
      'utf-8'
    );

    const after = readProjectSnapshotVersion(testDir);
    expect(after).not.toBe(before);
  });

  it('reads recent traces from session-scoped ndjson files', () => {
    const stateDir = join(testDir, '.ornn', 'state');
    writeFileSync(
      join(stateDir, 'session-a.ndjson'),
      JSON.stringify({
        trace_id: 'trace-a',
        runtime: 'codex',
        session_id: 'session-a',
        turn_id: 'turn-1',
        event_type: 'tool_call',
        timestamp: '2026-04-12T02:00:00.000Z',
        status: 'success',
        skill_refs: ['test-driven-development'],
      }) + '\n',
      'utf-8'
    );
    writeFileSync(
      join(stateDir, 'session-b.ndjson'),
      JSON.stringify({
        trace_id: 'trace-b',
        runtime: 'codex',
        session_id: 'session-b',
        turn_id: 'turn-2',
        event_type: 'assistant_output',
        timestamp: '2026-04-12T02:01:00.000Z',
        status: 'success',
        skill_refs: ['systematic-debugging'],
      }) + '\n',
      'utf-8'
    );

    const traces = readRecentTraces(testDir, 10);
    expect(traces.map((trace) => trace.trace_id)).toEqual(['trace-b', 'trace-a']);
    expect(traces.map((trace) => trace.session_id)).toEqual(['session-b', 'session-a']);
  });

  it('changes snapshot version when a session-scoped trace file changes', async () => {
    const tracePath = join(testDir, '.ornn', 'state', 'session-a.ndjson');
    writeFileSync(tracePath, '', 'utf-8');

    const before = readProjectSnapshotVersion(testDir);

    await new Promise((resolve) => setTimeout(resolve, 5));
    writeFileSync(
      tracePath,
      JSON.stringify({
        trace_id: 'trace-a',
        runtime: 'codex',
        session_id: 'session-a',
        turn_id: 'turn-1',
        event_type: 'tool_call',
        timestamp: '2026-04-12T02:02:00.000Z',
        status: 'success',
      }) + '\n',
      'utf-8'
    );

    const after = readProjectSnapshotVersion(testDir);
    expect(after).not.toBe(before);
  });

  it('changes snapshot version when the global daemon pid file changes', async () => {
    const oldHome = process.env.HOME;
    const fakeHome = join(testDir, 'global-home-snapshot-version');
    mkdirSync(join(fakeHome, '.ornn'), { recursive: true });
    process.env.HOME = fakeHome;

    try {
      const pidPath = join(fakeHome, '.ornn', 'daemon.pid');
      writeFileSync(pidPath, '', 'utf-8');

      const before = readProjectSnapshotVersion(testDir);

      await new Promise((resolve) => setTimeout(resolve, 5));
      writeFileSync(pidPath, String(process.pid), 'utf-8');

      const after = readProjectSnapshotVersion(testDir);
      expect(after).not.toBe(before);
    } finally {
      process.env.HOME = oldHome;
    }
  });

  it('changes snapshot version when the project registry monitoring state changes', async () => {
    const oldHome = process.env.HOME;
    const fakeHome = join(testDir, 'registry-home-snapshot-version');
    mkdirSync(join(fakeHome, '.ornn'), { recursive: true });
    process.env.HOME = fakeHome;

    try {
      const registryPath = join(fakeHome, '.ornn', 'projects.json');
      writeFileSync(
        registryPath,
        JSON.stringify({
          projects: [
            {
              path: testDir,
              name: 'test-project',
              registeredAt: '2026-04-17T08:00:00.000Z',
              lastSeenAt: '2026-04-17T08:00:00.000Z',
              monitoringState: 'active',
              pausedAt: null,
            },
          ],
        }),
        'utf-8'
      );

      const before = readProjectSnapshotVersion(testDir);

      await new Promise((resolve) => setTimeout(resolve, 5));
      writeFileSync(
        registryPath,
        JSON.stringify({
          projects: [
            {
              path: testDir,
              name: 'test-project',
              registeredAt: '2026-04-17T08:00:00.000Z',
              lastSeenAt: '2026-04-17T08:30:00.000Z',
              monitoringState: 'paused',
              pausedAt: '2026-04-17T08:30:00.000Z',
            },
          ],
        }),
        'utf-8'
      );

      const after = readProjectSnapshotVersion(testDir);
      expect(after).not.toBe(before);
    } finally {
      process.env.HOME = oldHome;
    }
  });

  it('changes snapshot version when skill version directories or latest targets change', async () => {
    const versionsDir = join(testDir, '.ornn', 'skills', 'codex', 'demo-skill', 'versions');
    mkdirSync(join(versionsDir, 'v1'), { recursive: true });
    writeFileSync(
      join(testDir, '.ornn', 'shadows', 'index.json'),
      JSON.stringify([
        {
          skillId: 'demo-skill',
          runtime: 'codex',
          version: '1',
          status: 'active',
          createdAt: '2026-04-18T09:00:00.000Z',
          updatedAt: '2026-04-18T09:00:00.000Z',
          traceCount: 0,
        },
      ]),
      'utf-8'
    );
    symlinkSync('v1', join(versionsDir, 'latest'));

    const before = readProjectSnapshotVersion(testDir);

    await new Promise((resolve) => setTimeout(resolve, 5));
    mkdirSync(join(versionsDir, 'v2'), { recursive: true });
    rmSync(join(versionsDir, 'latest'), { force: true });
    symlinkSync('v2', join(versionsDir, 'latest'));

    const after = readProjectSnapshotVersion(testDir);
    expect(after).not.toBe(before);
  });

  it('does not change snapshot version when only skill version file contents change', async () => {
    const versionsDir = join(testDir, '.ornn', 'skills', 'codex', 'demo-skill', 'versions');
    mkdirSync(join(versionsDir, 'v1'), { recursive: true });
    writeFileSync(join(versionsDir, 'v1', 'skill.md'), '# demo v1\n', 'utf-8');
    writeFileSync(
      join(versionsDir, 'v1', 'metadata.json'),
      JSON.stringify({
        version: 1,
        createdAt: '2026-04-18T09:00:00.000Z',
        reason: 'seed',
        traceIds: [],
        previousVersion: null,
        isDisabled: false,
      }),
      'utf-8'
    );
    symlinkSync('v1', join(versionsDir, 'latest'));
    writeFileSync(
      join(testDir, '.ornn', 'shadows', 'index.json'),
      JSON.stringify([
        {
          skillId: 'demo-skill',
          runtime: 'codex',
          version: '1',
          status: 'active',
          createdAt: '2026-04-18T09:00:00.000Z',
          updatedAt: '2026-04-18T09:00:00.000Z',
          traceCount: 0,
        },
      ]),
      'utf-8'
    );

    const before = readProjectSnapshotVersion(testDir);

    await new Promise((resolve) => setTimeout(resolve, 5));
    writeFileSync(join(versionsDir, 'v1', 'skill.md'), '# demo v1 updated\n', 'utf-8');
    writeFileSync(
      join(versionsDir, 'v1', 'metadata.json'),
      JSON.stringify({
        version: 1,
        createdAt: '2026-04-18T09:00:00.000Z',
        reason: 'seed-updated',
        traceIds: [],
        previousVersion: null,
        isDisabled: false,
      }),
      'utf-8'
    );

    const after = readProjectSnapshotVersion(testDir);
    expect(after).toBe(before);
  });

  it('marks daemon status as paused when the project registry pauses monitoring', () => {
    const oldHome = process.env.HOME;
    const fakeHome = join(testDir, 'registry-home-daemon-status');
    mkdirSync(join(fakeHome, '.ornn'), { recursive: true });
    process.env.HOME = fakeHome;

    try {
      writeFileSync(join(fakeHome, '.ornn', 'daemon.pid'), String(process.pid), 'utf-8');
      writeFileSync(
        join(testDir, '.ornn', 'state', 'daemon-checkpoint.json'),
        JSON.stringify({
          isRunning: true,
          startedAt: '2026-04-17T08:00:00.000Z',
          processedTraces: 12,
          lastCheckpointAt: '2026-04-17T08:20:00.000Z',
          retryQueueSize: 2,
          optimizationStatus: {
            currentState: 'analyzing',
            currentSkillId: 'demo-skill',
            lastOptimizationAt: null,
            lastError: 'stale error',
            queueSize: 1,
          },
        }),
        'utf-8'
      );
      writeFileSync(
        join(fakeHome, '.ornn', 'projects.json'),
        JSON.stringify({
          projects: [
            {
              path: testDir,
              name: 'test-project',
              registeredAt: '2026-04-17T08:00:00.000Z',
              lastSeenAt: '2026-04-17T08:30:00.000Z',
              monitoringState: 'paused',
              pausedAt: '2026-04-17T08:30:00.000Z',
            },
          ],
        }),
        'utf-8'
      );

      const daemon = readDaemonStatus(testDir);
      expect(daemon.isRunning).toBe(false);
      expect(daemon.isPaused).toBe(true);
      expect(daemon.monitoringState).toBe('paused');
      expect(daemon.pausedAt).toBe('2026-04-17T08:30:00.000Z');
      expect(daemon.optimizationStatus).toEqual({
        currentState: 'idle',
        currentSkillId: null,
        lastOptimizationAt: null,
        lastError: null,
        queueSize: 0,
      });
    } finally {
      process.env.HOME = oldHome;
    }
  });

  it('keeps recent skill-referenced traces in snapshot even after many newer untagged traces', () => {
    const tracePath = join(testDir, '.ornn', 'state', 'session-a.ndjson');
    const lines: string[] = [
      JSON.stringify({
        trace_id: 'skill-trace-1',
        runtime: 'codex',
        session_id: 'session-a',
        turn_id: 'turn-1',
        event_type: 'tool_call',
        timestamp: '2026-04-12T02:00:00.000Z',
        status: 'success',
        skill_refs: ['test-driven-development'],
      }),
    ];

    for (let index = 0; index < 260; index += 1) {
      lines.push(JSON.stringify({
        trace_id: `trace-${index}`,
        runtime: 'codex',
        session_id: 'session-a',
        turn_id: `turn-${index + 2}`,
        event_type: 'tool_result',
        timestamp: `2026-04-12T02:${String(Math.floor(index / 60)).padStart(2, '0')}:${String(index % 60).padStart(2, '0')}.000Z`,
        status: 'success',
        skill_refs: [],
      }));
    }

    writeFileSync(tracePath, lines.join('\n') + '\n', 'utf-8');

    const snapshot = readProjectSnapshot(testDir);
    expect(snapshot.recentTraces.some((trace) => trace.trace_id === 'skill-trace-1')).toBe(true);
    expect(snapshot.recentTraces.some((trace) => Array.isArray(trace.skill_refs) && trace.skill_refs.includes('test-driven-development'))).toBe(true);
    expect(snapshot.recentTraces[0]?.trace_id).toBe('trace-259');
  });

  it('caps snapshot decision events to keep sse payloads bounded', () => {
    const decisionEventsPath = join(testDir, '.ornn', 'state', 'decision-events.ndjson');
    const rows: string[] = [];
    for (let index = 0; index < 220; index += 1) {
      rows.push(JSON.stringify({
        id: `evt-${index}`,
        timestamp: `2026-04-12T03:${String(Math.floor(index / 60)).padStart(2, '0')}:${String(index % 60).padStart(2, '0')}.000Z`,
        tag: 'evaluation_result',
        detail: `detail-${index}`.repeat(20),
      }));
    }
    writeFileSync(decisionEventsPath, rows.join('\n') + '\n', 'utf-8');

    const snapshot = readProjectSnapshot(testDir);

    expect(snapshot.decisionEvents).toHaveLength(35);
    expect(snapshot.decisionEvents[0]?.id).toBe('evt-219');
  });

  it('keeps dashboard snapshots under the sse warning budget for dense projects', () => {
    const shadowIndexPath = join(testDir, '.ornn', 'shadows', 'index.json');
    const decisionEventsPath = join(testDir, '.ornn', 'state', 'decision-events.ndjson');
    const tracePath = join(testDir, '.ornn', 'state', 'session-a.ndjson');

    const skills = [];
    for (let index = 0; index < 120; index += 1) {
      skills.push({
        skillId: `skill-${index}`,
        runtime: 'codex',
        version: 'v'.repeat(32),
        status: 'active',
        createdAt: '2026-04-12T00:00:00.000Z',
        updatedAt: '2026-04-12T00:00:00.000Z',
        traceCount: index,
        skill_id: `skill-${index}`,
        created_at: '2026-04-12T00:00:00.000Z',
        last_optimized_at: '2026-04-12T00:00:00.000Z',
        current_revision: 1,
        analysisResult: {
          summary: `summary-${index}`,
          confidence: 0.8,
          suggestions: ['a', 'b', 'c'],
        },
      });
    }
    writeFileSync(shadowIndexPath, JSON.stringify(skills), 'utf-8');

    const events: string[] = [];
    for (let index = 0; index < 220; index += 1) {
      events.push(JSON.stringify({
        id: `evt-${index}`,
        timestamp: `2026-04-12T03:${String(Math.floor(index / 60)).padStart(2, '0')}:${String(index % 60).padStart(2, '0')}.000Z`,
        tag: 'evaluation_result',
        detail: `detail-${index}`.repeat(20),
        reason: `reason-${index}`.repeat(15),
        judgment: `judgment-${index}`.repeat(15),
        inputSummary: `input-${index}`.repeat(8),
        evidence: {
          windowId: `scope-${index % 20}`,
          rawEvidence: `raw-${index}`.repeat(12),
        },
        traceId: `trace-${index}`,
        sessionId: 'session-a',
        status: 'continue_collecting',
      }));
    }
    writeFileSync(decisionEventsPath, events.join('\n') + '\n', 'utf-8');

    const traces: string[] = [];
    for (let index = 0; index < 90; index += 1) {
      traces.push(JSON.stringify({
        trace_id: `trace-${index}`,
        runtime: 'codex',
        session_id: 'session-a',
        turn_id: `turn-${index}`,
        event_type: 'tool_call',
        timestamp: `2026-04-12T02:${String(Math.floor(index / 60)).padStart(2, '0')}:${String(index % 60).padStart(2, '0')}.000Z`,
        status: 'success',
        skill_refs: index < 10 ? ['skill-a'] : [],
      }));
    }
    writeFileSync(tracePath, traces.join('\n') + '\n', 'utf-8');

    const snapshot = readProjectSnapshot(testDir);
    const snapshotBytes = Buffer.byteLength(JSON.stringify(snapshot), 'utf-8');

    expect(snapshotBytes).toBeLessThan(96 * 1024);
  });

  it('reads latest dashboard logs from the rotated combined log file', async () => {
    const oldHome = process.env.HOME;
    const fakeHome = join(testDir, 'rotated-log-home-read');
    const logDir = join(fakeHome, '.ornn', 'logs');
    mkdirSync(logDir, { recursive: true });
    process.env.HOME = fakeHome;

    try {
      writeFileSync(
        join(logDir, 'combined.log'),
        '[2026-04-17 03:00:01] INFO  [daemon] old log line\n',
        'utf-8'
      );
      await new Promise((resolve) => setTimeout(resolve, 5));
      writeFileSync(
        join(logDir, 'combined1.log'),
        '[2026-04-17 05:09:07] INFO  [daemon] new rotated log line\n',
        'utf-8'
      );

      const logs = readGlobalLogs(10);

      expect(logs.at(-1)?.message).toContain('new rotated log line');
      expect(logs.some((line) => line.message.includes('old log line'))).toBe(true);
    } finally {
      process.env.HOME = oldHome;
    }
  });

  it('continues streaming dashboard logs after rotation to a new combined log file', async () => {
    const oldHome = process.env.HOME;
    const fakeHome = join(testDir, 'rotated-log-home-stream');
    const logDir = join(fakeHome, '.ornn', 'logs');
    mkdirSync(logDir, { recursive: true });
    process.env.HOME = fakeHome;

    try {
      const originalLogPath = join(logDir, 'combined.log');
      writeFileSync(
        originalLogPath,
        '[2026-04-17 03:00:01] INFO  [daemon] old log line '.repeat(40) + '\n',
        'utf-8'
      );
      const previousOffset = statSync(originalLogPath).size;

      await new Promise((resolve) => setTimeout(resolve, 5));
      writeFileSync(
        join(logDir, 'combined1.log'),
        '[2026-04-17 05:09:07] INFO  [daemon] new rotated log line\n',
        'utf-8'
      );

      const { lines, newOffset } = readLogsSince(previousOffset);

      expect(lines).toHaveLength(1);
      expect(lines[0]?.message).toContain('new rotated log line');
      expect(newOffset).toBeGreaterThan(0);
    } finally {
      process.env.HOME = oldHome;
    }
  });
});
