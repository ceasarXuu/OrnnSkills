import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createChildLogger } from '../../utils/logger.js';
import { getShadowSkillPath, getShadowMetaPath, getShadowJournalPath, getSnapshotsDir } from '../../utils/path.js';
import { createMarkdownSkill } from '../../storage/markdown.js';
import { createSQLiteStorage } from '../../storage/sqlite.js';
import { createJournalStore } from '../../storage/ndjson.js';
import type { ProjectSkillShadow, ShadowStatus, OriginSkill } from '../../types/index.js';

const logger = createChildLogger('shadow-registry');

/**
 * Shadow Skill 注册表
 * 负责管理项目中的 shadow skills
 */
export class ShadowRegistry {
  private db;
  private projectRoot: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    const dbPath = join(projectRoot, '.ornn', 'state', 'sessions.db');
    this.db = createSQLiteStorage(dbPath);
  }

  /**
   * 初始化数据库
   */
  async init(): Promise<void> {
    await this.db.init();
  }

  /**
   * 获取项目的 shadow skill
   */
  get(skillId: string): ProjectSkillShadow | null {
    return this.db.getShadowSkill(this.projectRoot, skillId);
  }

  /**
   * 列出项目的所有 shadow skills
   */
  list(): ProjectSkillShadow[] {
    return this.db.listShadowSkills(this.projectRoot);
  }

  /**
   * 从 origin 创建 shadow
   */
  fork(origin: OriginSkill): ProjectSkillShadow {
    const shadowId = `${origin.skill_id}@${this.getProjectId()}`;
    const now = new Date().toISOString();

    // 创建 shadow 目录结构
    const shadowDir = join(this.projectRoot, '.ornn', 'skills', origin.skill_id);
    const snapshotsDir = join(shadowDir, 'snapshots');

    if (!existsSync(shadowDir)) {
      mkdirSync(shadowDir, { recursive: true });
    }
    if (!existsSync(snapshotsDir)) {
      mkdirSync(snapshotsDir, { recursive: true });
    }

    // 复制 origin 内容到 shadow
    const shadowPath = getShadowSkillPath(this.projectRoot, origin.skill_id);
    const shadowSkill = createMarkdownSkill(shadowPath);
    shadowSkill.copyFromOrigin(origin.origin_path);

    // 创建 meta.json
    const metaPath = getShadowMetaPath(this.projectRoot, origin.skill_id);
    const meta: ProjectSkillShadow = {
      shadow_id: shadowId,
      project_id: this.projectRoot,
      skill_id: origin.skill_id,
      origin_skill_id: origin.skill_id,
      origin_version_at_fork: origin.origin_version,
      shadow_path: shadowPath,
      current_revision: 0,
      status: 'active' as ShadowStatus,
      created_at: now,
      last_optimized_at: '',
    };
    writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');

    // 保存到数据库
    this.db.upsertShadowSkill(meta);

    logger.info(`Shadow skill created: ${shadowId}`, {
      origin: origin.skill_id,
      path: shadowPath,
    });

    return meta;
  }

  /**
   * 检查 shadow 是否存在
   */
  exists(skillId: string): boolean {
    const shadow = this.get(skillId);
    return shadow !== null;
  }

  /**
   * 更新 shadow 状态
   */
  updateStatus(shadowId: string, status: ShadowStatus): void {
    this.db.updateShadowStatus(shadowId, status);
  }

  /**
   * 更新 shadow revision
   */
  updateRevision(shadowId: string, revision: number): void {
    this.db.updateShadowRevision(shadowId, revision);
  }

  /**
   * 读取 shadow skill 内容
   */
  readContent(skillId: string): string | null {
    const shadowPath = getShadowSkillPath(this.projectRoot, skillId);
    if (!existsSync(shadowPath)) {
      return null;
    }

    try {
      const shadowSkill = createMarkdownSkill(shadowPath);
      return shadowSkill.read();
    } catch (error) {
      logger.warn(`Failed to read shadow content: ${skillId}`, { error });
      return null;
    }
  }

  /**
   * 写入 shadow skill 内容
   */
  writeContent(skillId: string, content: string): void {
    const shadowPath = getShadowSkillPath(this.projectRoot, skillId);
    const shadowSkill = createMarkdownSkill(shadowPath);
    shadowSkill.write(content);
  }

  /**
   * 获取 shadow 的 journal
   */
  getJournal(skillId: string) {
    const journalPath = getShadowJournalPath(this.projectRoot, skillId);
    return createJournalStore(journalPath);
  }

  /**
   * 获取 shadow 的 snapshots 目录
   */
  getSnapshotsDir(skillId: string): string {
    return getSnapshotsDir(this.projectRoot, skillId);
  }

  /**
   * 获取项目 ID（使用项目根目录的哈希）
   */
  private getProjectId(): string {
    // 使用动态导入避免循环依赖
    return this.projectRoot.split('/').pop() || 'unknown';
  }

  /**
   * 确保项目 .evo 目录结构存在
   */
  ensureProjectStructure(): void {
    const evoDir = join(this.projectRoot, '.ornn');
    const dirs = [
      join(evoDir, 'skills'),
      join(evoDir, 'state'),
      join(evoDir, 'config'),
    ];

    for (const dir of dirs) {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    }

    logger.debug('Project structure ensured', { projectRoot: this.projectRoot });
  }

  /**
   * 关闭数据库连接
   */
  close(): void {
    this.db.close();
  }
}

// 导出工厂函数
export function createShadowRegistry(projectRoot: string): ShadowRegistry {
  return new ShadowRegistry(projectRoot);
}