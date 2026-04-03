#!/usr/bin/env node

import { Command } from 'commander';
import { createStatusCommand } from './commands/status.js';
import { createRollbackCommand } from './commands/rollback.js';
import { createLogCommand } from './commands/log.js';
import { createDiffCommand } from './commands/diff.js';
import { createFreezeCommand, createUnfreezeCommand } from './commands/freeze.js';
import { createSyncCommand } from './commands/sync.js';
import { createDaemonCommand, createStartCommand, createStopCommand } from './commands/daemon.js';
import { createLogsCommand } from './commands/logs.js';
import { createPreviewCommand } from './commands/preview.js';
import { createCompletionCommand } from './commands/completion.js';
import { createConfigCommand } from './commands/config.js';
import { createTopLevelStatusCommand } from './commands/top-level-status.js';
import { initCommand } from '../commands/init.js';
import { logger } from '../utils/logger.js';

const program = new Command();

program.name('ornn').description('OrnnSkills - Skill Evolution Agent').version('0.1.9');

// Init 命令
program
  .command('init')
  .description('Initialize Ornn Skills in current project')
  .option('-f, --force', 'Force reconfiguration even if already initialized', false)
  .action(async (options: { force?: boolean }) => {
    try {
      await initCommand(process.cwd(), { force: options.force ?? false });
    } catch (error) {
      logger.error('Failed to initialize Ornn Skills:', error);
      process.exit(1);
    }
  });

// Skills 子命令
const skills = new Command('skills').description('Manage shadow skills');

skills.addCommand(createStatusCommand());
skills.addCommand(createRollbackCommand());
skills.addCommand(createLogCommand());
skills.addCommand(createDiffCommand());
skills.addCommand(createSyncCommand());
skills.addCommand(createFreezeCommand());
skills.addCommand(createUnfreezeCommand());
skills.addCommand(createPreviewCommand());

program.addCommand(skills);

// Start 命令 (简化版 daemon start)
program.addCommand(createStartCommand());

// Stop 命令 (简化版 daemon stop)
program.addCommand(createStopCommand());

// Status 命令 (整体状态概览)
program.addCommand(createTopLevelStatusCommand());

// Daemon 命令 (完整的子命令)
program.addCommand(createDaemonCommand());

// Logs 命令
program.addCommand(createLogsCommand());

// Completion 命令
program.addCommand(createCompletionCommand());

// Config 命令
program.addCommand(createConfigCommand());

// 解析命令行参数
program.parse();
