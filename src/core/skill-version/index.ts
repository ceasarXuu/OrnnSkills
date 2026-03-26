/**
 * Skill Version Manager
 *
 * 管理 skill 的版本创建、存储和检索
 * 版本结构：.ornn/skills/{skill-id}/versions/v{N}/
 */

import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, renameSync, rmdirSync, symlinkSync, unlinkSync, lstatSync } from 'node:fs';
import { join } from 'node:path';
import { createChildLogger } from '../../utils/logger.js';
import { hashContent } from '../../utils/hash.js';
import type { RuntimeType } from '../../types/index.js';

const logger = createChildLogger('skill-version');

export interface VersionMetadata {
  version: number;
  createdAt: string;
  reason: string;
  traceIds: string[];
  previousVersion: number | null;
  analyzerModel?: string;
  tokenUsage?: {
    prompt: number;
    completion: number;
    total: number;
  };
}

export interface SkillVersion {
  version: number;
  content: string;
  metadata: VersionMetadata;
  contentHash: string;
}

export interface VersionManagerOptions {
  projectPath: string;
  skillId: string;
  runtime: RuntimeType;
}

/**
 * Skill Version Manager
 *
 * Responsibilities:
 * 1. Create version directories (.ornn/skills/{skill-id}/versions/v{N}/)
 * 2. Store version content and metadata
 * 3. Retrieve specific versions
 * 4. List all versions
 */
export class SkillVersionManager {
  private options: VersionManagerOptions;
  private versionsDir: string;
  private currentVersion: number = 0;

  constructor(options: VersionManagerOptions) {
    this.options = options;
    this.versionsDir = join(
      options.projectPath,
      '.ornn',
      'skills',
      options.skillId,
      'versions'
    );

    // Ensure versions directory exists
    this.ensureDirectory();

    // Scan existing versions
    this.scanExistingVersions();
  }

  /**
   * Ensure the versions directory exists
   */
  private ensureDirectory(): void {
    if (!existsSync(this.versionsDir)) {
      mkdirSync(this.versionsDir, { recursive: true });
      logger.debug(`Created versions directory: ${this.versionsDir}`);
    }
  }

  /**
   * Scan existing versions to determine current version
   */
  private scanExistingVersions(): void {
    if (!existsSync(this.versionsDir)) {
      this.currentVersion = 0;
      return;
    }

    const entries = readdirSync(this.versionsDir, { withFileTypes: true });
    const versionDirs = entries
      .filter((entry) => entry.isDirectory() && entry.name.startsWith('v'))
      .map((entry) => parseInt(entry.name.slice(1), 10))
      .filter((num) => !isNaN(num));

    this.currentVersion = versionDirs.length > 0 ? Math.max(...versionDirs) : 0;
    logger.debug(`Scanned versions for ${this.options.skillId}: current v${this.currentVersion}`);
  }

  /**
   * Create a new version
   * Uses atomic write operations to ensure consistency
   */
  createVersion(
    content: string,
    reason: string,
    traceIds: string[],
    tokenUsage?: VersionMetadata['tokenUsage'],
    analyzerModel?: string
  ): SkillVersion {
    const newVersion = this.currentVersion + 1;
    const versionDir = join(this.versionsDir, `v${newVersion}`);

    try {
      // Create version directory
      mkdirSync(versionDir, { recursive: true });

      // Prepare metadata
      const metadata: VersionMetadata = {
        version: newVersion,
        createdAt: new Date().toISOString(),
        reason,
        traceIds,
        previousVersion: this.currentVersion > 0 ? this.currentVersion : null,
        analyzerModel,
        tokenUsage,
      };

      // Write content atomically (write to temp file first, then rename)
      const contentPath = join(versionDir, 'skill.md');
      const tempContentPath = contentPath + '.tmp';
      writeFileSync(tempContentPath, content, 'utf-8');
      renameSync(tempContentPath, contentPath);

      // Write metadata atomically
      const metadataPath = join(versionDir, 'metadata.json');
      const tempMetadataPath = metadataPath + '.tmp';
      writeFileSync(tempMetadataPath, JSON.stringify(metadata, null, 2), 'utf-8');
      renameSync(tempMetadataPath, metadataPath);

      // Update current version only after successful write
      this.currentVersion = newVersion;

      // Update latest symlink
      this.updateLatestSymlink(newVersion);

      const version: SkillVersion = {
        version: newVersion,
        content,
        metadata,
        contentHash: hashContent(content),
      };

      logger.info(`Created version v${newVersion} for skill ${this.options.skillId}`);
      return version;
    } catch (error) {
      // Clean up on failure
      try {
        if (existsSync(versionDir)) {
          rmdirSync(versionDir, { recursive: true });
        }
      } catch (cleanupError) {
        logger.warn(`Failed to clean up version directory ${versionDir}:`, cleanupError);
      }

      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to create version v${newVersion} for ${this.options.skillId}: ${errorMsg}`);
      throw new Error(`Failed to create version: ${errorMsg}`);
    }
  }

  /**
   * Update the 'latest' symlink to point to the given version
   */
  private updateLatestSymlink(version: number): void {
    const latestLink = join(this.versionsDir, 'latest');
    const targetPath = `v${version}`;

    try {
      // Remove existing symlink if it exists
      if (existsSync(latestLink)) {
        const stats = lstatSync(latestLink);
        if (stats.isSymbolicLink()) {
          unlinkSync(latestLink);
        } else {
          // If it's a directory or file, rename it to backup
          const backupPath = latestLink + '.backup';
          renameSync(latestLink, backupPath);
          logger.warn(`Renamed existing 'latest' to backup: ${backupPath}`);
        }
      }

      // Create new symlink
      symlinkSync(targetPath, latestLink);
      logger.debug(`Updated 'latest' symlink to v${version}`);
    } catch (error) {
      logger.warn(`Failed to update 'latest' symlink:`, error);
      // Non-critical error, don't throw
    }
  }

  /**
   * Get the latest version via symlink (fast path)
   */
  getLatestVersionViaSymlink(): SkillVersion | null {
    const latestLink = join(this.versionsDir, 'latest');

    if (!existsSync(latestLink)) {
      return null;
    }

    try {
      const stats = lstatSync(latestLink);
      if (!stats.isSymbolicLink()) {
        return null;
      }

      // Read the symlink target to get version number
      // Note: readlinkSync returns the target path (e.g., "v5")
      const fs = require('fs');
      const target = fs.readlinkSync(latestLink);
      const versionMatch = target.match(/v(\d+)/);

      if (versionMatch) {
        const version = parseInt(versionMatch[1], 10);
        return this.getVersion(version);
      }

      return null;
    } catch (error) {
      logger.warn(`Failed to read 'latest' symlink:`, error);
      return null;
    }
  }

  /**
   * Get a specific version
   */
  getVersion(version: number): SkillVersion | null {
    const versionDir = join(this.versionsDir, `v${version}`);

    if (!existsSync(versionDir)) {
      return null;
    }

    try {
      const contentPath = join(versionDir, 'skill.md');
      const metadataPath = join(versionDir, 'metadata.json');

      if (!existsSync(contentPath) || !existsSync(metadataPath)) {
        return null;
      }

      const content = readFileSync(contentPath, 'utf-8');
      const metadata: VersionMetadata = JSON.parse(readFileSync(metadataPath, 'utf-8'));

      return {
        version,
        content,
        metadata,
        contentHash: hashContent(content),
      };
    } catch (error) {
      logger.error(`Failed to read version v${version}:`, error);
      return null;
    }
  }

  /**
   * Get the latest version
   */
  getLatestVersion(): SkillVersion | null {
    if (this.currentVersion === 0) {
      return null;
    }
    return this.getVersion(this.currentVersion);
  }

  /**
   * List all versions
   */
  listVersions(): number[] {
    if (!existsSync(this.versionsDir)) {
      return [];
    }

    const entries = readdirSync(this.versionsDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory() && entry.name.startsWith('v'))
      .map((entry) => parseInt(entry.name.slice(1), 10))
      .filter((num) => !isNaN(num))
      .sort((a, b) => a - b);
  }

  /**
   * Get all versions with metadata
   */
  getAllVersions(): SkillVersion[] {
    const versionNumbers = this.listVersions();
    const versions: SkillVersion[] = [];

    for (const version of versionNumbers) {
      const v = this.getVersion(version);
      if (v) {
        versions.push(v);
      }
    }

    return versions;
  }

  /**
   * Get the versions directory path
   */
  getVersionsDir(): string {
    return this.versionsDir;
  }

  /**
   * Get current version number
   */
  getCurrentVersion(): number {
    return this.currentVersion;
  }

  /**
   * Check if a version exists
   */
  hasVersion(version: number): boolean {
    const versionDir = join(this.versionsDir, `v${version}`);
    return existsSync(versionDir);
  }

  /**
   * Get version directory path
   */
  getVersionDir(version: number): string {
    return join(this.versionsDir, `v${version}`);
  }
}

/**
 * Create a SkillVersionManager instance
 */
export function createSkillVersionManager(
  options: VersionManagerOptions
): SkillVersionManager {
  return new SkillVersionManager(options);
}
