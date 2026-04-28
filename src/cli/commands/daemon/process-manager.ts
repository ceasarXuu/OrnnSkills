import { createChildLogger } from '../../../utils/logger.js';

const logger = createChildLogger('process-manager');

export interface StopDaemonProcessOptions {
  isProcessRunning?: (pid: number) => boolean;
  sendSignal?: (pid: number, signal: NodeJS.Signals) => void;
  maxAttempts?: number;
  intervalMs?: number;
}

export interface StopDaemonProcessResult {
  stopped: boolean;
  forced: boolean;
}

export async function stopDaemonProcess(
  pid: number,
  options: StopDaemonProcessOptions = {},
): Promise<StopDaemonProcessResult> {
  const isProcessRunning = options.isProcessRunning ?? ((processId: number) => {
    try {
      process.kill(processId, 0);
      return true;
    } catch {
      return false;
    }
  });
  const sendSignal = options.sendSignal ?? ((processId: number, signal: NodeJS.Signals) => {
    process.kill(processId, signal);
  });
  const maxAttempts = options.maxAttempts ?? 5;
  const intervalMs = options.intervalMs ?? 1000;

  sendSignal(pid, 'SIGTERM');

  if (!isProcessRunning(pid)) {
    return {
      stopped: true,
      forced: false,
    };
  }

  return new Promise<StopDaemonProcessResult>((resolve) => {
    let attempts = 0;
    const interval = setInterval(() => {
      attempts += 1;
      if (!isProcessRunning(pid)) {
        clearInterval(interval);
        resolve({ stopped: true, forced: false });
        return;
      }

      if (attempts >= maxAttempts) {
        clearInterval(interval);
        try {
          sendSignal(pid, 'SIGKILL');
        } catch (error) {
          logger.warn('Failed to send SIGKILL to daemon process', { pid, error: String(error) });
          resolve({ stopped: false, forced: true });
          return;
        }
        resolve({ stopped: false, forced: true });
      }
    }, intervalMs);
  });
}
