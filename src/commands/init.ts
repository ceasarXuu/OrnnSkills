/**
 * Ornn Init Command
 * Initialize .ornn directory structure for the project
 */

import { mkdir, access } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { logger } from '../utils/logger.js';
import { registerProject } from '../dashboard/projects-registry.js';

export interface InitOptions {
  force?: boolean;
}

export async function initCommand(
  projectPath: string = process.cwd(),
  options: InitOptions = {}
): Promise<void> {
  const normalizedProjectPath = resolve(projectPath);
  logger.info('🚀 Initializing Ornn Skills...');

  const ornnPath = join(normalizedProjectPath, '.ornn');

  // Check if already initialized
  try {
    await access(ornnPath);
    if (options.force) {
      logger.info('Force flag detected. Reinitializing...');
    } else {
      registerProject(normalizedProjectPath);
      logger.info(`Project registered: ${normalizedProjectPath}`);
      logger.warn('.ornn directory already exists. Use --force to reinitialize.');
      logger.info('To update configuration, use: ornn config');
      return;
    }
  } catch {
    // Directory doesn't exist, continue with initialization
  }

  // Create directory structure with error handling
  logger.info('Creating .ornn directory structure...');

  try {
    await mkdir(ornnPath, { recursive: true });
    await mkdir(join(ornnPath, 'skills'), { recursive: true });
    await mkdir(join(ornnPath, 'state'), { recursive: true });
    await mkdir(join(ornnPath, 'config'), { recursive: true });
    logger.info(`✓ Created ${ornnPath}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to create directory structure: ${errorMessage}`);
    throw new Error(`Initialization failed: unable to create project structure`);
  }

  logger.info('\n✅ Ornn Skills initialized successfully!');
  logger.info(`Project path: ${normalizedProjectPath}`);

  // Register project in the global dashboard registry
  try {
    registerProject(normalizedProjectPath);
  } catch {
    // Non-fatal: dashboard registry is best-effort
  }

  logger.info('\nNext steps:');
  logger.info('  1. Run "ornn config" to configure LLM provider');
  logger.info('  2. Run "ornn daemon start" to start the background daemon');
}
