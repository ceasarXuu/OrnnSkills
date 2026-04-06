import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { createTraceManager } from '../../src/core/observer/trace-manager.js';
import type { Trace } from '../../src/types/index.js';

describe('TraceManager', () => {
  const testProjectPath = join(tmpdir(), 'ornn-tm-test-' + Date.now());

  beforeEach(() => {
    mkdirSync(testProjectPath, { recursive: true });
    mkdirSync(join(testProjectPath, '.ornn', 'state'), { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testProjectPath)) rmSync(testProjectPath, { recursive: true, force: true });
  });

  const makeTrace = (id: string, session: string, eventType = 'user_input', status = 'success'): Trace => ({
    trace_id: id,
    session_id: session,
    turn_id: 'turn-1',
    runtime: 'codex',
    event_type: eventType as any,
    status: status as any,
    timestamp: new Date().toISOString(),
  });

  describe('init', () => {
    it('should initialize without errors', async () => {
      const manager = createTraceManager(testProjectPath);
      await expect(manager.init()).resolves.not.toThrow();
      manager.close();
    });
  });

  describe('setSession', () => {
    it('should set current session', async () => {
      const manager = createTraceManager(testProjectPath);
      await manager.init();
      manager.setSession('sess-1', 'codex');
      expect(manager.getCurrentSessionId()).toBe('sess-1');
      manager.close();
    });

    it('should set session with project id', async () => {
      const manager = createTraceManager(testProjectPath);
      await manager.init();
      manager.setSession('sess-1', 'codex', 'proj-1');
      expect(manager.getCurrentSessionId()).toBe('sess-1');
      manager.close();
    });
  });

  describe('recordTrace', () => {
    it('should record a trace', async () => {
      const manager = createTraceManager(testProjectPath);
      await manager.init();
      manager.setSession('sess-1', 'codex');
      expect(() => manager.recordTrace(makeTrace('t-1', 'sess-1'))).not.toThrow();
      manager.close();
    });

    it('should throw when not initialized', () => {
      const manager = createTraceManager(testProjectPath);
      expect(() => manager.recordTrace(makeTrace('t-1', 'sess-1'))).toThrow('TraceManager not initialized');
    });

    it('should auto-create session when recording first trace without setSession', async () => {
      const manager = createTraceManager(testProjectPath);
      await manager.init();
      expect(() => manager.recordTrace(makeTrace('t-1', 'sess-auto'))).not.toThrow();
      const traces = await manager.getSessionTraces('sess-auto');
      expect(traces.length).toBe(1);
      manager.close();
    });
  });

  describe('recordTraces', () => {
    it('should record multiple traces', async () => {
      const manager = createTraceManager(testProjectPath);
      await manager.init();
      manager.setSession('sess-1', 'codex');
      expect(() => manager.recordTraces([makeTrace('t-1', 'sess-1'), makeTrace('t-2', 'sess-1')])).not.toThrow();
      manager.close();
    });
  });

  describe('getSessionTraces', () => {
    it('should return traces for a session', async () => {
      const manager = createTraceManager(testProjectPath);
      await manager.init();
      manager.setSession('sess-1', 'codex');
      manager.recordTrace(makeTrace('t-1', 'sess-1'));
      manager.recordTrace(makeTrace('t-2', 'sess-1'));
      const traces = await manager.getSessionTraces('sess-1');
      expect(traces.length).toBe(2);
      manager.close();
    });

    it('should return empty for non-existent session', async () => {
      const manager = createTraceManager(testProjectPath);
      await manager.init();
      manager.setSession('sess-1', 'codex');
      manager.recordTrace(makeTrace('t-1', 'sess-1'));
      const traces = await manager.getSessionTraces('sess-other');
      expect(traces.length).toBe(0);
      manager.close();
    });
  });

  describe('getTracesByEventType', () => {
    it('should return traces by event type', async () => {
      const manager = createTraceManager(testProjectPath);
      await manager.init();
      manager.setSession('sess-1', 'codex');
      manager.recordTrace(makeTrace('t-1', 'sess-1', 'user_input'));
      manager.recordTrace(makeTrace('t-2', 'sess-1', 'assistant_output'));
      const traces = await manager.getTracesByEventType('sess-1', 'user_input');
      expect(traces.length).toBe(1);
      manager.close();
    });
  });

  describe('getTracesByTimeRange', () => {
    it('should return traces within time range', async () => {
      const manager = createTraceManager(testProjectPath);
      await manager.init();
      manager.setSession('sess-1', 'codex');
      manager.recordTrace(makeTrace('t-1', 'sess-1'));
      const traces = await manager.getTracesByTimeRange(
        'sess-1',
        new Date(Date.now() - 60000).toISOString(),
        new Date(Date.now() + 60000).toISOString()
      );
      expect(traces.length).toBe(1);
      manager.close();
    });
  });

  describe('getFailedTraces', () => {
    it('should return failed traces', async () => {
      const manager = createTraceManager(testProjectPath);
      await manager.init();
      manager.setSession('sess-1', 'codex');
      manager.recordTrace(makeTrace('t-1', 'sess-1', 'user_input', 'failure'));
      manager.recordTrace(makeTrace('t-2', 'sess-1', 'user_input', 'success'));
      const traces = await manager.getFailedTraces('sess-1');
      expect(traces.length).toBe(1);
      manager.close();
    });
  });

  describe('getRetryTraces', () => {
    it('should return retry traces', async () => {
      const manager = createTraceManager(testProjectPath);
      await manager.init();
      manager.setSession('sess-1', 'codex');
      manager.recordTrace(makeTrace('t-1', 'sess-1', 'retry'));
      manager.recordTrace(makeTrace('t-2', 'sess-1', 'user_input'));
      const traces = await manager.getRetryTraces('sess-1');
      expect(traces.length).toBe(1);
      manager.close();
    });
  });

  describe('getFileChangeTraces', () => {
    it('should return file change traces', async () => {
      const manager = createTraceManager(testProjectPath);
      await manager.init();
      manager.setSession('sess-1', 'codex');
      manager.recordTrace(makeTrace('t-1', 'sess-1', 'file_change'));
      manager.recordTrace(makeTrace('t-2', 'sess-1', 'user_input'));
      const traces = await manager.getFileChangeTraces('sess-1');
      expect(traces.length).toBe(1);
      manager.close();
    });
  });

  describe('getTraceStats', () => {
    it('should return trace statistics', async () => {
      const manager = createTraceManager(testProjectPath);
      await manager.init();
      manager.setSession('sess-1', 'codex');
      manager.recordTrace(makeTrace('t-1', 'sess-1', 'user_input', 'success'));
      manager.recordTrace(makeTrace('t-2', 'sess-1', 'assistant_output', 'success'));
      manager.recordTrace(makeTrace('t-3', 'sess-1', 'user_input', 'failure'));
      const stats = await manager.getTraceStats('sess-1');
      expect(stats.total).toBe(3);
      expect(stats.byEventType['user_input']).toBe(2);
      expect(stats.byStatus['success']).toBe(2);
      expect(stats.byStatus['failure']).toBe(1);
      manager.close();
    });
  });

  describe('endSession', () => {
    it('should end current session', async () => {
      const manager = createTraceManager(testProjectPath);
      await manager.init();
      manager.setSession('sess-1', 'codex');
      manager.endSession();
      expect(manager.getCurrentSessionId()).toBeNull();
      manager.close();
    });

    it('should do nothing when no session', async () => {
      const manager = createTraceManager(testProjectPath);
      await manager.init();
      expect(() => manager.endSession()).not.toThrow();
      manager.close();
    });
  });

  describe('close', () => {
    it('should close without errors', async () => {
      const manager = createTraceManager(testProjectPath);
      await manager.init();
      expect(() => manager.close()).not.toThrow();
    });

    it('should throw when not initialized', () => {
      const manager = createTraceManager(testProjectPath);
      expect(() => manager.close()).toThrow('TraceManager not initialized');
    });
  });

  describe('cleanupOldTraces', () => {
    it('should return 0', async () => {
      const manager = createTraceManager(testProjectPath);
      await manager.init();
      expect(manager.cleanupOldTraces(30)).toBe(0);
      manager.close();
    });
  });
});
