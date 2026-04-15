import { beforeEach, describe, expect, it, afterEach } from 'vitest';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readProjectSnapshot, readProjectSnapshotVersion, readRecentTraces } from '../../src/dashboard/data-reader.js';

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

    expect(snapshot.decisionEvents).toHaveLength(150);
    expect(snapshot.decisionEvents[0]?.id).toBe('evt-219');
  });
});
