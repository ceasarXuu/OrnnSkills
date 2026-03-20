#!/usr/bin/env node

import { Command } from 'commander';
import { createStatusCommand } from './commands/status.js';
import { createRollbackCommand } from './commands/rollback.js';
import { createLogCommand } from './commands/log.js';
import { createDiffCommand } from './commands/diff.js';
import { createFreezeCommand, createUnfreezeCommand } from './commands/freeze.js';

const program = new Command();

program
  .name('evo')
  .description('EVO Skills - Skill Evolution Agent')
  .version('0.1.0');

// Skills 子命令
const skills = new Command('skills')
  .description('Manage shadow skills');

skills.addCommand(createStatusCommand());
skills.addCommand(createRollbackCommand());
skills.addCommand(createLogCommand());
skills.addCommand(createDiffCommand());
skills.addCommand(createFreezeCommand());
skills.addCommand(createUnfreezeCommand());

program.addCommand(skills);

// 解析命令行参数
program.parse();
