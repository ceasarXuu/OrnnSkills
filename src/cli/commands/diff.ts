import { Command } from 'commander';
import { cliInfo } from '../../utils/cli-output.js';
import { readFileSync } from 'node:fs';
import { createUnifiedDiff } from '../../utils/diff.js';
import { printErrorAndExit } from '../../utils/error-helper.js';
import { buildShadowId } from '../../utils/parse.js';
import { initProjectComponents, validateSkillIdOrExit, getShadowOrExit } from '../lib/cli-setup.js';
import { originRegistry } from '../../core/origin-registry/index.js';

interface DiffOptions {
  project: string;
  revision?: string;
  origin?: boolean;
}

/**
 * Diff 命令
 * 查看当前内容与 origin 的 diff
 */
export function createDiffCommand(): Command {
  const diff = new Command('diff');

  diff
    .description('Show diff between shadow skill and origin')
    .argument('<skill>', 'Skill ID to show diff for')
    .option('-r, --revision <number>', 'Compare with specific revision')
    .option('-o, --origin', 'Compare with origin skill')
    .option('-p, --project <path>', 'Project root path', process.cwd())
    .action(async (skillId: string, options: DiffOptions) => {
      validateSkillIdOrExit(skillId, 'Validate skill ID', options.project);

      const { shadowRegistry, journalManager, projectRoot, close } =
        await initProjectComponents(options.project, 'diff');
      try {
        const shadow = getShadowOrExit(shadowRegistry, skillId, 'Show diff', projectRoot);

        const currentContent = shadowRegistry.readContent(skillId);
        if (!currentContent) {
          printErrorAndExit(`Cannot read shadow content for "${skillId}"`, {
            operation: 'Read shadow content',
            skillId,
            projectPath: projectRoot,
          });
        }

        const shadowId = buildShadowId(skillId, projectRoot);

        if (options.origin) {
          // 与 origin 比较
          originRegistry.scan();
          const origin = originRegistry.get(skillId);

          if (!origin) {
            printErrorAndExit(
              `Origin skill "${skillId}" not found`,
              { operation: 'Show diff', skillId, projectPath: projectRoot },
              'ORIGIN_NOT_FOUND'
            );
          }

          const originContent = originRegistry.readContent(skillId);
          if (!originContent) {
            printErrorAndExit(`Cannot read origin content for "${skillId}"`, {
              operation: 'Read origin content',
              skillId,
              projectPath: projectRoot,
            });
          }

          const diffOutput = createUnifiedDiff(
            `origin/${skillId}`,
            originContent,
            currentContent,
            'origin',
            'shadow'
          );

          if (diffOutput) {
            cliInfo(`Diff between origin and shadow for "${skillId}":\n`);
            cliInfo(diffOutput);
          } else {
            cliInfo(`No differences found between origin and shadow for "${skillId}"`);
          }
        } else if (options.revision) {
          // 与指定 revision 比较
          const targetRevision = parseInt(options.revision, 10);
          if (isNaN(targetRevision) || targetRevision < 0) {
            printErrorAndExit(
              `Invalid revision number: "${options.revision}". Must be a non-negative integer.`,
              { operation: 'Validate revision', skillId, projectPath: projectRoot },
              'INVALID_REVISION'
            );
          }

          const record = journalManager.getRecordByRevision(shadowId, targetRevision);

          if (!record) {
            printErrorAndExit(
              `Revision ${targetRevision} not found`,
              { operation: 'Find revision', skillId, projectPath: projectRoot },
              'INVALID_REVISION'
            );
          }

          // 从 snapshot 读取旧内容
          const snapshots = journalManager.getSnapshots(shadowId);
          const snapshot = snapshots.find((s) => s.revision === targetRevision);

          if (!snapshot) {
            printErrorAndExit(
              `Snapshot for revision ${targetRevision} not found`,
              { operation: 'Find snapshot', skillId, projectPath: projectRoot },
              'SNAPSHOT_NOT_FOUND'
            );
          }

          const oldContent = readFileSync(snapshot.file_path, 'utf-8');
          const diffOutput = createUnifiedDiff(
            `${skillId}@rev${targetRevision}`,
            oldContent,
            currentContent,
            `rev${targetRevision}`,
            'current'
          );

          if (diffOutput) {
            cliInfo(`Diff between revision ${targetRevision} and current for "${skillId}":\n`);
            cliInfo(diffOutput);
          } else {
            cliInfo(`No differences found between revision ${targetRevision} and current`);
          }
        } else {
          // 默认显示与 origin 的 diff
          originRegistry.scan();
          const origin = originRegistry.get(skillId);

          if (!origin) {
            cliInfo(`Origin skill "${skillId}" not found, cannot show diff`);
          } else {
            const originContent = originRegistry.readContent(skillId);
            if (originContent) {
              const diffOutput = createUnifiedDiff(
                `origin/${skillId}`,
                originContent,
                currentContent,
                'origin',
                'shadow'
              );

              if (diffOutput) {
                cliInfo(`Diff between origin and shadow for "${skillId}":\n`);
                cliInfo(diffOutput);
              } else {
                cliInfo(`No differences found between origin and shadow for "${skillId}"`);
              }
            }
          }
        }
      } catch (error) {
        printErrorAndExit(
          error instanceof Error ? error.message : String(error),
          { operation: 'Show diff', skillId },
          undefined
        );
      } finally {
        await close();
      }
    });

  return diff;
}
