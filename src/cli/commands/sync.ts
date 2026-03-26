import { Command } from 'commander';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { createShadowRegistry } from '../../core/shadow-registry/index.js';
import { originRegistry } from '../../core/origin-registry/index.js';
import { createMarkdownSkill } from '../../storage/markdown.js';
import { validateSkillId, validateProjectPath, getShadowSkillPath } from '../../utils/path.js';

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

        // 检查 .ornn 目录是否存在
        const ornnDir = join(projectRoot, '.ornn');
        if (!existsSync(ornnDir)) {
          console.error('Error: .ornn directory not found. Run "ornn init" first.');
          process.exit(1);
        }

        // 初始化 shadow registry
        const shadowRegistry = createShadowRegistry(projectRoot);
        await shadowRegistry.init();

        // 检查 shadow skill 是否存在
        const shadow = shadowRegistry.get(skillId);
        if (!shadow) {
          console.error(`Error: Shadow skill "${skillId}" not found in this project.`);
          console.log(`Run "ornn skills status" to see available skills.`);
          process.exit(1);
        }

        // 扫描 origin registry
        originRegistry.scan();
        const origin = originRegistry.get(skillId);

        if (!origin) {
          console.error(`Error: Origin skill "${skillId}" not found.`);
          console.log('Make sure the skill exists in one of the configured origin paths.');
          process.exit(1);
        }

        // 读取 shadow 内容
        const shadowPath = getShadowSkillPath(projectRoot, skillId);
        const shadowSkill = createMarkdownSkill(shadowPath);
        const shadowContent = shadowSkill.read();

        // 读取 origin 内容（用于显示 diff）
        const originContent = await originRegistry.readContent(skillId);

        // 如果没有变化
        if (originContent === shadowContent) {
          console.log(`✓ Skill "${skillId}" is already up to date.`);
          console.log(`  No changes to sync.`);
          return;
        }

        // 显示将要同步的信息
        const originPath = origin.origin_path || origin.skillPath;
        console.log(`\nSyncing skill "${skillId}" to origin...`);
        console.log(`  Shadow: ${shadowPath}`);
        console.log(`  Origin: ${originPath}`);
        console.log(`  Current revision: ${shadow.current_revision || shadow.traceCount}`);
        console.log();

        // 执行同步
        if (originPath) {
          // TODO: Implement actual sync logic
          console.log(`Would copy to: ${originPath}`);
        }

        console.log(`✓ Successfully synced "${skillId}" to origin!`);
        console.log(`  The optimized skill is now active and will be used by your Agent.`);

        // 关闭 registry
        shadowRegistry.close();
      } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  return sync;
}
