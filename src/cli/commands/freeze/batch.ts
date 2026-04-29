/**
 * Batch helpers used by both freeze and unfreeze CLI commands.
 *
 * Extracted from src/cli/commands/freeze.ts.
 */
import { createShadowRegistry } from '../../../core/shadow-registry/index.js';
import { cliInfo } from '../../../utils/cli-output.js';
import { confirmAction, printSuccess } from '../../../utils/cli-formatters.js';
import { showDryRunPreview } from '../../../utils/interactive-selector.js';
import type { FreezeOptions, ShadowSummary } from './shared.js';

export async function freezeSkillList(
  skillIds: string[],
  shadows: ShadowSummary[],
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

export async function unfreezeSkillList(
  skillIds: string[],
  shadows: ShadowSummary[],
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
