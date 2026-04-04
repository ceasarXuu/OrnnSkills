/**
 * CLI 项目初始化公共工具
 *
 * 消除 8 个 CLI 命令中重复的 try-catch 项目路径验证和组件初始化样板代码。
 */

import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { validateProjectPath } from './path.js';
import { printErrorAndExit } from './error-helper.js';
import { createShadowRegistry } from '../core/shadow-registry/index.js';
import { createJournalManager } from '../core/journal/index.js';

/**
 * 验证项目路径安全性，并确认 .ornn 目录存在。
 * 任何验证失败都会打印友好错误并退出进程。
 *
 * @param projectPath  用户传入的项目路径（来自 --project 选项）
 * @param operation    操作描述，用于错误消息
 * @returns  验证通过的绝对项目根路径
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

/**
 * 初始化后的组件集合（带有资源关闭方法）
 */
export interface ProjectComponents {
  shadowRegistry: ReturnType<typeof createShadowRegistry>;
  journalManager: ReturnType<typeof createJournalManager>;
  projectRoot: string;
  /** 关闭所有组件，释放资源 */
  close: () => Promise<void>;
}

/**
 * 验证项目路径并初始化常用组件（shadowRegistry + journalManager）。
 * 任何初始化失败都会打印友好错误并退出进程。
 *
 * @param projectPath  用户传入的项目路径
 * @param operation    操作描述，用于错误消息
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
 * 仅需要 shadowRegistry（不需要 journalManager）的轻量版初始化。
 */
export interface RegistryOnlyComponents {
  shadowRegistry: ReturnType<typeof createShadowRegistry>;
  projectRoot: string;
  close: () => void;
}

export function initRegistryOnly(
  projectPath: string,
  operation: string
): RegistryOnlyComponents {
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
