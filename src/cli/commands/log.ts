import { Command } from 'commander';
import { cliInfo } from '../../utils/cli-output.js';
import { validateSkillId } from '../../utils/path.js';
import { printErrorAndExit } from '../../utils/error-helper.js';
import { initProjectComponents } from '../lib/cli-setup.js';
import { buildShadowId } from '../../utils/parse.js';
import { formatTimestamp, formatRevision } from '../../utils/cli-formatters.js';
import type { JournalRecord } from '../../core/journal/index.js';
import type { ChangeType } from '../../types/index.js';

interface LogOptions {
  project: string;
  limit: string;
  follow?: boolean;
  type?: string;
  since?: string;
  until?: string;
  search?: string;
  appliedBy?: string;
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
    .option('-t, --type <type>', 'Filter by change type (comma-separated for multiple)')
    .option('--since <date>', 'Show records since date (YYYY-MM-DD or ISO 8601)')
    .option('--until <date>', 'Show records until date (YYYY-MM-DD or ISO 8601)')
    .option('--search <keyword>', 'Search in reason field (case-insensitive)')
    .option('--applied-by <source>', 'Filter by who applied the change (auto|manual)')
    .option('-p, --project <path>', 'Project root path', process.cwd())
    .alias('history')
    .action(async (skillId: string, options: LogOptions) => {
      if (!validateSkillId(skillId)) {
        printErrorAndExit(
          `Invalid skill ID "${skillId}".`,
          { operation: 'Show evolution log', skillId },
          'INVALID_SKILL_ID'
        );
      }

      const { shadowRegistry, journalManager, projectRoot, close } =
        await initProjectComponents(options.project, 'log');

      try {
        const shadow = shadowRegistry.get(skillId);
        if (!shadow) {
          printErrorAndExit(
            `Shadow skill "${skillId}" not found`,
            { operation: 'Show evolution log', skillId, projectPath: projectRoot },
            'SKILL_NOT_FOUND'
          );
        }

        const shadowId = buildShadowId(skillId, projectRoot);

        // ── 参数验证 ────────────────────────────────────────────────────────
        const limit = parseInt(options.limit, 10);
        if (isNaN(limit) || limit < 1 || limit > 1000) {
          printErrorAndExit('Invalid --limit value. Must be between 1 and 1000.', {
            operation: 'Validate options',
            skillId,
            projectPath: projectRoot,
          });
        }

        const validChangeTypes: ChangeType[] = [
          'append_context',
          'tighten_trigger',
          'add_fallback',
          'prune_noise',
          'rewrite_section',
        ];
        let changeTypes: ChangeType[] | undefined;
        if (options.type) {
          const requested = options.type.split(',').map((t) => t.trim());
          const invalid = requested.filter((t) => !validChangeTypes.includes(t as ChangeType));
          if (invalid.length > 0) {
            printErrorAndExit(
              `Invalid change type(s): ${invalid.join(', ')}.\nValid types: ${validChangeTypes.join(', ')}`,
              { operation: 'Validate options', skillId, projectPath: projectRoot }
            );
          }
          changeTypes = requested as ChangeType[];
        }

        let sinceDate: Date | undefined;
        let untilDate: Date | undefined;
        if (options.since) {
          sinceDate = new Date(options.since);
          if (isNaN(sinceDate.getTime())) {
            printErrorAndExit(
              `Invalid date for --since: "${options.since}". Use YYYY-MM-DD or ISO 8601.`,
              { operation: 'Validate options', skillId, projectPath: projectRoot }
            );
          }
        }
        if (options.until) {
          untilDate = new Date(options.until);
          if (isNaN(untilDate.getTime())) {
            printErrorAndExit(
              `Invalid date for --until: "${options.until}". Use YYYY-MM-DD or ISO 8601.`,
              { operation: 'Validate options', skillId, projectPath: projectRoot }
            );
          }
        }

        if (options.appliedBy && !['auto', 'manual'].includes(options.appliedBy)) {
          printErrorAndExit(
            `Invalid --applied-by "${options.appliedBy}". Must be "auto" or "manual".`,
            { operation: 'Validate options', skillId, projectPath: projectRoot }
          );
        }

        // ── 获取并过滤记录 ───────────────────────────────────────────────────
        let records: JournalRecord[] = journalManager.getJournalRecords(shadowId, {
          limit,
          changeType: changeTypes?.[0],
        });

        if (sinceDate) {
          const sd = sinceDate;
          records = records.filter((r) => new Date(r.timestamp) >= sd);
        }
        if (untilDate) {
          const ud = untilDate;
          records = records.filter((r) => new Date(r.timestamp) <= ud);
        }
        if (options.search) {
          const searchLower = options.search.toLowerCase();
          records = records.filter((r) => (r.reason || '').toLowerCase().includes(searchLower));
        }
        if (options.appliedBy) {
          records = records.filter((r) => r.applied_by === options.appliedBy);
        }

        // ── 构建过滤条件摘要 ───────────────────────────────────────────────
        const filters: string[] = [];
        if (changeTypes) filters.push(`type: ${changeTypes.join(', ')}`);
        if (sinceDate) filters.push(`since: ${sinceDate.toLocaleDateString()}`);
        if (untilDate) filters.push(`until: ${untilDate.toLocaleDateString()}`);
        if (options.search) filters.push(`search: "${options.search}"`);
        if (options.appliedBy) filters.push(`applied-by: ${options.appliedBy}`);

        // ── 输出 ────────────────────────────────────────────────────────────
        if (records.length === 0) {
          cliInfo(`\nNo evolution records found for "${skillId}"`);
          if (filters.length > 0) {
            cliInfo(`\nFilters applied: ${filters.join(' | ')}`);
            cliInfo('\nTry relaxing the filters, or view all records with:');
            cliInfo(`  ornn skills log ${skillId}`);
          }
          return;
        }

        cliInfo(`\n📋 Evolution log for "${skillId}"`);
        if (filters.length > 0) {
          cliInfo(`   Filters: ${filters.join(' | ')}`);
        }
        cliInfo('');

        for (const record of records) {
          const appliedBy = record.applied_by === 'auto' ? '🤖' : '👤';
          cliInfo(`${appliedBy} ${formatRevision(record.revision)} — ${formatTimestamp(record.timestamp)}`);
          cliInfo(`   Type:     ${record.change_type.toUpperCase()}`);
          cliInfo(`   Reason:   ${record.reason}`);
          cliInfo(`   Sessions: ${record.source_sessions.length}`);
          cliInfo('');
        }

        cliInfo(`Showing ${records.length} record(s)`);
        cliInfo('\nTo inspect a specific change:');
        cliInfo(`  ornn skills diff ${skillId} --from <revision>`);
      } finally {
        await close();
      }
    });

  return log;
}
