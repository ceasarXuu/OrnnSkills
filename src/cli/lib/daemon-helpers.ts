import { dirname, join, resolve, win32, posix } from 'node:path';
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import type { Language } from '../../dashboard/i18n.js';

export const GLOBAL_ORNN_DIR = join(process.env.HOME || '', '.ornn');
export const PID_FILE = join(GLOBAL_ORNN_DIR, 'daemon.pid');
export const LOG_DIR = join(GLOBAL_ORNN_DIR, 'logs');

export function getPidFilePath(_projectRoot?: string): string {
  return PID_FILE;
}

export function readPidFile(projectRoot?: string): number | null {
  const pidFile = getPidFilePath(projectRoot);
  if (!existsSync(pidFile)) return null;
  try {
    const pid = parseInt(readFileSync(pidFile, 'utf-8').trim(), 10);
    return isNaN(pid) ? null : pid;
  } catch {
    return null;
  }
}

export function writePidFile(projectRoot: string | undefined, pid: number): void {
  const pidFile = getPidFilePath(projectRoot);
  mkdirSync(dirname(pidFile), { recursive: true });
  writeFileSync(pidFile, pid.toString(), 'utf-8');
}

export function removePidFile(projectRoot?: string): void {
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

/**
 * Resolve CLI entry path in a cross-platform way.
 * Example: ".../cli/commands/daemon.js" -> ".../cli/index.js"
 */
export function resolveCliEntryPath(currentFile: string): string {
  if (currentFile.includes('\\')) {
    return win32.resolve(win32.dirname(currentFile), '..', 'index.js');
  }
  if (currentFile.includes('/')) {
    return posix.resolve(posix.dirname(currentFile), '..', 'index.js');
  }
  return resolve(dirname(currentFile), '..', 'index.js');
}

/**
 * Normalize dashboard language input.
 * Fallback to English for unknown values.
 */
export function normalizeDashboardLang(lang: string | undefined): Language {
  return lang === 'zh' ? 'zh' : 'en';
}
