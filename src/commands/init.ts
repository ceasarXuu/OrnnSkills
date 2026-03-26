/**
 * Ornn Init Command
 * Initialize .ornn directory structure for the project
 */

import { mkdir, access } from 'node:fs/promises';
import { join } from 'node:path';
import { logger } from '../utils/logger.js';
import { runConfigWizard } from '../config/wizard.js';

export async function initCommand(projectPath: string = process.cwd()): Promise<void> {
  logger.info('🚀 Initializing Ornn Skills...');

  const ornnPath = join(projectPath, '.ornn');

  // Check if already initialized
  try {
    await access(ornnPath);
    logger.warn('.ornn directory already exists. Skipping initialization.');
    return;
  } catch {
    // Directory doesn't exist, continue with initialization
  }

  // Create directory structure with error handling
  logger.info('Creating .ornn directory structure...');

  try {
    await mkdir(ornnPath, { recursive: true });
    await mkdir(join(ornnPath, 'skills'), { recursive: true });
    logger.info(`✓ Created ${ornnPath}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to create directory structure: ${errorMessage}`);
    throw new Error(`Initialization failed: unable to create project structure`);
  }

  // Run configuration wizard
  logger.info('\n📝 Configuration Wizard');
  await runConfigWizard(projectPath);

  logger.info('\n✅ Ornn Skills initialized successfully!');
  logger.info(`Project path: ${projectPath}`);
  logger.info('Run "ornn start" to begin skill evolution.');
}
