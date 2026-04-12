import { Command } from 'commander';
import { cliInfo } from '../../utils/cli-output.js';
import { printErrorAndExit } from '../../utils/error-helper.js';
import { initRegistryOnly, validateSkillIdOrExit, getShadowOrExit } from '../lib/cli-setup.js';
import { createShadowRegistry } from '../../core/shadow-registry/index.js';
import { confirmAction, printSuccess } from '../../utils/cli-formatters.js';
import {
  selectMultipleSkillsInteractively,
  showDryRunPreview,
  type SkillInfo,
} from '../../utils/interactive-selector.js';
import { parseRuntimeOption } from '../lib/runtime-option.js';
import type { RuntimeType } from '../../types/index.js';

interface FreezeOptions {
  project: string;
  all?: boolean;
  force?: boolean;
  dryRun?: boolean;
  interactive?: boolean;
  runtime?: string;
}

// ─── Freeze ──────────────────────────────────────────────────────────────────

/**
 * Freeze 命令 — 暂停某个 skill 的自动优化
 */
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

// ─── Unfreeze ─────────────────────────────────────────────────────────────────

/**
 * Unfreeze 命令 — 恢复某个 skill 的自动优化
 */
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

// ─── Batch helpers ────────────────────────────────────────────────────────────

async function freezeSkillList(
  skillIds: string[],
  shadows: Array<{ skill_id?: string; skillId?: string; status?: string; runtime?: RuntimeType }>,
  _projectRoot: string,
  shadowRegistry: ReturnType<typeof createShadowRegistry>,
  options: FreezeOptions
): Promise<void> {
  const toFreeze = skillIds.filter((id) => {
    const shadow = shadows.find((s) => (s.skill_id || s.skillId) === id);
    return shadow && shadow.status !== 'frozen';
  });

  if (toFreeze.length === 0) {
    cliInfo('All selected skills are already frozen.');
    return;
  }

  if (options.dryRun) {
    showDryRunPreview(
      'Freeze Skills',
      toFreeze.map((id) => {
        const shadow = shadows.find((s) => (s.skill_id || s.skillId) === id);
        return { id, currentState: (shadow?.status as string) || 'unknown', newState: 'frozen' };
      })
    );
    return;
  }

  if (!options.force) {
    const ok = await confirmAction({
      message: `Freeze ${toFreeze.length} selected skill(s)?`,
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

  for (const id of toFreeze) {
    const shadow = shadows.find((s) => (s.skill_id || s.skillId) === id);
    shadowRegistry.updateStatus(id, 'frozen', shadow?.runtime);
  }

  printSuccess(`Successfully froze ${toFreeze.length} shadow skill(s)`, [
    'To unfreeze: ornn skills unfreeze <skill-id>',
  ]);
}

async function unfreezeSkillList(
  skillIds: string[],
  shadows: Array<{ skill_id?: string; skillId?: string; status?: string; runtime?: RuntimeType }>,
  _projectRoot: string,
  shadowRegistry: ReturnType<typeof createShadowRegistry>,
  options: FreezeOptions
): Promise<void> {
  if (options.dryRun) {
    showDryRunPreview(
      'Unfreeze Skills',
      skillIds.map((id) => ({ id, currentState: 'frozen', newState: 'active' }))
    );
    return;
  }

  if (!options.force) {
    const ok = await confirmAction({
      message: `Unfreeze ${skillIds.length} selected skill(s)?`,
      warningLines: [
        `⚠️  This will unfreeze ${skillIds.length} shadow skill(s).`,
        '   Automatic optimization will resume for these skills.',
      ],
    });
    if (!ok) {
      cliInfo('Unfreeze cancelled.');
      return;
    }
  }

  for (const id of skillIds) {
    const shadow = shadows.find((s) => (s.skill_id || s.skillId) === id);
    shadowRegistry.updateStatus(id, 'active', shadow?.runtime);
  }

  printSuccess(`Successfully unfroze ${skillIds.length} shadow skill(s)`);
}
