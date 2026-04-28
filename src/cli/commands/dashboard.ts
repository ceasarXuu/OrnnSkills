/**
 * Dashboard CLI Command
 *
 * ornn dashboard [--port 47432] [--no-open] [--lang en|zh]
 * 启动本地 HTTP Dashboard 服务并在浏览器中打开。
 * 若指定端口被占用，自动向后尝试最多 10 个端口。
 * 支持多语言（中英文切换）。
 */

import { Command } from 'commander';
import { spawn } from 'node:child_process';
import { createDashboardServer } from '../../dashboard/server.js';
import { cliInfo } from '../../utils/cli-output.js';
import type { Language } from '../../dashboard/i18n.js';

/** 默认端口：47432（ornn 专属，不在常见开发端口范围内）*/
const DEFAULT_PORT = 47432;

/** 端口自动 fallback 最大尝试次数 */
const MAX_PORT_ATTEMPTS = 10;

function openBrowser(url: string): void {
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

/**
 * 从 startPort 开始依次尝试，直到找到可用端口。
 * 若超过 MAX_PORT_ATTEMPTS 次均被占用则抛出错误。
 */
async function startOnAvailablePort(
  startPort: number,
  userSpecified: boolean,
  lang: Language = 'en'
): Promise<{ server: ReturnType<typeof createDashboardServer>; port: number }> {
  for (let attempt = 0; attempt < MAX_PORT_ATTEMPTS; attempt++) {
    const port = startPort + attempt;
    if (port > 65535) break;

    const server = createDashboardServer(port, lang);
    try {
      await server.start();
      if (attempt > 0) {
        // Only show the notice when we fell back from the originally requested port
        const origin = userSpecified ? `${startPort} (in use)` : `default ${startPort} (in use)`;
        cliInfo(`Port ${origin} → using port ${port}`);
      }
      return { server, port };
    } catch (err: unknown) {
      const e = err as NodeJS.ErrnoException;
      if (e.code !== 'EADDRINUSE') {
        // Non-port-conflict error — don't retry
        throw err;
      }
      // Port busy — try next
    }
  }
  throw new Error(
    `Could not find an available port in range ${startPort}–${startPort + MAX_PORT_ATTEMPTS - 1}. ` +
    `Use --port to specify a different starting port.`
  );
}

export function createDashboardCommand(): Command {
  const cmd = new Command('dashboard');

  cmd
    .description('Open the OrnnSkills dashboard in your browser')
    .option('-p, --port <number>', `Port to listen on (default: ${DEFAULT_PORT})`)
    .option('--no-open', 'Do not automatically open the browser')
    .option('--lang <en|zh>', 'Dashboard language (default: en)', 'en')
    .action(async (options: { port?: string; open: boolean; lang: string }) => {
      const userSpecified = options.port !== undefined;
      const startPort = userSpecified ? parseInt(options.port!, 10) : DEFAULT_PORT;

      if (isNaN(startPort) || startPort < 1 || startPort > 65535) {
        console.error(`Invalid port: ${options.port}`);
        process.exit(1);
      }

      const lang = options.lang === 'zh' ? 'zh' as Language : 'en' as Language;

      let server: ReturnType<typeof createDashboardServer>;
      let port: number;

      try {
        ({ server, port } = await startOnAvailablePort(startPort, userSpecified, lang));
      } catch (err) {
        console.error(`Failed to start dashboard: ${String(err)}`);
        process.exit(1);
      }

      const url = `http://localhost:${port}/v3/`;
      cliInfo(`OrnnSkills Dashboard running at ${url}`);
      cliInfo('Press Ctrl+C to stop');

      if (options.open !== false) {
        openBrowser(url);
      }

      // Graceful shutdown
      let shutdownRegistered = false;
      const shutdown = (): void => {
        if (shutdownRegistered) return;
        shutdownRegistered = true;
        void (async () => {
          cliInfo('\nShutting down dashboard...');
          await server.stop();
          process.exit(0);
        })();
      };
      process.once('SIGINT', shutdown);
      process.once('SIGTERM', shutdown);
    });

  return cmd;
}
