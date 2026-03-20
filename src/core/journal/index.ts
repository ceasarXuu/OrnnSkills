import { existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { createChildLogger } from '../../utils/logger.js';
import { hashString } from '../../utils/hash.js';
import { createJournalStore } from '../../storage/ndjson.js';
import { createSQLiteStorage } from '../../storage/sqlite.js';
import type { EvolutionRecord, JournalQueryOptions } from '../../types/index.js';

const logger = createChildLogger('journal');

/**
 * Journal Manager
 * 负责管理演化日志和版本控制
 */
export class JournalManager {
  private db;
  private projectRoot: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    const dbPath = join(projectRoot, '.evo', 'state', 'sessions.db');
    this.db = createSQLiteStorage(dbPath);
  }

  /**
   * 初始化数据库
   */
  async init(): Promise<void> {
    await this.db.init();
  }

  /**
   * 记录一次演化
   */
  async record(
    shadowId: string,
    record: Omit<EvolutionRecord, 'revision'>
  ): Promise<number> {
    // 获取当前 revision
    const currentRevision = await this.getLatestRevision(shadowId);
    const newRevision = currentRevision + 1;

    // 创建完整的演化记录
    const fullRecord: EvolutionRecord = {
      ...record,
      revision: newRevision,
    };

    // 写入 journal
    const journal = this.getJournal(shadowId);
    journal.append(fullRecord);

    // 更新数据库索引
    this.db.addEvolutionRecordIndex({
      shadow_id: shadowId,
      revision: newRevision,
      timestamp: fullRecord.timestamp,
      change_type: fullRecord.change_type,
      source_sessions: fullRecord.source_sessions,
      confidence: 0, // 默认置信度
    });

    // 更新 shadow revision
    const skillId = this.extractSkillId(shadowId);
    if (skillId) {
      this.db.updateShadowRevision(shadowId, newRevision);
    }

    logger.info(`Evolution recorded: revision ${newRevision}`, {
      shadow_id: shadowId,
      change_type: fullRecord.change_type,
    });

    return newRevision;
  }

  /**
   * 获取 journal
   */
  getJournal(shadowId: string) {
    const skillId = this.extractSkillId(shadowId);
    const journalPath = join(
      this.projectRoot,
      '.evo',
      'skills',
      skillId,
      'journal.ndjson'
    );
    return createJournalStore(journalPath);
  }

  /**
   * 获取 journal 记录
   */
  async getJournalRecords(
    shadowId: string,
    options?: JournalQueryOptions
  ): Promise<EvolutionRecord[]> {
    const journal = this.getJournal(shadowId);
    const allRecords = await journal.readAll();

    let filtered = allRecords;

    if (options?.fromRevision !== undefined) {
      filtered = filtered.filter((r) => r.revision >= options.fromRevision!);
    }

    if (options?.toRevision !== undefined) {
      filtered = filtered.filter((r) => r.revision <= options.toRevision!);
    }

    if (options?.changeType) {
      filtered = filtered.filter((r) => r.change_type === options.changeType);
    }

    // 按 revision 降序排列
    filtered.sort((a, b) => b.revision - a.revision);

    if (options?.limit) {
      filtered = filtered.slice(0, options.limit);
    }

    return filtered;
  }

  /**
   * 获取最新 revision
   */
  async getLatestRevision(shadowId: string): Promise<number> {
    const journal = this.getJournal(shadowId);
    return journal.getLatestRevision();
  }

  /**
   * 获取指定 revision 的记录
   */
  async getRecordByRevision(
    shadowId: string,
    revision: number
  ): Promise<EvolutionRecord | null> {
    const journal = this.getJournal(shadowId);
    return journal.getByRevision(revision);
  }

  /**
   * 创建 snapshot
   */
  async createSnapshot(shadowId: string, revision?: number): Promise<void> {
    const skillId = this.extractSkillId(shadowId);
    const targetRevision = revision ?? (await this.getLatestRevision(shadowId));

    // 读取当前 shadow 内容
    const shadowPath = join(
      this.projectRoot,
      '.evo',
      'skills',
      skillId,
      'current.md'
    );

    if (!existsSync(shadowPath)) {
      throw new Error(`Shadow skill not found: ${skillId}`);
    }

    // 创建 snapshot 文件
    const snapshotsDir = join(
      this.projectRoot,
      '.evo',
      'skills',
      skillId,
      'snapshots'
    );

    if (!existsSync(snapshotsDir)) {
      mkdirSync(snapshotsDir, { recursive: true });
    }

    const snapshotFileName = `rev_${String(targetRevision).padStart(4, '0')}.md`;
    const snapshotPath = join(snapshotsDir, snapshotFileName);

    // 复制当前内容到 snapshot
    copyFileSync(shadowPath, snapshotPath);

    // 计算内容哈希
    const { readFileSync } = require('node:fs');
    const content = readFileSync(shadowPath, 'utf-8');
    const contentHash = hashString(content);

    // 记录到数据库
    this.db.addSnapshot({
      shadow_id: shadowId,
      revision: targetRevision,
      timestamp: new Date().toISOString(),
      file_path: snapshotPath,
      content_hash: contentHash,
    });

    logger.info(`Snapshot created: revision ${targetRevision}`, {
      shadow_id: shadowId,
      path: snapshotPath,
    });
  }

  /**
   * 回滚到指定 revision
   */
  async rollback(shadowId: string, targetRevision: number): Promise<void> {
    const skillId = this.extractSkillId(shadowId);

    // 查找 snapshot
    const snapshots = this.db.getSnapshots(shadowId);
    const snapshot = snapshots.find((s) => s.revision === targetRevision);

    if (!snapshot) {
      throw new Error(`Snapshot not found for revision ${targetRevision}`);
    }

    // 复制 snapshot 到当前
    const shadowPath = join(
      this.projectRoot,
      '.evo',
      'skills',
      skillId,
      'current.md'
    );

    copyFileSync(snapshot.file_path, shadowPath);

    // 更新 revision
    this.db.updateShadowRevision(shadowId, targetRevision);

    logger.info(`Rolled back to revision ${targetRevision}`, {
      shadow_id: shadowId,
      snapshot_path: snapshot.file_path,
    });
  }

  /**
   * 回滚到上一个 snapshot
   */
  async rollbackToSnapshot(shadowId: string): Promise<void> {
    const snapshots = this.db.getSnapshots(shadowId);
    if (snapshots.length === 0) {
      throw new Error('No snapshots available');
    }

    // 获取最新的 snapshot
    const latestSnapshot = snapshots[0];
    await this.rollback(shadowId, latestSnapshot.revision);
  }

  /**
   * 获取所有 snapshots
   */
  getSnapshots(shadowId: string) {
    return this.db.getSnapshots(shadowId);
  }

  /**
   * 获取最新 snapshot
   */
  getLatestSnapshot(shadowId: string) {
    return this.db.getLatestSnapshot(shadowId);
  }

  /**
   * 从 shadowId 提取 skillId
   */
  private extractSkillId(shadowId: string): string {
    // shadowId 格式: skillId@projectId
    const parts = shadowId.split('@');
    return parts[0] || shadowId;
  }

  /**
   * 关闭数据库连接
   */
  close(): void {
    this.db.close();
  }
}

// 导出工厂函数
export function createJournalManager(projectRoot: string): JournalManager {
  return new JournalManager(projectRoot);
}