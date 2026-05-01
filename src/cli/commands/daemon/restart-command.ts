/**
 * `ornn daemon restart` subcommand factory.
 *
 * Extracted from src/cli/commands/daemon.ts.
 */
import { Command } from 'commander';
import ora from 'ora';

import { cliInfo } from '../../../utils/cli-output.js';
import { printErrorAndExit } from '../../../utils/error-helper.js';
import {
  isProcessRunning,
  readPidFile,
  removePidFile,
} from '../../lib/daemon-helpers.js';
import { stopDaemonProcess } from './process-manager.js';
import { createStartCommand } from './start-command.js';
import {
  DEFAULT_DASHBOARD_PORT,
  buildArgs,
  resolveLaunchContext,
  type DaemonOptions,
} from './shared.js';

export function createRestartCommand(): Command {
  const restart = new Command('restart');

  restart
    .description('Restart the OrnnSkills daemon')
    .option('-p, --project <path>', 'Project root path', process.cwd())
    .option('--no-dashboard', 'Do not start the dashboard')
    .option('--port <number>', 'Dashboard port (default: 47432)', String(DEFAULT_DASHBOARD_PORT))
    .option('--lang <en|zh>', 'Dashboard language', 'en')
    .option('--no-open', 'Do not automatically open the browser')
    .option('--background', 'Run in background and release terminal', false)
    .action(async (options: DaemonOptions): Promise<void> => {
      try {
        const launchContext = resolveLaunchContext(options.project);

        // 停止现有 daemon
        const existingPid = readPidFile();
        if (existingPid && isProcessRunning(existingPid)) {
          const spinner = ora(`Stopping daemon (PID: ${existingPid})...`).start();
          await stopDaemonProcess(existingPid, {
            isProcessRunning,
            sendSignal: (processId, signal) => {
              process.kill(processId, signal);
            },
          });
          removePidFile();
          spinner.succeed('Daemon stopped');
        } else if (existingPid) {
          removePidFile();
        }

        // 等待端口释放
        await new Promise((resolve) => setTimeout(resolve, 500));

        // 启动新 daemon
        cliInfo('Starting new daemon instance...');
        const startOptions = {
          project: launchContext,
          dashboard: options.dashboard,
          port: options.port,
          lang: options.lang,
          open: options.open,
          background: options.background,
        };

        const startCmd = createStartCommand();
        await startCmd.parseAsync(buildArgs(startOptions), { from: 'user' });
      } catch (error) {
        printErrorAndExit(error instanceof Error ? error.message : String(error), {
          operation: 'Restart daemon',
          projectPath: options.project,
        });
      }
    });

  return restart;
}
