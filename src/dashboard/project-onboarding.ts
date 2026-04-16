import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { access } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initCommand } from '../commands/init.js';
import { isProcessRunning, readPidFile } from '../cli/lib/daemon-helpers.js';

export interface ProjectInitializationResult {
  projectPath: string;
  initialized: boolean;
}

export interface MonitoringDaemonResult {
  daemonStarted: boolean;
  daemonRunning: boolean;
}

const DEFAULT_DAEMON_WAIT_MS = 5000;
const DAEMON_POLL_INTERVAL_MS = 150;

function hasProjectInitialization(projectPath: string): boolean {
  return existsSync(join(projectPath, '.ornn'));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveDaemonCliEntry(): string {
  const argvEntry = process.argv[1] ? resolve(process.argv[1]) : '';
  if (argvEntry && existsSync(argvEntry)) {
    return argvEntry;
  }

  const currentFile = fileURLToPath(import.meta.url);
  const compiledCliEntry = resolve(dirname(currentFile), '..', 'cli', 'index.js');
  if (existsSync(compiledCliEntry)) {
    return compiledCliEntry;
  }

  throw new Error('Unable to resolve Ornn CLI entry for daemon startup');
}

async function waitForDaemonRunning(timeoutMs = DEFAULT_DAEMON_WAIT_MS): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const pid = readPidFile();
    if (pid && isProcessRunning(pid)) {
      return true;
    }
    await sleep(DAEMON_POLL_INTERVAL_MS);
  }
  return false;
}

export async function ensureProjectInitialized(projectPath: string): Promise<ProjectInitializationResult> {
  const normalizedProjectPath = resolve(projectPath);
  const initialized = hasProjectInitialization(normalizedProjectPath);

  if (!initialized) {
    await initCommand(normalizedProjectPath);
  } else {
    await access(normalizedProjectPath);
  }

  return {
    projectPath: normalizedProjectPath,
    initialized: !initialized,
  };
}

export async function ensureMonitoringDaemon(projectPath: string): Promise<MonitoringDaemonResult> {
  const normalizedProjectPath = resolve(projectPath);
  const existingPid = readPidFile();
  if (existingPid && isProcessRunning(existingPid)) {
    return {
      daemonStarted: false,
      daemonRunning: true,
    };
  }

  const cliEntry = resolveDaemonCliEntry();
  const entryArgs = cliEntry.endsWith('.ts')
    ? [...process.execArgv, cliEntry, 'start', '--project', normalizedProjectPath, '--no-dashboard']
    : [cliEntry, 'start', '--project', normalizedProjectPath, '--no-dashboard'];

  const child = spawn(process.execPath, entryArgs, {
    cwd: normalizedProjectPath,
    detached: true,
    stdio: 'ignore',
  });
  child.unref();

  const daemonRunning = await waitForDaemonRunning();
  if (!daemonRunning) {
    throw new Error('Timed out waiting for daemon to start monitoring');
  }

  return {
    daemonStarted: true,
    daemonRunning: true,
  };
}
