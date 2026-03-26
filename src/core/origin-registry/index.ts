/**
 * Origin Registry
 *
 * 管理技能的原始版本（Origin）备份。
 * Origin 是技能首次被 Ornn 发现时的版本，用于回滚和对比。
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'fs';
import { join } from 'path';
import { createChildLogger } from '../../utils/logger.js';
import { hashContent } from '../../utils/hash.js';

const logger = createChildLogger('origin-registry');

export interface OriginEntry {
  skillId: string;
  skillPath: string;
  content: string;
  contentHash: string;
  discoveredAt: string;
  runtime: string;
  // Backward compatibility aliases (snake_case)
  origin_path?: string;
}

export interface OriginRegistryOptions {
  projectPath: string;
}

/**
 * Origin Registry
 *
 * Responsibilities:
 * 1. Backup original skill content when first discovered
 * 2. Store origin metadata (path, hash, timestamp)
 * 3. Provide origin retrieval for rollback
 * 4. Track which skills have been backed up
 */
export class OriginRegistry {
  private options: Required<OriginRegistryOptions>;
  private originsDir: string;
  private indexPath: string;
  private index: Map<string, OriginEntry> = new Map();
  private initialized = false;

  constructor(options: OriginRegistryOptions) {
    this.options = {
      ...options,
    };
    this.originsDir = join(this.options.projectPath, '.ornn', 'origins');
    this.indexPath = join(this.originsDir, 'index.json');
  }

  /**
   * Initialize the registry
   */
  init(): void {
    if (this.initialized) return;

    // Ensure directory exists
    if (!existsSync(this.originsDir)) {
      mkdirSync(this.originsDir, { recursive: true });
    }

    // Load index if exists
    this.loadIndex();

    this.initialized = true;
    logger.info('Origin Registry initialized');
  }

  /**
   * Load index from disk
   */
  private loadIndex(): void {
    if (!existsSync(this.indexPath)) {
      this.index = new Map();
      return;
    }

    try {
      const data = readFileSync(this.indexPath, 'utf-8');
      const entries: OriginEntry[] = JSON.parse(data);
      this.index = new Map(entries.map((e) => [e.skillId, e]));
      logger.debug(`Loaded ${entries.length} origin entries from index`);
    } catch (error) {
      logger.error('Failed to load origin index:', error);
      this.index = new Map();
    }
  }

  /**
   * Save index to disk
   */
  private saveIndex(): void {
    try {
      const entries = Array.from(this.index.values());
      writeFileSync(this.indexPath, JSON.stringify(entries, null, 2), 'utf-8');
      logger.debug(`Saved ${entries.length} origin entries to index`);
    } catch (error) {
      logger.error('Failed to save origin index:', error);
      throw error;
    }
  }

  /**
   * Get origin file path for a skill
   */
  private getOriginPath(skillId: string): string {
    return join(this.originsDir, `${skillId}.md`);
  }

  /**
   * Backup a skill's origin version
   * Only backs up if not already backed up
   */
  backup(skillId: string, skillPath: string, runtime: string): OriginEntry {
    this.ensureInitialized();

    // Check if already backed up
    if (this.index.has(skillId)) {
      logger.debug(`Origin already exists for skill: ${skillId}`);
      return this.index.get(skillId)!;
    }

    // Read skill content
    if (!existsSync(skillPath)) {
      throw new Error(`Skill file not found: ${skillPath}`);
    }

    const content = readFileSync(skillPath, 'utf-8');
    const contentHash = hashContent(content);

    // Save origin copy
    const originPath = this.getOriginPath(skillId);
    writeFileSync(originPath, content, 'utf-8');

    // Create entry
    const entry: OriginEntry = {
      skillId,
      skillPath,
      content,
      contentHash,
      discoveredAt: new Date().toISOString(),
      runtime,
    };

    // Add backward compatibility properties
    entry.origin_path = entry.skillPath;

    // Update index
    this.index.set(skillId, entry);
    this.saveIndex();

    logger.info(`Backed up origin for skill: ${skillId}`);
    return entry;
  }

  /**
   * Get origin entry for a skill
   */
  get(skillId: string): OriginEntry | undefined {
    this.ensureInitialized();

    const entry = this.index.get(skillId);
    if (!entry) return undefined;

    // Load latest content from file
    const originPath = this.getOriginPath(skillId);
    if (existsSync(originPath)) {
      entry.content = readFileSync(originPath, 'utf-8');
    }

    return entry;
  }

  /**
   * Check if origin exists for a skill
   */
  has(skillId: string): boolean {
    this.ensureInitialized();
    return this.index.has(skillId);
  }

  /**
   * Get origin content for a skill
   */
  getContent(skillId: string): string | undefined {
    const entry = this.get(skillId);
    return entry?.content;
  }

  /**
   * Get origin hash for a skill
   */
  getHash(skillId: string): string | undefined {
    const entry = this.index.get(skillId);
    return entry?.contentHash;
  }

  /**
   * Get all origin entries
   */
  getAll(): OriginEntry[] {
    this.ensureInitialized();
    return Array.from(this.index.values());
  }

  /**
   * Get origin count
   */
  count(): number {
    this.ensureInitialized();
    return this.index.size;
  }

  /**
   * Restore origin to a target path
   */
  restore(skillId: string, targetPath?: string): boolean {
    this.ensureInitialized();

    const entry = this.index.get(skillId);
    if (!entry) {
      logger.warn(`No origin found for skill: ${skillId}`);
      return false;
    }

    const originPath = this.getOriginPath(skillId);
    if (!existsSync(originPath)) {
      logger.error(`Origin file not found: ${originPath}`);
      return false;
    }

    const restorePath = targetPath || entry.skillPath;

    try {
      copyFileSync(originPath, restorePath);
      logger.info(`Restored origin for skill ${skillId} to: ${restorePath}`);
      return true;
    } catch (error) {
      logger.error(`Failed to restore origin for skill ${skillId}:`, error);
      return false;
    }
  }

  /**
   * Compare current skill with origin
   */
  compare(skillId: string, currentContent: string): {
    changed: boolean;
    originHash: string;
    currentHash: string;
  } {
    this.ensureInitialized();

    const originHash = this.getHash(skillId);
    const currentHash = hashContent(currentContent);

    if (!originHash) {
      return {
        changed: true,
        originHash: '',
        currentHash,
      };
    }

    return {
      changed: originHash !== currentHash,
      originHash,
      currentHash,
    };
  }

  /**
   * Delete an origin entry
   */
  delete(skillId: string): boolean {
    this.ensureInitialized();

    const entry = this.index.get(skillId);
    if (!entry) return false;

    // Delete origin file
    const originPath = this.getOriginPath(skillId);
    if (existsSync(originPath)) {
      const fs = require('fs');
      fs.unlinkSync(originPath);
    }

    // Remove from index
    this.index.delete(skillId);
    this.saveIndex();

    logger.info(`Deleted origin for skill: ${skillId}`);
    return true;
  }

  /**
   * Clear all origins
   */
  clear(): void {
    this.ensureInitialized();

    // Delete all origin files
    for (const skillId of this.index.keys()) {
      const originPath = this.getOriginPath(skillId);
      if (existsSync(originPath)) {
        const fs = require('fs');
        fs.unlinkSync(originPath);
      }
    }

    // Clear index
    this.index.clear();
    this.saveIndex();

    logger.info('Cleared all origins');
  }

  /**
   * Ensure registry is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      this.init();
    }
  }

  // ===== Backward Compatibility Methods =====

  /**
   * Scan for origins - backward compatibility (no-op)
   */
  scan(): void {
    this.ensureInitialized();
    // No-op: origins are tracked via index
  }

  /**
   * Read origin content - backward compatibility
   */
  async readContent(skillId: string): Promise<string | undefined> {
    return this.getContent(skillId);
  }
}

/**
 * Create an OriginRegistry instance
 */
export function createOriginRegistry(options: OriginRegistryOptions): OriginRegistry {
  return new OriginRegistry(options);
}

/**
 * Singleton instance for backward compatibility
 */
export const originRegistry = new OriginRegistry({ projectPath: process.cwd() });
