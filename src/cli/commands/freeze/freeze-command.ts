/**
 * `ornn skills freeze` subcommand factory.
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
import { freezeSkillList } from './batch.js';
import type { FreezeOptions } from './shared.js';

export function createFreezeCommand(): Command {
  const freeze = new Command('freeze');

  freeze
    .description('Pause automatic optimization for a shadow skill')
    .argument('[skill]', 'Skill ID to freeze (use "all" to freeze all skills)')
    .option('-p, --project <path>', 'Project root path', process.cwd())
    .option('-r, --runtime <runtime>', 'Host scope: codex | claude | opencode')
    .option('-f, --force', 'Skip confirmation prompt', false)
    .option('--dry-run', 'Show what would be frozen without making changes', false)
    .option('-i, --interactive', 'Select skills interactively', false)
    .action(async (skillId: string | undefined, options: FreezeOptions) => {
      const { shadowRegistry, projectRoot, close } = initRegistryOnly(options.project, 'freeze');
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

        // ── 交互式多选 ──────────────────────────────────────────────────────
        if (options.interactive && !skillId) {
          const skillInfos: SkillInfo[] = shadows.map((s) => ({
            skillId: s.skill_id || s.skillId,
            status: s.status as string,
            lastOptimized: s.last_optimized_at
              ? new Date(s.last_optimized_at).toLocaleDateString()
              : undefined,
          }));

          const selectedSkills = await selectMultipleSkillsInteractively(
            skillInfos,
            'Select skills to freeze (space to select, enter to confirm):'
          );

          if (selectedSkills.length === 0) {
            cliInfo('No skills selected. Freeze cancelled.');
            return;
          }

          await freezeSkillList(selectedSkills, shadows, projectRoot, shadowRegistry, options);
          return;
        }

        // ── 无参数：显示帮助 ────────────────────────────────────────────────
        if (!skillId) {
          cliInfo('Usage: ornn skills freeze <skill-id> [--all] [--interactive]');
          cliInfo('\nAvailable skills:');
          shadows.forEach((shadow) => {
            const sid = shadow.skill_id || shadow.skillId;
            cliInfo(`  - ${sid} [${shadow.status}]`);
          });
          cliInfo('\nTip: use --interactive to select skills visually.');
          return;
        }

        // ── --all ───────────────────────────────────────────────────────────
        if (skillId === 'all' || options.all) {
          const toFreeze = shadows.filter((s) => s.status !== 'frozen');

          if (toFreeze.length === 0) {
            cliInfo('All skills are already frozen.');
            return;
          }

          if (options.dryRun) {
            showDryRunPreview(
              'Freeze Skills',
              toFreeze.map((s) => ({
                id: s.skill_id || s.skillId,
                currentState: s.status as string,
                newState: 'frozen',
              }))
            );
            return;
          }

          if (!options.force) {
            const ok = await confirmAction({
              message: `Freeze all ${toFreeze.length} skill(s)?`,
              warningLines: [
                `⚠️  This will freeze ${toFreeze.length} shadow skill(s).`,
                '   Frozen skills will not receive automatic optimizations.',
              ],
            });
            if (!ok) {
              cliInfo('Freeze cancelled.');
              return;
            }
          }

          let count = 0;
          for (const shadow of toFreeze) {
            const sid = shadow.skill_id || shadow.skillId;
            shadowRegistry.updateStatus(sid, 'frozen', shadow.runtime);
            count++;
          }

          printSuccess(`Successfully froze ${count} shadow skill(s)`, [
            'To unfreeze all:',
            '  ornn skills unfreeze all',
          ]);
          return;
        }

        // ── 単個 skill ──────────────────────────────────────────────────────
        validateSkillIdOrExit(skillId, 'Freeze skill', projectRoot);
        const shadow = getShadowOrExit(
          shadowRegistry,
          skillId,
          'Freeze skill',
          projectRoot,
          runtime
        );

        if (shadow.status === 'frozen') {
          cliInfo(`Skill "${skillId}" is already frozen.`);
          return;
        }

        if (options.dryRun) {
          showDryRunPreview('Freeze Skill', [
            { id: skillId, currentState: shadow.status, newState: 'frozen' },
          ]);
          return;
        }

        if (!options.force) {
          const ok = await confirmAction({
            message: `Freeze "${skillId}"?`,
            warningLines: [
              `⚠️  This will freeze "${skillId}".`,
              '   Frozen skills will not receive automatic optimizations.',
            ],
          });
          if (!ok) {
            cliInfo('Freeze cancelled.');
            return;
          }
        }

        shadowRegistry.updateStatus(skillId, 'frozen', shadow.runtime);

        printSuccess(`Shadow skill "${skillId}" has been frozen`, [
          'Automatic optimization is now paused.',
          `To unfreeze: ornn skills unfreeze ${skillId}`,
        ]);
      } catch (error) {
        printErrorAndExit(
          error instanceof Error ? error.message : String(error),
          { operation: 'Freeze skill', projectPath: options.project }
        );
      } finally {
        close();
      }
    });

  return freeze;
}
