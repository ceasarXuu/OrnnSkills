/**
 * Phase 4 Integration
 *
 * 集成 Skill Evolution 的所有组件：
 * - SkillVersionManager: 版本管理
 * - SkillDeployer: 部署到 runtime
 * - OriginRegistry: 管理 origin skills
 *
 * 处理 skill 首次调用、版本创建和部署的完整流程。
 */

import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createChildLogger } from '../utils/logger.js';
import { SkillVersionManager, createSkillVersionManager } from './skill-version/index.js';
import { SkillDeployer, createSkillDeployer } from './skill-deployer/index.js';
import { originRegistry } from './origin-registry/index.js';
import type { RuntimeType } from '../types/index.js';
import type { SkillVersion } from './skill-version/index.js';

const logger = createChildLogger('phase4-integration');

export interface Phase4IntegrationOptions {
  projectPath: string;
  runtime: RuntimeType;
  onSkillDeployed?: (skillId: string, version: number) => void;
}

export interface FirstCallResult {
  success: boolean;
  skillId: string;
  originPath: string;
  version: number;
  deployedPath?: string;
  error?: string;
}

export interface OptimizationResult {
  success: boolean;
  skillId: string;
  newVersion: number;
  deployedPath: string;
  reason: string;
  error?: string;
}

/**
 * Phase 4 Integration
 *
 * Responsibilities:
 * 1. Handle skill first call (backup origin, create v1)
 * 2. Create new versions after optimization
 * 3. Deploy skills to runtime
 * 4. Manage origin registry
 */
export class Phase4Integration {
  private options: Phase4IntegrationOptions;
  private versionManagers: Map<string, SkillVersionManager> = new Map();
  private deployer: SkillDeployer;

  constructor(options: Phase4IntegrationOptions) {
    this.options = options;
    this.deployer = createSkillDeployer({
      runtime: options.runtime,
      projectPath: options.projectPath,
    });

    logger.info('Phase 4 integration initialized');
  }

  /**
   * Validate skill ID format
   * Skill ID should only contain lowercase letters, numbers, and hyphens
   */
  private validateSkillId(skillId: string): boolean {
    return /^[a-z0-9-]+$/.test(skillId) && skillId.length > 0 && skillId.length <= 100;
  }

  /**
   * Handle skill first call
   * 1. Copy origin to .ornn/skills/{skill-id}/origin/
   * 2. Create v1 from origin
   * 3. Deploy v1 to runtime
   */
  handleFirstCall(skillId: string, originPath: string): FirstCallResult {
    logger.info(`Handling first call for skill: ${skillId}`);

    // Validate inputs
    if (!this.validateSkillId(skillId)) {
      const error = `Invalid skill ID: ${skillId}. Skill ID should only contain lowercase letters, numbers, and hyphens.`;
      logger.error(error);
      return {
        success: false,
        skillId,
        originPath,
        version: 0,
        error,
      };
    }

    try {
      // Step 1: Copy origin to .ornn/skills/{skill-id}/origin/
      const originBackupPath = this.backupOrigin(skillId, originPath);
      if (!originBackupPath) {
        throw new Error(`Failed to backup origin for ${skillId}`);
      }

      // Step 2: Read origin content
      const originContent = readFileSync(originBackupPath, 'utf-8');

      // Step 3: Create version manager for this skill
      const versionManager = this.getOrCreateVersionManager(skillId);

      // Step 4: Create v1 from origin
      const v1 = versionManager.createVersion(
        originContent,
        'Initial version from origin',
        [],
        undefined,
        undefined
      );

      // Step 5: Deploy v1 to runtime
      const deployResult = this.deployer.deploy(skillId, v1);
      if (!deployResult.success) {
        throw new Error(`Failed to deploy v1: ${deployResult.error}`);
      }

      // Step 6: Register in origin registry
      originRegistry.scan();

      logger.info(`First call handled for ${skillId}: v1 created and deployed`);

      return {
        success: true,
        skillId,
        originPath,
        version: 1,
        deployedPath: deployResult.deployedPath,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to handle first call for ${skillId}:`, error);

      return {
        success: false,
        skillId,
        originPath,
        version: 0,
        error: errorMsg,
      };
    }
  }

  /**
   * Create new version after optimization
   */
  createOptimizedVersion(
    skillId: string,
    newContent: string,
    reason: string,
    traceIds: string[],
    tokenUsage?: { prompt: number; completion: number; total: number },
    analyzerModel?: string
  ): SkillVersion | null {
    logger.info(`Creating optimized version for ${skillId}: ${reason}`);

    try {
      const versionManager = this.getOrCreateVersionManager(skillId);

      const newVersion = versionManager.createVersion(
        newContent,
        reason,
        traceIds,
        tokenUsage,
        analyzerModel
      );

      logger.info(`Created v${newVersion.version} for ${skillId}`);
      return newVersion;
    } catch (error) {
      logger.error(`Failed to create version for ${skillId}:`, error);
      return null;
    }
  }

  /**
   * Deploy a specific version to runtime
   */
  deployVersion(skillId: string, version: SkillVersion): OptimizationResult {
    logger.info(`Deploying ${skillId} v${version.version}`);

    // Backup current version before deploying
    this.deployer.backup(skillId);

    // Deploy new version
    const result = this.deployer.deploy(skillId, version);

    if (result.success) {
      logger.info(`Successfully deployed ${skillId} v${version.version}`);

      if (this.options.onSkillDeployed) {
        this.options.onSkillDeployed(skillId, version.version);
      }

      return {
        success: true,
        skillId,
        newVersion: version.version,
        deployedPath: result.deployedPath,
        reason: version.metadata.reason,
      };
    } else {
      logger.error(`Failed to deploy ${skillId} v${version.version}: ${result.error}`);

      return {
        success: false,
        skillId,
        newVersion: version.version,
        deployedPath: '',
        reason: version.metadata.reason,
        error: result.error,
      };
    }
  }

  /**
   * Backup origin skill to .ornn/skills/{skill-id}/origin/
   */
  private backupOrigin(skillId: string, originPath: string): string | null {
    try {
      // Validate origin path exists
      if (!existsSync(originPath)) {
        logger.error(`Origin path does not exist: ${originPath}`);
        return null;
      }

      const originBackupDir = join(
        this.options.projectPath,
        '.ornn',
        'skills',
        skillId,
        'origin'
      );
      mkdirSync(originBackupDir, { recursive: true });

      // Read origin content
      const content = readFileSync(originPath, 'utf-8');

      // Write to backup
      const backupPath = join(originBackupDir, 'skill.md');
      writeFileSync(backupPath, content, 'utf-8');

      logger.info(`Backed up origin for ${skillId} to ${backupPath}`);
      return backupPath;
    } catch (error) {
      logger.error(`Failed to backup origin for ${skillId}:`, error);
      return null;
    }
  }

  /**
   * Get or create version manager for a skill
   */
  private getOrCreateVersionManager(skillId: string): SkillVersionManager {
    if (!this.versionManagers.has(skillId)) {
      const manager = createSkillVersionManager({
        projectPath: this.options.projectPath,
        skillId,
        runtime: this.options.runtime,
      });
      this.versionManagers.set(skillId, manager);
    }
    return this.versionManagers.get(skillId)!;
  }

  /**
   * Get version manager for a skill
   */
  getVersionManager(skillId: string): SkillVersionManager | undefined {
    return this.versionManagers.get(skillId);
  }

  /**
   * Get deployer
   */
  getDeployer(): SkillDeployer {
    return this.deployer;
  }

  /**
   * Check if skill has versions
   */
  hasVersions(skillId: string): boolean {
    const manager = this.versionManagers.get(skillId);
    return manager ? manager.getCurrentVersion() > 0 : false;
  }

  /**
   * Get current version number for a skill
   */
  getCurrentVersion(skillId: string): number {
    const manager = this.versionManagers.get(skillId);
    return manager ? manager.getCurrentVersion() : 0;
  }

  /**
   * Get all versions for a skill
   */
  getAllVersions(skillId: string): SkillVersion[] {
    const manager = this.getOrCreateVersionManager(skillId);
    return manager.getAllVersions();
  }
}

/**
 * Create a Phase4Integration instance
 */
export function createPhase4Integration(options: Phase4IntegrationOptions): Phase4Integration {
  return new Phase4Integration(options);
}
