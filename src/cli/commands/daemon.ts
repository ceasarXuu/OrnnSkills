import { Command } from 'commander';
import { join } from 'node:path';
import { existsSync, writeFileSync, readFileSync, unlinkSync } from 'node:fs';
import { Daemon } from '../../daemon/index.js';
import { validateProjectPath } from '../../utils/path.js';

const PID_FILE = '.ornn/daemon.pid';

interface DaemonOptions {
  project: string;
}

/**
 * 获取 PID 文件路径
 */
function getPidFilePath(projectRoot: string): string {
  return join(projectRoot, PID_FILE);
}

/**
 * 读取 PID 文件
 */
function readPidFile(projectRoot: string): number | null {
  const pidFile = getPidFilePath(projectRoot);
  if (!existsSync(pidFile)) {
    return null;
  }
  try {
    const pid = parseInt(readFileSync(pidFile, 'utf-8').trim(), 10);
    return isNaN(pid) ? null : pid;
  } catch {
    return null;
  }
}

/**
 * 写入 PID 文件
 */
function writePidFile(projectRoot: string, pid: number): void {
  const pidFile = getPidFilePath(projectRoot);
  writeFileSync(pidFile, pid.toString(), 'utf-8');
}

/**
 * 删除 PID 文件
 */
function removePidFile(projectRoot: string): void {
  const pidFile = getPidFilePath(projectRoot);
  if (existsSync(pidFile)) {
    try {
      unlinkSync(pidFile);
    } catch {
      // 忽略删除错误
    }
  }
}

/**
 * 检查进程是否运行
 */
function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * 创建 start 命令
 */
export function createStartCommand(): Command {
  const start = new Command('start');

  start
    .description('Start the OrnnSkills daemon')
    .option('-p, --project <path>', 'Project root path', process.cwd())
    .action(async (options: DaemonOptions) => {
      try {
        // 验证项目路径
        let projectRoot: string;
        try {
          projectRoot = validateProjectPath(options.project);
        } catch (error) {
          console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
          process.exit(1);
        }

        // 检查 .ornn 目录是否存在
        const ornnDir = join(projectRoot, '.ornn');
        if (!existsSync(ornnDir)) {
          console.error('Error: .ornn directory not found. Run "ornn init" first.');
          process.exit(1);
        }

        // 检查是否已经在运行
        const existingPid = readPidFile(projectRoot);
        if (existingPid && isProcessRunning(existingPid)) {
          console.log(`Daemon is already running (PID: ${existingPid})`);
          console.log(`Use "ornn daemon status" to check status.`);
          process.exit(0);
        }

        // 如果 PID 文件存在但进程不在运行，清理旧文件
        if (existingPid) {
          removePidFile(projectRoot);
        }

        console.log('Starting OrnnSkills daemon...');
        console.log(`Project: ${projectRoot}`);

        // 创建并启动 daemon
        const daemon = new Daemon(projectRoot);
        await daemon.start();

        // 写入 PID 文件
        writePidFile(projectRoot, process.pid);

        console.log('✓ Daemon started successfully');
        console.log(`  PID: ${process.pid}`);
        console.log(`  Project: ${projectRoot}`);
        console.log();
        console.log('The daemon is now running in the background.');
        console.log('It will automatically analyze traces and optimize skills.');
        console.log();
        console.log('Use "ornn daemon status" to check status.');
        console.log('Use "ornn daemon stop" to stop the daemon.');

        // 保持进程运行
        process.stdin.resume();
      } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : String(error));
        process.exit(1);
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
    .action(async (options: DaemonOptions) => {
      try {
        // 验证项目路径
        let projectRoot: string;
        try {
          projectRoot = validateProjectPath(options.project);
        } catch (error) {
          console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
          process.exit(1);
        }

        // 读取 PID
        const pid = readPidFile(projectRoot);
        if (!pid) {
          console.log('Daemon is not running (no PID file found)');
          process.exit(0);
        }

        // 检查进程是否在运行
        if (!isProcessRunning(pid)) {
          console.log('Daemon is not running (stale PID file)');
          removePidFile(projectRoot);
          process.exit(0);
        }

        console.log(`Stopping daemon (PID: ${pid})...`);

        // 发送 SIGTERM 信号
        process.kill(pid, 'SIGTERM');

        // 等待进程退出
        let attempts = 0;
        const maxAttempts = 30;
        const interval = setInterval(() => {
          attempts++;
          if (!isProcessRunning(pid) || attempts >= maxAttempts) {
            clearInterval(interval);
            if (!isProcessRunning(pid)) {
              console.log('✓ Daemon stopped successfully');
              removePidFile(projectRoot);
            } else {
              console.log('Daemon did not stop gracefully, forcing...');
              try {
                process.kill(pid, 'SIGKILL');
                console.log('✓ Daemon stopped');
              } catch {
                console.log('Failed to stop daemon');
              }
              removePidFile(projectRoot);
            }
          }
        }, 1000);
      } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  return stop;
}

/**
 * 创建 status 命令
 */
export function createDaemonStatusCommand(): Command {
  const status = new Command('status');

  status
    .description('Check daemon status')
    .option('-p, --project <path>', 'Project root path', process.cwd())
    .action(async (options: DaemonOptions) => {
      try {
        // 验证项目路径
        let projectRoot: string;
        try {
          projectRoot = validateProjectPath(options.project);
        } catch (error) {
          console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
          process.exit(1);
        }

        // 读取 PID
        const pid = readPidFile(projectRoot);
        if (!pid) {
          console.log('Daemon status: Not running');
          console.log();
          console.log('Use "ornn daemon start" to start the daemon.');
          process.exit(0);
        }

        // 检查进程是否在运行
        if (!isProcessRunning(pid)) {
          console.log('Daemon status: Not running (stale PID file)');
          removePidFile(projectRoot);
          console.log();
          console.log('Use "ornn daemon start" to start the daemon.');
          process.exit(0);
        }

        console.log('Daemon status: Running ✓');
        console.log(`  PID: ${pid}`);
        console.log(`  Project: ${projectRoot}`);
        console.log();
        console.log('The daemon is actively analyzing traces and optimizing skills.');
        console.log();
        console.log('Use "ornn skills status" to see skill optimization status.');
        console.log('Use "ornn daemon stop" to stop the daemon.');
      } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : String(error));
        process.exit(1);
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
