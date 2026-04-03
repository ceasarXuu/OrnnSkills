import { Command } from 'commander';
import { cliInfo } from '../../utils/cli-output.js';
import { join, basename } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { validateProjectPath } from '../../utils/path.js';
import { printErrorAndExit } from '../../utils/error-helper.js';
import { createShadowRegistry } from '../../core/shadow-registry/index.js';
import { createJournalManager } from '../../core/journal/index.js';

const PID_FILE = '.ornn/daemon.pid';
const CHECKPOINT_FILE = '.ornn/state/daemon-checkpoint.json';

interface StatusOptions {
  project: string;
}

function readPidFile(projectRoot: string): number | null {
  const pidFile = join(projectRoot, PID_FILE);
  if (!existsSync(pidFile)) return null;
  try {
    const pid = parseInt(readFileSync(pidFile, 'utf-8').trim(), 10);
    return isNaN(pid) ? null : pid;
  } catch {
    return null;
  }
}

function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function formatUptime(startedAt?: string): string {
  if (!startedAt) return 'unknown';
  const diff = Date.now() - new Date(startedAt).getTime();
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function getLogStats(): { errorCount: number } {
  const logPath = join(process.env.HOME || '', '.ornn', 'logs', 'error.log');
  if (!existsSync(logPath)) return { errorCount: 0 };
  try {
    const content = readFileSync(logPath, 'utf-8');
    const lines = content.split('\n').filter((l) => l.includes('ERROR:'));
    return { errorCount: lines.length };
  } catch {
    return { errorCount: 0 };
  }
}

export function createTopLevelStatusCommand(): Command {
  const status = new Command('status');

  status
    .description('Show overall OrnnSkills status (daemon + skills)')
    .option('-p, --project <path>', 'Project root path', process.cwd())
    .action((options: StatusOptions) => {
      try {
        let projectRoot: string;
        try {
          projectRoot = validateProjectPath(options.project);
        } catch (error) {
          printErrorAndExit(
            error instanceof Error ? error.message : String(error),
            { operation: 'Validate project path', projectPath: options.project },
            'PATH_TRAVERSAL'
          );
        }

        const ornnDir = join(projectRoot, '.ornn');
        const projectName = basename(projectRoot);

        // === Daemon Status ===
        cliInfo('\n📊 OrnnSkills Status');
        cliInfo(`   Project: ${projectName}`);
        cliInfo(`   Path:   ${projectRoot}`);

        if (!existsSync(ornnDir)) {
          cliInfo('\n   🔴 Not initialized');
          cliInfo('');
          cliInfo('   Run "ornn init" to get started.');
          return;
        }

        const pid = readPidFile(projectRoot);
        if (!pid || !isProcessRunning(pid)) {
          if (pid) {
            cliInfo('\n   🟡 Daemon: Stopped (stale PID cleaned)');
          } else {
            cliInfo('\n   🔴 Daemon: Not running');
          }
          cliInfo('');
          cliInfo('   Start with: ornn start');
        } else {
          let uptime = 'unknown';
          try {
            const cpPath = join(projectRoot, CHECKPOINT_FILE);
            if (existsSync(cpPath)) {
              const cp = JSON.parse(readFileSync(cpPath, 'utf-8'));
              uptime = formatUptime(cp.startedAt);
            }
          } catch {}

          const logStats = getLogStats();
          cliInfo('\n   🟢 Daemon: Running');
          cliInfo(`     PID:   ${pid}`);
          cliInfo(`     Uptime: ${uptime}`);
          if (logStats.errorCount > 0) {
            cliInfo(`     Errors: ${logStats.errorCount} recent`);
          }
        }

        // === Skills Overview ===
        try {
          const shadowRegistry = createShadowRegistry(projectRoot);
          shadowRegistry.init();
          const shadows = shadowRegistry.list();
          shadowRegistry.close();

          if (shadows.length === 0) {
            cliInfo('\n   📦 Skills: None yet');
            cliInfo('     Skills are created automatically when you use them.');
          } else {
            cliInfo(`\n   📦 Skills: ${shadows.length} shadow(s)`);

            const journalManager = createJournalManager(projectRoot);
            journalManager.init();

            for (const shadow of shadows) {
              const skillId = shadow.skill_id || shadow.skillId || 'unknown';
              const shadowId = `${skillId}@${projectRoot}`;
              const latestRevision = journalManager.getLatestRevision(shadowId);
              const lastOptimized = shadow.last_optimized_at || shadow.updatedAt
                ? new Date(shadow.last_optimized_at || shadow.updatedAt).toLocaleDateString()
                : 'Never';

              const statusIcon = shadow.status === 'active' ? '✅' :
                shadow.status === 'frozen' ? '❄️' : '⚪';

              cliInfo(`     ${statusIcon} ${skillId.padEnd(22)} rev:${String(latestRevision).padStart(3)}  optimized: ${lastOptimized}`);
            }

            journalManager.close();
          }
        } catch (skillsError) {
          cliInfo('\n   ⚠️ Skills: Unable to load');
        }

        // === Quick Commands ===
        cliInfo('');
        cliInfo('   Quick commands:');
        cliInfo('     ornn start           Start the daemon');
        cliInfo('     ornn stop            Stop the daemon');
        cliInfo('     ornn skills status   Detailed skill info');
        cliInfo('     ornn logs            View logs');
        cliInfo('');
      } catch (error) {
        printErrorAndExit(
          error instanceof Error ? error.message : String(error),
          { operation: 'Show overall status', projectPath: options.project },
          undefined
        );
      }
    });

  return status;
}
