/**
 * Skill Evolution Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SkillEvolutionThread, createSkillEvolutionThread } from '../../src/core/skill-evolution/thread.js';
import { SkillEvolutionManager, createSkillEvolutionManager } from '../../src/core/skill-evolution/manager.js';
import type { Trace } from '../../src/types/index.js';

describe('SkillEvolutionThread', () => {
  let thread: SkillEvolutionThread;
  let triggerCalled = false;

  beforeEach(() => {
    triggerCalled = false;
    thread = createSkillEvolutionThread({
      skillId: 'test-skill',
      originPath: '/test/skill.md',
      runtime: 'codex',
      turnsThreshold: 3,
      onTrigger: () => {
        triggerCalled = true;
      },
    });
  });

  describe('addTrace', () => {
    it('should add trace to queue', () => {
      thread.start();
      const trace: Trace = {
        trace_id: 'test-1',
        runtime: 'codex',
        session_id: 'session-1',
        turn_id: 'turn-1',
        event_type: 'user_input',
        timestamp: new Date().toISOString(),
        status: 'success',
      };

      thread.addTrace(trace);

      expect(thread.getQueueSize()).toBe(1);
    });

    it('should trigger when threshold reached', () => {
      thread.start();
      
      // Add 3 traces (threshold is 3)
      for (let i = 0; i < 3; i++) {
        thread.addTrace({
          trace_id: `test-${i}`,
          runtime: 'codex',
          session_id: 'session-1',
          turn_id: `turn-${i}`,
          event_type: 'user_input',
          timestamp: new Date().toISOString(),
          status: 'success',
        });
      }

      expect(triggerCalled).toBe(true);
    });

    it('should not trigger when thread not running', () => {
      // Don't start the thread
      thread.addTrace({
        trace_id: 'test-1',
        runtime: 'codex',
        session_id: 'session-1',
        turn_id: 'turn-1',
        event_type: 'user_input',
        timestamp: new Date().toISOString(),
        status: 'success',
      });

      expect(triggerCalled).toBe(false);
    });
  });

  describe('recordInvocation', () => {
    it('should trigger on re-invocation', () => {
      thread.start();
      
      // First invocation (should trigger because submittedCount is 0)
      thread.recordInvocation();
      expect(triggerCalled).toBe(true);
      
      // Reset and test proper re-invocation flow
      triggerCalled = false;
      thread.markSubmitted();
      
      // Second invocation (re-invoke)
      thread.recordInvocation();
      expect(triggerCalled).toBe(true);
    });
  });

  describe('getStats', () => {
    it('should return correct stats', () => {
      thread.start();
      thread.addTrace({
        trace_id: 'test-1',
        runtime: 'codex',
        session_id: 'session-1',
        turn_id: 'turn-1',
        event_type: 'user_input',
        timestamp: new Date().toISOString(),
        status: 'success',
      });

      const stats = thread.getStats();

      expect(stats.skillId).toBe('test-skill');
      expect(stats.queueSize).toBe(1);
      expect(stats.status).toBe('collecting');
    });
  });
});

describe('SkillEvolutionManager', () => {
  let manager: SkillEvolutionManager;

  beforeEach(() => {
    manager = createSkillEvolutionManager({
      projectPath: '/test/project',
    });
  });

  describe('trackSkill', () => {
    it('should create and track new skill', () => {
      const thread = manager.trackSkill('test-skill', '/test/skill.md', 'codex');

      expect(thread).toBeDefined();
      expect(manager.isTracking('test-skill')).toBe(true);
      expect(thread.isActive()).toBe(true);
    });

    it('should return existing thread for already tracked skill', () => {
      const thread1 = manager.trackSkill('test-skill', '/test/skill.md', 'codex');
      const thread2 = manager.trackSkill('test-skill', '/test/skill.md', 'codex');

      expect(thread1).toBe(thread2);
    });
  });

  describe('untrackSkill', () => {
    it('should stop tracking skill', () => {
      manager.trackSkill('test-skill', '/test/skill.md', 'codex');
      expect(manager.isTracking('test-skill')).toBe(true);

      manager.untrackSkill('test-skill');
      expect(manager.isTracking('test-skill')).toBe(false);
    });

    it('should return false for untracked skill', () => {
      const result = manager.untrackSkill('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('routeTrace', () => {
    it('should route trace to skill thread', () => {
      manager.trackSkill('test-skill', '/test/skill.md', 'codex');
      
      const trace: Trace = {
        trace_id: 'test-1',
        runtime: 'codex',
        session_id: 'session-1',
        turn_id: 'turn-1',
        event_type: 'user_input',
        timestamp: new Date().toISOString(),
        status: 'success',
      };

      const result = manager.routeTrace('test-skill', trace);
      expect(result).toBe(true);
    });

    it('should return false for untracked skill', () => {
      const trace: Trace = {
        trace_id: 'test-1',
        runtime: 'codex',
        session_id: 'session-1',
        turn_id: 'turn-1',
        event_type: 'user_input',
        timestamp: new Date().toISOString(),
        status: 'success',
      };

      const result = manager.routeTrace('non-existent', trace);
      expect(result).toBe(false);
    });
  });

  describe('getStats', () => {
    it('should return stats for all tracked skills', () => {
      manager.trackSkill('skill-1', '/test/skill1.md', 'codex');
      manager.trackSkill('skill-2', '/test/skill2.md', 'codex');

      const stats = manager.getStats();

      expect(stats.totalSkills).toBe(2);
      expect(stats.skills).toHaveLength(2);
    });
  });
});
