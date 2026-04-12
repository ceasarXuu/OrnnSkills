import { Command } from 'commander';
import { cliInfo } from '../../utils/cli-output.js';
import { printErrorAndExit } from '../../utils/error-helper.js';
import { createUnifiedDiff, countChanges } from '../../utils/diff.js';
import { confirmAction } from '../../utils/cli-formatters.js';
import { initRegistryOnly, validateSkillIdOrExit, getShadowOrExit } from '../lib/cli-setup.js';
import { parseRuntimeOption } from '../lib/runtime-option.js';
import { join } from 'node:path';
import { createSkillVersionManager } from '../../core/skill-version/index.js';
import { createSkillDeployer } from '../../core/skill-deployer/index.js';

interface SyncOptions {
  project: string;
  force?: boolean;
  runtime?: string;
}

/**
 * Sync 命令
 * 将 shadow skill 同步到项目宿主路径（不改全局）
 */
export function createSyncCommand(): Command {
  const sync = new Command('sync');

  sync
    .description('Sync shadow skill to project host path (apply optimizations)')
    .argument('<skill>', 'Skill ID to sync')
    .option('-r, --runtime <runtime>', 'Host scope: codex | claude | opencode')
    .option('-p, --project <path>', 'Project root path', process.cwd())
    .option('-f, --force', 'Force sync without confirmation', false)
    .action(async (skillId: string, options: SyncOptions) => {
      validateSkillIdOrExit(skillId, 'Sync skill', options.project);

      const { shadowRegistry, projectRoot, close } = initRegistryOnly(options.project, 'sync');
      try {
        const runtime = parseRuntimeOption(options.runtime);
        const shadow = getShadowOrExit(shadowRegistry, skillId, 'Sync skill', projectRoot, runtime);

        const shadowPath = join(
          projectRoot,
          '.ornn',
          'shadows',
          shadow.runtime ?? 'codex',
          `${skillId}.md`
        );
        const shadowContent = shadowRegistry.readContent(skillId, shadow.runtime);
        const targetRuntime = shadow.runtime ?? 'codex';
        const deployer = createSkillDeployer({
          runtime: targetRuntime,
          projectPath: projectRoot,
        });
        const deployedContent = deployer.readCurrent(skillId);
        const targetPath = deployer.getDeploymentPath(skillId);

        if (!shadowContent) {
          printErrorAndExit(`Cannot read shadow content for "${skillId}"`, {
            operation: 'Read shadow content',
            skillId,
            runtime: shadow.runtime,
            projectPath: projectRoot,
          });
        }

        if (deployedContent === shadowContent) {
          cliInfo(`✓ Skill "${skillId}" is already up to date.`);
          cliInfo(`  No changes to sync.`);
          return;
        }

        cliInfo(`\n📦 Syncing skill "${skillId}" to project host...`);
        cliInfo(`  Shadow: ${shadowPath}`);
        cliInfo(`  Host target: ${targetPath}`);
        cliInfo(`  Host: ${targetRuntime}`);
        cliInfo('');

        const changes = countChanges(deployedContent ?? '', shadowContent);
        cliInfo(`📊 Changes to be applied:`);
        cliInfo(`  +${changes.added} lines added`);
        cliInfo(`  -${changes.removed} lines removed`);
        cliInfo('');

        const diffOutput = createUnifiedDiff(
          skillId,
          deployedContent ?? '',
          shadowContent,
          'runtime',
          'shadow'
        );
        cliInfo('Diff:');
        cliInfo(diffOutput);
        cliInfo('');

        if (!options.force) {
          const ok = await confirmAction({
            message: 'Sync this optimized skill to project host path?',
            warningLines: [
              `⚠️  This will overwrite the project host skill file with the optimized shadow version.`,
              `   Host target: ${targetPath}`,
            ],
          });

          if (!ok) {
            cliInfo('Sync cancelled.');
            return;
          }
        }

        const versionManager = createSkillVersionManager({
          projectPath: projectRoot,
          skillId,
          runtime: targetRuntime,
        });
        const latest = versionManager.getLatestVersion();
        const version =
          latest && latest.content === shadowContent
            ? latest
            : versionManager.createVersion(shadowContent, 'Manual sync from CLI', []);
        const deployResult = deployer.deploy(skillId, version);
        if (!deployResult.success) {
          printErrorAndExit(`Failed to deploy skill "${skillId}"`, {
            operation: 'Deploy skill',
            skillId,
            runtime: targetRuntime,
            projectPath: projectRoot,
          });
        }

        cliInfo(`\n✓ Successfully synced "${skillId}" to project host!`);
        cliInfo(`  The optimized skill is now active for this project.`);
        cliInfo('');
        cliInfo(`  Host path: ${targetPath}`);
        cliInfo(`  Version: v${version.version}`);
        cliInfo('');
        cliInfo(`  Note: This does not modify global skills.`);
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
