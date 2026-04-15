import { Command } from 'commander';
import { cliInfo } from '../../utils/cli-output.js';
import { join, resolve } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { exec, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Daemon } from '../../daemon/index.js';
import { createDashboardServer } from '../../dashboard/server.js';
import { listProjects } from '../../dashboard/projects-registry.js';
import { printErrorAndExit } from '../../utils/error-helper.js';
import {
  readPidFile,
  writePidFile,
  removePidFile,
  isProcessRunning,
  formatUptime,
  getLogStats,
  resolveCliEntryPath,
  normalizeDashboardLang,
} from '../lib/daemon-helpers.js';
import ora from 'ora';

const __filename = fileURLToPath(import.meta.url);

interface DaemonOptions {
  project: string;
  dashboard: boolean;
  port: string;
  lang: string;
  background: boolean;
  open: boolean;
}

const DEFAULT_DASHBOARD_PORT = 47432;
const MAX_PORT_ATTEMPTS = 10;

function resolveLaunchContext(projectPath: string): string {
  return resolve(projectPath);
}

function getRegisteredProjectRoots(): string[] {
  return listProjects().map((project) => resolve(project.path));
}

function getRegisteredProjectRootsOrThrow(): string[] {
  const projectRoots = getRegisteredProjectRoots();
  if (projectRoots.length === 0) {
    throw new Error(
      'No initialized projects found. Run "ornn init" in at least one project first.'
    );
  }
  return projectRoots;
}

function openBrowser(url: string): void {
  const platform = process.platform;
  const cmd =
    platform === 'darwin'
      ? `open "${url}"`
      : platform === 'win32'
        ? `start "" "${url}"`
        : `xdg-open "${url}"`;
  exec(cmd, (err) => {
    if (err) {
      cliInfo(`Could not open browser automatically. Visit: ${url}`);
    }
  });
}

async function startDashboardServerOnAvailablePort(
  startPort: number,
  lang: 'en' | 'zh'
): Promise<{ server: ReturnType<typeof createDashboardServer>; port: number }> {
  for (let attempt = 0; attempt < MAX_PORT_ATTEMPTS; attempt++) {
    const port = startPort + attempt;
    if (port > 65535) break;

    const server = createDashboardServer(port, lang);
    try {
      await server.start();
      return { server, port };
    } catch {
      // Port in use, try next
    }
  }
  throw new Error(
    `Could not find an available port in range ${startPort}–${startPort + MAX_PORT_ATTEMPTS - 1}`
  );
}

/**
 * 创建 start 命令
 */
export function createStartCommand(): Command {
  const start = new Command('start');

  start
    .description('Start the OrnnSkills daemon')
    .option('-p, --project <path>', 'Project root path', process.cwd())
    .option('--no-dashboard', 'Do not start the dashboard')
    .option('--port <number>', 'Dashboard port (default: 47432)', String(DEFAULT_DASHBOARD_PORT))
    .option('--lang <en|zh>', 'Dashboard language', 'en')
    .option('--no-open', 'Do not automatically open the browser')
    .option('--background', 'Run in background and release terminal', false)
    .action(async (options: DaemonOptions): Promise<void> => {
      try {
        const launchContext = resolveLaunchContext(options.project);
        const registeredProjects = getRegisteredProjectRootsOrThrow();

        // 检查是否已经在运行
        const existingPid = readPidFile();
        if (existingPid && isProcessRunning(existingPid)) {
          cliInfo(`Daemon is already running (PID: ${existingPid})`);
          cliInfo(`Use "ornn daemon status" to check status.`);
          process.exit(0);
        }

        // 如果指定了 --background，则 spawn 一个 detached 子进程
        if (options.background) {
          const dashboardLang = normalizeDashboardLang(options.lang);
          const args = ['start'];
          if (options.dashboard === false) args.push('--no-dashboard');
          if (options.port) args.push('--port', options.port);
          if (options.lang) args.push('--lang', dashboardLang);
          if (options.open === false) args.push('--no-open');

          const child = spawn(process.execPath, [resolveCliEntryPath(__filename), ...args], {
            detached: true,
            stdio: 'ignore',
          });
          child.unref();

          cliInfo('Daemon starting in background...');
          cliInfo('Use "ornn daemon status" to check status.');
          process.exit(0);
          return;
        }

        // 如果 PID 文件存在但进程不在运行，清理旧文件
        if (existingPid) {
          removePidFile();
        }

        // 使用进度指示器
        const spinner = ora('Starting OrnnSkills daemon...').start();

        try {
          // 创建并启动 daemon
          const daemon = new Daemon(launchContext);

          spinner.text = 'Initializing daemon components...';
          await daemon.start();

          // 写入 PID 文件
          writePidFile(undefined, process.pid);

          spinner.succeed('Daemon started');
          cliInfo(`Monitoring ${registeredProjects.length} registered project(s).`);

          // 启动 dashboard
          let dashboardServer: ReturnType<typeof createDashboardServer> | null = null;
          let dashboardPort: number | null = null;

          if (options.dashboard !== false) {
            const dashboardSpinner = ora('Starting dashboard...').start();
            try {
              const dashboardPortNum = parseInt(options.port, 10);
              const dashboardLang = normalizeDashboardLang(options.lang);
              ({ server: dashboardServer, port: dashboardPort } =
                await startDashboardServerOnAvailablePort(dashboardPortNum, dashboardLang));
              dashboardSpinner.succeed('Dashboard started');

              const url = `http://localhost:${dashboardPort}`;
              cliInfo(`Dashboard URL: ${url}`);

              if (options.open !== false) {
                openBrowser(url);
              }
            } catch (dashboardError) {
              dashboardSpinner.warn('Failed to start dashboard');
              cliInfo(
                `Dashboard error: ${dashboardError instanceof Error ? dashboardError.message : String(dashboardError)}`
              );
            }
          }

          // 设置信号处理以支持 Ctrl+C 退出
          const handleShutdown = (): void => {
            const cleanup = async () => {
              if (dashboardServer) {
                await dashboardServer.stop();
              }
              await daemon.stop();
              removePidFile();
            };

            void cleanup()
              .then(() => {
                process.exit(0);
              })
              .catch(() => {
                removePidFile();
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
        printErrorAndExit(error instanceof Error ? error.message : String(error), {
          operation: 'Start daemon',
          projectPath: options.project,
        });
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
              removePidFile();
            } else {
              // 强制 kill
              try {
                process.kill(pid, 'SIGKILL');
                spinner.succeed('Daemon stopped');
              } catch {
                spinner.fail('Failed to stop daemon');
              }
              removePidFile();
            }
          }
        }, 1000);
      } catch (error) {
        printErrorAndExit(error instanceof Error ? error.message : String(error), {
          operation: 'Stop daemon',
          projectPath: options.project,
        });
      }
    });

  return stop;
}

/**
 * 创建 restart 命令
 */
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
        getRegisteredProjectRootsOrThrow();

        // 停止现有 daemon
        const existingPid = readPidFile();
        if (existingPid && isProcessRunning(existingPid)) {
          const spinner = ora(`Stopping daemon (PID: ${existingPid})...`).start();
          process.kill(existingPid, 'SIGTERM');

          let attempts = 0;
          const maxAttempts = 5;
          await new Promise<void>((resolve) => {
            const interval = setInterval(() => {
              attempts++;
              if (!isProcessRunning(existingPid) || attempts >= maxAttempts) {
                clearInterval(interval);
                if (isProcessRunning(existingPid)) {
                  try {
                    process.kill(existingPid, 'SIGKILL');
                  } catch {
                    // ignore
                  }
                }
                removePidFile();
                spinner.succeed('Daemon stopped');
                resolve();
              }
            }, 1000);
          });
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

function buildArgs(options: DaemonOptions): string[] {
  const args: string[] = [];
  const dashboardLang = normalizeDashboardLang(options.lang);
  if (options.dashboard === false) args.push('--no-dashboard');
  if (options.port) args.push('--port', options.port);
  if (options.lang) args.push('--lang', dashboardLang);
  if (options.open === false) args.push('--no-open');
  if (options.background) args.push('--background');
  return args;
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

/**
 * 创建 daemon 主命令
 */
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
