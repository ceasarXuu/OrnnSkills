/**
 * TraceRouter Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TraceRouter, type RouterOptions } from '../../src/core/router/router.js';
import type { Trace, TraceSkillMapping } from '../../src/types/index.js';

describe('TraceRouter', () => {
  let router: TraceRouter;
  let receivedMappings: Array<{ mapping: TraceSkillMapping; trace: Trace }> = [];
  let unknownTraces: Trace[] = [];

  const mockOptions: RouterOptions = {
    projectPath: '/test/project',
    onSkillTrace: (mapping: TraceSkillMapping, trace: Trace) => {
      receivedMappings.push({ mapping, trace });
    },
    onUnknownTrace: (trace: Trace) => {
      unknownTraces.push(trace);
    },
  };

  beforeEach(() => {
    receivedMappings = [];
    unknownTraces = [];
    router = new TraceRouter(mockOptions);
  });

  describe('route', () => {
    it('should route trace with skill_refs to appropriate handlers', () => {
      const trace: Trace = {
        trace_id: 'test-1',
        runtime: 'codex',
        session_id: 'session-1',
        turn_id: 'turn-1',
        event_type: 'user_input',
        timestamp: new Date().toISOString(),
        status: 'success',
        skill_refs: ['code-review', 'test-skill'],
      };

      const result = router.route(trace);

      expect(result.routed).toBe(true);
      expect(result.skillRefs).toHaveLength(2);
      expect(receivedMappings).toHaveLength(2);
      expect(receivedMappings[0].mapping.skill_id).toBe('code-review');
      expect(receivedMappings[1].mapping.skill_id).toBe('test-skill');
    });

    it('should handle trace without skill_refs as unknown', () => {
      const trace: Trace = {
        trace_id: 'test-1',
        runtime: 'codex',
        session_id: 'session-1',
        turn_id: 'turn-1',
        event_type: 'user_input',
        timestamp: new Date().toISOString(),
        status: 'success',
      };

      const result = router.route(trace);

      expect(result.routed).toBe(false);
      expect(result.skillRefs).toHaveLength(0);
      expect(unknownTraces).toHaveLength(1);
      expect(unknownTraces[0].trace_id).toBe('test-1');
    });

    it('should parse shadow skill references correctly', () => {
      const trace: Trace = {
        trace_id: 'test-1',
        runtime: 'codex',
        session_id: 'session-1',
        turn_id: 'turn-1',
        event_type: 'user_input',
        timestamp: new Date().toISOString(),
        status: 'success',
        skill_refs: ['code-review@shadow-1'],
      };

      router.route(trace);

      expect(receivedMappings[0].mapping.skill_id).toBe('code-review');
      expect(receivedMappings[0].mapping.shadow_id).toBe('shadow-1');
    });

    it('should calculate confidence based on context', () => {
      const trace: Trace = {
        trace_id: 'test-1',
        runtime: 'codex',
        session_id: 'session-1',
        turn_id: 'turn-1',
        event_type: 'user_input',
        timestamp: new Date().toISOString(),
        status: 'success',
        user_input: 'Use code-review to check this',
        skill_refs: ['code-review'],
      };

      router.route(trace);

      expect(receivedMappings[0].mapping.confidence).toBeGreaterThan(0.5);
    });
  });

  describe('routeBatch', () => {
    it('should route multiple traces', () => {
      const traces: Trace[] = [
        {
          trace_id: 'test-1',
          runtime: 'codex',
          session_id: 'session-1',
          turn_id: 'turn-1',
          event_type: 'user_input',
          timestamp: new Date().toISOString(),
          status: 'success',
          skill_refs: ['skill-1'],
        },
        {
          trace_id: 'test-2',
          runtime: 'codex',
          session_id: 'session-1',
          turn_id: 'turn-2',
          event_type: 'user_input',
          timestamp: new Date().toISOString(),
          status: 'success',
          skill_refs: ['skill-2'],
        },
      ];

      const results = router.routeBatch(traces);

      expect(results).toHaveLength(2);
      expect(receivedMappings).toHaveLength(2);
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', () => {
      // Route some traces
      router.route({
        trace_id: 'test-1',
        runtime: 'codex',
        session_id: 'session-1',
        turn_id: 'turn-1',
        event_type: 'user_input',
        timestamp: new Date().toISOString(),
        status: 'success',
        skill_refs: ['skill-1'],
      });

      router.route({
        trace_id: 'test-2',
        runtime: 'codex',
        session_id: 'session-1',
        turn_id: 'turn-2',
        event_type: 'user_input',
        timestamp: new Date().toISOString(),
        status: 'success',
      });

      const stats = router.getStats();

      expect(stats.totalRouted).toBe(1);
      expect(stats.totalUnknown).toBe(1);
      expect(stats.averageSkillsPerTrace).toBe(1);
      expect(stats.topSkills).toHaveLength(1);
      expect(stats.topSkills[0].skillId).toBe('skill-1');
    });
  });

  describe('filterBySkill', () => {
    it('should filter traces by skill ID', () => {
      const traces: Trace[] = [
        {
          trace_id: 'test-1',
          runtime: 'codex',
          session_id: 'session-1',
          turn_id: 'turn-1',
          event_type: 'user_input',
          timestamp: new Date().toISOString(),
          status: 'success',
          skill_refs: ['target-skill'],
        },
        {
          trace_id: 'test-2',
          runtime: 'codex',
          session_id: 'session-1',
          turn_id: 'turn-2',
          event_type: 'user_input',
          timestamp: new Date().toISOString(),
          status: 'success',
          skill_refs: ['other-skill'],
        },
      ];

      const filtered = router.filterBySkill(traces, 'target-skill');

      expect(filtered).toHaveLength(1);
      expect(filtered[0].trace_id).toBe('test-1');
    });
  });
});
