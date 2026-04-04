import { Command } from 'commander';
import { cliInfo } from '../../utils/cli-output.js';
import { join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { Daemon } from '../../daemon/index.js';
import { printErrorAndExit } from '../../utils/error-helper.js';
import { validateProjectRootOrExit } from '../lib/cli-setup.js';
import {
  readPidFile,
  writePidFile,
  removePidFile,
  isProcessRunning,
  formatUptime,
  getLogStats,
} from '../lib/daemon-helpers.js';
import ora from 'ora';

interface DaemonOptions {
  project: string;
}

/**
 * 创建 start 命令
 */
export function createStartCommand(): Command {
  const start = new Command('start');

  start
    .description('Start the OrnnSkills daemon')
    .option('-p, --project <path>', 'Project root path', process.cwd())
    .action(async (options: DaemonOptions): Promise<void> => {
      try {
          const projectRoot = validateProjectRootOrExit(options.project, 'daemon start');

          // 检查是否已经在运行
          const existingPid = readPidFile(projectRoot);
          if (existingPid && isProcessRunning(existingPid)) {
            cliInfo(`Daemon is already running (PID: ${existingPid})`);
            cliInfo(`Use "ornn daemon status" to check status.`);
            process.exit(0);
          }

          // 如果 PID 文件存在但进程不在运行，清理旧文件
          if (existingPid) {
            removePidFile(projectRoot);
          }

          // 使用进度指示器
          const spinner = ora('Starting OrnnSkills daemon...').start();

          try {
            // 创建并启动 daemon
            const daemon = new Daemon(projectRoot);

            spinner.text = 'Initializing daemon components...';
            await daemon.start();

            // 写入 PID 文件
            writePidFile(projectRoot, process.pid);

            spinner.succeed('Daemon started');

            // 设置信号处理以支持 Ctrl+C 退出
            const handleShutdown = (): void => {
              void daemon
                .stop()
                .then(() => {
                  removePidFile(projectRoot);
                  process.exit(0);
                })
                .catch(() => {
                  removePidFile(projectRoot);
                  process.exit(1);
                });
            };

            process.on('SIGINT', handleShutdown);
            process.on('SIGTERM', handleShutdown);

            // 保持进程运行 - 使用 setInterval 代替 stdin.resume() 以避免阻塞 SIGINT
            const keepAlive = setInterval(() => {}, 1000);

            // 清理定时器当收到退出信号时
            process.on('exit', () => {
              clearInterval(keepAlive);
            });
          } catch (startError) {
            spinner.fail('Failed to start daemon');
            throw startError;
          }
      } catch (error) {
        printErrorAndExit(
          error instanceof Error ? error.message : String(error),
          { operation: 'Start daemon', projectPath: options.project }
        );
      }
    });

  return start;
}

/**
 * 创建 stop 命令
 */
export function createStopCommand(): Command {
  const stop = new Command('stop');

  stop
    .description('Stop the OrnnSkills daemon')
    .option('-p, --project <path>', 'Project root path', process.cwd())
    .action((options: DaemonOptions) => {
      try {
        const projectRoot = validateProjectRootOrExit(options.project, 'daemon stop');

        // 读取 PID
        const pid = readPidFile(projectRoot);
        if (!pid) {
          cliInfo('Daemon is not running (no PID file found)');
          process.exit(0);
        }

        // 检查进程是否在运行
        if (!isProcessRunning(pid)) {
          cliInfo('Daemon is not running (stale PID file)');
          removePidFile(projectRoot);
          process.exit(0);
        }

        const spinner = ora(`Stopping daemon (PID: ${pid})...`).start();

        // 发送 SIGTERM 信号
        process.kill(pid, 'SIGTERM');

        // 等待进程退出（最多 5 秒）
        let attempts = 0;
        const maxAttempts = 5;
        const interval = setInterval(() => {
          attempts++;
          if (!isProcessRunning(pid) || attempts >= maxAttempts) {
            clearInterval(interval);
            if (!isProcessRunning(pid)) {
              spinner.succeed('Daemon stopped');
              removePidFile(projectRoot);
            } else {
              // 强制 kill
              try {
                process.kill(pid, 'SIGKILL');
                spinner.succeed('Daemon stopped');
              } catch {
                spinner.fail('Failed to stop daemon');
              }
              removePidFile(projectRoot);
            }
          }
        }, 1000);
      } catch (error) {
        printErrorAndExit(
          error instanceof Error ? error.message : String(error),
          { operation: 'Stop daemon', projectPath: options.project }
        );
      }
    });

  return stop;
}

/**
 * 读取检查点文件获取统计信息
 */
function readCheckpointStats(
  projectRoot: string
): { processedTraces: number; startedAt: string } | null {
  const checkpointPath = join(projectRoot, '.ornn', 'state', 'daemon-checkpoint.json');
  if (!existsSync(checkpointPath)) {
    return null;
  }

  try {
    const data = JSON.parse(readFileSync(checkpointPath, 'utf-8')) as Record<string, unknown>;
    return {
      processedTraces: (data.processedTraces as number) || 0,
      startedAt:
        (data.startedAt as string) || (data.started_at as string) || new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

/**
 * 读取优化统计信息
 */
function readOptimizationStats(projectRoot: string): {
  currentState: string;
  currentSkillId: string | null;
  lastOptimizationAt: string | null;
  lastError: string | null;
  queueSize: number;
} | null {
  const checkpointPath = join(projectRoot, '.ornn', 'state', 'daemon-checkpoint.json');
  if (!existsSync(checkpointPath)) {
    return null;
  }

  try {
    const data = JSON.parse(readFileSync(checkpointPath, 'utf-8')) as Record<string, unknown>;
    if (data.optimizationStatus) {
      return data.optimizationStatus as {
        currentState: string;
        currentSkillId: string | null;
        lastOptimizationAt: string | null;
        lastError: string | null;
        queueSize: number;
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * 创建 status 命令
 */
export function createDaemonStatusCommand(): Command {
  const status = new Command('status');

  status
    .description('Check daemon status')
    .option('-p, --project <path>', 'Project root path', process.cwd())
    .action((options: DaemonOptions) => {
      try {
        const projectRoot = validateProjectRootOrExit(options.project, 'daemon status');

        // 读取 PID
        const pid = readPidFile(projectRoot);
        if (!pid) {
          cliInfo('\n🔴 Daemon status: Not running');
          cliInfo('');
          cliInfo('   The daemon is not currently active.');
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
          removePidFile(projectRoot);
          cliInfo('   Cleaned up stale PID file.');
          cliInfo('   To start the daemon, run:');
          cliInfo('     $ ornn daemon start');
          cliInfo('');
          process.exit(0);
        }

        // 读取统计信息
        const stats = readCheckpointStats(projectRoot);
        const logStats = getLogStats();
        const optimizationStats = readOptimizationStats(projectRoot);

        // 显示增强的状态信息
        cliInfo('\n🟢 Daemon status: Running');
        cliInfo('');
        cliInfo('   Process:');
        cliInfo(`     PID:        ${pid}`);
        cliInfo(`     Project:    ${projectRoot}`);
        if (stats) {
          cliInfo(`     Uptime:     ${formatUptime(stats.startedAt)}`);
        }
        cliInfo('');

        if (stats) {
          cliInfo('   Activity:');
          cliInfo(`     Traces processed: ${stats.processedTraces.toLocaleString()}`);
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

/**
 * 创建 daemon 主命令
 */
export function createDaemonCommand(): Command {
  const daemon = new Command('daemon');

  daemon
    .description('Manage the OrnnSkills background daemon')
    .addCommand(createStartCommand())
    .addCommand(createStopCommand())
    .addCommand(createDaemonStatusCommand());

  return daemon;
}
