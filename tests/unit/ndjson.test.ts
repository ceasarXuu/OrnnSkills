import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  mkdirSync,
  rmSync,
  existsSync,
  readFileSync,
  appendFileSync,
  closeSync,
  openSync,
  utimesSync,
} from 'node:fs';
import {
  NDJSONReader,
  NDJSONWriter,
  TraceStore,
  JournalStore,
  createTraceStore,
  createJournalStore,
} from '../../src/storage/ndjson.js';
import type { Trace, EvolutionRecord } from '../../src/types/index.js';

describe('NDJSONWriter', () => {
  const testDir = join(tmpdir(), 'ornn-ndjson-writer-test-' + Date.now());
  beforeEach(() => { mkdirSync(testDir, { recursive: true }); });
  afterEach(() => { if (existsSync(testDir)) rmSync(testDir, { recursive: true, force: true }); });

  it('should append records', async () => {
    const filePath = join(testDir, 'test.ndjson');
    const writer = new NDJSONWriter<{ id: string }>(filePath);
    await writer.append({ id: '1' });
    await writer.append({ id: '2' });
    expect(existsSync(filePath)).toBe(true);
    const content = readFileSync(filePath, 'utf-8');
    expect(content).toContain('"id":"1"');
    expect(content).toContain('"id":"2"');
  });

  it('should append batch records', async () => {
    const filePath = join(testDir, 'test.ndjson');
    const writer = new NDJSONWriter<{ id: string }>(filePath);
    writer.appendBatch([{ id: '1' }, { id: '2' }]);
    const content = readFileSync(filePath, 'utf-8');
    expect(content).toContain('"id":"1"');
    expect(content).toContain('"id":"2"');
  });

  it('should clear all records', async () => {
    const filePath = join(testDir, 'test.ndjson');
    const writer = new NDJSONWriter<{ id: string }>(filePath);
    await writer.append({ id: '1' });
    await writer.append({ id: '2' });
    writer.clear();
    await new Promise((r) => setTimeout(r, 50));
    await writer.append({ id: '3' });
    const content = readFileSync(filePath, 'utf-8').trim();
    expect(content).toBe('{"id":"3"}');
  });

  it('should return file path', () => {
    const filePath = join(testDir, 'test.ndjson');
    const writer = new NDJSONWriter<{ id: string }>(filePath);
    expect(writer.getPath()).toBe(filePath);
  });

  it('should recover from stale lock file', async () => {
    const filePath = join(testDir, 'test.ndjson');
    const lockPath = `${filePath}.lock`;

    // 模拟崩溃残留的旧锁文件
    const fd = openSync(lockPath, 'w');
    closeSync(fd);
    const staleAt = new Date(Date.now() - 31_000);
    utimesSync(lockPath, staleAt, staleAt);

    const writer = new NDJSONWriter<{ id: string }>(filePath);
    expect(() => writer.append({ id: '1' })).not.toThrow();

    const content = readFileSync(filePath, 'utf-8');
    expect(content).toContain('"id":"1"');
  });
});

describe('NDJSONReader', () => {
  const testDir = join(tmpdir(), 'ornn-ndjson-reader-test-' + Date.now());
  beforeEach(() => { mkdirSync(testDir, { recursive: true }); });
  afterEach(() => { if (existsSync(testDir)) rmSync(testDir, { recursive: true, force: true }); });

  it('should read empty file', async () => {
    const filePath = join(testDir, 'test.ndjson');
    const reader = new NDJSONReader(filePath);
    const records = await reader.readAll();
    expect(records).toEqual([]);
  });

  it('should read written records', async () => {
    const filePath = join(testDir, 'test.ndjson');
    const writer = new NDJSONWriter<{ id: string; value: number }>(filePath);
    await writer.append({ id: '1', value: 100 });
    await writer.append({ id: '2', value: 200 });
    const reader = new NDJSONReader<{ id: string; value: number }>(filePath);
    const records = await reader.readAll();
    expect(records.length).toBe(2);
    expect(records[0].id).toBe('1');
    expect(records[1].value).toBe(200);
  });

  it('should filter records', async () => {
    const filePath = join(testDir, 'test.ndjson');
    const writer = new NDJSONWriter<{ type: string }>(filePath);
    await writer.append({ type: 'a' });
    await writer.append({ type: 'b' });
    await writer.append({ type: 'a' });
    const reader = new NDJSONReader<{ type: string }>(filePath);
    const records = await reader.readAll();
    const filtered = records.filter((r) => r.type === 'a');
    expect(filtered.length).toBe(2);
  });

  it('should read last N records', async () => {
    const filePath = join(testDir, 'test.ndjson');
    const writer = new NDJSONWriter<{ id: string }>(filePath);
    for (let i = 0; i < 5; i++) await writer.append({ id: String(i) });
    const reader = new NDJSONReader<{ id: string }>(filePath);
    const last = await reader.readLast(2);
    expect(last.length).toBe(2);
    expect(last[0].id).toBe('3');
    expect(last[1].id).toBe('4');
  });

  it('should count records', async () => {
    const filePath = join(testDir, 'test.ndjson');
    const writer = new NDJSONWriter<{ id: string }>(filePath);
    await writer.append({ id: '1' });
    await writer.append({ id: '2' });
    await writer.append({ id: '3' });
    const reader = new NDJSONReader<{ id: string }>(filePath);
    const count = await reader.count();
    expect(count).toBe(3);
  });

  it('should return false for exists when file not present', () => {
    const filePath = join(testDir, 'nonexistent.ndjson');
    const reader = new NDJSONReader(filePath);
    expect(reader.exists()).toBe(false);
  });

  it('should skip malformed lines', async () => {
    const filePath = join(testDir, 'test.ndjson');
    const writer = new NDJSONWriter(filePath);
    await writer.append({ id: '1' });
    appendFileSync(filePath, 'not valid json\n', 'utf-8');
    await writer.append({ id: '2' });
    const reader = new NDJSONReader<{ id: string }>(filePath);
    const records = await reader.readAll();
    expect(records.length).toBe(2);
  });
});

const makeJournalRecord = (revision: number): EvolutionRecord => ({
  revision,
  shadow_id: 's-1',
  timestamp: new Date().toISOString(),
  reason: 'test',
  source_sessions: ['sess-1'],
  change_type: 'add_fallback',
  patch: '# patch',
  before_hash: 'abc',
  after_hash: 'def',
  applied_by: 'auto' as const,
});

describe('TraceStore', () => {
  const testDir = join(tmpdir(), 'ornn-tracestore-test-' + Date.now());
  beforeEach(() => { mkdirSync(testDir, { recursive: true }); });
  afterEach(() => { if (existsSync(testDir)) rmSync(testDir, { recursive: true, force: true }); });

  const makeTrace = (id: string, session: string): Trace => ({
    trace_id: id, session_id: session, turn_id: 't1',
    runtime: 'codex', event_type: 'user_input', status: 'success',
    timestamp: new Date().toISOString(),
  });

  it('should append and read traces', async () => {
    const store = createTraceStore(testDir, 'sess-1');
    store.append(makeTrace('t-1', 'sess-1'));
    store.append(makeTrace('t-2', 'sess-1'));
    const traces = await store.readAll();
    expect(traces.length).toBe(2);
    store.close();
  });

  it('should read traces by session', async () => {
    const store = createTraceStore(testDir, 'sess-1');
    store.append(makeTrace('t-1', 'sess-1'));
    store.append(makeTrace('t-2', 'sess-2'));
    const traces = await store.readBySession('sess-1');
    expect(traces.length).toBe(1);
    store.close();
  });

  it('should read recent traces', async () => {
    const store = createTraceStore(testDir, 'sess-1');
    for (let i = 0; i < 5; i++) store.append(makeTrace(`t-${i}`, 'sess-1'));
    const traces = await store.readRecent(2);
    expect(traces.length).toBe(2);
    store.close();
  });

  it('should close without errors', () => {
    const store = createTraceStore(testDir, 'sess-1');
    expect(() => store.close()).not.toThrow();
  });
});

describe('JournalStore', () => {
  const testDir = join(tmpdir(), 'ornn-journalstore-test-' + Date.now());
  beforeEach(() => { mkdirSync(testDir, { recursive: true }); });
  afterEach(() => { if (existsSync(testDir)) rmSync(testDir, { recursive: true, force: true }); });

  it('should append and read records', async () => {
    const store = createJournalStore(join(testDir, 'journal.ndjson'));
    store.append(makeJournalRecord(1));
    store.append(makeJournalRecord(2));
    const records = await store.readAll();
    expect(records.length).toBe(2);
  });

  it('should read records by revision range', async () => {
    const store = createJournalStore(join(testDir, 'journal.ndjson'));
    store.append(makeJournalRecord(1));
    store.append(makeJournalRecord(2));
    store.append(makeJournalRecord(3));
    const records = await store.readRange(1, 2);
    expect(records.length).toBe(2);
  });

  it('should read last N records', async () => {
    const store = createJournalStore(join(testDir, 'journal.ndjson'));
    for (let i = 1; i <= 5; i++) store.append(makeJournalRecord(i));
    const records = await store.readLast(2);
    expect(records.length).toBe(2);
    expect(records[0].revision).toBe(4);
    expect(records[1].revision).toBe(5);
  });

  it('should get latest revision', async () => {
    const store = createJournalStore(join(testDir, 'journal.ndjson'));
    expect(await store.getLatestRevision()).toBe(0);
    store.append(makeJournalRecord(3));
    expect(await store.getLatestRevision()).toBe(3);
  });

  it('should get record by revision', async () => {
    const store = createJournalStore(join(testDir, 'journal.ndjson'));
    store.append(makeJournalRecord(1));
    store.append(makeJournalRecord(2));
    const record = await store.getByRevision(1);
    expect(record).not.toBeNull();
    expect(record?.revision).toBe(1);
  });

  it('should return null for non-existent revision', async () => {
    const store = createJournalStore(join(testDir, 'journal.ndjson'));
    const record = await store.getByRevision(99);
    expect(record).toBeNull();
  });
});
