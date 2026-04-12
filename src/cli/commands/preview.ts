import { Command } from 'commander';
import { cliInfo } from '../../utils/cli-output.js';
import { printErrorAndExit } from '../../utils/error-helper.js';
import { buildShadowId } from '../../utils/parse.js';
import { initProjectComponents, validateSkillIdOrExit, getShadowOrExit } from '../lib/cli-setup.js';
import type { JournalRecord } from '../../core/journal/index.js';
import { parseRuntimeOption } from '../lib/runtime-option.js';

interface PreviewOptions {
  project: string;
  revision?: string;
  runtime?: string;
}

export function createPreviewCommand(): Command {
  const preview = new Command('preview');

  preview
    .description('Preview changes that would be applied to a shadow skill')
    .argument('<skill>', 'Skill ID to preview')
    .option('-r, --revision <rev>', 'Preview changes from specific revision')
    .option('--runtime <runtime>', 'Host scope: codex | claude | opencode')
    .option('-p, --project <path>', 'Project root path', process.cwd())
    .action(async (skillId: string, options: PreviewOptions) => {
      validateSkillIdOrExit(skillId, 'Preview skill', options.project);

      const { shadowRegistry, journalManager, projectRoot, close } =
        await initProjectComponents(options.project, 'preview');
      try {
        const runtime = parseRuntimeOption(options.runtime);
        const shadow = getShadowOrExit(shadowRegistry, skillId, 'Preview skill', projectRoot, runtime);

        const shadowId = buildShadowId(skillId, projectRoot, shadow.runtime ?? 'codex');
        const latestRevision = journalManager.getLatestRevision(shadowId);
        const records = journalManager.getJournalRecords(shadowId, { limit: 10 });

        cliInfo('');
        cliInfo(`  Preview for Shadow Skill: ${skillId}`);
        cliInfo('');
        cliInfo(`   Current Revision: ${latestRevision}`);
        cliInfo(`   Status: ${shadow.status}`);
        cliInfo(`   Last Optimized: ${shadow.last_optimized_at || 'Never'}`);
        cliInfo('');

        if (records.length === 0) {
          cliInfo('   No optimization history found.');
          cliInfo('   This skill has not been optimized yet.');
          cliInfo('');
          return;
        }

        cliInfo('  Recent Optimization History:');
        cliInfo('');

        const recentRecords: JournalRecord[] = records.slice(0, 5);
        for (const record of recentRecords) {
          const date = new Date(record.timestamp).toLocaleString();
          const type = record.change_type.toUpperCase().padEnd(20);
          const appliedBy = record.applied_by === 'auto' ? 'Auto' : 'Manual';

          cliInfo(`   rev_${String(record.revision).padStart(4, '0')} - ${date}`);
          cliInfo(`      Type: ${type} | By: ${appliedBy}`);
          cliInfo(`      Reason: ${record.reason}`);
          cliInfo('');
        }

        cliInfo('  Optimization Suggestions:');
        cliInfo('');
        cliInfo('   Based on recent usage patterns, potential optimizations:');
        cliInfo('');

        const changeTypeCounts: Record<string, number> = {};
        for (const record of records) {
          changeTypeCounts[record.change_type] = (changeTypeCounts[record.change_type] || 0) + 1;
        }

        const suggestions: string[] = [];
        if (changeTypeCounts['append_context'] > 0) {
          suggestions.push('   - APPEND_CONTEXT: Consider adding more project-specific context');
        }
        if (changeTypeCounts['tighten_trigger'] > 0) {
          suggestions.push('   - TIGHTEN_TRIGGER: Review trigger conditions for better precision');
        }
        if (changeTypeCounts['add_fallback'] > 0) {
          suggestions.push('   - ADD_FALLBACK: Ensure common error cases have fallbacks');
        }
        if (changeTypeCounts['prune_noise'] > 0) {
          suggestions.push('   - PRUNE_NOISE: Remove low-value content periodically');
        }

        if (suggestions.length === 0) {
          cliInfo('   - No specific suggestions at this time');
          cliInfo('   - The skill appears to be well-optimized');
          cliInfo('');
        } else {
          for (const suggestion of suggestions) {
            cliInfo(suggestion);
          }
        }

        cliInfo('');
        cliInfo('  Next Steps:');
        cliInfo('');
        cliInfo(`   To view detailed diff between versions:`);
        cliInfo(`     $ ornn skills diff ${skillId} --from <revision>`);
        cliInfo('');
        cliInfo(`   To trigger a new optimization analysis:`);
        cliInfo(`     $ ornn optimize ${skillId}`);
        cliInfo('');
        cliInfo(`   To freeze automatic optimizations:`);
        cliInfo(`     $ ornn skills freeze ${skillId}`);
        cliInfo('');
      } catch (error) {
        printErrorAndExit(
          error instanceof Error ? error.message : String(error),
          { operation: 'Preview skill', skillId },
          undefined
        );
      } finally {
        await close();
      }
    });

  return preview;
}
