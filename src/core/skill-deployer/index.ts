/**
 * Skill Deployer
 *
 * 将优化后的 skill 部署到 runtime (Codex/Claude)
 * 支持版本头和 metadata 注入
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { createChildLogger } from '../../utils/logger.js';
import type { RuntimeType } from '../../types/index.js';
import type { SkillVersion } from '../skill-version/index.js';

const logger = createChildLogger('skill-deployer');

export interface DeployerOptions {
  runtime: RuntimeType;
  projectPath: string;
}

export interface DeployResult {
  success: boolean;
  deployedPath: string;
  version: number;
  error?: string;
}

/**
 * Skill Deployer
 *
 * Responsibilities:
 * 1. Deploy skill to runtime directory
 * 2. Inject version headers into skill content
 * 3. Handle different runtime directory structures
 */
export class SkillDeployer {
  private options: DeployerOptions;

  constructor(options: DeployerOptions) {
    this.options = options;
  }

  /**
   * Deploy a skill version to runtime
   */
  deploy(skillId: string, version: SkillVersion): DeployResult {
    logger.info(`Deploying ${skillId} v${version.version} to ${this.options.runtime}`);

    try {
      const targetPath = this.getTargetPath(skillId);
      const contentWithHeader = this.injectVersionHeader(version, skillId);

      // Ensure directory exists
      mkdirSync(dirname(targetPath), { recursive: true });

      // Write skill file
      writeFileSync(targetPath, contentWithHeader, 'utf-8');

      logger.info(`Successfully deployed ${skillId} v${version.version} to ${targetPath}`);

      return {
        success: true,
        deployedPath: targetPath,
        version: version.version,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to deploy ${skillId}:`, error);

      return {
        success: false,
        deployedPath: '',
        version: version.version,
        error: errorMsg,
      };
    }
  }

  /**
   * Get target deployment path based on runtime
   */
  private getTargetPath(skillId: string): string {
    switch (this.options.runtime) {
      case 'codex':
        return join(homedir(), '.codex', 'skills', `${skillId}.md`);

      case 'claude': {
        const projectName = this.options.projectPath.replace(/\//g, '-');
        return join(homedir(), '.claude', 'projects', projectName, 'skills', `${skillId}.md`);
      }

      case 'opencode':
        return join(homedir(), '.opencode', 'skills', `${skillId}.md`);

      default:
        throw new Error(`Unsupported runtime: ${String(this.options.runtime)}`);
    }
  }

  /**
   * Inject version header into skill content
   * Handles frontmatter (---) correctly by inserting after frontmatter
   */
  private injectVersionHeader(version: SkillVersion, skillId: string): string {
    const metadata = version.metadata;

    const header = `<!-- Ornn Version: v${version.version} -->
<!-- Origin: ${this.options.projectPath}/.ornn/skills/${skillId} -->
<!-- Runtime: ${this.options.runtime} -->
<!-- Project: ${this.options.projectPath} -->
<!-- Last Optimized: ${metadata.createdAt} -->
<!-- Optimization Reason: ${metadata.reason} -->

`;

    let content = version.content;

    // Remove existing Ornn headers first
    content = this.removeExistingHeaders(content);

    // Check for frontmatter
    const frontmatterMatch = content.match(/^---\n[\s\S]*?\n---\n/);
    if (frontmatterMatch) {
      // Insert after frontmatter
      const endOfFrontmatter = frontmatterMatch[0].length;
      return content.slice(0, endOfFrontmatter) + '\n' + header + content.slice(endOfFrontmatter);
    }

    // Add headers at the beginning
    return header + content;
  }

  /**
   * Remove existing Ornn headers from content
   */
  private removeExistingHeaders(content: string): string {
    // Match Ornn version headers (from <!-- Ornn Version: to the next blank line or other content)
    const ornnHeaderPattern = /<!-- Ornn Version: v\d+ -->\n(?:<!-- [\s\S]*? -->\n)*\n?/g;
    return content.replace(ornnHeaderPattern, '');
  }

  /**
   * Backup current skill before deployment
   */
  backup(skillId: string): string | null {
    try {
      const targetPath = this.getTargetPath(skillId);

      if (!existsSync(targetPath)) {
        logger.debug(`No existing skill to backup: ${skillId}`);
        return null;
      }

      const backupDir = join(this.options.projectPath, '.ornn', 'skills', skillId, 'backup');
      mkdirSync(backupDir, { recursive: true });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = join(backupDir, `backup-${timestamp}.md`);

      const content = readFileSync(targetPath, 'utf-8');
      writeFileSync(backupPath, content, 'utf-8');

      logger.info(`Backed up ${skillId} to ${backupPath}`);
      return backupPath;
    } catch (error) {
      logger.error(`Failed to backup ${skillId}:`, error);
      return null;
    }
  }

  /**
   * Check if skill exists in runtime
   */
  exists(skillId: string): boolean {
    try {
      const targetPath = this.getTargetPath(skillId);
      return existsSync(targetPath);
    } catch (error) {
      logger.debug('Could not check skill existence', { skillId, error });
      return false;
    }
  }

  /**
   * Read current skill content from runtime
   */
  readCurrent(skillId: string): string | null {
    try {
      const targetPath = this.getTargetPath(skillId);
      if (!existsSync(targetPath)) {
        return null;
      }
      return readFileSync(targetPath, 'utf-8');
    } catch (error) {
      logger.error(`Failed to read ${skillId}:`, error);
      return null;
    }
  }

  /**
   * Get deployment target path for a skill
   */
  getDeploymentPath(skillId: string): string {
    return this.getTargetPath(skillId);
  }
}

/**
 * Create a SkillDeployer instance
 */
export function createSkillDeployer(options: DeployerOptions): SkillDeployer {
  return new SkillDeployer(options);
}
