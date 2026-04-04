import { Command } from 'commander';
import { cliInfo } from '../../utils/cli-output.js';
import { validateSkillId } from '../../utils/path.js';
import { printErrorAndExit } from '../../utils/error-helper.js';
import { initProjectComponents } from '../../utils/cli-setup.js';
import {
  printSkillsTable,
  formatDate,
  formatRevision,
  printNoSkillsFound,
} from '../../utils/cli-formatters.js';
import { selectSkillInteractively, type SkillInfo } from '../../utils/interactive-selector.js';

interface StatusOptions {
  project: string;
  skill?: string;
  interactive?: boolean;
}

/**
 * Status 命令 — 查看当前项目 shadow skills 状态
 */
export function createStatusCommand(): Command {
  const status = new Command('status');

  status
    .description('Show status of shadow skills in current project')
    .option('-p, --project <path>', 'Project root path', process.cwd())
    .option('-s, --skill <id>', 'Show detailed status for specific skill')
    .option('-i, --interactive', 'Select skill interactively', false)
    .alias('ls')
    .alias('list')
    .action(async (options: StatusOptions) => {
      const { shadowRegistry, journalManager, projectRoot, close } =
        await initProjectComponents(options.project, 'status');

      try {
        // ── 交互式选择 ───────────────────────────────────────────────────────
        if (options.interactive && !options.skill) {
          const shadows = shadowRegistry.list();
          if (shadows.length === 0) {
            printNoSkillsFound(projectRoot);
            return;
          }

          const skillInfos: SkillInfo[] = shadows.map((s) => ({
            skillId: s.skill_id || s.skillId,
            status: s.status as string,
            lastOptimized: formatDate(s.last_optimized_at),
          }));

          const selected = await selectSkillInteractively(skillInfos, 'Select a skill to view:');
          if (!selected) {
            cliInfo('No skill selected.');
            return;
          }
          options.skill = selected;
        }

        // ── 单个 skill 详情 ───────────────────────────────────────────────
        if (options.skill) {
          if (!validateSkillId(options.skill)) {
            printErrorAndExit(
              `Invalid skill ID "${options.skill}".`,
              { operation: 'Show skill status', skillId: options.skill, projectPath: projectRoot },
              'INVALID_SKILL_ID'
            );
          }

          const shadow = shadowRegistry.get(options.skill);
          if (!shadow) {
            printErrorAndExit(
              `Shadow skill "${options.skill}" not found`,
              { operation: 'Show skill status', skillId: options.skill, projectPath: projectRoot },
              'SKILL_NOT_FOUND'
            );
          }

          const shadowId = `${options.skill}@${projectRoot}`;
          const latestRevision = journalManager.getLatestRevision(shadowId);
          const snapshots = journalManager.getSnapshots(shadowId);

          cliInfo(`\nShadow Skill: ${options.skill}`);
          cliInfo(`  Status:         ${shadow.status}`);
          cliInfo(`  Revision:       ${formatRevision(latestRevision)}`);
          cliInfo(`  Created:        ${formatDate(shadow.created_at)}`);
          cliInfo(`  Last Optimized: ${formatDate(shadow.last_optimized_at)}`);
          cliInfo(`  Snapshots:      ${snapshots.length}`);

          if (snapshots.length > 0) {
            cliInfo('\nRecent Snapshots:');
            for (const snapshot of snapshots.slice(0, 5)) {
              cliInfo(`  ${formatRevision(snapshot.revision)} — ${snapshot.timestamp}`);
            }
          }
          return;
        }

        // ── 列表视图 ─────────────────────────────────────────────────────
        const shadows = shadowRegistry.list();

        if (shadows.length === 0) {
          printNoSkillsFound(projectRoot);
          return;
        }

        cliInfo(`\nShadow Skills in ${projectRoot}:\n`);

        const rows = shadows.map((shadow) => {
          const skillId = shadow.skill_id || shadow.skillId || 'unknown';
          const shadowId = `${skillId}@${projectRoot}`;
          const latestRevision = journalManager.getLatestRevision(shadowId);
          return {
            skillId,
            status: shadow.status as string,
            revision: latestRevision,
            lastOptimized: shadow.last_optimized_at || shadow.updatedAt,
          };
        });

        printSkillsTable(rows);

        cliInfo('\nFor detailed status of a skill:');
        cliInfo('  ornn skills status --skill <skill-id>');
        cliInfo('  ornn skills status --interactive');
      } finally {
        await close();
      }
    });

  return status;
}
