import { Command } from 'commander';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { createShadowRegistry } from '../../core/shadow-registry/index.js';
import { validateSkillId, validateProjectPath } from '../../utils/path.js';

interface FreezeOptions {
  project: string;
}

/**
 * Freeze 命令
 * 暂停某个 skill 的自动优化
 */
export function createFreezeCommand(): Command {
  const freeze = new Command('freeze');

  freeze
    .description('Pause automatic optimization for a shadow skill')
    .argument('<skill>', 'Skill ID to freeze')
    .option('-p, --project <path>', 'Project root path', process.cwd())
    .action(async (skillId: string, options: FreezeOptions) => {
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
        await shadowRegistry.init();

        // 检查 shadow 是否存在
        const shadow = shadowRegistry.get(skillId);
        if (!shadow) {
          console.error(`Error: Shadow skill "${skillId}" not found`);
          process.exit(1);
        }

        // 更新状态为 frozen
        const shadowId = `${skillId}@${projectRoot}`;
        shadowRegistry.updateStatus(shadowId, 'frozen');

        console.log(`✅ Shadow skill "${skillId}" has been frozen`);
        console.log('Automatic optimization is now paused for this skill');
        console.log('\nTo unfreeze, use:');
        console.log(`  sea skills unfreeze ${skillId}`);

        // 关闭
        shadowRegistry.close();
      } catch (error) {
        console.error(`Error: ${error}`);
        process.exit(1);
      }
    });

  return freeze;
}

/**
 * Unfreeze 命令
 * 恢复某个 skill 的自动优化
 */
export function createUnfreezeCommand(): Command {
  const unfreeze = new Command('unfreeze');

  unfreeze
    .description('Resume automatic optimization for a shadow skill')
    .argument('<skill>', 'Skill ID to unfreeze')
    .option('-p, --project <path>', 'Project root path', process.cwd())
    .action(async (skillId: string, options: FreezeOptions) => {
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
        await shadowRegistry.init();

        // 检查 shadow 是否存在
        const shadow = shadowRegistry.get(skillId);
        if (!shadow) {
          console.error(`Error: Shadow skill "${skillId}" not found`);
          process.exit(1);
        }

        // 更新状态为 active
        const shadowId = `${skillId}@${projectRoot}`;
        shadowRegistry.updateStatus(shadowId, 'active');

        console.log(`✅ Shadow skill "${skillId}" has been unfrozen`);
        console.log('Automatic optimization is now resumed for this skill');

        // 关闭
        shadowRegistry.close();
      } catch (error) {
        console.error(`Error: ${error}`);
        process.exit(1);
      }
    });

  return unfreeze;
}