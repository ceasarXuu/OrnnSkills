import { spawn } from 'node:child_process';
import { createDashboardServer } from '../../../dashboard/server.js';
import { cliInfo } from '../../../utils/cli-output.js';

export interface DashboardServerInstance {
  start: () => Promise<void>;
  stop: () => Promise<void>;
}

export interface StartDashboardServerOptions {
  createServer?: (port: number, lang: 'en' | 'zh') => DashboardServerInstance;
  maxAttempts?: number;
}

export function openBrowser(url: string): void {
  const platform = process.platform;
  const command = platform === 'darwin' ? 'open'
    : platform === 'win32' ? 'cmd'
    : 'xdg-open';
  const args = platform === 'win32'
    ? ['/c', 'start', '', url]
    : [url];

  const child = spawn(command, args, { detached: true, stdio: 'ignore' });
  child.on('error', () => {
    cliInfo(`Could not open browser automatically. Visit: ${url}`);
  });
  child.unref();
}

export async function startDashboardServerOnAvailablePort(
  startPort: number,
  lang: 'en' | 'zh',
  options: StartDashboardServerOptions = {},
): Promise<{ server: DashboardServerInstance; port: number }> {
  const createServer = options.createServer ?? createDashboardServer;
  const maxAttempts = options.maxAttempts ?? 10;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const port = startPort + attempt;
    if (port > 65535) break;

    const server = createServer(port, lang);
    try {
      await server.start();
      return { server, port };
    } catch {
      // Port in use, try next.
    }
  }

  throw new Error(
    `Could not find an available port in range ${startPort}–${startPort + maxAttempts - 1}`
  );
}
