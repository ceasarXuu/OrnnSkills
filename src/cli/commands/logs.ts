import { Command } from 'commander';
import { existsSync, statSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { printErrorAndExit } from '../../utils/error-helper.js';
import {
  truncateMessage,
  shortenPath,
  formatRelativeTime,
  levelIcon,
} from '../../utils/cli-formatters.js';
import {
  readRecentRotatingLogEntries,
  type GlobalLogEntry,
} from '../../utils/global-log-source.js';

interface LogOptions {
  project: string;
  tail: string;
  level: string;
  skill?: string;
  follow?: boolean;
}

type ParsedLogEntry = GlobalLogEntry;

interface LogStream {
  displayName: string;
  basePath: string;
  totalSizeBytes: number;
  latestMtimeMs: number;
}

function normalizeLogStreamName(fileName: string): string {
  const rotatedMatch = fileName.match(/^(.*?)(\d+)\.log$/);
  if (rotatedMatch) {
    return `${rotatedMatch[1]}.log`;
  }

  return fileName;
}

function getLogStreams(): LogStream[] {
  const globalLogPath = join(process.env.HOME || '', '.ornn', 'logs');
  const streams = new Map<string, LogStream>();

  if (!existsSync(globalLogPath)) {
    return [];
  }

  try {
    const files = readdirSync(globalLogPath).filter((file) => file.endsWith('.log'));
    for (const file of files) {
      const displayName = normalizeLogStreamName(file);
      const stream = streams.get(displayName) ?? {
        displayName,
        basePath: join(globalLogPath, displayName),
        totalSizeBytes: 0,
        latestMtimeMs: 0,
      };
      try {
        const stats = statSync(join(globalLogPath, file));
        stream.totalSizeBytes += stats.size;
        stream.latestMtimeMs = Math.max(stream.latestMtimeMs, stats.mtimeMs);
      } catch {
        // Ignore unreadable files
      }
      streams.set(displayName, stream);
    }
  } catch (_err) {
    // Ignore errors reading global log directory
  }

  return Array.from(streams.values()).sort(
    (left, right) => right.latestMtimeMs - left.latestMtimeMs || left.displayName.localeCompare(right.displayName)
  );
}

interface LogGroup {
  message: string;
  level: string;
  context: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
  sampleRaw: string;
}

function groupEntries(entries: ParsedLogEntry[], maxGroupSize: number = 20): LogGroup[] {
  const map = new Map<string, LogGroup>();

  for (const entry of entries) {
    const key = `${entry.level}|${entry.context}|${entry.message}`;
    const existing = map.get(key);

    if (existing) {
      existing.count++;
      existing.lastSeen = entry.timestamp;
    } else {
      map.set(key, {
        message: entry.message,
        level: entry.level,
        context: entry.context,
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

function filterEntries(entries: ParsedLogEntry[], options: LogOptions): ParsedLogEntry[] {
  const maxLines = parseInt(options.tail, 10) || 100;
  const targetLevel = (options.level || 'info').toUpperCase();
  const skillFilter = options.skill?.toLowerCase();

  const levelPriority: Record<string, number> = {
    DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3, FATAL: 4,
  };
  const minPriority = levelPriority[targetLevel] ?? 1;

  const parsed: ParsedLogEntry[] = [];
  for (const entry of entries) {
    if ((levelPriority[entry.level] ?? 0) < minPriority) continue;
    // --skill filters on the full raw line so it catches skill IDs in both
    // template-interpolated messages and structured metadata (key=skillId).
    if (skillFilter && !entry.raw.toLowerCase().includes(skillFilter)) continue;
    parsed.push(entry);
  }

  return parsed.slice(-maxLines);
}

function readEntriesForStream(stream: LogStream, options: LogOptions): ParsedLogEntry[] {
  const maxLines = parseInt(options.tail, 10) || 100;
  let scanLimit = Math.max(maxLines * 20, 2000);

  while (true) {
    const scannedEntries = readRecentRotatingLogEntries(stream.basePath, scanLimit);
    const filteredEntries = filterEntries(scannedEntries, options);

    if (filteredEntries.length >= maxLines || scannedEntries.length < scanLimit) {
      return filteredEntries;
    }

    scanLimit *= 2;
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + 'B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB';
  return (bytes / (1024 * 1024)).toFixed(1) + 'MB';
}

function log(msg: string): void {
  console.log(msg);
}

function clearLogs(): Promise<void> {
  const logDir = join(process.env.HOME || '', '.ornn', 'logs');

  if (!existsSync(logDir)) {
    log('\n📋 No log directory found. Nothing to clear.\n');
    return Promise.resolve();
  }

  const files = readdirSync(logDir).filter((f) => f.endsWith('.log'));

  if (files.length === 0) {
    log('\n📋 No log files to clear.\n');
    return Promise.resolve();
  }

  const totalSizeBefore = files.reduce((sum, f) => {
    try { return sum + statSync(join(logDir, f)).size; } catch { return sum; }
  }, 0);

  log('\n⚠️  This will clear all log files:');
  log('');
  for (const f of files) {
    const size = statSync(join(logDir, f)).size;
    log(`   • ${f}  (${formatFileSize(size)})`);
  }
  log(`\n   Total: ${formatFileSize(totalSizeBefore)}\n`);
  log('   Type "yes" to confirm, or press Ctrl+C to cancel:');
  log('');

  process.stdout.write('   > ');

  let input = '';
  process.stdin.setRawMode(true);
  process.stdin.resume();

  return new Promise<void>((resolve) => {
    process.stdin.on('data', (chunk: Buffer) => {
      const char = chunk.toString();
      if (char === '\x03') {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeAllListeners('data');
        log('\n\n   Cancelled. No files were removed.\n');
        resolve();
        return;
      }
      if (char === '\r' || char === '\n') {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeAllListeners('data');

        if (input.toLowerCase() !== 'yes') {
          log('\n\n   Cancelled. No files were removed.\n');
          resolve();
          return;
        }

        let cleared = 0;
        for (const file of files) {
          try {
            writeFileSync(join(logDir, file), '', 'utf-8');
            cleared++;
          } catch (_err) {
            // Skip files that cannot be cleared (permission issues etc.)
          }
        }

        log(`\n   ✅ Cleared ${cleared}/${files.length} log files (${formatFileSize(totalSizeBefore)} freed)\n`);
        resolve();
        return;
      }
      if (char === '\x7f') {
        input = input.slice(0, -1);
        process.stdout.write('\b \b');
      } else {
        input += char;
        process.stdout.write(char);
      }
    });
  });
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
    .option('--clear', 'Clear all log files (requires confirmation)', false)
    .action((options: LogOptions & { raw?: boolean; clear?: boolean }) => {
      if (options.clear) {
        void clearLogs();
        return;
      }
      try {
        const logStreams = getLogStreams();

        if (logStreams.length === 0) {
          log('\n📋 OrnnSkills Logs\n');
          log('   No log files found.\n');
          log('   Log files are stored at:');
          log('   • ~/.ornn/logs/ (global)\n');
          log('   Run "ornn daemon start" to generate logs.\n');
          return;
        }

        for (const stream of logStreams) {
          try {
            const entries = readEntriesForStream(stream, options);

            if (entries.length === 0) {
              log(`\n📋 ${stream.displayName}`);
              log('   No matching log entries.');
              continue;
            }

            log('');
            log(`┌─ 📄 ${stream.displayName}  (${formatFileSize(stream.totalSizeBytes)}, ${entries.length} entries) ───────────────────────────────`);

            if (options.raw) {
              log('│');
              for (const entry of entries) {
                const ctx = entry.context ? `[${entry.context}] ` : '';
                const shortMsg = truncateMessage(shortenPath(entry.message), 140);
                log(`│ ${levelIcon(entry.level)} ${entry.timestamp}  ${ctx}${shortMsg}`);
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
                const ctx = group.context ? `[${group.context}] ` : '';
                const shortMsg = truncateMessage(shortenPath(group.message), 95);
                const countBadge = group.count > 1 ? `  ×${group.count}` : '';
                const timeRange = group.firstSeen === group.lastSeen
                  ? formatRelativeTime(group.firstSeen)
                  : `${formatRelativeTime(group.firstSeen)} ~ ${formatRelativeTime(group.lastSeen)}`;

                log(`│  ${idx}. ${levelIcon(group.level)} ${ctx}${shortMsg}${countBadge}`);
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
            log(`\n   ⚠️  Could not read ${stream.displayName}: ${error instanceof Error ? error.message : String(error)}`);
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
