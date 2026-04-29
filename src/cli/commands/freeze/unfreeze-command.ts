/**
 * `ornn skills unfreeze` subcommand factory.
 *
 * Extracted from src/cli/commands/freeze.ts.
 */
import { Command } from 'commander';

import { cliInfo } from '../../../utils/cli-output.js';
import { confirmAction, printSuccess } from '../../../utils/cli-formatters.js';
import { printErrorAndExit } from '../../../utils/error-helper.js';
import {
  selectMultipleSkillsInteractively,
  showDryRunPreview,
  type SkillInfo,
} from '../../../utils/interactive-selector.js';
import {
  getShadowOrExit,
  initRegistryOnly,
  validateSkillIdOrExit,
} from '../../lib/cli-setup.js';
import { parseRuntimeOption } from '../../lib/runtime-option.js';
import { unfreezeSkillList } from './batch.js';
import type { FreezeOptions } from './shared.js';

export function createUnfreezeCommand(): Command {
  const unfreeze = new Command('unfreeze');

  unfreeze
    .description('Resume automatic optimization for a shadow skill')
    .argument('[skill]', 'Skill ID to unfreeze (use "all" to unfreeze all skills)')
    .option('-p, --project <path>', 'Project root path', process.cwd())
    .option('-r, --runtime <runtime>', 'Host scope: codex | claude | opencode')
    .option('-f, --force', 'Skip confirmation prompt', false)
    .option('--dry-run', 'Show what would be unfrozen without making changes', false)
    .option('-i, --interactive', 'Select skills interactively', false)
    .action(async (skillId: string | undefined, options: FreezeOptions) => {
      const { shadowRegistry, projectRoot, close } = initRegistryOnly(options.project, 'unfreeze');
      try {
        const runtime = parseRuntimeOption(options.runtime);
        const allShadows = shadowRegistry.list();
        const shadows = runtime
          ? allShadows.filter((s) => (s.runtime ?? 'codex') === runtime)
          : allShadows;

        if (shadows.length === 0) {
          cliInfo('No shadow skills found in this project');
          return;
        }

        // ── 交互式多选（仅显示冻结的 skills）──────────────────────────────
        if (options.interactive && !skillId) {
          const frozenSkills = shadows.filter((s) => s.status === 'frozen');

          if (frozenSkills.length === 0) {
            cliInfo('No frozen skills to unfreeze.');
            return;
          }

          const skillInfos: SkillInfo[] = frozenSkills.map((s) => ({
            skillId: s.skill_id || s.skillId,
            status: s.status as string,
            lastOptimized: s.last_optimized_at
              ? new Date(s.last_optimized_at).toLocaleDateString()
              : undefined,
          }));

          const selectedSkills = await selectMultipleSkillsInteractively(
            skillInfos,
            'Select skills to unfreeze (space to select, enter to confirm):'
          );

          if (selectedSkills.length === 0) {
            cliInfo('No skills selected. Unfreeze cancelled.');
            return;
          }

          await unfreezeSkillList(selectedSkills, shadows, projectRoot, shadowRegistry, options);
          return;
        }

        // ── 无参数：显示帮助 ────────────────────────────────────────────────
        if (!skillId) {
          cliInfo('Usage: ornn skills unfreeze <skill-id> [--all] [--interactive]');
          const frozenSkills = shadows.filter((s) => s.status === 'frozen');
          cliInfo('\nFrozen skills:');
          if (frozenSkills.length === 0) {
            cliInfo('  (none)');
          } else {
            frozenSkills.forEach((s) => cliInfo(`  - ${s.skill_id || s.skillId}`));
          }
          cliInfo('\nTip: use --interactive to select skills visually.');
          return;
        }

        // ── --all ───────────────────────────────────────────────────────────
        if (skillId === 'all' || options.all) {
          const toUnfreeze = shadows.filter((s) => s.status === 'frozen');

          if (toUnfreeze.length === 0) {
            cliInfo('No frozen skills to unfreeze.');
            return;
          }

          if (options.dryRun) {
            showDryRunPreview(
              'Unfreeze Skills',
              toUnfreeze.map((s) => ({
                id: s.skill_id || s.skillId,
                currentState: s.status as string,
                newState: 'active',
              }))
            );
            return;
          }

          if (!options.force) {
            const ok = await confirmAction({
              message: `Unfreeze all ${toUnfreeze.length} skill(s)?`,
              warningLines: [
                `⚠️  This will unfreeze ${toUnfreeze.length} shadow skill(s).`,
                '   Automatic optimization will resume for these skills.',
              ],
            });
            if (!ok) {
              cliInfo('Unfreeze cancelled.');
              return;
            }
          }

          let count = 0;
          for (const shadow of toUnfreeze) {
            const sid = shadow.skill_id || shadow.skillId;
            shadowRegistry.updateStatus(sid, 'active', shadow.runtime);
            count++;
          }

          printSuccess(`Successfully unfroze ${count} shadow skill(s)`, [
            'Automatic optimization has been resumed.',
          ]);
          return;
        }

        // ── 单个 skill ──────────────────────────────────────────────────────
        validateSkillIdOrExit(skillId, 'Unfreeze skill', projectRoot);
        const shadow = getShadowOrExit(
          shadowRegistry,
          skillId,
          'Unfreeze skill',
          projectRoot,
          runtime
        );

        if (shadow.status === 'active') {
          cliInfo(`Skill "${skillId}" is already active (not frozen).`);
          return;
        }

        if (options.dryRun) {
          showDryRunPreview('Unfreeze Skill', [
            { id: skillId, currentState: shadow.status, newState: 'active' },
          ]);
          return;
        }

        if (!options.force) {
          const ok = await confirmAction({
            message: `Unfreeze "${skillId}"?`,
            warningLines: [
              `⚠️  This will unfreeze "${skillId}".`,
              '   Automatic optimization will resume for this skill.',
            ],
          });
          if (!ok) {
            cliInfo('Unfreeze cancelled.');
            return;
          }
        }

        shadowRegistry.updateStatus(skillId, 'active', shadow.runtime);

        printSuccess(`Shadow skill "${skillId}" has been unfrozen`, [
          'Automatic optimization has resumed.',
          `To freeze again: ornn skills freeze ${skillId}`,
        ]);
      } catch (error) {
        printErrorAndExit(
          error instanceof Error ? error.message : String(error),
          { operation: 'Unfreeze skill', projectPath: options.project }
        );
      } finally {
        close();
      }
    });

  return unfreeze;
}
