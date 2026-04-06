import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TraceSkillMapper, createTraceSkillMapper } from '../../src/core/trace-skill-mapper/index.js';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Trace, OriginSkill, ProjectSkillShadow } from '../../src/types/index.js';

const TEST_DIR = join(__dirname, '../.test-trace-skill-mapper');

describe('TraceSkillMapper', () => {
  let mapper: TraceSkillMapper;

  beforeEach(async () => {
    // 创建测试目录
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });

    mapper = createTraceSkillMapper(TEST_DIR);
    await mapper.init();
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
  });

  describe('mapTrace', () => {
    it('应该识别read_file中的skill文件', () => {
      const trace: Trace = {
        trace_id: 'test-1',
        runtime: 'codex',
        session_id: 'session-1',
        turn_id: 'turn-1',
        event_type: 'tool_call',
        tool_name: 'read_file',
        tool_args: { path: '/home/user/.skills/my-skill/current.md' },
        timestamp: new Date().toISOString(),
        status: 'success',
      };

      // 注册已知skill
      const origin: OriginSkill = {
        skill_id: 'my-skill',
        origin_path: '/home/user/.skills/my-skill',
        origin_version: 'abc123',
        source: 'local',
        installed_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
      };
      mapper.registerSkill(origin);

      const result = mapper.mapTrace(trace);

      expect(result.skill_id).toBe('my-skill');
      expect(result.confidence).toBeGreaterThan(0.9);
      expect(result.reason).toContain('read_file on skill file');
    });

    it('应该识别metadata中的skill_id', () => {
      const trace: Trace = {
        trace_id: 'test-2',
        runtime: 'codex',
        session_id: 'session-1',
        turn_id: 'turn-1',
        event_type: 'assistant_output',
        assistant_output: '执行某个操作',
        timestamp: new Date().toISOString(),
        status: 'success',
        metadata: { skill_id: 'registered-skill' },
      };

      const origin: OriginSkill = {
        skill_id: 'registered-skill',
        origin_path: '/path/to/skill',
        origin_version: 'xyz789',
        source: 'local',
        installed_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
      };
      mapper.registerSkill(origin);

      const result = mapper.mapTrace(trace);

      expect(result.skill_id).toBe('registered-skill');
      expect(result.confidence).toBeGreaterThan(0.95);
    });

    it('应该识别file_change中的skill文件', () => {
      const trace: Trace = {
        trace_id: 'test-3',
        runtime: 'codex',
        session_id: 'session-1',
        turn_id: 'turn-1',
        event_type: 'file_change',
        files_changed: ['/home/user/.ornn/skills/another-skill/current.md'],
        timestamp: new Date().toISOString(),
        status: 'success',
      };

      const origin: OriginSkill = {
        skill_id: 'another-skill',
        origin_path: '/path/to/another-skill',
        origin_version: 'def456',
        source: 'local',
        installed_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
      };
      mapper.registerSkill(origin);

      const result = mapper.mapTrace(trace);

      expect(result.skill_id).toBe('another-skill');
      expect(result.confidence).toBeGreaterThan(0.85);
    });

    it('应该对无法映射的trace返回null', () => {
      const trace: Trace = {
        trace_id: 'test-4',
        runtime: 'codex',
        session_id: 'session-1',
        turn_id: 'turn-1',
        event_type: 'tool_call',
        tool_name: 'execute_command',
        tool_args: { command: 'ls -la' },
        timestamp: new Date().toISOString(),
        status: 'success',
      };

      const result = mapper.mapTrace(trace);

      expect(result.skill_id).toBeNull();
      expect(result.confidence).toBe(0);
    });

    it('应该识别exec_command中的skill名称', () => {
      const trace: Trace = {
        trace_id: 'test-5',
        runtime: 'codex',
        session_id: 'session-1',
        turn_id: 'turn-1',
        event_type: 'tool_call',
        tool_name: 'exec_command',
        tool_args: { cmd: 'cat /Users/xuzhang/.agents/skills/show-my-repo/SKILL.md' },
        timestamp: new Date().toISOString(),
        status: 'success',
      };

      const origin: OriginSkill = {
        skill_id: 'show-my-repo',
        origin_path: '/Users/xuzhang/.agents/skills/show-my-repo/SKILL.md',
        origin_version: 'hash-show-my-repo',
        source: 'local',
        installed_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
      };
      mapper.registerSkill(origin);

      const result = mapper.mapTrace(trace);
      expect(result.skill_id).toBe('show-my-repo');
      expect(result.confidence).toBeGreaterThanOrEqual(0.85);
    });
  });

  describe('mapAndGroupTraces', () => {
    it('应该将traces按skill分组', () => {
      const traces: Trace[] = [
        {
          trace_id: 'trace-1',
          runtime: 'codex',
          session_id: 'session-1',
          turn_id: 'turn-1',
          event_type: 'tool_call',
          tool_name: 'read_file',
          tool_args: { path: '/home/user/.skills/skill-a/current.md' },
          timestamp: new Date().toISOString(),
          status: 'success',
        },
        {
          trace_id: 'trace-2',
          runtime: 'codex',
          session_id: 'session-1',
          turn_id: 'turn-2',
          event_type: 'tool_call',
          tool_name: 'read_file',
          tool_args: { path: '/home/user/.skills/skill-a/current.md' },
          timestamp: new Date().toISOString(),
          status: 'success',
        },
        {
          trace_id: 'trace-3',
          runtime: 'codex',
          session_id: 'session-1',
          turn_id: 'turn-3',
          event_type: 'tool_call',
          tool_name: 'read_file',
          tool_args: { path: '/home/user/.skills/skill-b/current.md' },
          timestamp: new Date().toISOString(),
          status: 'success',
        },
      ];

      // 注册skills
      const skillA: OriginSkill = {
        skill_id: 'skill-a',
        origin_path: '/home/user/.skills/skill-a',
        origin_version: 'hash-a',
        source: 'local',
        installed_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
      };
      const skillB: OriginSkill = {
        skill_id: 'skill-b',
        origin_path: '/home/user/.skills/skill-b',
        origin_version: 'hash-b',
        source: 'local',
        installed_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
      };

      // 注册shadow skills
      const shadowA: ProjectSkillShadow = {
        project_id: TEST_DIR,
        skill_id: 'skill-a',
        shadow_id: 'skill-a@test',
        origin_skill_id: 'skill-a',
        origin_version_at_fork: 'hash-a',
        shadow_path: '/path/to/shadow-a',
        current_revision: 0,
        status: 'active',
        created_at: new Date().toISOString(),
        last_optimized_at: '',
      };
      const shadowB: ProjectSkillShadow = {
        project_id: TEST_DIR,
        skill_id: 'skill-b',
        shadow_id: 'skill-b@test',
        origin_skill_id: 'skill-b',
        origin_version_at_fork: 'hash-b',
        shadow_path: '/path/to/shadow-b',
        current_revision: 0,
        status: 'active',
        created_at: new Date().toISOString(),
        last_optimized_at: '',
      };

      mapper.registerSkill(skillA, shadowA);
      mapper.registerSkill(skillB, shadowB);

      const groups = mapper.mapAndGroupTraces(traces);

      expect(groups.length).toBe(2);
      expect(groups.find(g => g.skill_id === 'skill-a')?.traces.length).toBe(2);
      expect(groups.find(g => g.skill_id === 'skill-b')?.traces.length).toBe(1);
    });
  });

  describe('extractSkillIdFromPath', () => {
    it('应该从各种路径格式中提取skill_id', () => {
      // 注册所有测试用的skills
      const skills = ['my-skill', 'claude-skill', 'shadow-skill'];
      for (const skillId of skills) {
        const origin: OriginSkill = {
          skill_id: skillId,
          origin_path: `/path/to/${skillId}`,
          origin_version: 'hash',
          source: 'local',
          installed_at: new Date().toISOString(),
          last_seen_at: new Date().toISOString(),
        };
        mapper.registerSkill(origin);
      }

      const testCases = [
        { path: '/home/user/.skills/my-skill/current.md', expected: 'my-skill' },
        { path: '~/.claude/skills/claude-skill/skill.md', expected: 'claude-skill' },
        { path: '/project/.ornn/skills/shadow-skill/current.md', expected: 'shadow-skill' },
        { path: '/some/random/path.txt', expected: null },
      ];

      for (const { path, expected } of testCases) {
        const trace: Trace = {
          trace_id: 'test',
          runtime: 'codex',
          session_id: 'session',
          turn_id: 'turn',
          event_type: 'tool_call',
          tool_name: 'read_file',
          tool_args: { path },
          timestamp: new Date().toISOString(),
          status: 'success',
        };

        const result = mapper.mapTrace(trace);
        expect(result.skill_id).toBe(expected);
      }
    });
  });
});
