import { Command } from 'commander';
import { basename, join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { validateProjectPath } from '../../utils/path.js';
import { printErrorAndExit } from '../../utils/error-helper.js';
import { buildShadowId } from '../../utils/parse.js';
import { createShadowRegistry } from '../../core/shadow-registry/index.js';
import { createJournalManager } from '../../core/journal/index.js';
import {
  readPidFile,
  isProcessRunning,
  formatUptime,
  getLogStats,
} from '../lib/daemon-helpers.js';

const CHECKPOINT_FILE = '.ornn/state/daemon-checkpoint.json';

interface StatusOptions {
  project: string;
}

function log(msg: string): void {
  console.log(msg);
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

        log('\n📊 OrnnSkills Status');
        log(`   Project: ${projectName}`);
        log(`   Path:   ${projectRoot}`);

        if (!existsSync(ornnDir)) {
          log('\n   🔴 Not initialized');
          log('');
          log('   Run "ornn init" to get started.');
          return;
        }

        const pid = readPidFile(projectRoot);
        if (!pid || !isProcessRunning(pid)) {
          if (pid) {
            log('\n   🟡 Daemon: Stopped (stale PID cleaned)');
          } else {
            log('\n   🔴 Daemon: Not running');
          }
          log('');
          log('   Start with: ornn start');
        } else {
          let uptime = 'unknown';
          try {
            const cpPath = join(projectRoot, CHECKPOINT_FILE);
            if (existsSync(cpPath)) {
              const cp = JSON.parse(readFileSync(cpPath, 'utf-8')) as { startedAt?: string };
              uptime = formatUptime(cp.startedAt ?? '');
            }
          } catch (_err) {
            // Ignore checkpoint read errors
          }

          const logStats = getLogStats();
          log('\n   🟢 Daemon: Running');
          log(`     PID:    ${pid}`);
          log(`     Uptime: ${uptime}`);
          if (logStats.errorCount > 0) {
            log(`     Errors: ${logStats.errorCount} recent`);
          }
        }

        try {
          const shadowRegistry = createShadowRegistry(projectRoot);
          shadowRegistry.init();
          const shadows = shadowRegistry.list();
          shadowRegistry.close();

          if (shadows.length === 0) {
            log('\n   📦 Skills: None yet');
            log('     Skills are created automatically when you use them.');
          } else {
            log(`\n   📦 Skills: ${shadows.length} shadow(s)`);

            const journalManager = createJournalManager(projectRoot);
            void journalManager.init();

            for (const shadow of shadows) {
              const skillId = shadow.skill_id || shadow.skillId || 'unknown';
              const runtime = shadow.runtime ?? 'codex';
              const shadowId = buildShadowId(skillId, projectRoot, runtime);
              const latestRevision = journalManager.getLatestRevision(shadowId);
              const lastOptimized = shadow.last_optimized_at || shadow.updatedAt
                ? new Date(shadow.last_optimized_at || shadow.updatedAt).toLocaleDateString()
                : 'Never';

              const statusIcon = shadow.status === 'active' ? '✅' :
                shadow.status === 'frozen' ? '❄️' : '⚪';

              log(`     ${statusIcon} [${runtime}] ${skillId.padEnd(22)} rev:${String(latestRevision).padStart(3)}  optimized: ${lastOptimized}`);
            }

            void journalManager.close();
          }
        } catch (_skillsError) {
          log('\n   ⚠️  Skills: Unable to load');
        }

        log('');
        log('   Quick commands:');
        log('     ornn start           Start the daemon');
        log('     ornn stop            Stop the daemon');
        log('     ornn skills status   Detailed skill info');
        log('     ornn logs            View logs');
        log('');
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
