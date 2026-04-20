import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const readFileSyncSpy = vi.hoisted(() => vi.fn());

vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
  return {
    ...actual,
    readFileSync: vi.fn((...args: Parameters<typeof actual.readFileSync>) => {
      readFileSyncSpy(...args);
      return actual.readFileSync(...args);
    }),
  };
});

describe('dashboard trace reader cache', () => {
  const testDir = join(tmpdir(), `ornn-dashboard-trace-cache-${Date.now()}`);

  beforeEach(() => {
    mkdirSync(join(testDir, '.ornn', 'state'), { recursive: true });
    readFileSyncSpy.mockClear();
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('reuses cached processed trace ids when trace files are unchanged', async () => {
    const { countProcessedTraceIds } = await import('../../src/dashboard/readers/trace-reader.js');
    const tracePath = join(testDir, '.ornn', 'state', 'session-a.ndjson');
    writeFileSync(
      tracePath,
      [
        JSON.stringify({ trace_id: 'trace-1' }),
        JSON.stringify({ trace_id: 'trace-2' }),
      ].join('\n') + '\n',
      'utf-8'
    );

    expect(countProcessedTraceIds(testDir)).toBe(2);
    const afterFirstReadCount = readFileSyncSpy.mock.calls.length;

    expect(countProcessedTraceIds(testDir)).toBe(2);
    expect(readFileSyncSpy.mock.calls.length).toBe(afterFirstReadCount);
  });

  it('invalidates only changed trace files when recounting processed trace ids', async () => {
    const { countProcessedTraceIds } = await import('../../src/dashboard/readers/trace-reader.js');
    const stateDir = join(testDir, '.ornn', 'state');
    const tracePathA = join(stateDir, 'session-a.ndjson');
    const tracePathB = join(stateDir, 'session-b.ndjson');

    writeFileSync(tracePathA, JSON.stringify({ trace_id: 'trace-a-1' }) + '\n', 'utf-8');
    writeFileSync(tracePathB, JSON.stringify({ trace_id: 'trace-b-1' }) + '\n', 'utf-8');

    expect(countProcessedTraceIds(testDir)).toBe(2);
    const baselineReadCount = readFileSyncSpy.mock.calls.length;

    await new Promise((resolve) => setTimeout(resolve, 5));
    writeFileSync(
      tracePathB,
      [
        JSON.stringify({ trace_id: 'trace-b-1' }),
        JSON.stringify({ trace_id: 'trace-b-2' }),
      ].join('\n') + '\n',
      'utf-8'
    );

    expect(countProcessedTraceIds(testDir)).toBe(3);
    expect(readFileSyncSpy.mock.calls.length).toBe(baselineReadCount + 1);
  });

  it('keeps processed trace caches bounded across many project rotations', async () => {
    const {
      countProcessedTraceIds,
      getProcessedTraceCacheStats,
      resetProcessedTraceCaches,
    } = await import('../../src/dashboard/readers/trace-reader.js');

    resetProcessedTraceCaches();
    const baseline = getProcessedTraceCacheStats();
    const rootDir = join(testDir, 'trace-cache-rotation');
    mkdirSync(rootDir, { recursive: true });

    for (let index = 0; index < baseline.projectCache.maxEntries + 40; index += 1) {
      const projectRoot = join(rootDir, `project-${index}`);
      const stateDir = join(projectRoot, '.ornn', 'state');
      mkdirSync(stateDir, { recursive: true });
      writeFileSync(
        join(stateDir, 'session-a.ndjson'),
        JSON.stringify({ trace_id: `trace-${index}` }) + '\n',
        'utf-8'
      );

      expect(countProcessedTraceIds(projectRoot)).toBe(1);
    }

    const stats = getProcessedTraceCacheStats();
    expect(stats.projectCache.entries).toBeLessThanOrEqual(stats.projectCache.maxEntries);
    expect(stats.fileCache.entries).toBeLessThanOrEqual(stats.fileCache.maxEntries);
  });
});