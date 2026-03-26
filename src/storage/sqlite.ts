import initSqlJs, { type Database } from 'sql.js';
import { join, resolve } from 'node:path';
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, unlinkSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { createChildLogger } from '../utils/logger.js';
import type { ProjectSkillShadow, ShadowStatus, Session, RuntimeType, OriginSkill } from '../types/index.js';

const logger = createChildLogger('sqlite');

/**
 * SQLite 存储管理器
 */
export class SQLiteStorage {
  private db: Database | null = null;
  private dbPath: string;
  
  // 单例管理：防止多个实例指向同一文件
  private static instances: Map<string, SQLiteStorage> = new Map();
  private static locks: Map<string, Promise<SQLiteStorage>> = new Map();

  private constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  /**
   * 获取 SQLiteStorage 实例（单例模式）
   * 使用异步锁防止并发创建多个实例
   */
  static async getInstance(dbPath: string): Promise<SQLiteStorage> {
    const normalizedPath = resolve(dbPath);
    
    // 如果已有实例，直接返回
    if (SQLiteStorage.instances.has(normalizedPath)) {
      return SQLiteStorage.instances.get(normalizedPath)!;
    }
    
    // 如果正在创建实例，等待完成
    if (SQLiteStorage.locks.has(normalizedPath)) {
      return SQLiteStorage.locks.get(normalizedPath)!;
    }
    
    // 创建新实例的 Promise
    const createPromise = (async () => {
      try {
        const instance = new SQLiteStorage(normalizedPath);
        SQLiteStorage.instances.set(normalizedPath, instance);
        return instance;
      } finally {
        SQLiteStorage.locks.delete(normalizedPath);
      }
    })();
    
    SQLiteStorage.locks.set(normalizedPath, createPromise);
    return createPromise;
  }

  /**
   * 关闭并移除实例
   */
  static removeInstance(dbPath: string): void {
    const instance = SQLiteStorage.instances.get(dbPath);
    if (instance) {
      instance.close();
      SQLiteStorage.instances.delete(dbPath);
    }
  }

  /**
   * 初始化数据库
   */
  async init(): Promise<void> {
    // 确保目录存在
    const dir = join(this.dbPath, '..');
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // 初始化 sql.js
    const SQL = await initSqlJs();

    // 尝试加载现有数据库
    if (existsSync(this.dbPath)) {
      const buffer = readFileSync(this.dbPath);
      this.db = new SQL.Database(buffer);
    } else {
      this.db = new SQL.Database();
    }

    this.createTables();
    this.save();
    logger.info('Database initialized', { path: this.dbPath });
  }

  /**
   * 保存数据库到文件（原子写入）
   */
  private save(): void {
    if (!this.db) throw new Error('Database not initialized');
    const data = this.db.export();
    const buffer = Buffer.from(data);
    
    // 使用唯一临时文件实现原子写入（防止多进程并发冲突）
    const uniqueId = randomBytes(8).toString('hex');
    const tempPath = `${this.dbPath}.${process.pid}.${uniqueId}.tmp`;
    try {
      writeFileSync(tempPath, buffer);
      renameSync(tempPath, this.dbPath); // 原子替换
    } catch (error) {
      // 清理临时文件
      try {
        if (existsSync(tempPath)) {
          unlinkSync(tempPath);
        }
      } catch {
        // 忽略清理错误
      }
      throw error;
    }
  }

  /**
   * 开始事务
   */
  beginTrans(): void {
    if (!this.db) throw new Error('Database not initialized');
    this.db.run('BEGIN TRANSACTION');
  }

  /**
   * 提交事务
   */
  commit(): void {
    if (!this.db) throw new Error('Database not initialized');
    this.db.run('COMMIT');
    this.save();
  }

  /**
   * 回滚事务
   */
  rollback(): void {
    if (!this.db) throw new Error('Database not initialized');
    this.db.run('ROLLBACK');
  }

  /**
   * 创建数据库备份
   */
  createBackup(backupPath?: string): string {
    if (!this.db) throw new Error('Database not initialized');
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFilePath = backupPath ?? `${this.dbPath}.backup.${timestamp}`;
    
    const data = this.db.export();
    const buffer = Buffer.from(data);
    writeFileSync(backupFilePath, buffer);
    
    logger.info('Database backup created', { path: backupFilePath });
    return backupFilePath;
  }

  /**
   * 从备份恢复数据库
   */
  async restoreFromBackup(backupPath: string): Promise<void> {
    if (!existsSync(backupPath)) {
      throw new Error(`Backup file not found: ${backupPath}`);
    }

    const buffer = readFileSync(backupPath);
    const SQL = await initSqlJs();
    
    if (this.db) {
      this.db.close();
    }
    
    this.db = new SQL.Database(buffer);
    this.save();
    
    logger.info('Database restored from backup', { path: backupPath });
  }

  /**
   * 创建表结构
   */
  private createTables(): void {
    if (!this.db) throw new Error('Database not initialized');

    this.db.run(`
      -- Shadow Skills 表
      CREATE TABLE IF NOT EXISTS shadow_skills (
        shadow_id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        skill_id TEXT NOT NULL,
        origin_skill_id TEXT NOT NULL,
        origin_version_at_fork TEXT NOT NULL,
        shadow_path TEXT NOT NULL,
        current_revision INTEGER DEFAULT 0,
        status TEXT DEFAULT 'active',
        created_at TEXT NOT NULL,
        last_optimized_at TEXT,
        hit_count INTEGER DEFAULT 0,
        success_count INTEGER DEFAULT 0,
        manual_override_count INTEGER DEFAULT 0,
        health_score REAL DEFAULT 100.0,
        UNIQUE(project_id, skill_id)
      );
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS evolution_records_index (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        shadow_id TEXT NOT NULL,
        revision INTEGER NOT NULL,
        timestamp TEXT NOT NULL,
        change_type TEXT NOT NULL,
        source_sessions TEXT,
        confidence REAL,
        FOREIGN KEY (shadow_id) REFERENCES shadow_skills(shadow_id)
      );
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        shadow_id TEXT NOT NULL,
        revision INTEGER NOT NULL,
        timestamp TEXT NOT NULL,
        file_path TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        FOREIGN KEY (shadow_id) REFERENCES shadow_skills(shadow_id)
      );
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS sessions (
        session_id TEXT PRIMARY KEY,
        runtime TEXT NOT NULL,
        project_id TEXT,
        started_at TEXT NOT NULL,
        ended_at TEXT,
        trace_count INTEGER DEFAULT 0
      );
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS traces_index (
        trace_id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        runtime TEXT NOT NULL,
        event_type TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        status TEXT,
        FOREIGN KEY (session_id) REFERENCES sessions(session_id)
      );
    `);

    this.db.run(`
      -- Trace-Skill 映射表
      CREATE TABLE IF NOT EXISTS trace_skill_mappings (
        trace_id TEXT NOT NULL,
        skill_id TEXT NOT NULL,
        shadow_id TEXT,
        confidence REAL NOT NULL,
        reason TEXT,
        mapped_at TEXT NOT NULL,
        PRIMARY KEY (trace_id, skill_id)
      );
    `);

    this.db.run(`
      -- Origin Skills 表
      CREATE TABLE IF NOT EXISTS origin_skills (
        skill_id TEXT PRIMARY KEY,
        origin_path TEXT NOT NULL,
        origin_version TEXT NOT NULL,
        source TEXT NOT NULL,
        installed_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL
      );
    `);

    // 创建索引
    this.db.run('CREATE INDEX IF NOT EXISTS idx_shadow_project ON shadow_skills(project_id);');
    this.db.run('CREATE INDEX IF NOT EXISTS idx_evolution_shadow ON evolution_records_index(shadow_id);');
    this.db.run('CREATE INDEX IF NOT EXISTS idx_traces_session ON traces_index(session_id);');
    this.db.run('CREATE INDEX IF NOT EXISTS idx_traces_timestamp ON traces_index(timestamp);');
    this.db.run('CREATE INDEX IF NOT EXISTS idx_trace_skill_skill ON trace_skill_mappings(skill_id);');
    this.db.run('CREATE INDEX IF NOT EXISTS idx_trace_skill_shadow ON trace_skill_mappings(shadow_id);');
  }

  /**
   * 关闭数据库连接
   */
  close(): void {
    if (this.db) {
      this.save();
      this.db.close();
      this.db = null;
      logger.info('Database closed');
    }
  }

  // ==================== Shadow Skills ====================

  /**
   * 插入或更新 shadow skill
   */
  upsertShadowSkill(shadow: ProjectSkillShadow): void {
    if (!this.db) throw new Error('Database not initialized');

    this.db.run(
      `INSERT OR REPLACE INTO shadow_skills (
        shadow_id, project_id, skill_id, origin_skill_id, origin_version_at_fork,
        shadow_path, current_revision, status, created_at, last_optimized_at,
        hit_count, success_count, manual_override_count, health_score
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        shadow.shadow_id,
        shadow.project_id,
        shadow.skill_id,
        shadow.origin_skill_id,
        shadow.origin_version_at_fork,
        shadow.shadow_path,
        shadow.current_revision,
        shadow.status,
        shadow.created_at,
        shadow.last_optimized_at,
        0,
        0,
        0,
        100.0,
      ]
    );
    this.save();
  }

  /**
   * 在事务中插入或更新 shadow skill
   */
  upsertShadowSkillInTransaction(shadow: ProjectSkillShadow): void {
    if (!this.db) throw new Error('Database not initialized');

    this.db.run(
      `INSERT OR REPLACE INTO shadow_skills (
        shadow_id, project_id, skill_id, origin_skill_id, origin_version_at_fork,
        shadow_path, current_revision, status, created_at, last_optimized_at,
        hit_count, success_count, manual_override_count, health_score
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        shadow.shadow_id,
        shadow.project_id,
        shadow.skill_id,
        shadow.origin_skill_id,
        shadow.origin_version_at_fork,
        shadow.shadow_path,
        shadow.current_revision,
        shadow.status,
        shadow.created_at,
        shadow.last_optimized_at,
        0,
        0,
        0,
        100.0,
      ]
    );
    // 注意：不在这里调用save()，由调用者决定何时提交事务
  }

  /**
   * 批量操作（使用事务保护）
   */
  batchOperation<T>(operations: () => T): T {
    if (!this.db) throw new Error('Database not initialized');
    
    this.beginTrans();
    try {
      const result = operations();
      this.commit();
      return result;
    } catch (error) {
      this.rollback();
      throw error;
    }
  }

  /**
   * 获取 shadow skill
   */
  getShadowSkill(projectId: string, skillId: string): ProjectSkillShadow | null {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(
      'SELECT * FROM shadow_skills WHERE project_id = ? AND skill_id = ?'
    );
    stmt.bind([projectId, skillId]);

    if (!stmt.step()) {
      stmt.free();
      return null;
    }

    const row = stmt.getAsObject();
    stmt.free();

    return {
      project_id: row.project_id as string,
      skill_id: row.skill_id as string,
      shadow_id: row.shadow_id as string,
      origin_skill_id: row.origin_skill_id as string,
      origin_version_at_fork: row.origin_version_at_fork as string,
      shadow_path: row.shadow_path as string,
      current_revision: row.current_revision as number,
      status: row.status as ShadowStatus,
      created_at: row.created_at as string,
      last_optimized_at: row.last_optimized_at as string,
    };
  }

  /**
   * 列出项目的所有 shadow skills
   */
  listShadowSkills(projectId: string): ProjectSkillShadow[] {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(
      'SELECT * FROM shadow_skills WHERE project_id = ? ORDER BY created_at DESC'
    );
    stmt.bind([projectId]);

    const results: ProjectSkillShadow[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      results.push({
        project_id: row.project_id as string,
        skill_id: row.skill_id as string,
        shadow_id: row.shadow_id as string,
        origin_skill_id: row.origin_skill_id as string,
        origin_version_at_fork: row.origin_version_at_fork as string,
        shadow_path: row.shadow_path as string,
        current_revision: row.current_revision as number,
        status: row.status as ShadowStatus,
        created_at: row.created_at as string,
        last_optimized_at: row.last_optimized_at as string,
      });
    }
    stmt.free();

    return results;
  }

  /**
   * 更新 shadow skill 状态
   */
  updateShadowStatus(shadowId: string, status: ShadowStatus): void {
    if (!this.db) throw new Error('Database not initialized');
    this.db.run('UPDATE shadow_skills SET status = ? WHERE shadow_id = ?', [status, shadowId]);
    this.save();
  }

  /**
   * 更新 shadow skill revision
   */
  updateShadowRevision(shadowId: string, revision: number): void {
    if (!this.db) throw new Error('Database not initialized');
    this.db.run('UPDATE shadow_skills SET current_revision = ? WHERE shadow_id = ?', [revision, shadowId]);
    this.save();
  }

  // ==================== Sessions ====================

  /**
   * 创建 session
   */
  createSession(session: Session): void {
    if (!this.db) throw new Error('Database not initialized');

    this.db.run(
      'INSERT INTO sessions (session_id, runtime, project_id, started_at, ended_at, trace_count) VALUES (?, ?, ?, ?, ?, ?)',
      [
        session.session_id,
        session.runtime,
        session.project_id,
        session.started_at,
        session.ended_at,
        session.trace_count,
      ]
    );
    this.save();
  }

  /**
   * 获取 session
   */
  getSession(sessionId: string): Session | null {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare('SELECT * FROM sessions WHERE session_id = ?');
    stmt.bind([sessionId]);

    if (!stmt.step()) {
      stmt.free();
      return null;
    }

    const row = stmt.getAsObject();
    stmt.free();

    return {
      session_id: row.session_id as string,
      runtime: row.runtime as RuntimeType,
      project_id: row.project_id as string | null,
      started_at: row.started_at as string,
      ended_at: row.ended_at as string | null,
      trace_count: row.trace_count as number,
    };
  }

  /**
   * 更新 session trace 计数
   */
  incrementSessionTraceCount(sessionId: string): void {
    if (!this.db) throw new Error('Database not initialized');
    this.db.run('UPDATE sessions SET trace_count = trace_count + 1 WHERE session_id = ?', [sessionId]);
    this.save();
  }

  // ==================== Traces Index ====================

  /**
   * 添加 trace 索引记录
   */
  addTraceIndex(trace: {
    trace_id: string;
    session_id: string;
    runtime: RuntimeType;
    event_type: string;
    timestamp: string;
    status: string;
  }): void {
    if (!this.db) throw new Error('Database not initialized');

    this.db.run(
      'INSERT INTO traces_index (trace_id, session_id, runtime, event_type, timestamp, status) VALUES (?, ?, ?, ?, ?, ?)',
      [trace.trace_id, trace.session_id, trace.runtime, trace.event_type, trace.timestamp, trace.status]
    );
    this.save();
  }

  /**
   * 获取 session 的 trace 索引
   */
  getTraceIndexBySession(sessionId: string, limit = 100): Array<{
    trace_id: string;
    event_type: string;
    timestamp: string;
    status: string;
  }> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(
      'SELECT trace_id, event_type, timestamp, status FROM traces_index WHERE session_id = ? ORDER BY timestamp DESC LIMIT ?'
    );
    stmt.bind([sessionId, limit]);

    const results: Array<{
      trace_id: string;
      event_type: string;
      timestamp: string;
      status: string;
    }> = [];

    while (stmt.step()) {
      const row = stmt.getAsObject();
      results.push({
        trace_id: row.trace_id as string,
        event_type: row.event_type as string,
        timestamp: row.timestamp as string,
        status: row.status as string,
      });
    }
    stmt.free();

    return results;
  }

  // ==================== Evolution Records Index ====================

  /**
   * 添加演化记录索引
   */
  addEvolutionRecordIndex(record: {
    shadow_id: string;
    revision: number;
    timestamp: string;
    change_type: string;
    source_sessions: string[];
    confidence: number;
  }): void {
    if (!this.db) throw new Error('Database not initialized');

    this.db.run(
      'INSERT INTO evolution_records_index (shadow_id, revision, timestamp, change_type, source_sessions, confidence) VALUES (?, ?, ?, ?, ?, ?)',
      [
        record.shadow_id,
        record.revision,
        record.timestamp,
        record.change_type,
        JSON.stringify(record.source_sessions),
        record.confidence,
      ]
    );
    this.save();
  }

  /**
   * 获取 shadow 的演化记录索引
   */
  getEvolutionRecordIndex(shadowId: string, limit = 50): Array<{
    id: number;
    revision: number;
    timestamp: string;
    change_type: string;
    source_sessions: string[];
    confidence: number;
  }> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(
      'SELECT * FROM evolution_records_index WHERE shadow_id = ? ORDER BY revision DESC LIMIT ?'
    );
    stmt.bind([shadowId, limit]);

    const results: Array<{
      id: number;
      revision: number;
      timestamp: string;
      change_type: string;
      source_sessions: string[];
      confidence: number;
    }> = [];

    while (stmt.step()) {
      const row = stmt.getAsObject();
      results.push({
        id: row.id as number,
        revision: row.revision as number,
        timestamp: row.timestamp as string,
        change_type: row.change_type as string,
        source_sessions: JSON.parse(row.source_sessions as string) as string[],
        confidence: row.confidence as number,
      });
    }
    stmt.free();

    return results;
  }

  // ==================== Snapshots ====================

  /**
   * 添加 snapshot 记录
   */
  addSnapshot(snapshot: {
    shadow_id: string;
    revision: number;
    timestamp: string;
    file_path: string;
    content_hash: string;
  }): void {
    if (!this.db) throw new Error('Database not initialized');

    this.db.run(
      'INSERT INTO snapshots (shadow_id, revision, timestamp, file_path, content_hash) VALUES (?, ?, ?, ?, ?)',
      [snapshot.shadow_id, snapshot.revision, snapshot.timestamp, snapshot.file_path, snapshot.content_hash]
    );
    this.save();
  }

  /**
   * 获取 shadow 的 snapshots
   */
  getSnapshots(shadowId: string): Array<{
    id: number;
    revision: number;
    timestamp: string;
    file_path: string;
    content_hash: string;
  }> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(
      'SELECT * FROM snapshots WHERE shadow_id = ? ORDER BY revision DESC'
    );
    stmt.bind([shadowId]);

    const results: Array<{
      id: number;
      revision: number;
      timestamp: string;
      file_path: string;
      content_hash: string;
    }> = [];

    while (stmt.step()) {
      const row = stmt.getAsObject();
      results.push({
        id: row.id as number,
        revision: row.revision as number,
        timestamp: row.timestamp as string,
        file_path: row.file_path as string,
        content_hash: row.content_hash as string,
      });
    }
    stmt.free();

    return results;
  }

  /**
   * 获取最新的 snapshot
   */
  getLatestSnapshot(shadowId: string): {
    id: number;
    revision: number;
    timestamp: string;
    file_path: string;
    content_hash: string;
  } | null {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(
      'SELECT * FROM snapshots WHERE shadow_id = ? ORDER BY revision DESC LIMIT 1'
    );
    stmt.bind([shadowId]);

    if (!stmt.step()) {
      stmt.free();
      return null;
    }

    const row = stmt.getAsObject();
    stmt.free();

    return {
      id: row.id as number,
      revision: row.revision as number,
      timestamp: row.timestamp as string,
      file_path: row.file_path as string,
      content_hash: row.content_hash as string,
    };
  }

  // ==================== Origin Skills ====================

  /**
   * 插入或更新 origin skill
   */
  upsertOriginSkill(origin: OriginSkill): void {
    if (!this.db) throw new Error('Database not initialized');

    this.db.run(
      `INSERT OR REPLACE INTO origin_skills (
        skill_id, origin_path, origin_version, source, installed_at, last_seen_at
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        origin.skill_id,
        origin.origin_path,
        origin.origin_version,
        origin.source,
        origin.installed_at,
        origin.last_seen_at,
      ]
    );
    this.save();
  }

  /**
   * 获取 origin skill
   */
  getOriginSkill(skillId: string): OriginSkill | null {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare('SELECT * FROM origin_skills WHERE skill_id = ?');
    stmt.bind([skillId]);

    if (!stmt.step()) {
      stmt.free();
      return null;
    }

    const row = stmt.getAsObject();
    stmt.free();

    return {
      skill_id: row.skill_id as string,
      origin_path: row.origin_path as string,
      origin_version: row.origin_version as string,
      source: row.source as 'local' | 'marketplace' | 'git',
      installed_at: row.installed_at as string,
      last_seen_at: row.last_seen_at as string,
    };
  }

  /**
   * 列出所有 origin skills
   */
  listOriginSkills(): OriginSkill[] {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare('SELECT * FROM origin_skills ORDER BY skill_id');
    const results: OriginSkill[] = [];

    while (stmt.step()) {
      const row = stmt.getAsObject();
      results.push({
        skill_id: row.skill_id as string,
        origin_path: row.origin_path as string,
        origin_version: row.origin_version as string,
        source: row.source as 'local' | 'marketplace' | 'git',
        installed_at: row.installed_at as string,
        last_seen_at: row.last_seen_at as string,
      });
    }
    stmt.free();

    return results;
  }

  // ==================== Trace-Skill Mappings ====================

  /**
   * 插入或更新 trace-skill 映射
   */
  upsertTraceSkillMapping(mapping: {
    trace_id: string;
    skill_id: string;
    shadow_id: string | null;
    confidence: number;
    reason: string;
    mapped_at: string;
  }): void {
    if (!this.db) throw new Error('Database not initialized');

    this.db.run(
      `INSERT OR REPLACE INTO trace_skill_mappings (
        trace_id, skill_id, shadow_id, confidence, reason, mapped_at
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        mapping.trace_id,
        mapping.skill_id,
        mapping.shadow_id,
        mapping.confidence,
        mapping.reason,
        mapping.mapped_at,
      ]
    );
    this.save();
  }

  /**
   * 获取 skill 的 trace 映射
   */
  getTraceSkillMappings(skillId: string): Array<{
    trace_id: string;
    skill_id: string;
    shadow_id: string | null;
    confidence: number;
    reason: string;
    mapped_at: string;
  }> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(
      'SELECT * FROM trace_skill_mappings WHERE skill_id = ? ORDER BY mapped_at DESC'
    );
    stmt.bind([skillId]);

    const results: Array<{
      trace_id: string;
      skill_id: string;
      shadow_id: string | null;
      confidence: number;
      reason: string;
      mapped_at: string;
    }> = [];

    while (stmt.step()) {
      const row = stmt.getAsObject();
      results.push({
        trace_id: row.trace_id as string,
        skill_id: row.skill_id as string,
        shadow_id: row.shadow_id as string | null,
        confidence: row.confidence as number,
        reason: row.reason as string,
        mapped_at: row.mapped_at as string,
      });
    }
    stmt.free();

    return results;
  }

  /**
   * 获取 trace 的 skill 映射
   */
  getTraceSkillMappingByTraceId(traceId: string): Array<{
    trace_id: string;
    skill_id: string;
    shadow_id: string | null;
    confidence: number;
    reason: string;
    mapped_at: string;
  }> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(
      'SELECT * FROM trace_skill_mappings WHERE trace_id = ?'
    );
    stmt.bind([traceId]);

    const results: Array<{
      trace_id: string;
      skill_id: string;
      shadow_id: string | null;
      confidence: number;
      reason: string;
      mapped_at: string;
    }> = [];

    while (stmt.step()) {
      const row = stmt.getAsObject();
      results.push({
        trace_id: row.trace_id as string,
        skill_id: row.skill_id as string,
        shadow_id: row.shadow_id as string | null,
        confidence: row.confidence as number,
        reason: row.reason as string,
        mapped_at: row.mapped_at as string,
      });
    }
    stmt.free();

    return results;
  }

  /**
   * 获取映射统计
   */
  getTraceSkillMappingStats(): {
    total_mappings: number;
    by_skill: Record<string, number>;
    avg_confidence: number;
  } {
    if (!this.db) throw new Error('Database not initialized');

    // 总映射数
    const totalStmt = this.db.prepare('SELECT COUNT(*) as total FROM trace_skill_mappings');
    totalStmt.step();
    const totalRow = totalStmt.getAsObject();
    totalStmt.free();
    const total_mappings = totalRow.total as number;

    // 按 skill 分组统计
    const bySkillStmt = this.db.prepare(
      'SELECT skill_id, COUNT(*) as count FROM trace_skill_mappings GROUP BY skill_id'
    );
    const by_skill: Record<string, number> = {};
    while (bySkillStmt.step()) {
      const row = bySkillStmt.getAsObject();
      by_skill[row.skill_id as string] = row.count as number;
    }
    bySkillStmt.free();

    // 平均置信度
    const avgStmt = this.db.prepare('SELECT AVG(confidence) as avg_conf FROM trace_skill_mappings');
    avgStmt.step();
    const avgRow = avgStmt.getAsObject();
    avgStmt.free();
    const avg_confidence = (avgRow.avg_conf as number) || 0;

    return {
      total_mappings,
      by_skill,
      avg_confidence,
    };
  }

  /**
   * 清理旧的映射
   */
  cleanupTraceSkillMappings(retentionDays: number): number {
    if (!this.db) throw new Error('Database not initialized');

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    const cutoff = cutoffDate.toISOString();

    const stmt = this.db.prepare('DELETE FROM trace_skill_mappings WHERE mapped_at < ?');
    stmt.bind([cutoff]);
    stmt.step();
    const changes = this.db.getRowsModified();
    stmt.free();
    this.save();

    logger.info('Cleaned up old trace-skill mappings', { deleted: changes, retentionDays });
    return changes;
  }
}

// 导出工厂函数（使用单例模式）
export async function createSQLiteStorage(dbPath: string): Promise<SQLiteStorage> {
  return SQLiteStorage.getInstance(dbPath);
}
