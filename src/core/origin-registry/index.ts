import { readdirSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { createChildLogger } from '../../utils/logger.js';
import { hashFile } from '../../utils/hash.js';
import { expandHome, isDirectory, isFile } from '../../utils/path.js';
import { configManager } from '../../config/index.js';
import type { OriginSkill } from '../../types/index.js';

const logger = createChildLogger('origin-registry');

/**
 * Origin Skill 注册表
 * 负责扫描和管理用户本机已安装的 skills
 */
export class OriginRegistry {
  private skills: Map<string, OriginSkill> = new Map();
  private lastScanTime: number = 0;

  /**
   * 扫描所有配置的 skill 目录
   */
  scan(): OriginSkill[] {
    const paths = configManager.getOriginPaths();
    const allSkills: OriginSkill[] = [];

    for (const skillPath of paths) {
      const expandedPath = expandHome(skillPath);
      if (!existsSync(expandedPath)) {
        logger.debug(`Skill path not found: ${expandedPath}`);
        continue;
      }

      try {
        const skills = this.scanDirectory(expandedPath);
        allSkills.push(...skills);
      } catch (error) {
        logger.warn(`Failed to scan directory: ${expandedPath}`, { error });
      }
    }

    // 更新内部缓存
    this.skills.clear();
    for (const skill of allSkills) {
      this.skills.set(skill.skill_id, skill);
    }

    this.lastScanTime = Date.now();
    logger.info(`Scanned ${allSkills.length} origin skills`);

    return allSkills;
  }

  /**
   * 扫描单个目录
   */
  private scanDirectory(dirPath: string): OriginSkill[] {
    const skills: OriginSkill[] = [];

    if (!isDirectory(dirPath)) {
      return skills;
    }

    const entries = readdirSync(dirPath);

    for (const entry of entries) {
      const fullPath = join(dirPath, entry);

      // 检查是否是目录（skill 通常是目录形式）
      if (isDirectory(fullPath)) {
        const skill = this.readSkillFromDirectory(fullPath, entry);
        if (skill) {
          skills.push(skill);
        }
      }
      // 或者是单个 .md 文件
      else if (entry.endsWith('.md') && isFile(fullPath)) {
        const skillId = basename(entry, '.md');
        const skill = this.readSkillFromFile(fullPath, skillId);
        if (skill) {
          skills.push(skill);
        }
      }
    }

    return skills;
  }

  /**
   * 从目录读取 skill
   */
  private readSkillFromDirectory(dirPath: string, skillId: string): OriginSkill | null {
    try {
      // 查找主要的 skill 文件（通常是 current.md 或 skill.md）
      const possibleFiles = ['current.md', 'skill.md', `${skillId}.md`];
      let mainFile: string | null = null;

      for (const filename of possibleFiles) {
        const filePath = join(dirPath, filename);
        if (isFile(filePath)) {
          mainFile = filePath;
          break;
        }
      }

      if (!mainFile) {
        logger.debug(`No skill file found in directory: ${dirPath}`);
        return null;
      }

      const version = hashFile(mainFile);
      const now = new Date().toISOString();

      return {
        skill_id: skillId,
        origin_path: dirPath,
        origin_version: version,
        source: this.detectSource(dirPath),
        installed_at: now,
        last_seen_at: now,
      };
    } catch (error) {
      logger.warn(`Failed to read skill from directory: ${dirPath}`, { error });
      return null;
    }
  }

  /**
   * 从文件读取 skill
   */
  private readSkillFromFile(filePath: string, skillId: string): OriginSkill | null {
    try {
      const version = hashFile(filePath);
      const now = new Date().toISOString();

      return {
        skill_id: skillId,
        origin_path: filePath,
        origin_version: version,
        source: this.detectSource(filePath),
        installed_at: now,
        last_seen_at: now,
      };
    } catch (error) {
      logger.warn(`Failed to read skill from file: ${filePath}`, { error });
      return null;
    }
  }

  /**
   * 检测 skill 来源
   */
  private detectSource(path: string): 'local' | 'marketplace' | 'git' {
    if (path.includes('.git') || path.includes('github')) {
      return 'git';
    }
    if (path.includes('marketplace') || path.includes('registry')) {
      return 'marketplace';
    }
    return 'local';
  }

  /**
   * 获取指定 skill
   */
  get(skillId: string): OriginSkill | null {
    return this.skills.get(skillId) ?? null;
  }

  /**
   * 获取所有 skills
   */
  list(): OriginSkill[] {
    return Array.from(this.skills.values());
  }

  /**
   * 检查 skill 是否有更新
   */
  checkUpdate(skillId: string): boolean {
    const skill = this.skills.get(skillId);
    if (!skill) {
      return false;
    }

    try {
      const currentVersion = hashFile(skill.origin_path);
      return currentVersion !== skill.origin_version;
    } catch {
      return false;
    }
  }

  /**
   * 读取 origin skill 内容
   */
  async readContent(skillId: string): Promise<string | null> {
    const skill = this.skills.get(skillId);
    if (!skill) {
      return null;
    }

    try {
      const { readFileSync } = await import('node:fs');
      
      // 如果是目录，查找主文件
      if (isDirectory(skill.origin_path)) {
        const possibleFiles = ['current.md', 'skill.md', `${skillId}.md`];
        for (const filename of possibleFiles) {
          const filePath = join(skill.origin_path, filename);
          if (isFile(filePath)) {
            return readFileSync(filePath, 'utf-8');
          }
        }
      }
      // 如果是文件，直接读取
      else if (isFile(skill.origin_path)) {
        return readFileSync(skill.origin_path, 'utf-8');
      }

      return null;
    } catch (error) {
      logger.warn(`Failed to read skill content: ${skillId}`, { error });
      return null;
    }
  }

  /**
   * 刷新单个 skill 的版本信息
   */
  refreshSkill(skillId: string): OriginSkill | null {
    const skill = this.skills.get(skillId);
    if (!skill) {
      return null;
    }

    try {
      const newVersion = hashFile(skill.origin_path);
      skill.origin_version = newVersion;
      skill.last_seen_at = new Date().toISOString();
      return skill;
    } catch (error) {
      logger.warn(`Failed to refresh skill: ${skillId}`, { error });
      return null;
    }
  }

  /**
   * 获取上次扫描时间
   */
  getLastScanTime(): number {
    return this.lastScanTime;
  }

  /**
   * 检查是否需要重新扫描
   */
  needsRescan(): boolean {
    const scanInterval = 3600 * 1000; // 1 小时
    return Date.now() - this.lastScanTime > scanInterval;
  }
}

// 导出单例实例
export const originRegistry = new OriginRegistry();