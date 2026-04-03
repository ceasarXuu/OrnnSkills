import { describe, it, expect, vi } from 'vitest';
import {
  SkillEvolutionManager,
  createSkillEvolutionManager,
} from '../../src/core/skill-evolution/manager.js';
import type { Trace } from '../../src/types/index.js';

describe('SkillEvolutionManager', () => {
  const makeTrace = (id: string): Trace => ({
    trace_id: id,
    session_id: 'sess-1',
    turn_id: 't1',
    runtime: 'codex',
    event_type: 'user_input',
    status: 'success',
    timestamp: new Date().toISOString(),
  });

  describe('trackSkill', () => {
    it('should track a skill', () => {
      const manager = createSkillEvolutionManager({ projectPath: '/test' });
      const thread = manager.trackSkill('my-skill', '/path', 'codex');
      expect(thread).toBeDefined();
      expect(manager.isTracking('my-skill')).toBe(true);
    });

    it('should return existing thread for already tracked skill', () => {
      const manager = createSkillEvolutionManager({ projectPath: '/test' });
      const thread1 = manager.trackSkill('my-skill', '/path', 'codex');
      const thread2 = manager.trackSkill('my-skill', '/path', 'codex');
      expect(thread1).toBe(thread2);
    });
  });

  describe('untrackSkill', () => {
    it('should untrack a skill', () => {
      const manager = createSkillEvolutionManager({ projectPath: '/test' });
      manager.trackSkill('my-skill', '/path', 'codex');
      expect(manager.untrackSkill('my-skill')).toBe(true);
      expect(manager.isTracking('my-skill')).toBe(false);
    });

    it('should return false for non-existent skill', () => {
      const manager = createSkillEvolutionManager({ projectPath: '/test' });
      expect(manager.untrackSkill('non-existent')).toBe(false);
    });
  });

  describe('routeTrace', () => {
    it('should route trace to tracked skill', () => {
      const manager = createSkillEvolutionManager({ projectPath: '/test' });
      manager.trackSkill('my-skill', '/path', 'codex');
      expect(manager.routeTrace('my-skill', makeTrace('t-1'))).toBe(true);
    });

    it('should return false for non-tracked skill', () => {
      const manager = createSkillEvolutionManager({ projectPath: '/test' });
      expect(manager.routeTrace('non-existent', makeTrace('t-1'))).toBe(false);
    });
  });

  describe('recordInvocation', () => {
    it('should record invocation for tracked skill', () => {
      const manager = createSkillEvolutionManager({ projectPath: '/test' });
      manager.trackSkill('my-skill', '/path', 'codex');
      expect(manager.recordInvocation('my-skill')).toBe(true);
    });

    it('should return false for non-tracked skill', () => {
      const manager = createSkillEvolutionManager({ projectPath: '/test' });
      expect(manager.recordInvocation('non-existent')).toBe(false);
    });
  });

  describe('getTrackedSkill', () => {
    it('should return tracked skill', () => {
      const manager = createSkillEvolutionManager({ projectPath: '/test' });
      manager.trackSkill('my-skill', '/path', 'codex');
      const tracked = manager.getTrackedSkill('my-skill');
      expect(tracked).toBeDefined();
      expect(tracked?.skillId).toBe('my-skill');
    });

    it('should return undefined for non-existent skill', () => {
      const manager = createSkillEvolutionManager({ projectPath: '/test' });
      expect(manager.getTrackedSkill('non-existent')).toBeUndefined();
    });
  });

  describe('getThread', () => {
    it('should return thread for tracked skill', () => {
      const manager = createSkillEvolutionManager({ projectPath: '/test' });
      manager.trackSkill('my-skill', '/path', 'codex');
      const thread = manager.getThread('my-skill');
      expect(thread).toBeDefined();
    });

    it('should return undefined for non-existent skill', () => {
      const manager = createSkillEvolutionManager({ projectPath: '/test' });
      expect(manager.getThread('non-existent')).toBeUndefined();
    });
  });

  describe('getAllTrackedSkills', () => {
    it('should return all tracked skills', () => {
      const manager = createSkillEvolutionManager({ projectPath: '/test' });
      manager.trackSkill('skill-1', '/path1', 'codex');
      manager.trackSkill('skill-2', '/path2', 'claude');
      const skills = manager.getAllTrackedSkills();
      expect(skills.length).toBe(2);
    });
  });

  describe('getSkillIds', () => {
    it('should return all skill IDs', () => {
      const manager = createSkillEvolutionManager({ projectPath: '/test' });
      manager.trackSkill('skill-1', '/path1', 'codex');
      manager.trackSkill('skill-2', '/path2', 'claude');
      const ids = manager.getSkillIds();
      expect(ids.sort()).toEqual(['skill-1', 'skill-2']);
    });
  });

  describe('getStats', () => {
    it('should return statistics', () => {
      const manager = createSkillEvolutionManager({ projectPath: '/test' });
      manager.trackSkill('skill-1', '/path1', 'codex');
      manager.trackSkill('skill-2', '/path2', 'claude');
      const stats = manager.getStats();
      expect(stats.totalSkills).toBe(2);
      expect(stats.skills.length).toBe(2);
    });
  });

  describe('markSubmitted', () => {
    it('should mark skill as submitted', () => {
      const manager = createSkillEvolutionManager({ projectPath: '/test' });
      manager.trackSkill('my-skill', '/path', 'codex');
      expect(manager.markSubmitted('my-skill')).toBe(true);
    });

    it('should return false for non-tracked skill', () => {
      const manager = createSkillEvolutionManager({ projectPath: '/test' });
      expect(manager.markSubmitted('non-existent')).toBe(false);
    });
  });

  describe('incrementVersion', () => {
    it('should increment version', () => {
      const manager = createSkillEvolutionManager({ projectPath: '/test' });
      manager.trackSkill('my-skill', '/path', 'codex');
      const version = manager.incrementVersion('my-skill');
      expect(version).toBe(1);
    });

    it('should return null for non-tracked skill', () => {
      const manager = createSkillEvolutionManager({ projectPath: '/test' });
      expect(manager.incrementVersion('non-existent')).toBeNull();
    });
  });

  describe('stopAll', () => {
    it('should stop all threads', () => {
      const manager = createSkillEvolutionManager({ projectPath: '/test' });
      manager.trackSkill('skill-1', '/path1', 'codex');
      manager.trackSkill('skill-2', '/path2', 'claude');
      manager.stopAll();
      expect(manager.getTrackedCount()).toBe(0);
    });
  });

  describe('getTrackedCount', () => {
    it('should return count', () => {
      const manager = createSkillEvolutionManager({ projectPath: '/test' });
      manager.trackSkill('skill-1', '/path1', 'codex');
      manager.trackSkill('skill-2', '/path2', 'claude');
      expect(manager.getTrackedCount()).toBe(2);
    });
  });

  describe('onSkillTrigger callback', () => {
    it('should accept onSkillTrigger callback', () => {
      const onSkillTrigger = vi.fn();
      const manager = createSkillEvolutionManager({
        projectPath: '/test',
        onSkillTrigger,
      });
      manager.trackSkill('my-skill', '/path', 'codex');
      expect(manager.isTracking('my-skill')).toBe(true);
    });
  });
});
