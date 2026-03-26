import { Command } from 'commander';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { createShadowRegistry } from '../../core/shadow-registry/index.js';
import { createJournalManager } from '../../core/journal/index.js';
import { validateSkillId, validateProjectPath } from '../../utils/path.js';

interface StatusOptions {
  project: string;
  skill?: string;
}

/**
 * Status 命令
 * 查看当前项目 shadow skills 状态
 */
export function createStatusCommand(): Command {
  const status = new Command('status');

  status
    .description('Show status of shadow skills in current project')
    .option('-p, --project <path>', 'Project root path', process.cwd())
    .option('-s, --skill <id>', 'Show detailed status for specific skill')
    .action(async (options: StatusOptions) => {
      try {
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

        if (options.skill) {
          // 验证 skill ID 格式
          if (!validateSkillId(options.skill)) {
            console.error(`Error: Invalid skill ID "${options.skill}". Skill IDs can only contain letters, numbers, hyphens, underscores, and dots.`);
            process.exit(1);
          }

          // 显示特定 skill 的详细状态
          const shadow = shadowRegistry.get(options.skill);
          if (!shadow) {
            console.error(`Error: Shadow skill "${options.skill}" not found`);
            process.exit(1);
          }

          const shadowId: string = `${options.skill}@${projectRoot}`;
          const latestRevision = await journalManager.getLatestRevision(shadowId);
          const snapshots = journalManager.getSnapshots(shadowId);

          console.log(`Shadow Skill: ${options.skill}`);
          console.log(`Status: ${shadow.status}`);
          console.log(`Current Revision: ${latestRevision}`);
          console.log(`Created: ${shadow.created_at}`);
          console.log(`Last Optimized: ${shadow.last_optimized_at || 'Never'}`);
          console.log(`Snapshots: ${snapshots.length}`);

          if (snapshots.length > 0) {
            console.log('\nRecent Snapshots:');
            for (const snapshot of snapshots.slice(0, 5)) {
              console.log(`  rev_${String(snapshot.revision).padStart(4, '0')} - ${snapshot.timestamp}`);
            }
          }
        } else {
          // 列出所有 shadow skills
          const shadows = shadowRegistry.list();

          if (shadows.length === 0) {
            console.log('No shadow skills found in this project');
            console.log('\nTo create a shadow skill, use:');
            console.log('  sea skills fork <skill-id>');
          } else {
            console.log(`Shadow Skills in ${projectRoot}:\n`);
            console.log('Skill ID                Status      Revision  Last Optimized');
            console.log('─'.repeat(70));

            for (const shadow of shadows) {
              const skillId = shadow.skill_id || shadow.skillId || 'unknown';
              const shadowId = `${skillId}@${projectRoot}`;
              const latestRevision = await journalManager.getLatestRevision(shadowId);
              const lastOptimized = (shadow.last_optimized_at || shadow.updatedAt)
                ? new Date(shadow.last_optimized_at || shadow.updatedAt).toLocaleDateString()
                : 'Never';

              console.log(
                `${skillId.padEnd(22)} ${shadow.status.padEnd(11)} ${String(latestRevision).padEnd(9)} ${lastOptimized}`
              );
            }

            console.log('\nFor detailed status of a specific skill:');
            console.log('  sea skills status --skill <skill-id>');
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

  return status;
}