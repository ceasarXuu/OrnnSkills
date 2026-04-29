/**
 * `ornn daemon stop` subcommand factory.
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
import type { DaemonOptions } from './shared.js';

export function createStopCommand(): Command {
  const stop = new Command('stop');

  stop
    .description('Stop the OrnnSkills daemon')
    .option('-p, --project <path>', 'Project root path', process.cwd())
    .action(async (options: DaemonOptions) => {
      try {
        // 读取 PID
        const pid = readPidFile();
        if (!pid) {
          cliInfo('Daemon is not running (no PID file found)');
          process.exit(0);
        }

        // 检查进程是否在运行
        if (!isProcessRunning(pid)) {
          cliInfo('Daemon is not running (stale PID file)');
          removePidFile();
          process.exit(0);
        }

        const spinner = ora(`Stopping daemon (PID: ${pid})...`).start();
        const result = await stopDaemonProcess(pid, {
          isProcessRunning,
          sendSignal: (processId, signal) => {
            process.kill(processId, signal);
          },
        });

        if (result.stopped || result.forced) {
          spinner.succeed('Daemon stopped');
          removePidFile();
        } else {
          spinner.fail('Failed to stop daemon');
        }
      } catch (error) {
        printErrorAndExit(error instanceof Error ? error.message : String(error), {
          operation: 'Stop daemon',
          projectPath: options.project,
        });
      }
    });

  return stop;
}
