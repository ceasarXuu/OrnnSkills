import { beforeEach, afterEach, describe, it, expect } from 'vitest';
import {
  existsSync,
  mkdirSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
  appendFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { CodexObserver } from '../../src/core/observer/codex-observer.js';

describe('CodexObserver', () => {
  const testDir = join(tmpdir(), 'ornn-codex-observer-' + Date.now());

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should attach skill refs for exec_command reading a skill file', () => {
    const observer = new CodexObserver('/tmp/codex-sessions');

    const preprocessed = (observer as any).preprocessResponseItem('session-1', 'turn-1', {
      timestamp: '2026-04-08T10:00:00.000Z',
      type: 'response_item',
      payload: {
        type: 'function_call',
        name: 'functions.exec_command',
        arguments: JSON.stringify({
          cmd: 'cat /Users/xuzhang/.agents/skills/show-my-repo/SKILL.md',
        }),
      },
    });

    expect(preprocessed).toMatchObject({
      eventType: 'tool_call',
      skillRefs: ['show-my-repo'],
    });
  });

  it('should attach skill refs for assistant messages that mention backticked skill ids', () => {
    const observer = new CodexObserver('/tmp/codex-sessions');

    const preprocessed = (observer as any).preprocessResponseItem('session-1', 'turn-1', {
      timestamp: '2026-04-15T14:46:23.646Z',
      type: 'response_item',
      payload: {
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'output_text',
            text: '使用 `systematic-debugging` 先查运行链路，再按 `test-driven-development` 收敛修改。',
          },
        ],
      },
    });

    expect(preprocessed).toMatchObject({
      eventType: 'assistant_output',
      skillRefs: ['systematic-debugging', 'test-driven-development'],
    });
  });

  it('preserves session cwd as projectPath metadata on emitted traces', () => {
    const observer = new CodexObserver('/tmp/codex-sessions');

    (observer as any).sessionProjectPaths.set('session-1', '/projects/alpha');

    const trace = (observer as any).convertToStandardTrace({
      sessionId: 'session-1',
      turnId: 'turn-1',
      timestamp: '2026-04-16T00:00:00.000Z',
      eventType: 'assistant_output',
      content: 'hello',
      metadata: {
        source: 'vscode',
      },
    });

    expect(trace.metadata).toMatchObject({
      projectPath: '/projects/alpha',
      source: 'vscode',
    });
  });

  it('skips compacted maintenance events', () => {
    const observer = new CodexObserver('/tmp/codex-sessions');

    const preprocessed = (observer as any).preprocessEvent('session-1', {
      timestamp: '2026-04-08T10:00:00.000Z',
      type: 'compacted',
      payload: {
        message: 'compacted history blob',
      },
    });

    expect(preprocessed).toBeNull();
  });

  it('skips event_msg records that do not produce stable business traces', () => {
    const observer = new CodexObserver('/tmp/codex-sessions');

    const preprocessed = (observer as any).preprocessEvent('session-1', {
      timestamp: '2026-04-08T10:00:00.000Z',
      type: 'event_msg',
      payload: {
        type: 'user_message',
        text: 'duplicate transport envelope',
      },
    });

    expect(preprocessed).toBeNull();
  });

  it('bootstraps recently updated session files on startup', () => {
    const sessionsDir = join(testDir, 'sessions');
    mkdirSync(join(sessionsDir, '2026', '04', '12'), { recursive: true });
    const recentPath = join(sessionsDir, '2026', '04', '12', 'recent.jsonl');
    const olderPath = join(sessionsDir, '2026', '04', '12', 'older.jsonl');
    writeFileSync(
      recentPath,
      '{"timestamp":"2026-04-12T02:00:00.000Z","type":"response_item","payload":{"type":"message","role":"assistant","content":[{"type":"output_text","text":"recent"}]}}\n',
      'utf-8'
    );
    writeFileSync(
      olderPath,
      '{"timestamp":"2026-04-11T02:00:00.000Z","type":"response_item","payload":{"type":"message","role":"assistant","content":[{"type":"output_text","text":"older"}]}}\n',
      'utf-8'
    );
    utimesSync(
      olderPath,
      new Date('2026-04-11T02:00:00.000Z'),
      new Date('2026-04-11T02:00:00.000Z')
    );
    utimesSync(
      recentPath,
      new Date('2026-04-12T02:00:00.000Z'),
      new Date('2026-04-12T02:00:00.000Z')
    );

    const observer = new CodexObserver(sessionsDir);
    const processed: string[] = [];

    (observer as any).processSessionFileInternal = (filePath: string) => {
      processed.push(filePath);
    };

    (observer as any).bootstrapRecentSessionFiles(1);

    expect(processed).toEqual([recentPath]);
    expect((observer as any).processedFiles.has(recentPath)).toBe(true);
    expect((observer as any).processedFiles.has(olderPath)).toBe(false);
  });

  it('primes byte offsets for existing session files without replaying them', () => {
    const sessionsDir = join(testDir, 'sessions');
    mkdirSync(join(sessionsDir, '2026', '04', '12'), { recursive: true });
    const recentPath = join(sessionsDir, '2026', '04', '12', 'recent.jsonl');
    const olderPath = join(sessionsDir, '2026', '04', '12', 'older.jsonl');
    writeFileSync(
      recentPath,
      '{"timestamp":"2026-04-12T02:00:00.000Z","type":"response_item","payload":{"type":"message","role":"assistant","content":[{"type":"output_text","text":"recent"}]}}\n',
      'utf-8'
    );
    writeFileSync(
      olderPath,
      '{"timestamp":"2026-04-11T02:00:00.000Z","type":"response_item","payload":{"type":"message","role":"assistant","content":[{"type":"output_text","text":"older"}]}}\n',
      'utf-8'
    );

    const observer = new CodexObserver(sessionsDir);

    (observer as any).primeSessionOffsets();

    expect((observer as any).processedByteOffset.get(recentPath)).toBe(statSync(recentPath).size);
    expect((observer as any).processedByteOffset.get(olderPath)).toBe(statSync(olderPath).size);
  });

  it('tracks processed byte offsets after bootstrap tail replay', () => {
    const sessionsDir = join(testDir, 'sessions');
    mkdirSync(join(sessionsDir, '2026', '04', '12'), { recursive: true });
    const sessionPath = join(sessionsDir, '2026', '04', '12', 'recent.jsonl');
    writeFileSync(
      sessionPath,
      [
        '{"timestamp":"2026-04-12T01:00:00.000Z","type":"response_item","payload":{"type":"message","role":"assistant","content":[{"type":"output_text","text":"one"}]}}',
        '{"timestamp":"2026-04-12T02:00:00.000Z","type":"response_item","payload":{"type":"message","role":"assistant","content":[{"type":"output_text","text":"two"}]}}',
        '{"timestamp":"2026-04-12T03:00:00.000Z","type":"response_item","payload":{"type":"message","role":"assistant","content":[{"type":"output_text","text":"three"}]}}',
      ].join('\n') + '\n',
      'utf-8'
    );

    const observer = new CodexObserver(sessionsDir);
    const emittedTexts: string[] = [];

    (observer as any).emitPreprocessedTraces = (
      _sessionId: string,
      traces: Array<{ content?: string }>
    ) => {
      emittedTexts.push(...traces.map((trace) => String(trace.content ?? '')));
    };

    (observer as any).processSessionFileInternal(sessionPath, { bootstrapTailLines: 2 });

    expect(emittedTexts).toEqual(['two', 'three']);
    expect((observer as any).processedByteOffset.get(sessionPath)).toBe(statSync(sessionPath).size);
  });

  it('advances byte offsets and only emits appended traces on file change', () => {
    const sessionsDir = join(testDir, 'sessions');
    mkdirSync(join(sessionsDir, '2026', '04', '12'), { recursive: true });
    const sessionPath = join(sessionsDir, '2026', '04', '12', 'recent.jsonl');
    writeFileSync(
      sessionPath,
      '{"timestamp":"2026-04-12T01:00:00.000Z","type":"response_item","payload":{"type":"message","role":"assistant","content":[{"type":"output_text","text":"first"}]}}\n',
      'utf-8'
    );

    const observer = new CodexObserver(sessionsDir);
    const emittedTexts: string[] = [];

    (observer as any).emitPreprocessedTraces = (
      _sessionId: string,
      traces: Array<{ content?: string }>
    ) => {
      emittedTexts.push(...traces.map((trace) => String(trace.content ?? '')));
    };

    (observer as any).processSessionFileInternal(sessionPath);
    const initialOffset = (observer as any).processedByteOffset.get(sessionPath);

    appendFileSync(
      sessionPath,
      '{"timestamp":"2026-04-12T02:00:00.000Z","type":"response_item","payload":{"type":"message","role":"assistant","content":[{"type":"output_text","text":"second"}]}}\n',
      'utf-8'
    );

    (observer as any).handleFileChange(sessionPath);

    expect(emittedTexts).toEqual(['first', 'second']);
    expect((observer as any).processedByteOffset.get(sessionPath)).toBe(statSync(sessionPath).size);
    expect((observer as any).processedByteOffset.get(sessionPath)).toBeGreaterThan(initialOffset);
  });

  it('recovers appended traces when an already-known file is seen again as add', () => {
    const sessionsDir = join(testDir, 'sessions');
    mkdirSync(join(sessionsDir, '2026', '04', '12'), { recursive: true });
    const sessionPath = join(sessionsDir, '2026', '04', '12', 'recent.jsonl');
    writeFileSync(
      sessionPath,
      '{"timestamp":"2026-04-12T01:00:00.000Z","type":"response_item","payload":{"type":"message","role":"assistant","content":[{"type":"output_text","text":"first"}]}}\n',
      'utf-8'
    );

    const observer = new CodexObserver(sessionsDir);
    const emittedTexts: string[] = [];

    (observer as any).emitPreprocessedTraces = (
      _sessionId: string,
      traces: Array<{ content?: string }>
    ) => {
      emittedTexts.push(...traces.map((trace) => String(trace.content ?? '')));
    };

    (observer as any).processedFiles.add(sessionPath);
    (observer as any).processSessionFileInternal(sessionPath);

    appendFileSync(
      sessionPath,
      '{"timestamp":"2026-04-12T02:00:00.000Z","type":"response_item","payload":{"type":"message","role":"assistant","content":[{"type":"output_text","text":"second"}]}}\n',
      'utf-8'
    );

    (observer as any).handleFileAdd(sessionPath);

    expect(emittedTexts).toEqual(['first', 'second']);
    expect((observer as any).processedByteOffset.get(sessionPath)).toBe(statSync(sessionPath).size);
  });

  it('reconciles recent session growth even when watcher change is missed', () => {
    const sessionsDir = join(testDir, 'sessions');
    mkdirSync(join(sessionsDir, '2026', '04', '12'), { recursive: true });
    const sessionPath = join(sessionsDir, '2026', '04', '12', 'recent.jsonl');
    writeFileSync(
      sessionPath,
      '{"timestamp":"2026-04-12T01:00:00.000Z","type":"response_item","payload":{"type":"message","role":"assistant","content":[{"type":"output_text","text":"first"}]}}\n',
      'utf-8'
    );

    const observer = new CodexObserver(sessionsDir);
    const emittedTexts: string[] = [];

    (observer as any).emitPreprocessedTraces = (
      _sessionId: string,
      traces: Array<{ content?: string }>
    ) => {
      emittedTexts.push(...traces.map((trace) => String(trace.content ?? '')));
    };

    (observer as any).processedFiles.add(sessionPath);
    (observer as any).processSessionFileInternal(sessionPath);

    appendFileSync(
      sessionPath,
      '{"timestamp":"2026-04-12T02:00:00.000Z","type":"response_item","payload":{"type":"message","role":"assistant","content":[{"type":"output_text","text":"second"}]}}\n',
      'utf-8'
    );
    utimesSync(
      sessionPath,
      new Date('2026-04-12T02:00:00.000Z'),
      new Date('2026-04-12T02:00:00.000Z')
    );

    (observer as any).reconcileRecentSessionGrowth(1);

    expect(emittedTexts).toEqual(['first', 'second']);
    expect((observer as any).processedByteOffset.get(sessionPath)).toBe(statSync(sessionPath).size);
  });

  it('buffers partial appended lines so realtime change handling does not lose traces', () => {
    const sessionsDir = join(testDir, 'sessions');
    mkdirSync(join(sessionsDir, '2026', '04', '12'), { recursive: true });
    const sessionPath = join(sessionsDir, '2026', '04', '12', 'recent.jsonl');
    writeFileSync(
      sessionPath,
      '{"timestamp":"2026-04-12T01:00:00.000Z","type":"response_item","payload":{"type":"message","role":"assistant","content":[{"type":"output_text","text":"first"}]}}\n',
      'utf-8'
    );

    const observer = new CodexObserver(sessionsDir);
    const emittedTexts: string[] = [];

    (observer as any).emitPreprocessedTraces = (
      _sessionId: string,
      traces: Array<{ content?: string }>
    ) => {
      emittedTexts.push(...traces.map((trace) => String(trace.content ?? '')));
    };

    (observer as any).processSessionFileInternal(sessionPath);

    appendFileSync(
      sessionPath,
      '{"timestamp":"2026-04-12T02:00:00.000Z","type":"response_item","payload":{"type":"message","role":"assistant","content":[{"type":"output_text","text":"sec',
      'utf-8'
    );
    (observer as any).handleFileChange(sessionPath);

    appendFileSync(sessionPath, 'ond"}]}}\n', 'utf-8');
    (observer as any).handleFileChange(sessionPath);

    expect(emittedTexts).toEqual(['first', 'second']);
    expect((observer as any).processedByteOffset.get(sessionPath)).toBe(statSync(sessionPath).size);
  });
});
