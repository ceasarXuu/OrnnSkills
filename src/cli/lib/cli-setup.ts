/**
 * CLI 项目初始化公共工具（属于 CLI 层）
 *
 * 消除 CLI 命令中重复的项目路径验证和组件初始化样板代码。
 * 该文件依赖 core 层，因此放在 src/cli/lib/ 而非 src/utils/。
 */

import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { validateProjectPath, validateSkillId } from '../../utils/path.js';
import { printErrorAndExit } from '../../utils/error-helper.js';
import { createShadowRegistry } from '../../core/shadow-registry/index.js';
import type { ShadowEntry } from '../../core/shadow-registry/index.js';
import { createJournalManager } from '../../core/journal/index.js';
import type { ShadowRegistry } from '../../core/shadow-registry/index.js';
import type { RuntimeType } from '../../types/index.js';

/**
 * 验证项目路径安全性，并确认 .ornn 目录存在。
 * 任何验证失败都会打印友好错误并退出进程。
 */
export function validateProjectRootOrExit(projectPath: string, operation: string): string {
  let projectRoot: string;
  try {
    projectRoot = validateProjectPath(projectPath);
  } catch (error) {
    printErrorAndExit(
      error instanceof Error ? error.message : String(error),
      { operation: `Validate project path for "${operation}"`, projectPath },
      'PATH_TRAVERSAL'
    );
  }

  const ornnDir = join(projectRoot, '.ornn');
  if (!existsSync(ornnDir)) {
    printErrorAndExit(
      '.ornn directory not found. Run "ornn init" to set up this project.',
      { operation: `Check project initialization for "${operation}"`, projectPath: projectRoot },
      'PROJECT_NOT_INITIALIZED'
    );
  }

  return projectRoot;
}

// ─── Registry-only components ─────────────────────────────────────────────────

export interface RegistryComponents {
  shadowRegistry: ReturnType<typeof createShadowRegistry>;
  projectRoot: string;
  close: () => void;
}

/**
 * 验证项目路径并仅初始化 shadowRegistry（无 journalManager）。
 * 适用于 freeze/unfreeze/sync 等不需要 journal 的命令。
 */
export function initRegistryOnly(
  projectPath: string,
  operation: string
): RegistryComponents {
  const projectRoot = validateProjectRootOrExit(projectPath, operation);
  const shadowRegistry = createShadowRegistry(projectRoot);

  try {
    shadowRegistry.init();
  } catch (error) {
    printErrorAndExit(
      error instanceof Error ? error.message : String(error),
      { operation: `Initialize registry for "${operation}"`, projectPath: projectRoot }
    );
  }

  return {
    shadowRegistry,
    projectRoot,
    close: () => shadowRegistry.close(),
  };
}

// ─── Full project components ───────────────────────────────────────────────────

export interface ProjectComponents {
  shadowRegistry: ReturnType<typeof createShadowRegistry>;
  journalManager: ReturnType<typeof createJournalManager>;
  projectRoot: string;
  close: () => Promise<void>;
}

/**
 * 验证项目路径并初始化常用组件（shadowRegistry + journalManager）。
 * 适用于 status/log/rollback/diff/preview 等需要 journal 的命令。
 */
export async function initProjectComponents(
  projectPath: string,
  operation: string
): Promise<ProjectComponents> {
  const projectRoot = validateProjectRootOrExit(projectPath, operation);
  const shadowRegistry = createShadowRegistry(projectRoot);
  const journalManager = createJournalManager(projectRoot);

  try {
    shadowRegistry.init();
    await journalManager.init();
  } catch (error) {
    printErrorAndExit(
      error instanceof Error ? error.message : String(error),
      { operation: `Initialize components for "${operation}"`, projectPath: projectRoot }
    );
  }

  return {
    shadowRegistry,
    journalManager,
    projectRoot,
    close: async (): Promise<void> => {
      shadowRegistry.close();
      await journalManager.close();
    },
  };
}

/**
 * skillId 格式校验。不合法时打印友好错误并退出进程。
 */
export function validateSkillIdOrExit(
  skillId: string,
  operation: string,
  projectPath: string
): void {
  if (!validateSkillId(skillId)) {
    printErrorAndExit(
      `Invalid skill ID "${skillId}". Skill IDs can only contain letters, numbers, hyphens, underscores, and dots.`,
      { operation, skillId, projectPath },
      'INVALID_SKILL_ID'
    );
  }
}

/**
 * 从注册表查找 shadow skill。未找到时打印友好错误并退出进程。
 */
export function getShadowOrExit(
  shadowRegistry: ShadowRegistry,
  skillId: string,
  operation: string,
  projectPath: string,
  runtime?: RuntimeType
): ShadowEntry {
  const shadow = shadowRegistry.get(skillId, runtime);
  if (!shadow) {
    printErrorAndExit(
      `Shadow skill "${skillId}"${runtime ? ` [${runtime}]` : ''} not found`,
      { operation, skillId, runtime, projectPath },
      'SKILL_NOT_FOUND'
    );
  }
  return shadow;
}
