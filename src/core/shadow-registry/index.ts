/**
 * Shadow Registry
 *
 * 管理技能的 shadow 状态，用于追踪技能优化过程中的中间状态。
 * Shadow 技能是优化中的临时版本，不会直接部署到运行时。
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
  readdirSync,
  renameSync,
} from 'fs';
import { join } from 'path';
import { createChildLogger } from '../../utils/logger.js';
import type { RuntimeType } from '../../types/index.js';

const logger = createChildLogger('shadow-registry');

export interface ShadowEntry {
  skillId: string;
  runtime?: RuntimeType;
  version: string;
  content: string;
  status: 'pending' | 'analyzing' | 'optimized' | 'deployed' | 'discarded' | 'frozen' | 'active';
  createdAt: string;
  updatedAt: string;
  traceCount: number;
  analysisResult?: {
    summary: string;
    confidence: number;
    suggestions: string[];
  };
  // Backward compatibility aliases (snake_case)
  skill_id?: string;
  created_at?: string;
  last_optimized_at?: string;
  current_revision?: number;
}

export interface ShadowRegistryOptions {
  projectPath: string;
}

/**
 * Shadow Registry
 *
 * Responsibilities:
 * 1. Store shadow versions of skills during optimization
 * 2. Track optimization status and progress
 * 3. Manage shadow lifecycle (create → analyze → deploy/discard)
 * 4. Provide atomic operations for shadow management
 */
export class ShadowRegistry {
  private options: Required<ShadowRegistryOptions>;
  private shadowsDir: string;
  private indexPath: string;
  private index: Map<string, ShadowEntry> = new Map();
  /** 内容缓存：避免每次 get() 都重新从磁盘读取文件（N+1 读盘）。
   *  updateContent() / create() 时同步更新缓存，close() 时清理。 */
  private contentCache: Map<string, string> = new Map();
  private initialized = false;

  private normalizeRuntime(runtime?: RuntimeType): RuntimeType {
    return runtime ?? 'codex';
  }

  private buildScopedKey(skillId: string, runtime?: RuntimeType): string {
    return `${this.normalizeRuntime(runtime)}::${skillId}`;
  }

  private resolveScopedKey(skillId: string, runtime?: RuntimeType): string | null {
    if (runtime) {
      const key = this.buildScopedKey(skillId, runtime);
      return this.index.has(key) ? key : null;
    }

    const codexKey = this.buildScopedKey(skillId, 'codex');
    if (this.index.has(codexKey)) {
      return codexKey;
    }

    for (const key of this.index.keys()) {
      if (key.endsWith(`::${skillId}`)) {
        return key;
      }
    }
    return null;
  }

  constructor(options: ShadowRegistryOptions) {
    this.options = {
      ...options,
    };
    this.shadowsDir = join(this.options.projectPath, '.ornn', 'shadows');
    this.indexPath = join(this.shadowsDir, 'index.json');
  }

  /**
   * Initialize the registry
   */
  init(): void {
    if (this.initialized) return;

    // Ensure directory exists
    if (!existsSync(this.shadowsDir)) {
      mkdirSync(this.shadowsDir, { recursive: true });
    }

    // Load index if exists
    this.loadIndex();
    this.migrateLegacyFlatShadowFiles();

    this.initialized = true;
    logger.debug('Shadow Registry initialized');
  }

  /**
   * 迁移旧版平铺 shadow 文件结构：
   * .ornn/shadows/<skill>.md -> .ornn/shadows/codex/<skill>.md
   */
  private migrateLegacyFlatShadowFiles(): void {
    let moved = 0;
    let skipped = 0;

    try {
      const entries = readdirSync(this.shadowsDir, { withFileTypes: true });
      const codexDir = join(this.shadowsDir, 'codex');
      mkdirSync(codexDir, { recursive: true });

      for (const entry of entries) {
        if (!entry.isFile()) continue;
        if (!entry.name.endsWith('.md')) continue;

        const oldPath = join(this.shadowsDir, entry.name);
        const newPath = join(codexDir, entry.name);

        if (existsSync(newPath)) {
          skipped++;
          continue;
        }

        renameSync(oldPath, newPath);
        moved++;
      }
    } catch (error) {
      logger.warn('Legacy shadow file migration failed', { error });
      return;
    }

    if (moved > 0 || skipped > 0) {
      logger.info('Legacy shadow file migration completed', { moved, skipped });
    }
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
      const entries = JSON.parse(data) as ShadowEntry[];
      this.index = new Map(
        entries.map((e) => [
          this.buildScopedKey(e.skillId, this.normalizeRuntime(e.runtime)),
          { ...e, runtime: this.normalizeRuntime(e.runtime) },
        ])
      );
      logger.debug(`Loaded ${entries.length} shadow entries from index`);
    } catch (error) {
      logger.error('Failed to load shadow index:', error);
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
      logger.debug(`Saved ${entries.length} shadow entries to index`);
    } catch (error) {
      logger.error('Failed to save shadow index:', error);
      throw error;
    }
  }

  /**
   * Get shadow file path
   */
  private getShadowPath(skillId: string, runtime?: RuntimeType): string {
    const rt = this.normalizeRuntime(runtime);
    return join(this.shadowsDir, rt, `${skillId}.md`);
  }

  /**
   * Create a new shadow entry
   */
  create(skillId: string, content: string, version: string, runtime?: RuntimeType): ShadowEntry {
    this.ensureInitialized();
    const rt = this.normalizeRuntime(runtime);

    const now = new Date().toISOString();
    const entry: ShadowEntry = {
      skillId,
      runtime: rt,
      version,
      content,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      traceCount: 0,
    };

    // Save content to file
    const shadowPath = this.getShadowPath(skillId, rt);
    mkdirSync(join(this.shadowsDir, rt), { recursive: true });
    writeFileSync(shadowPath, content, 'utf-8');

    // Update index and content cache
    const key = this.buildScopedKey(skillId, rt);
    this.index.set(key, entry);
    this.contentCache.set(key, content);
    this.saveIndex();

    logger.info(`Created shadow for skill: ${skillId} (version: ${version})`);
    return entry;
  }

  /**
   * Get a shadow entry.
   * Content is served from an in-memory cache to avoid repeated disk reads.
   */
  get(skillId: string, runtime?: RuntimeType): ShadowEntry | undefined {
    this.ensureInitialized();

    const key = this.resolveScopedKey(skillId, runtime);
    if (!key) return undefined;
    const entry = this.index.get(key);
    if (!entry) return undefined;

    // Serve content from cache; fall back to disk only on first access
    if (!this.contentCache.has(key)) {
      const shadowPath = this.getShadowPath(entry.skillId, entry.runtime);
      if (existsSync(shadowPath)) {
        const content = readFileSync(shadowPath, 'utf-8');
        this.contentCache.set(key, content);
        entry.content = content;
      }
    } else {
      entry.content = this.contentCache.get(key)!;
    }

    // Add backward compatibility properties
    entry.skill_id = entry.skillId;
    entry.created_at = entry.createdAt;
    entry.last_optimized_at = entry.updatedAt;
    entry.current_revision = entry.traceCount;

    return entry;
  }

  /**
   * Check if shadow exists
   */
  has(skillId: string, runtime?: RuntimeType): boolean {
    this.ensureInitialized();
    return this.resolveScopedKey(skillId, runtime) !== null;
  }

  /**
   * Update shadow content
   */
  updateContent(skillId: string, content: string, runtime?: RuntimeType): ShadowEntry | undefined {
    this.ensureInitialized();

    const key = this.resolveScopedKey(skillId, runtime);
    if (!key) return undefined;
    const entry = this.index.get(key);
    if (!entry) return undefined;

    // Update content file
    const shadowPath = this.getShadowPath(entry.skillId, entry.runtime);
    mkdirSync(join(this.shadowsDir, this.normalizeRuntime(entry.runtime)), { recursive: true });
    writeFileSync(shadowPath, content, 'utf-8');

    // Update entry and content cache
    entry.content = content;
    entry.updatedAt = new Date().toISOString();

    this.index.set(key, entry);
    this.contentCache.set(key, content);
    this.saveIndex();

    logger.debug(`Updated shadow content for skill: ${skillId}`);
    return entry;
  }

  /**
   * Update shadow status
   */
  updateStatus(
    skillId: string,
    status: ShadowEntry['status'],
    runtime?: RuntimeType
  ): ShadowEntry | undefined {
    this.ensureInitialized();

    const key = this.resolveScopedKey(skillId, runtime);
    if (!key) return undefined;
    const entry = this.index.get(key);
    if (!entry) return undefined;

    entry.status = status;
    entry.updatedAt = new Date().toISOString();

    this.index.set(key, entry);
    this.saveIndex();

    logger.info(`Updated shadow status for ${skillId}: ${status}`);
    return entry;
  }

  /**
   * Update analysis result
   */
  updateAnalysis(
    skillId: string,
    analysisResult: ShadowEntry['analysisResult'],
    runtime?: RuntimeType
  ): ShadowEntry | undefined {
    this.ensureInitialized();

    const key = this.resolveScopedKey(skillId, runtime);
    if (!key) return undefined;
    const entry = this.index.get(key);
    if (!entry) return undefined;

    entry.analysisResult = analysisResult;
    entry.updatedAt = new Date().toISOString();

    this.index.set(key, entry);
    this.saveIndex();

    logger.debug(`Updated analysis result for skill: ${skillId}`);
    return entry;
  }

  /**
   * Increment trace count
   */
  incrementTraceCount(skillId: string, runtime?: RuntimeType): ShadowEntry | undefined {
    this.ensureInitialized();

    const key = this.resolveScopedKey(skillId, runtime);
    if (!key) return undefined;
    const entry = this.index.get(key);
    if (!entry) return undefined;

    entry.traceCount++;
    entry.updatedAt = new Date().toISOString();

    this.index.set(key, entry);
    this.saveIndex();

    return entry;
  }

  /**
   * Get all shadow entries
   */
  getAll(): ShadowEntry[] {
    this.ensureInitialized();
    return Array.from(this.index.values());
  }

  /**
   * Get shadows by status
   */
  getByStatus(status: ShadowEntry['status']): ShadowEntry[] {
    this.ensureInitialized();
    return Array.from(this.index.values()).filter((e) => e.status === status);
  }

  /**
   * Get pending shadows
   */
  getPending(): ShadowEntry[] {
    return this.getByStatus('pending');
  }

  /**
   * Get analyzing shadows
   */
  getAnalyzing(): ShadowEntry[] {
    return this.getByStatus('analyzing');
  }

  /**
   * Get optimized shadows
   */
  getOptimized(): ShadowEntry[] {
    return this.getByStatus('optimized');
  }

  /**
   * Delete a shadow entry
   */
  delete(skillId: string, runtime?: RuntimeType): boolean {
    this.ensureInitialized();

    const key = this.resolveScopedKey(skillId, runtime);
    if (!key) return false;
    const entry = this.index.get(key);
    if (!entry) return false;

    // Delete content file
    const shadowPath = this.getShadowPath(entry.skillId, entry.runtime);
    if (existsSync(shadowPath)) {
      unlinkSync(shadowPath);
    }

    // Remove from index and cache
    this.index.delete(key);
    this.contentCache.delete(key);
    this.saveIndex();

    logger.info(`Deleted shadow for skill: ${skillId}`);
    return true;
  }

  /**
   * Clear all shadows
   */
  clear(): void {
    this.ensureInitialized();

    // Delete all shadow files
    for (const entry of this.index.values()) {
      const shadowPath = this.getShadowPath(entry.skillId, entry.runtime);
      if (existsSync(shadowPath)) {
        unlinkSync(shadowPath);
      }
    }

    // Clear index
    this.index.clear();
    this.saveIndex();

    logger.info('Cleared all shadows');
  }

  /**
   * Promote shadow to deployed status
   */
  promote(skillId: string, runtime?: RuntimeType): ShadowEntry | undefined {
    this.ensureInitialized();

    const key = this.resolveScopedKey(skillId, runtime);
    if (!key) return undefined;
    const entry = this.index.get(key);
    if (!entry) return undefined;

    entry.status = 'deployed';
    entry.updatedAt = new Date().toISOString();

    this.index.set(key, entry);
    this.saveIndex();

    logger.info(`Promoted shadow to deployed: ${skillId}`);
    return entry;
  }

  /**
   * Discard a shadow
   */
  discard(skillId: string, runtime?: RuntimeType): ShadowEntry | undefined {
    this.ensureInitialized();

    const key = this.resolveScopedKey(skillId, runtime);
    if (!key) return undefined;
    const entry = this.index.get(key);
    if (!entry) return undefined;

    entry.status = 'discarded';
    entry.updatedAt = new Date().toISOString();

    this.index.set(key, entry);
    this.saveIndex();

    logger.info(`Discarded shadow: ${skillId}`);
    return entry;
  }

  /**
   * Get shadow statistics
   */
  getStats(): {
    total: number;
    byStatus: Record<'pending' | 'analyzing' | 'optimized' | 'deployed' | 'discarded', number>;
    totalTraces: number;
  } {
    this.ensureInitialized();

    const entries = Array.from(this.index.values());
    const byStatus: Record<
      'pending' | 'analyzing' | 'optimized' | 'deployed' | 'discarded',
      number
    > = {
      pending: 0,
      analyzing: 0,
      optimized: 0,
      deployed: 0,
      discarded: 0,
    };

    let totalTraces = 0;

    for (const entry of entries) {
      // Map 'frozen' and 'active' to valid status for stats
      const status =
        entry.status === 'frozen' || entry.status === 'active' ? 'pending' : entry.status;
      byStatus[status]++;
      totalTraces += entry.traceCount;
    }

    return {
      total: entries.length,
      byStatus,
      totalTraces,
    };
  }

  /**
   * Ensure registry is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      this.init();
    }
  }

  /**
   * Clean up old discarded shadows
   */
  cleanup(maxAgeDays: number = 7): number {
    this.ensureInitialized();

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);

    let deletedCount = 0;
    const entriesToDelete: string[] = [];

    for (const [key, entry] of this.index.entries()) {
      if (entry.status === 'discarded' || entry.status === 'deployed') {
        const updatedAt = new Date(entry.updatedAt);
        if (updatedAt < cutoffDate) {
          entriesToDelete.push(key);
        }
      }
    }

    for (const scopedKey of entriesToDelete) {
      const parts = scopedKey.split('::');
      if (parts.length !== 2) continue;
      this.delete(parts[1], parts[0] as RuntimeType);
      deletedCount++;
    }

    if (deletedCount > 0) {
      logger.info(`Cleaned up ${deletedCount} old shadows`);
    }

    return deletedCount;
  }

  // ===== Backward Compatibility Methods =====

  /**
   * Async init for backward compatibility
   */
  initAsync(): void {
    this.init();
  }

  /**
   * Read shadow content - backward compatibility
   */
  readContent(skillId: string, runtime?: RuntimeType): string | undefined {
    return this.get(skillId, runtime)?.content;
  }

  /**
   * Write shadow content - backward compatibility
   */
  writeContent(skillId: string, content: string, runtime?: RuntimeType): void {
    this.updateContent(skillId, content, runtime);
  }

  /**
   * List all shadows - backward compatibility
   */
  list(): ShadowEntry[] {
    return this.getAll();
  }

  /**
   * Close registry - clears in-memory caches to free resources.
   */
  close(): void {
    this.contentCache.clear();
    logger.debug('Shadow registry closed');
  }
}

/**
 * Create a ShadowRegistry instance
 */
export function createShadowRegistry(options: ShadowRegistryOptions | string): ShadowRegistry {
  if (typeof options === 'string') {
    // Backward compatibility: accept projectPath as string
    return new ShadowRegistry({ projectPath: options });
  }
  return new ShadowRegistry(options);
}
