/**
 * `ornn daemon` command group.
 *
 * The actual implementations live in src/cli/commands/daemon/*.ts; this file
 * only wires the subcommands together to keep the entry point small.
 */
import { Command } from 'commander';

import { createStartCommand } from './daemon/start-command.js';
import { createStopCommand } from './daemon/stop-command.js';
import { createRestartCommand } from './daemon/restart-command.js';
import { createDaemonStatusCommand } from './daemon/status-command.js';

export {
  createStartCommand,
  createStopCommand,
  createRestartCommand,
  createDaemonStatusCommand,
};

export function createDaemonCommand(): Command {
  const daemon = new Command('daemon');

  daemon
    .description('Manage the OrnnSkills background daemon')
    .addCommand(createStartCommand())
    .addCommand(createStopCommand())
    .addCommand(createRestartCommand())
    .addCommand(createDaemonStatusCommand());

  return daemon;
}
