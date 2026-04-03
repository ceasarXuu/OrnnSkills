import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { SQLiteStorage } from '../../src/storage/sqlite.js';
import type { ProjectSkillShadow, OriginSkill, Session } from '../../src/types/index.js';

describe('SQLiteStorage', () => {
  const testDir = join(tmpdir(), 'ornn-sqlite-test-' + Date.now());

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
  });
  afterEach(() => {
    if (existsSync(testDir)) rmSync(testDir, { recursive: true, force: true });
  });

  const testDbPath = () => join(testDir, `test-${Date.now()}-${Math.random()}.db`);

  const makeShadow = (id: string, projectId: string, skillId: string): ProjectSkillShadow => ({
    shadow_id: id,
    project_id: projectId,
    skill_id: skillId,
    origin_skill_id: `origin-${skillId}`,
    origin_version_at_fork: '1.0',
    shadow_path: `/path/to/${skillId}`,
    current_revision: 0,
    status: 'active',
    created_at: new Date().toISOString(),
    last_optimized_at: new Date().toISOString(),
  });

  const makeSession = (id: string, runtime = 'codex'): Session => ({
    session_id: id,
    runtime: runtime as any,
    project_id: 'proj-1',
    started_at: new Date().toISOString(),
    ended_at: null,
    trace_count: 0,
  });

  describe('getInstance', () => {
    it('should create and get instance', async () => {
      const storage = await SQLiteStorage.getInstance(testDbPath());
      expect(storage).toBeDefined();
    });

    it('should return same instance for same path', async () => {
      const path = testDbPath();
      const s1 = await SQLiteStorage.getInstance(path);
      const s2 = await SQLiteStorage.getInstance(path);
      expect(s1).toBe(s2);
    });
  });

  describe('upsertShadowSkill + getShadowSkill', () => {
    it('should upsert and retrieve a shadow skill', async () => {
      const storage = await SQLiteStorage.getInstance(testDbPath());
      await storage.init();
      const shadow = makeShadow('s-1@proj-1', 'proj-1', 'skill-1');
      storage.upsertShadowSkill(shadow);
      const result = storage.getShadowSkill('proj-1', 'skill-1');
      expect(result).not.toBeNull();
      expect(result?.skill_id).toBe('skill-1');
      storage.close();
    });

    it('should return null for non-existent skill', async () => {
      const storage = await SQLiteStorage.getInstance(testDbPath());
      await storage.init();
      const result = storage.getShadowSkill('proj-1', 'non-existent');
      expect(result).toBeNull();
      storage.close();
    });

    it('should update existing shadow on duplicate', async () => {
      const storage = await SQLiteStorage.getInstance(testDbPath());
      await storage.init();
      const shadow = makeShadow('s-1@proj-1', 'proj-1', 'skill-1');
      storage.upsertShadowSkill(shadow);
      shadow.current_revision = 5;
      storage.upsertShadowSkill(shadow);
      const result = storage.getShadowSkill('proj-1', 'skill-1');
      expect(result?.current_revision).toBe(5);
      storage.close();
    });
  });

  describe('listShadowSkills', () => {
    it('should list all shadows for a project', async () => {
      const storage = await SQLiteStorage.getInstance(testDbPath());
      await storage.init();
      storage.upsertShadowSkill(makeShadow('s-1@proj-1', 'proj-1', 'skill-1'));
      storage.upsertShadowSkill(makeShadow('s-2@proj-1', 'proj-1', 'skill-2'));
      storage.upsertShadowSkill(makeShadow('s-3@proj-2', 'proj-2', 'skill-3'));
      expect(storage.listShadowSkills('proj-1').length).toBe(2);
      expect(storage.listShadowSkills('proj-2').length).toBe(1);
      storage.close();
    });

    it('should return empty array for non-existent project', async () => {
      const storage = await SQLiteStorage.getInstance(testDbPath());
      await storage.init();
      expect(storage.listShadowSkills('non-existent')).toEqual([]);
      storage.close();
    });
  });

  describe('updateShadowStatus', () => {
    it('should update shadow status', async () => {
      const storage = await SQLiteStorage.getInstance(testDbPath());
      await storage.init();
      storage.upsertShadowSkill(makeShadow('s-1@proj-1', 'proj-1', 'skill-1'));
      storage.updateShadowStatus('s-1@proj-1', 'frozen');
      expect(storage.getShadowSkill('proj-1', 'skill-1')?.status).toBe('frozen');
      storage.close();
    });
  });

  describe('updateShadowRevision', () => {
    it('should update shadow revision', async () => {
      const storage = await SQLiteStorage.getInstance(testDbPath());
      await storage.init();
      storage.upsertShadowSkill(makeShadow('s-1@proj-1', 'proj-1', 'skill-1'));
      storage.updateShadowRevision('s-1@proj-1', 10);
      expect(storage.getShadowSkill('proj-1', 'skill-1')?.current_revision).toBe(10);
      storage.close();
    });
  });

  describe('createSession + getSession', () => {
    it('should create and retrieve a session', async () => {
      const storage = await SQLiteStorage.getInstance(testDbPath());
      await storage.init();
      storage.createSession(makeSession('sess-1', 'codex'));
      const result = storage.getSession('sess-1');
      expect(result).not.toBeNull();
      expect(result?.session_id).toBe('sess-1');
      storage.close();
    });

    it('should return null for non-existent session', async () => {
      const storage = await SQLiteStorage.getInstance(testDbPath());
      await storage.init();
      expect(storage.getSession('non-existent')).toBeNull();
      storage.close();
    });
  });

  describe('incrementSessionTraceCount', () => {
    it('should increment trace count', async () => {
      const storage = await SQLiteStorage.getInstance(testDbPath());
      await storage.init();
      storage.createSession(makeSession('sess-1', 'codex'));
      storage.incrementSessionTraceCount('sess-1');
      storage.incrementSessionTraceCount('sess-1');
      expect(storage.getSession('sess-1')?.trace_count).toBe(2);
      storage.close();
    });
  });

  describe('addTraceIndex + getTraceIndexBySession', () => {
    it('should add and retrieve trace index', async () => {
      const storage = await SQLiteStorage.getInstance(testDbPath());
      await storage.init();
      storage.addTraceIndex({
        trace_id: 't-1',
        session_id: 'sess-1',
        runtime: 'codex',
        event_type: 'user_input',
        timestamp: new Date().toISOString(),
        status: 'success',
      });
      storage.addTraceIndex({
        trace_id: 't-2',
        session_id: 'sess-1',
        runtime: 'codex',
        event_type: 'assistant_output',
        timestamp: new Date().toISOString(),
        status: 'success',
      });
      expect(storage.getTraceIndexBySession('sess-1').length).toBe(2);
      storage.close();
    });

    it('should respect limit', async () => {
      const storage = await SQLiteStorage.getInstance(testDbPath());
      await storage.init();
      for (let i = 0; i < 5; i++) {
        storage.addTraceIndex({
          trace_id: `t-${i}`,
          session_id: 'sess-1',
          runtime: 'codex',
          event_type: 'user_input',
          timestamp: new Date().toISOString(),
          status: 'success',
        });
      }
      expect(storage.getTraceIndexBySession('sess-1', 3).length).toBe(3);
      storage.close();
    });
  });

  describe('upsertOriginSkill + getOriginSkill', () => {
    it('should upsert and retrieve origin skill', async () => {
      const storage = await SQLiteStorage.getInstance(testDbPath());
      await storage.init();
      const origin: OriginSkill = {
        skill_id: 'origin-1',
        origin_path: '/path/1',
        origin_version: '1.0',
        source: 'local',
        installed_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
      };
      storage.upsertOriginSkill(origin);
      const result = storage.getOriginSkill('origin-1');
      expect(result).not.toBeNull();
      expect(result?.skill_id).toBe('origin-1');
      storage.close();
    });

    it('should return null for non-existent skill', async () => {
      const storage = await SQLiteStorage.getInstance(testDbPath());
      await storage.init();
      expect(storage.getOriginSkill('non-existent')).toBeNull();
      storage.close();
    });
  });

  describe('listOriginSkills', () => {
    it('should list all origin skills', async () => {
      const storage = await SQLiteStorage.getInstance(testDbPath());
      await storage.init();
      storage.upsertOriginSkill({
        skill_id: 'origin-1',
        origin_path: '/path/1',
        origin_version: '1.0',
        source: 'local',
        installed_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
      });
      storage.upsertOriginSkill({
        skill_id: 'origin-2',
        origin_path: '/path/2',
        origin_version: '2.0',
        source: 'marketplace',
        installed_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
      });
      expect(storage.listOriginSkills().length).toBe(2);
      storage.close();
    });
  });

  describe('createBackup', () => {
    it('should create a backup', async () => {
      const storage = await SQLiteStorage.getInstance(testDbPath());
      await storage.init();
      const backupPath = storage.createBackup();
      expect(existsSync(backupPath)).toBe(true);
      storage.close();
    });

    it('should create backup at specified path', async () => {
      const storage = await SQLiteStorage.getInstance(testDbPath());
      await storage.init();
      const backupPath = join(testDir, 'my-backup.db');
      storage.createBackup(backupPath);
      expect(existsSync(backupPath)).toBe(true);
      storage.close();
    });
  });

  describe('restoreFromBackup', () => {
    it('should restore from backup', async () => {
      const storage = await SQLiteStorage.getInstance(testDbPath());
      await storage.init();
      const backupPath = storage.createBackup();
      await expect(storage.restoreFromBackup(backupPath)).resolves.not.toThrow();
      storage.close();
    });

    it('should throw for non-existent backup', async () => {
      const storage = await SQLiteStorage.getInstance(testDbPath());
      await storage.init();
      await expect(storage.restoreFromBackup('/nonexistent/backup.db')).rejects.toThrow();
      storage.close();
    });
  });

  describe('batchOperation', () => {
    it('should execute batch operations', async () => {
      const storage = await SQLiteStorage.getInstance(testDbPath());
      await storage.init();
      expect(storage.batchOperation(() => 'result')).toBe('result');
      storage.close();
    });

    it('should rollback on error', async () => {
      const storage = await SQLiteStorage.getInstance(testDbPath());
      await storage.init();
      expect(() =>
        storage.batchOperation(() => {
          throw new Error('fail');
        })
      ).toThrow('fail');
      storage.close();
    });
  });

  describe('beginTrans/commit', () => {
    it('should handle transactions', async () => {
      const storage = await SQLiteStorage.getInstance(testDbPath());
      await storage.init();
      storage.beginTrans();
      expect(() => storage.commit()).not.toThrow();
      storage.close();
    });

    it('should handle commit with no transaction', async () => {
      const storage = await SQLiteStorage.getInstance(testDbPath());
      await storage.init();
      expect(() => storage.commit()).not.toThrow();
      storage.close();
    });
  });

  describe('rollback', () => {
    it('should handle rollback with no transaction', async () => {
      const storage = await SQLiteStorage.getInstance(testDbPath());
      await storage.init();
      expect(() => storage.rollback()).not.toThrow();
      storage.close();
    });
  });

  describe('addEvolutionRecordIndex + getEvolutionRecordIndex', () => {
    it('should add and retrieve evolution records', async () => {
      const storage = await SQLiteStorage.getInstance(testDbPath());
      await storage.init();
      storage.upsertShadowSkill(makeShadow('s-1', 'proj-1', 'skill-1'));

      storage.addEvolutionRecordIndex({
        shadow_id: 's-1',
        revision: 1,
        timestamp: new Date().toISOString(),
        change_type: 'add_fallback',
        source_sessions: ['sess-1', 'sess-2'],
        confidence: 0.85,
      });

      storage.addEvolutionRecordIndex({
        shadow_id: 's-1',
        revision: 2,
        timestamp: new Date().toISOString(),
        change_type: 'prune_noise',
        source_sessions: ['sess-3'],
        confidence: 0.7,
      });

      const records = storage.getEvolutionRecordIndex('s-1');
      expect(records.length).toBe(2);
      expect(records[0].revision).toBe(2);
      expect(records[0].change_type).toBe('prune_noise');
      expect(records[1].revision).toBe(1);
      expect(records[1].source_sessions).toEqual(['sess-1', 'sess-2']);
      storage.close();
    });

    it('should respect limit', async () => {
      const storage = await SQLiteStorage.getInstance(testDbPath());
      await storage.init();
      storage.upsertShadowSkill(makeShadow('s-1', 'proj-1', 'skill-1'));

      for (let i = 1; i <= 5; i++) {
        storage.addEvolutionRecordIndex({
          shadow_id: 's-1',
          revision: i,
          timestamp: new Date().toISOString(),
          change_type: 'add_fallback',
          source_sessions: [`sess-${i}`],
          confidence: 0.8,
        });
      }

      const records = storage.getEvolutionRecordIndex('s-1', 3);
      expect(records.length).toBe(3);
      storage.close();
    });

    it('should return empty for non-existent shadow', async () => {
      const storage = await SQLiteStorage.getInstance(testDbPath());
      await storage.init();
      const records = storage.getEvolutionRecordIndex('non-existent');
      expect(records).toEqual([]);
      storage.close();
    });
  });

  describe('addSnapshot + getSnapshots + getLatestSnapshot', () => {
    it('should add and retrieve snapshots', async () => {
      const storage = await SQLiteStorage.getInstance(testDbPath());
      await storage.init();
      storage.upsertShadowSkill(makeShadow('s-1', 'proj-1', 'skill-1'));

      storage.addSnapshot({
        shadow_id: 's-1',
        revision: 1,
        timestamp: new Date().toISOString(),
        file_path: '/path/to/snap-1.md',
        content_hash: 'hash1',
      });

      storage.addSnapshot({
        shadow_id: 's-1',
        revision: 2,
        timestamp: new Date().toISOString(),
        file_path: '/path/to/snap-2.md',
        content_hash: 'hash2',
      });

      const snapshots = storage.getSnapshots('s-1');
      expect(snapshots.length).toBe(2);
      expect(snapshots[0].file_path).toBe('/path/to/snap-2.md');
      expect(snapshots[1].file_path).toBe('/path/to/snap-1.md');
      storage.close();
    });

    it('should get latest snapshot', async () => {
      const storage = await SQLiteStorage.getInstance(testDbPath());
      await storage.init();
      storage.upsertShadowSkill(makeShadow('s-1', 'proj-1', 'skill-1'));

      storage.addSnapshot({
        shadow_id: 's-1',
        revision: 1,
        timestamp: new Date().toISOString(),
        file_path: '/path/to/snap-1.md',
        content_hash: 'hash1',
      });

      storage.addSnapshot({
        shadow_id: 's-1',
        revision: 2,
        timestamp: new Date().toISOString(),
        file_path: '/path/to/snap-2.md',
        content_hash: 'hash2',
      });

      const latest = storage.getLatestSnapshot('s-1');
      expect(latest).not.toBeNull();
      expect(latest?.revision).toBe(2);
      expect(latest?.file_path).toBe('/path/to/snap-2.md');
      storage.close();
    });

    it('should return null for non-existent shadow', async () => {
      const storage = await SQLiteStorage.getInstance(testDbPath());
      await storage.init();
      const latest = storage.getLatestSnapshot('non-existent');
      expect(latest).toBeNull();
      storage.close();
    });

    it('should return empty snapshots for non-existent shadow', async () => {
      const storage = await SQLiteStorage.getInstance(testDbPath());
      await storage.init();
      const snapshots = storage.getSnapshots('non-existent');
      expect(snapshots).toEqual([]);
      storage.close();
    });
  });

  describe('upsertTraceSkillMapping + getTraceSkillMappings', () => {
    it('should upsert and retrieve trace-skill mapping', async () => {
      const storage = await SQLiteStorage.getInstance(testDbPath());
      await storage.init();

      storage.upsertTraceSkillMapping({
        trace_id: 't-1',
        skill_id: 'skill-1',
        shadow_id: 's-1',
        confidence: 0.9,
        reason: 'mentioned in user input',
        mapped_at: new Date().toISOString(),
      });

      const mappings = storage.getTraceSkillMappings('skill-1');
      expect(mappings.length).toBe(1);
      expect(mappings[0].trace_id).toBe('t-1');
      expect(mappings[0].confidence).toBe(0.9);
      storage.close();
    });

    it('should return empty for non-existent skill', async () => {
      const storage = await SQLiteStorage.getInstance(testDbPath());
      await storage.init();
      const mappings = storage.getTraceSkillMappings('non-existent');
      expect(mappings).toEqual([]);
      storage.close();
    });
  });

  describe('getTraceSkillMappingByTraceId', () => {
    it('should retrieve mapping by trace id', async () => {
      const storage = await SQLiteStorage.getInstance(testDbPath());
      await storage.init();

      storage.upsertTraceSkillMapping({
        trace_id: 't-1',
        skill_id: 'skill-1',
        shadow_id: 's-1',
        confidence: 0.9,
        reason: 'mentioned',
        mapped_at: new Date().toISOString(),
      });

      storage.upsertTraceSkillMapping({
        trace_id: 't-1',
        skill_id: 'skill-2',
        shadow_id: null,
        confidence: 0.6,
        reason: 'inferred',
        mapped_at: new Date().toISOString(),
      });

      const mappings = storage.getTraceSkillMappingByTraceId('t-1');
      expect(mappings.length).toBe(2);
      storage.close();
    });

    it('should return empty for non-existent trace', async () => {
      const storage = await SQLiteStorage.getInstance(testDbPath());
      await storage.init();
      const mappings = storage.getTraceSkillMappingByTraceId('non-existent');
      expect(mappings).toEqual([]);
      storage.close();
    });
  });

  describe('getTraceSkillMappingStats', () => {
    it('should return mapping statistics', async () => {
      const storage = await SQLiteStorage.getInstance(testDbPath());
      await storage.init();

      storage.upsertTraceSkillMapping({
        trace_id: 't-1',
        skill_id: 'skill-1',
        shadow_id: 's-1',
        confidence: 0.9,
        reason: 'mentioned',
        mapped_at: new Date().toISOString(),
      });

      storage.upsertTraceSkillMapping({
        trace_id: 't-2',
        skill_id: 'skill-1',
        shadow_id: 's-1',
        confidence: 0.7,
        reason: 'mentioned',
        mapped_at: new Date().toISOString(),
      });

      const stats = storage.getTraceSkillMappingStats();
      expect(stats.total_mappings).toBe(2);
      expect(stats.by_skill['skill-1']).toBe(2);
      expect(stats.avg_confidence).toBeCloseTo(0.8);
      storage.close();
    });

    it('should return zero stats for empty database', async () => {
      const storage = await SQLiteStorage.getInstance(testDbPath());
      await storage.init();
      const stats = storage.getTraceSkillMappingStats();
      expect(stats.total_mappings).toBe(0);
      expect(stats.avg_confidence).toBe(0);
      storage.close();
    });
  });

  describe('cleanupTraceSkillMappings', () => {
    it('should cleanup old mappings', async () => {
      const storage = await SQLiteStorage.getInstance(testDbPath());
      await storage.init();

      // Add old mapping
      storage.upsertTraceSkillMapping({
        trace_id: 't-1',
        skill_id: 'skill-1',
        shadow_id: 's-1',
        confidence: 0.9,
        reason: 'mentioned',
        mapped_at: '2020-01-01T00:00:00.000Z',
      });

      // Add new mapping
      storage.upsertTraceSkillMapping({
        trace_id: 't-2',
        skill_id: 'skill-1',
        shadow_id: 's-1',
        confidence: 0.8,
        reason: 'mentioned',
        mapped_at: new Date().toISOString(),
      });

      const cleaned = storage.cleanupTraceSkillMappings(30);
      expect(cleaned).toBe(1);
      storage.close();
    });
  });

  describe('close', () => {
    it('should close without errors', async () => {
      const storage = await SQLiteStorage.getInstance(testDbPath());
      await storage.init();
      expect(() => storage.close()).not.toThrow();
    });

    it('should do nothing when already closed', async () => {
      const storage = await SQLiteStorage.getInstance(testDbPath());
      await storage.init();
      storage.close();
      expect(() => storage.close()).not.toThrow();
    });
  });
});
