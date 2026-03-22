import { Command } from 'commander';
import { join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { createShadowRegistry } from '../../core/shadow-registry/index.js';
import { createJournalManager } from '../../core/journal/index.js';
import { originRegistry } from '../../core/origin-registry/index.js';
import { createUnifiedDiff } from '../../utils/diff.js';
import { validateSkillId, validateProjectPath } from '../../utils/path.js';

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
      try {
        // 验证 skill ID 格式
        if (!validateSkillId(skillId)) {
          console.error(`Error: Invalid skill ID "${skillId}". Skill IDs can only contain letters, numbers, hyphens, underscores, and dots.`);
          process.exit(1);
        }

        // 验证项目路径安全性
        let projectRoot: string;
        try {
          projectRoot = validateProjectPath(options.project);
        } catch (error) {
          console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
          process.exit(1);
        }

        // 检查 .sea 目录是否存在
        const seaDir = join(projectRoot, '.sea');
        if (!existsSync(seaDir)) {
          console.error('Error: .sea directory not found. Is this a SEA project?');
          process.exit(1);
        }

        // 初始化组件
        const shadowRegistry = createShadowRegistry(projectRoot);
        const journalManager = createJournalManager(projectRoot);

        await shadowRegistry.init();
        await journalManager.init();

        // 检查 shadow 是否存在
        const shadow = shadowRegistry.get(skillId);
        if (!shadow) {
          console.error(`Error: Shadow skill "${skillId}" not found`);
          process.exit(1);
        }

        // 读取当前内容
        const currentContent = shadowRegistry.readContent(skillId);
        if (!currentContent) {
          console.error(`Error: Cannot read shadow content for "${skillId}"`);
          process.exit(1);
        }

        const shadowId = `${skillId}@${projectRoot}`;

        if (options.origin) {
          // 与 origin 比较
          originRegistry.scan();
          const origin = originRegistry.get(skillId);

          if (!origin) {
            console.error(`Error: Origin skill "${skillId}" not found`);
            process.exit(1);
          }

          const originContent = await originRegistry.readContent(skillId);
          if (!originContent) {
            console.error(`Error: Cannot read origin content for "${skillId}"`);
            process.exit(1);
          }

          const diffOutput = createUnifiedDiff(
            `origin/${skillId}`,
            originContent,
            currentContent,
            'origin',
            'shadow'
          );

          if (diffOutput) {
            console.log(`Diff between origin and shadow for "${skillId}":\n`);
            console.log(diffOutput);
          } else {
            console.log(`No differences found between origin and shadow for "${skillId}"`);
          }
        } else if (options.revision) {
          // 与指定 revision 比较
          const targetRevision = parseInt(options.revision, 10);
          const record = await journalManager.getRecordByRevision(shadowId, targetRevision);

          if (!record) {
            console.error(`Error: Revision ${targetRevision} not found`);
            process.exit(1);
          }

          // 从 snapshot 读取旧内容
          const snapshots = journalManager.getSnapshots(shadowId);
          const snapshot = snapshots.find((s) => s.revision === targetRevision);

          if (!snapshot) {
            console.error(`Error: Snapshot for revision ${targetRevision} not found`);
            process.exit(1);
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
            console.log(`Diff between revision ${targetRevision} and current for "${skillId}":\n`);
            console.log(diffOutput);
          } else {
            console.log(`No differences found between revision ${targetRevision} and current`);
          }
        } else {
          // 默认显示与 origin 的 diff
          originRegistry.scan();
          const origin = originRegistry.get(skillId);

          if (!origin) {
            console.log(`Origin skill "${skillId}" not found, cannot show diff`);
          } else {
            const originContent = await originRegistry.readContent(skillId);
            if (originContent) {
              const diffOutput = createUnifiedDiff(
                `origin/${skillId}`,
                originContent,
                currentContent,
                'origin',
                'shadow'
              );

              if (diffOutput) {
                console.log(`Diff between origin and shadow for "${skillId}":\n`);
                console.log(diffOutput);
              } else {
                console.log(`No differences found between origin and shadow for "${skillId}"`);
              }
            }
          }
        }

        // 关闭
        shadowRegistry.close();
        journalManager.close();
      } catch (error) {
        console.error(`Error: ${error}`);
        process.exit(1);
      }
    });

  return diff;
}