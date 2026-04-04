import { join } from 'node:path';
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';

export const PID_FILE = '.ornn/daemon.pid';
export const LOG_DIR = join(process.env.HOME || '', '.ornn', 'logs');

export function getPidFilePath(projectRoot: string): string {
  return join(projectRoot, PID_FILE);
}

export function readPidFile(projectRoot: string): number | null {
  const pidFile = getPidFilePath(projectRoot);
  if (!existsSync(pidFile)) return null;
  try {
    const pid = parseInt(readFileSync(pidFile, 'utf-8').trim(), 10);
    return isNaN(pid) ? null : pid;
  } catch {
    return null;
  }
}

export function writePidFile(projectRoot: string, pid: number): void {
  writeFileSync(getPidFilePath(projectRoot), pid.toString(), 'utf-8');
}

export function removePidFile(projectRoot: string): void {
  const pidFile = getPidFilePath(projectRoot);
  if (existsSync(pidFile)) {
    try {
      unlinkSync(pidFile);
    } catch {
      // ignore removal errors
    }
  }
}

export function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * 格式化运行时长，精度到秒。
 * startedAt 为空或无效时返回 'unknown'。
 */
export function formatUptime(startedAt?: string): string {
  if (!startedAt) return 'unknown';
  const diff = Date.now() - new Date(startedAt).getTime();
  if (isNaN(diff) || diff < 0) return 'unknown';

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
  if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

export function getLogStats(): { errorCount: number; warningCount: number } {
  if (!existsSync(LOG_DIR)) return { errorCount: 0, warningCount: 0 };
  try {
    const errorLogPath = join(LOG_DIR, 'error.log');
    if (!existsSync(errorLogPath)) return { errorCount: 0, warningCount: 0 };
    const content = readFileSync(errorLogPath, 'utf-8');
    const errorCount = content.split('\n').filter((line) => line.includes('ERROR')).length;
    return { errorCount, warningCount: 0 };
  } catch {
    return { errorCount: 0, warningCount: 0 };
  }
}
