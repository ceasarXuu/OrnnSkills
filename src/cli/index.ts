#!/usr/bin/env node

import { Command } from 'commander';
import { createStatusCommand } from './commands/status.js';
import { createRollbackCommand } from './commands/rollback.js';
import { createLogCommand } from './commands/log.js';
import { createDiffCommand } from './commands/diff.js';
import { createFreezeCommand, createUnfreezeCommand } from './commands/freeze.js';
import { createSyncCommand } from './commands/sync.js';
import { createDaemonCommand } from './commands/daemon.js';
import { initCommand } from '../commands/init.js';
import { logger } from '../utils/logger.js';

const program = new Command();

program
  .name('ornn')
  .description('OrnnSkills - Skill Evolution Agent')
  .version('0.1.0');

// Init 命令
program
  .command('init')
  .description('Initialize Ornn Skills in current project')
  .action(async () => {
    try {
      await initCommand(process.cwd());
    } catch (error) {
      logger.error('Failed to initialize Ornn Skills:', error);
      process.exit(1);
    }
  });

// Skills 子命令
const skills = new Command('skills')
  .description('Manage shadow skills');

skills.addCommand(createStatusCommand());
skills.addCommand(createRollbackCommand());
skills.addCommand(createLogCommand());
skills.addCommand(createDiffCommand());
skills.addCommand(createSyncCommand());
skills.addCommand(createFreezeCommand());
skills.addCommand(createUnfreezeCommand());

program.addCommand(skills);

// Daemon 命令
program.addCommand(createDaemonCommand());

// 解析命令行参数
program.parse();
