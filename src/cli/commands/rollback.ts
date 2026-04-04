import { Command } from 'commander';
import { cliInfo } from '../../utils/cli-output.js';
import { printErrorAndExit } from '../../utils/error-helper.js';
import { initProjectComponents, validateSkillIdOrExit, getShadowOrExit } from '../lib/cli-setup.js';
import { buildShadowId } from '../../utils/parse.js';
import { confirmAction, formatRevision } from '../../utils/cli-formatters.js';

interface RollbackOptions {
  project: string;
  to?: string;
  snapshot?: boolean;
  initial?: boolean;
  force?: boolean;
}

function parseRevision(input: string): number {
  const revision = parseInt(input, 10);
  if (isNaN(revision) || revision < 0) {
    throw new Error(`Invalid revision "${input}". Must be a non-negative integer.`);
  }
  if (revision > Number.MAX_SAFE_INTEGER) {
    throw new Error(`Revision "${input}" exceeds maximum safe integer.`);
  }
  return revision;
}

/**
 * Rollback 命令 — 回滚 shadow skill 到指定版本
 */
export function createRollbackCommand(): Command {
  const rollback = new Command('rollback');

  rollback
    .description('Rollback a shadow skill to a previous version')
    .argument('<skill>', 'Skill ID to rollback')
    .option('-t, --to <revision>', 'Rollback to specific revision')
    .option('-s, --snapshot', 'Rollback to latest snapshot')
    .option('-i, --initial', 'Rollback to initial version (revision 0)')
    .option('-p, --project <path>', 'Project root path', process.cwd())
    .option('-f, --force', 'Skip confirmation prompt', false)
    .alias('revert')
    .action(async (skillId: string, options: RollbackOptions) => {
      validateSkillIdOrExit(skillId, 'Rollback skill', options.project);

      const { shadowRegistry, journalManager, projectRoot, close } =
        await initProjectComponents(options.project, 'rollback');

      try {
        const shadow = getShadowOrExit(shadowRegistry, skillId, 'Rollback skill', projectRoot);

        const shadowId = buildShadowId(skillId, projectRoot);

        // ── 确定回滚目标 ────────────────────────────────────────────────────
        let targetRevision: number | undefined;
        let rollbackDescription = '';

        if (options.initial) {
          targetRevision = 0;
          rollbackDescription = `initial version (${formatRevision(0)})`;
        } else if (options.snapshot) {
          const snapshots = journalManager.getSnapshots(shadowId);
          if (snapshots.length === 0) {
            cliInfo(`No snapshots found for "${skillId}".`);
            cliInfo(`\nTip: run "ornn skills log ${skillId}" to see available revisions.`);
            return;
          }
          const latest = snapshots[snapshots.length - 1];
          targetRevision = latest.revision;
          rollbackDescription = `latest snapshot (${formatRevision(targetRevision)})`;
        } else if (options.to) {
          try {
            targetRevision = parseRevision(options.to);
          } catch (error) {
            printErrorAndExit(
              error instanceof Error ? error.message : String(error),
              { operation: 'Rollback skill', skillId, projectPath: projectRoot },
              'INVALID_REVISION'
            );
          }
          rollbackDescription = formatRevision(targetRevision);
        } else {
          // 显示可用选项
          cliInfo(`\nAvailable rollback targets for "${skillId}":\n`);
          const snapshots = journalManager.getSnapshots(shadowId);
          if (snapshots.length === 0) {
            cliInfo('  No snapshots available yet.');
          } else {
            for (const snapshot of snapshots) {
              cliInfo(`  ${formatRevision(snapshot.revision)} — ${snapshot.timestamp}`);
            }
          }
          cliInfo('\nUsage:');
          cliInfo(`  ornn skills rollback ${skillId} --to <revision>    # specific revision`);
          cliInfo(`  ornn skills rollback ${skillId} --snapshot          # latest snapshot`);
          cliInfo(`  ornn skills rollback ${skillId} --initial           # revert to original`);
          return;
        }

        // ── 用户确认 ────────────────────────────────────────────────────────
        if (!options.force) {
          const ok = await confirmAction({
            message: `Rollback "${skillId}" to ${rollbackDescription}?`,
            warningLines: [
              `⚠️  Rolling back "${skillId}" to ${rollbackDescription}.`,
              '   This can be reversed by rolling forward again.',
            ],
          });
          if (!ok) {
            cliInfo('Rollback cancelled.');
            return;
          }
        }

        // ── 执行回滚 ────────────────────────────────────────────────────────
        cliInfo(`\nRolling back "${skillId}" to ${rollbackDescription}...`);

        if (options.snapshot) {
          const snapshots = journalManager.getSnapshots(shadowId);
          const latest = snapshots[snapshots.length - 1];
          journalManager.rollbackToSnapshot(shadowId, latest.file_path);
        } else {
          journalManager.rollback(shadowId, targetRevision);
        }

        cliInfo(`✅ Successfully rolled back to ${rollbackDescription}`);
        cliInfo(`\nRun "ornn skills status --skill ${skillId}" to verify.`);
      } finally {
        await close();
      }
    });

  return rollback;
}
