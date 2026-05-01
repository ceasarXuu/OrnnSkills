/**
 * `ornn daemon start` subcommand factory.
 *
 * Extracted from src/cli/commands/daemon.ts.
 */
import { Command } from 'commander';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import ora from 'ora';

import { Daemon } from '../../../daemon/index.js';
import { cliInfo } from '../../../utils/cli-output.js';
import { printErrorAndExit } from '../../../utils/error-helper.js';
import {
  isProcessRunning,
  normalizeDashboardLang,
  readPidFile,
  removePidFile,
  resolveCliEntryPath,
  writePidFile,
} from '../../lib/daemon-helpers.js';
import {
  openBrowser,
  startDashboardServerOnAvailablePort,
  type DashboardServerInstance,
} from './dashboard-launcher.js';
import {
  DEFAULT_DASHBOARD_PORT,
  getRegisteredProjectRoots,
  resolveLaunchContext,
  type DaemonOptions,
} from './shared.js';

const __filename = fileURLToPath(import.meta.url);

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
        const registeredProjects = getRegisteredProjectRoots();

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
          if (registeredProjects.length === 0) {
            cliInfo('No projects registered yet. Daemon and dashboard are running.');
            cliInfo('Run "ornn init" inside a project later to add it to monitoring.');
          } else {
            cliInfo(`Monitoring ${registeredProjects.length} registered project(s).`);
          }

          // 启动 dashboard
          let dashboardServer: DashboardServerInstance | null = null;
          let dashboardPort: number | null = null;

          if (options.dashboard !== false) {
            const dashboardSpinner = ora('Starting dashboard...').start();
            try {
              const dashboardPortNum = parseInt(options.port, 10);
              const dashboardLang = normalizeDashboardLang(options.lang);
              ({ server: dashboardServer, port: dashboardPort } =
                await startDashboardServerOnAvailablePort(dashboardPortNum, dashboardLang));
              dashboardSpinner.succeed('Dashboard started');

              const url = `http://localhost:${dashboardPort}/v3/`;
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
