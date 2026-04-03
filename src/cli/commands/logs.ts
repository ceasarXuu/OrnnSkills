import { Command } from 'commander';
import { existsSync, readFileSync, statSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { printErrorAndExit } from '../../utils/error-helper.js';

interface LogOptions {
  project: string;
  tail: string;
  level: string;
  skill?: string;
  follow?: boolean;
}

interface ParsedLogEntry {
  timestamp: string;
  level: string;
  message: string;
  raw: string;
}

function getLogFiles(): string[] {
  const logs: string[] = [];
  const globalLogPath = join(process.env.HOME || '', '.ornn', 'logs');

  if (existsSync(globalLogPath)) {
    try {
      const files = readdirSync(globalLogPath);
      for (const file of files) {
        if (file.endsWith('.log')) {
          logs.push(join(globalLogPath, file));
        }
      }
    } catch {}
  }

  return logs;
}

function parseLine(line: string): ParsedLogEntry | null {
  if (!line.trim()) return null;

  const match = line.match(/^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\]\s+(\w+):\s*(.*)$/);
  if (!match) return null;

  return {
    timestamp: match[1],
    level: match[2].toUpperCase(),
    message: match[3],
    raw: line,
  };
}

function truncateMessage(msg: string, maxLen: number = 120): string {
  if (msg.length <= maxLen) return msg;
  return msg.slice(0, maxLen) + '...';
}

function shortenPath(msg: string): string {
  return msg.replace(/\/var\/folders\/[^/]+\/[^/]+\/T\//g, '/tmp/')
            .replace(/\/Users\/[^/]+\//g, '~/');
}

function formatRelativeTime(ts: string): string {
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

function levelIcon(level: string): string {
  switch (level) {
    case 'ERROR': case 'FATAL': return '🔴';
    case 'WARN': case 'WARNING': return '🟡';
    default: return '  ';
  }
}

interface LogGroup {
  message: string;
  level: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
  sampleRaw: string;
}

function groupEntries(entries: ParsedLogEntry[], maxGroupSize: number = 20): LogGroup[] {
  const map = new Map<string, LogGroup>();

  for (const entry of entries) {
    const key = `${entry.level}|${entry.message}`;
    const existing = map.get(key);

    if (existing) {
      existing.count++;
      existing.lastSeen = entry.timestamp;
    } else {
      map.set(key, {
        message: entry.message,
        level: entry.level,
        count: 1,
        firstSeen: entry.timestamp,
        lastSeen: entry.timestamp,
        sampleRaw: entry.raw,
      });
    }
  }

  return Array.from(map.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, maxGroupSize);
}

function filterAndParse(content: string, options: LogOptions): ParsedLogEntry[] {
  const lines = content.split('\n');
  const maxLines = parseInt(options.tail, 10) || 100;
  const targetLevel = (options.level || 'info').toUpperCase();

  const levelPriority: Record<string, number> = {
    DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3, FATAL: 4,
  };
  const minPriority = levelPriority[targetLevel] ?? 1;

  const parsed: ParsedLogEntry[] = [];
  for (const line of lines) {
    const entry = parseLine(line);
    if (!entry) continue;
    if ((levelPriority[entry.level] ?? 0) < minPriority) continue;
    parsed.push(entry);
  }

  return parsed.slice(-maxLines);
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + 'B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB';
  return (bytes / (1024 * 1024)).toFixed(1) + 'MB';
}

function log(msg: string): void {
  console.log(msg);
}

export function createLogsCommand(): Command {
  const logs = new Command('logs');

  logs
    .description('View OrnnSkills logs')
    .option('-p, --project <path>', 'Project root path', process.cwd())
    .option('-n, --tail <lines>', 'Number of lines to show', '50')
    .option('-l, --level <level>', 'Filter by level (error, warn, info, debug)', 'error')
    .option('-s, --skill <id>', 'Filter logs for specific skill')
    .option('--raw', 'Show raw log lines without grouping', false)
    .action((options: LogOptions & { raw?: boolean }) => {
      try {
        const logFiles = getLogFiles();

        if (logFiles.length === 0) {
          log('\n📋 OrnnSkills Logs\n');
          log('   No log files found.\n');
          log('   Log files are stored at:');
          log('   • ~/.ornn/logs/ (global)\n');
          log('   Run "ornn daemon start" to generate logs.\n');
          return;
        }

        for (const logFile of logFiles) {
          try {
            const stats = statSync(logFile);
            const basename = logFile.split('/').pop() || logFile;
            const content = readFileSync(logFile, 'utf-8');
            const entries = filterAndParse(content, options);

            if (entries.length === 0) {
              log(`\n📋 ${basename}`);
              log('   No matching log entries.');
              continue;
            }

            log('');
            log(`┌─ 📄 ${basename}  (${formatFileSize(stats.size)}, ${entries.length} entries) ───────────────────────────────`);

            if (options.raw) {
              log('│');
              for (const entry of entries) {
                const shortMsg = truncateMessage(shortenPath(entry.message), 150);
                log(`│ ${levelIcon(entry.level)} ${entry.timestamp}  ${shortMsg}`);
              }
            } else {
              const groups = groupEntries(entries);

              log('│');
              log('│  Summary:');
              log(`│    Total entries: ${entries.length}`);
              log(`│    Unique types:  ${groups.length}`);
              log('│');

              let idx = 0;
              for (const group of groups) {
                idx++;
                const shortMsg = truncateMessage(shortenPath(group.message), 100);
                const countBadge = group.count > 1 ? `  ×${group.count}` : '';
                const timeRange = group.firstSeen === group.lastSeen
                  ? formatRelativeTime(group.firstSeen)
                  : `${formatRelativeTime(group.firstSeen)} ~ ${formatRelativeTime(group.lastSeen)}`;

                log(`│  ${idx}. ${levelIcon(group.level)} ${shortMsg}${countBadge}`);
                log(`│     └─ ${timeRange}`);

                if (group.count === 1 && group.sampleRaw.includes('\n')) {
                  const stackLines = group.sampleRaw.split('\n').slice(1, 4);
                  for (const sl of stackLines) {
                    const trimmed = sl.trim();
                    if (trimmed) log(`│       ${truncateMessage(shortenPath(trimmed), 100)}`);
                  }
                }
              }

              if (groups.length < entries.length) {
                log('│');
                log(`│  ... and ${entries.length - groups.reduce((s, g) => s + g.count, 0)} more unique entries (use --raw to see all)`);
              }
            }

            log('└──────────────────────────────────────────────────────────────────────┘');
          } catch (error) {
            log(`\n   ⚠️  Could not read ${logFile}: ${error instanceof Error ? error.message : String(error)}`);
          }
        }

        log('');
        log('   💡 Tips:');
        log('     ornn logs --level error    Show only errors');
        log('     ornn logs --tail 20         Show fewer lines');
        log('     ornn logs --raw             Show raw ungrouped output');
        log('');
      } catch (error) {
        printErrorAndExit(
          error instanceof Error ? error.message : String(error),
          { operation: 'View logs', projectPath: options.project },
          undefined
        );
      }
    });

  return logs;
}
