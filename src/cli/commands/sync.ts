import { Command } from 'commander';
import { cliInfo } from '../../utils/cli-output.js';
import { writeFileSync } from 'node:fs';
import { createMarkdownSkill } from '../../storage/markdown.js';
import { getSkillCurrentPath } from '../../utils/path.js';
import { printErrorAndExit } from '../../utils/error-helper.js';
import { createUnifiedDiff, countChanges } from '../../utils/diff.js';
import { confirmAction } from '../../utils/cli-formatters.js';
import { initRegistryOnly, validateSkillIdOrExit, getShadowOrExit } from '../lib/cli-setup.js';
import { originRegistry } from '../../core/origin-registry/index.js';

interface SyncOptions {
  project: string;
  force?: boolean;
}

/**
 * Sync 命令
 * 将 shadow skill 同步回 origin
 */
export function createSyncCommand(): Command {
  const sync = new Command('sync');

  sync
    .description('Sync shadow skill back to origin (apply optimizations)')
    .argument('<skill>', 'Skill ID to sync')
    .option('-p, --project <path>', 'Project root path', process.cwd())
    .option('-f, --force', 'Force sync without confirmation', false)
    .action(async (skillId: string, options: SyncOptions) => {
      validateSkillIdOrExit(skillId, 'Sync skill', options.project);

      const { shadowRegistry, projectRoot, close } = initRegistryOnly(options.project, 'sync');
      try {
        const shadow = getShadowOrExit(shadowRegistry, skillId, 'Sync skill', projectRoot);

        originRegistry.scan();
        const origin = originRegistry.get(skillId);

        if (!origin) {
          printErrorAndExit(
            `Origin skill "${skillId}" not found`,
            { operation: 'Sync skill', skillId, projectPath: projectRoot },
            'ORIGIN_NOT_FOUND'
          );
        }

        const shadowPath = getSkillCurrentPath(projectRoot, skillId);
        const shadowSkill = createMarkdownSkill(shadowPath);
        const shadowContent = shadowSkill.read();
        const originContent = originRegistry.readContent(skillId);

        if (!originContent) {
          printErrorAndExit(`Cannot read origin content for "${skillId}"`, {
            operation: 'Read origin content',
            skillId,
            projectPath: projectRoot,
          });
        }

        if (originContent === shadowContent) {
          cliInfo(`✓ Skill "${skillId}" is already up to date.`);
          cliInfo(`  No changes to sync.`);
          return;
        }

        const originPath = origin.skillPath;
        cliInfo(`\n📦 Syncing skill "${skillId}" to origin...`);
        cliInfo(`  Shadow: ${shadowPath}`);
        cliInfo(`  Origin: ${originPath}`);
        cliInfo('');

        const changes = countChanges(originContent, shadowContent);
        cliInfo(`📊 Changes to be applied:`);
        cliInfo(`  +${changes.added} lines added`);
        cliInfo(`  -${changes.removed} lines removed`);
        cliInfo('');

        const diffOutput = createUnifiedDiff(skillId, originContent, shadowContent, 'origin', 'shadow');
        cliInfo('Diff:');
        cliInfo(diffOutput);
        cliInfo('');

        if (!options.force) {
          const ok = await confirmAction({
            message: 'Sync this optimized skill back to origin? This will update the global skill.',
            warningLines: [
              `⚠️  This will overwrite the origin skill file with the optimized shadow version.`,
              `   Origin path: ${originPath}`,
            ],
          });

          if (!ok) {
            cliInfo('Sync cancelled.');
            return;
          }
        }

        writeFileSync(originPath, shadowContent, 'utf-8');
        cliInfo(`\n✓ Successfully synced "${skillId}" to origin!`);
        cliInfo(`  The optimized skill is now active globally.`);
        cliInfo('');
        cliInfo(`  Origin path: ${originPath}`);
        cliInfo('');
        cliInfo(`  Note: This affects all projects using this skill.`);
        cliInfo(`  To revert, restore the original skill from backup or version control.`);
      } catch (error) {
        printErrorAndExit(
          error instanceof Error ? error.message : String(error),
          { operation: 'Sync skill', skillId },
          undefined
        );
      } finally {
        close();
      }
    });

  return sync;
}
