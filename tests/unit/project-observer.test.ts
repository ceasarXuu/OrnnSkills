/**
 * ProjectObserver Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ProjectObserver, type ProjectObserverOptions } from '../../src/core/observer/project-observer.js';
import type { Trace } from '../../src/types/index.js';

describe('ProjectObserver', () => {
  let observer: ProjectObserver;
  let receivedTraces: Trace[] = [];

  const mockOptions: ProjectObserverOptions = {
    projectPath: '/test/project',
    onTrace: (trace: Trace) => {
      receivedTraces.push(trace);
    },
  };

  beforeEach(() => {
    receivedTraces = [];
    observer = new ProjectObserver(mockOptions);
  });

  afterEach(async () => {
    await observer.stop();
  });

  describe('extractSkillRefs', () => {
    it('should extract bracket format [$skill-name]', () => {
      const text = 'Use [$code-review] to check this';
      const refs = observer.extractSkillRefs(text);
      expect(refs).toContain('code-review');
    });

    it('should extract at format @skill-name', () => {
      const text = 'Ask @code-review to review this';
      const refs = observer.extractSkillRefs(text);
      expect(refs).toContain('code-review');
    });

    it('should filter out code keywords like @dataclass', () => {
      const text = '@dataclass @code-review';
      const refs = observer.extractSkillRefs(text);
      expect(refs).toContain('code-review');
      expect(refs).not.toContain('dataclass');
    });

    it('should return unique refs only', () => {
      const text = '[$code-review] [$code-review] @code-review';
      const refs = observer.extractSkillRefs(text);
      expect(refs).toHaveLength(1);
      expect(refs[0]).toBe('code-review');
    });

    it('should handle object input by converting to string', () => {
      const obj = { skill: '[$test-skill]' };
      const refs = observer.extractSkillRefs(obj);
      expect(refs).toContain('test-skill');
    });
  });

  describe('isCurrentProject', () => {
    it('should return true for matching project path', () => {
      const trace = {
        trace_id: 'test-1',
        runtime: 'codex' as const,
        session_id: 'session-1',
        turn_id: 'turn-1',
        event_type: 'user_input' as const,
        timestamp: new Date().toISOString(),
        status: 'success' as const,
        metadata: {
          projectPath: '/test/project',
        },
      };
      expect(observer.isCurrentProject(trace)).toBe(true);
    });

    it('should return false for non-matching project path', () => {
      const trace = {
        trace_id: 'test-1',
        runtime: 'codex' as const,
        session_id: 'session-1',
        turn_id: 'turn-1',
        event_type: 'user_input' as const,
        timestamp: new Date().toISOString(),
        status: 'success' as const,
        metadata: {
          projectPath: '/other/project',
        },
      };
      expect(observer.isCurrentProject(trace)).toBe(false);
    });

    it('should return true for Claude runtime without project path', () => {
      const trace = {
        trace_id: 'test-1',
        runtime: 'claude' as const,
        session_id: 'session-1',
        turn_id: 'turn-1',
        event_type: 'user_input' as const,
        timestamp: new Date().toISOString(),
        status: 'success' as const,
      };
      expect(observer.isCurrentProject(trace)).toBe(true);
    });

    it('should return false for non-Claude runtime without project path', () => {
      const trace = {
        trace_id: 'test-1',
        runtime: 'codex' as const,
        session_id: 'session-1',
        turn_id: 'turn-1',
        event_type: 'user_input' as const,
        timestamp: new Date().toISOString(),
        status: 'success' as const,
      };
      expect(observer.isCurrentProject(trace)).toBe(false);
    });
  });
});
