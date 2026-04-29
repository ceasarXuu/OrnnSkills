/**
 * `ornn daemon status` subcommand factory.
 *
 * Extracted from src/cli/commands/daemon.ts.
 */
import { Command } from 'commander';

import { cliInfo } from '../../../utils/cli-output.js';
import { printErrorAndExit } from '../../../utils/error-helper.js';
import {
  formatUptime,
  getLogStats,
  isProcessRunning,
  readPidFile,
  removePidFile,
} from '../../lib/daemon-helpers.js';
import { readCheckpointStats, readOptimizationStats } from './status-reader.js';
import {
  getRegisteredProjectRoots,
  resolveLaunchContext,
  type DaemonOptions,
} from './shared.js';

export function createDaemonStatusCommand(): Command {
  const status = new Command('status');

  status
    .description('Check daemon status')
    .option('-p, --project <path>', 'Project root path', process.cwd())
    .action((options: DaemonOptions) => {
      try {
        const registeredProjects = getRegisteredProjectRoots();
        const requestedProject = resolveLaunchContext(options.project);
        const selectedProject =
          registeredProjects.find((projectRoot) => projectRoot === requestedProject) ??
          registeredProjects[0] ??
          requestedProject;

        // 读取 PID
        const pid = readPidFile();
        if (!pid) {
          cliInfo('\n🔴 Daemon status: Not running');
          cliInfo('');
          cliInfo('   The daemon is not currently active.');
          if (registeredProjects.length === 0) {
            cliInfo('   No initialized projects are registered yet.');
          } else {
            cliInfo(`   Registered projects: ${registeredProjects.length}`);
          }
          cliInfo('');
          cliInfo('   To start the daemon, run:');
          cliInfo('     $ ornn daemon start');
          cliInfo('');
          process.exit(0);
        }

        // 检查进程是否在运行
        if (!isProcessRunning(pid)) {
          cliInfo('\n🟡 Daemon status: Not running (stale PID file)');
          cliInfo('');
          cliInfo('   The daemon was not properly shut down.');
          cliInfo('');
          removePidFile();
          cliInfo('   Cleaned up stale PID file.');
          cliInfo('   To start the daemon, run:');
          cliInfo('     $ ornn daemon start');
          cliInfo('');
          process.exit(0);
        }

        // 读取统计信息
        const stats = readCheckpointStats(selectedProject);
        const logStats = getLogStats();
        const optimizationStats = readOptimizationStats(selectedProject);
        const totalProcessedTraces = registeredProjects.reduce((sum, projectRoot) => {
          return sum + (readCheckpointStats(projectRoot)?.processedTraces ?? 0);
        }, 0);

        // 显示增强的状态信息
        cliInfo('\n🟢 Daemon status: Running');
        cliInfo('');
        cliInfo('   Process:');
        cliInfo(`     PID:        ${pid}`);
        cliInfo(`     Projects:   ${registeredProjects.length}`);
        cliInfo(`     Selected:   ${selectedProject}`);
        if (stats) {
          cliInfo(`     Uptime:     ${formatUptime(stats.startedAt)}`);
        }
        cliInfo('');

        if (registeredProjects.length > 0) {
          cliInfo('   Activity:');
          cliInfo(`     Total traces processed: ${totalProcessedTraces.toLocaleString()}`);
          if (stats) {
            cliInfo(`     Selected project traces: ${stats.processedTraces.toLocaleString()}`);
          }
          cliInfo('');
        }

        if (optimizationStats) {
          cliInfo('   Optimization:');
          cliInfo(`     State:        ${optimizationStats.currentState}`);
          if (optimizationStats.currentSkillId) {
            cliInfo(`     Current skill: ${optimizationStats.currentSkillId}`);
          }
          if (optimizationStats.queueSize > 0) {
            cliInfo(`     Queue size:   ${optimizationStats.queueSize}`);
          }
          if (optimizationStats.lastOptimizationAt) {
            cliInfo(
              `     Last optimized: ${new Date(optimizationStats.lastOptimizationAt).toLocaleString()}`
            );
          }
          cliInfo('');

          if (optimizationStats.lastError) {
            cliInfo('   ⚠️  Optimization Issues:');
            cliInfo(`     Last error: ${optimizationStats.lastError}`);
            cliInfo('');
            cliInfo('   🔧 Troubleshooting:');
            cliInfo('     $ ornn logs --level error');
            cliInfo('     $ ornn skills status');
            cliInfo('');
          }
        }

        if (logStats.errorCount > 0) {
          cliInfo('   Health:');
          cliInfo(`     Recent errors: ${logStats.errorCount}`);
          cliInfo(`     Check logs: ~/.ornn/logs/error.log`);
          cliInfo('');
        }

        cliInfo('   Quick commands:');
        cliInfo('     $ ornn skills status     # View skill optimization status');
        cliInfo('     $ ornn daemon stop        # Stop the daemon');
        cliInfo('     $ ornn skills log <skill> # View evolution logs');
        cliInfo('');

        cliInfo('   The daemon is actively analyzing traces and optimizing skills.');
        cliInfo('');
      } catch (error) {
        printErrorAndExit(
          error instanceof Error ? error.message : String(error),
          { operation: 'Check daemon status' },
          undefined
        );
      }
    });

  return status;
}
