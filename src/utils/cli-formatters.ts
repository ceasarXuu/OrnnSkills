/**
 * CLI 输出格式化工具
 *
 * 消除 CLI 命令中重复的表格输出、时间格式化、确认提示逻辑。
 */

import { cliInfo } from './cli-output.js';

// ─── 时间格式化 ───────────────────────────────────────────────────────────────

/**
 * 格式化时间戳为本地日期时间字符串（用于详情展示）。
 */
export function formatTimestamp(ts: string | Date | null | undefined): string {
  if (!ts) return 'Never';
  const d = new Date(ts);
  return isNaN(d.getTime()) ? String(ts) : d.toLocaleString();
}

/**
 * 格式化时间戳为本地日期字符串（用于列表展示）。
 */
export function formatDate(ts: string | Date | null | undefined): string {
  if (!ts) return 'Never';
  const d = new Date(ts);
  return isNaN(d.getTime()) ? String(ts) : d.toLocaleDateString();
}

/**
 * 格式化 revision 编号为固定宽度字符串，例如 `rev_0042`。
 */
export function formatRevision(rev: number): string {
  return `rev_${String(rev).padStart(4, '0')}`;
}

// ─── 表格输出 ─────────────────────────────────────────────────────────────────

export interface SkillTableRow {
  skillId: string;
  status: string;
  revision: number;
  lastOptimized: string | null;
}

/**
 * 打印 skills 列表表格。
 */
export function printSkillsTable(rows: SkillTableRow[]): void {
  cliInfo('Skill ID                Status      Revision  Last Optimized');
  cliInfo('─'.repeat(70));
  for (const row of rows) {
    const lastOpt = formatDate(row.lastOptimized);
    cliInfo(
      `${row.skillId.padEnd(22)} ${row.status.padEnd(11)} ${String(row.revision).padEnd(9)} ${lastOpt}`
    );
  }
}

// ─── 确认提示 ─────────────────────────────────────────────────────────────────

export interface ConfirmOptions {
  /** 主确认问题 */
  message: string;
  /** 警告说明行（在问题上方显示） */
  warningLines?: string[];
  /** 默认值，默认为 false（安全起见） */
  defaultValue?: boolean;
}

/**
 * 向用户显示确认提示，返回用户选择（true = 确认）。
 *
 * 抽取自各命令中重复的 inquirer confirm 模式。
 */
export async function confirmAction(opts: ConfirmOptions): Promise<boolean> {
  const inquirer = await import('inquirer').then((m) => m.default || m);

  if (opts.warningLines?.length) {
    cliInfo('');
    for (const line of opts.warningLines) {
      cliInfo(line);
    }
    cliInfo('');
  }

  const { confirmed } = await inquirer.prompt<{ confirmed: boolean }>([
    {
      type: 'confirm',
      name: 'confirmed',
      message: opts.message,
      default: opts.defaultValue ?? false,
    },
  ]);

  return confirmed;
}

// ─── 常用信息块 ───────────────────────────────────────────────────────────────

/**
 * 打印操作成功反馈。
 */
export function printSuccess(message: string, hints?: string[]): void {
  cliInfo(`✅ ${message}`);
  if (hints?.length) {
    cliInfo('');
    for (const hint of hints) {
      cliInfo(hint);
    }
  }
}

/**
 * 打印"没有可操作项目"的友好提示。
 */
export function printNoSkillsFound(projectRoot: string): void {
  cliInfo('No shadow skills found in this project');
  cliInfo('');
  cliInfo(`  Project: ${projectRoot}`);
  cliInfo('');
  cliInfo('Shadow skills are created automatically when the Agent uses a skill.');
  cliInfo('Make sure the daemon is running:');
  cliInfo('  ornn start');
}

// ─── Log viewer helpers ────────────────────────────────────────────────────────
// Used by src/cli/commands/logs.ts

/**
 * Truncate a message to the given max length.
 */
export function truncateMessage(msg: string, maxLen = 120): string {
  if (msg.length <= maxLen) return msg;
  return msg.slice(0, maxLen) + '...';
}

/**
 * Shorten common noisy path prefixes for display.
 */
export function shortenPath(msg: string): string {
  return msg
    .replace(/\/var\/folders\/[^/]+\/[^/]+\/T\//g, '/tmp/')
    .replace(/\/Users\/[^/]+\//g, '~/');
}

/**
 * Format a timestamp as a human-readable relative time (e.g. "3m ago").
 */
export function formatRelativeTime(ts: string): string {
  try {
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  } catch {
    return ts;
  }
}

/**
 * Map a log level string to an emoji indicator.
 */
export function levelIcon(level: string): string {
  switch (level) {
    case 'ERROR':
    case 'FATAL':
      return '🔴';
    case 'WARN':
    case 'WARNING':
      return '🟡';
    default:
      return '  ';
  }
}
