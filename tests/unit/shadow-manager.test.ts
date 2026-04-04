import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { createShadowManager } from '../../src/core/shadow-manager/index.js';
import type { Trace } from '../../src/types/index.js';

describe('ShadowManager', () => {
  const testProjectPath = join(tmpdir(), 'ornn-sm-test-' + Date.now());

  beforeEach(() => {
    mkdirSync(testProjectPath, { recursive: true });
    mkdirSync(join(testProjectPath, '.ornn', 'skills'), { recursive: true });
    mkdirSync(join(testProjectPath, '.ornn', 'state'), { recursive: true });
    mkdirSync(join(testProjectPath, '.ornn', 'shadows'), { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testProjectPath)) rmSync(testProjectPath, { recursive: true, force: true });
  });

  const makeTrace = (id: string, session: string): Trace => ({
    trace_id: id,
    session_id: session,
    turn_id: 'turn-1',
    runtime: 'codex',
    event_type: 'user_input',
    status: 'success',
    timestamp: new Date().toISOString(),
  });

  describe('init', () => {
    it('should initialize without errors', async () => {
      const manager = createShadowManager(testProjectPath);
      await expect(manager.init()).resolves.not.toThrow();
    });
  });

  describe('processTrace', () => {
    it('should process trace without errors', async () => {
      const manager = createShadowManager(testProjectPath);
      await manager.init();
      await expect(manager.processTrace(makeTrace('t-1', 'sess-1'))).resolves.not.toThrow();
    });
  });

  describe('triggerOptimize', () => {
    it('should trigger optimization', async () => {
      const manager = createShadowManager(testProjectPath);
      await manager.init();
      const result = await manager.triggerOptimize('skill-1@' + testProjectPath);
      expect(result).toBeDefined();
    });
  });

  describe('getShadowState', () => {
    it('should return null for non-existent shadow', async () => {
      const manager = createShadowManager(testProjectPath);
      await manager.init();
      expect(manager.getShadowState('non-existent@' + testProjectPath)).toBeNull();
    });
  });

  describe('cleanupOldTraces', () => {
    it('should return 0', async () => {
      const manager = createShadowManager(testProjectPath);
      await manager.init();
      expect(manager.cleanupOldTraces(30)).toBe(0);
    });
  });

  describe('close', () => {
    it('should close without errors', async () => {
      const manager = createShadowManager(testProjectPath);
      await manager.init();
      await expect(manager.close()).resolves.toBeUndefined();
    });
  });
});
