import { Command } from 'commander';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { createShadowRegistry } from '../../core/shadow-registry/index.js';
import { createJournalManager } from '../../core/journal/index.js';
import { validateSkillId, validateProjectPath } from '../../utils/path.js';
import type { ChangeType } from '../../types/index.js';

interface LogOptions {
  project: string;
  limit: string;
  follow?: boolean;
  type?: string;
}

/**
 * Log 命令
 * 查看某个 skill 的演化日志
 */
export function createLogCommand(): Command {
  const log = new Command('log');

  log
    .description('Show evolution log for a shadow skill')
    .argument('<skill>', 'Skill ID to show log for')
    .option('-n, --limit <number>', 'Number of records to show', '20')
    .option('-f, --follow', 'Follow log output (like tail -f)')
    .option('-t, --type <type>', 'Filter by change type')
    .option('-p, --project <path>', 'Project root path', process.cwd())
    .action(async (skillId: string, options: LogOptions) => {
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

        const shadowId = `${skillId}@${projectRoot}`;
        
        // 验证 limit 参数
        const limit = parseInt(options.limit, 10);
        if (isNaN(limit) || limit < 1 || limit > 1000) {
          console.error('Error: Invalid limit value. Must be between 1 and 1000.');
          process.exit(1);
        }

        // 验证 changeType 参数
        const validChangeTypes: ChangeType[] = ['append_context', 'tighten_trigger', 'add_fallback', 'prune_noise', 'rewrite_section'];
        const changeType = options.type as ChangeType | undefined;
        if (changeType && !validChangeTypes.includes(changeType)) {
          console.error(`Error: Invalid change type "${options.type}". Valid types are: ${validChangeTypes.join(', ')}`);
          process.exit(1);
        }
        const records = await journalManager.getJournalRecords(shadowId, {
          limit,
          changeType,
        });

        if (records.length === 0) {
          console.log(`No evolution records found for "${skillId}"`);
        } else {
          console.log(`Evolution log for "${skillId}":\n`);

          for (const record of records) {
            const date = new Date(record.timestamp).toLocaleString();
            const changeType = record.change_type.toUpperCase();
            const appliedBy = record.applied_by === 'auto' ? '🤖' : '👤';

            console.log(`${appliedBy} rev_${String(record.revision).padStart(4, '0')} - ${date}`);
            console.log(`   Type: ${changeType}`);
            console.log(`   Reason: ${record.reason}`);
            console.log(`   Sessions: ${record.source_sessions.length}`);
            console.log('');
          }

          console.log(`Showing ${records.length} of ${limit} most recent records`);
          console.log('\nFor more details, use:');
          console.log(`  sea skills diff ${skillId} --from <revision>`);
        }

        // 关闭
        shadowRegistry.close();
        journalManager.close();
      } catch (error) {
        console.error(`Error: ${error}`);
        process.exit(1);
      }
    });

  return log;
}