import { basename, dirname, join } from 'node:path';
import { existsSync, readdirSync, statSync, openSync, readSync, closeSync } from 'node:fs';

export interface GlobalLogEntry {
  raw: string;
  level: string;
  timestamp: string;
  context: string;
  message: string;
}

export interface RotatingLogCursor {
  path: string | null;
  offset: number;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function tailTextFile(filePath: string, maxLines = 200): string[] {
  if (!existsSync(filePath)) return [];

  const CHUNK_SIZE = 65536;
  const fd = openSync(filePath, 'r');
  try {
    const fileSize = statSync(filePath).size;
    if (fileSize === 0) return [];

    let position = fileSize;
    let lines: string[] = [];
    let remainder = '';

    while (position > 0 && lines.length < maxLines) {
      const readSize = Math.min(CHUNK_SIZE, position);
      position -= readSize;
      const buffer = Buffer.alloc(readSize);
      readSync(fd, buffer, 0, readSize, position);
      const chunk = buffer.toString('utf-8') + remainder;
      const parts = chunk.split('\n');
      remainder = parts[0];
      for (let index = parts.length - 1; index >= 1; index -= 1) {
        if (parts[index].trim()) {
          lines.push(parts[index]);
        }
      }
    }

    if (remainder.trim()) {
      lines.push(remainder);
    }

    return lines.slice(0, maxLines).reverse();
  } finally {
    closeSync(fd);
  }
}

function readTextFileFromOffset(filePath: string, offset: number): string {
  const fileSize = statSync(filePath).size;
  const readOffset = Math.max(0, Math.min(offset, fileSize));
  if (fileSize <= readOffset) return '';

  const readSize = fileSize - readOffset;
  const fd = openSync(filePath, 'r');
  try {
    const buffer = Buffer.alloc(readSize);
    readSync(fd, buffer, 0, readSize, readOffset);
    return buffer.toString('utf-8');
  } finally {
    closeSync(fd);
  }
}

export function parseGlobalLogLine(raw: string): GlobalLogEntry {
  const newFormatMatch = raw.match(/^\[([^\]]+)\]\s+(\w+)\s+(?:\[([^\]]+)\]\s+)?(.*)$/);
  if (newFormatMatch) {
    return {
      raw,
      timestamp: newFormatMatch[1],
      level: newFormatMatch[2].toUpperCase(),
      context: newFormatMatch[3] ?? '',
      message: newFormatMatch[4] ?? raw,
    };
  }

  const oldFormatMatch = raw.match(/^\[([^\]]+)\]\s+(\w+)[:\s]+\s*(.*)$/);
  if (oldFormatMatch) {
    return {
      raw,
      timestamp: oldFormatMatch[1],
      level: oldFormatMatch[2].toUpperCase(),
      context: '',
      message: oldFormatMatch[3] ?? raw,
    };
  }

  return {
    raw,
    level: 'INFO',
    timestamp: '',
    context: '',
    message: raw,
  };
}

export function listRotatingLogPaths(baseLogPath: string): string[] {
  const logDir = dirname(baseLogPath);
  if (!existsSync(logDir)) return [];

  const baseName = basename(baseLogPath);
  const stem = baseName.endsWith('.log') ? baseName.slice(0, -4) : baseName;
  const rotatedPattern = new RegExp(`^${escapeRegExp(stem)}\\d+\\.log$`);

  try {
    return readdirSync(logDir, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((name) => name === baseName || rotatedPattern.test(name))
      .map((name) => join(logDir, name));
  } catch {
    return existsSync(baseLogPath) ? [baseLogPath] : [];
  }
}

function compareRotatingLogPaths(left: string, right: string): number {
  try {
    const leftStat = statSync(left);
    const rightStat = statSync(right);
    if (leftStat.mtimeMs !== rightStat.mtimeMs) {
      return leftStat.mtimeMs - rightStat.mtimeMs;
    }
  } catch {
    // fall back to lexical ordering
  }

  return left.localeCompare(right);
}

function listSortedRotatingLogPaths(baseLogPath: string): string[] {
  return listRotatingLogPaths(baseLogPath).sort(compareRotatingLogPaths);
}

export function getLatestRotatingLogPath(baseLogPath: string): string | null {
  const candidates = listSortedRotatingLogPaths(baseLogPath);
  return candidates.at(-1) ?? null;
}

export function createRotatingLogCursor(baseLogPath: string): RotatingLogCursor {
  const latestLogPath = getLatestRotatingLogPath(baseLogPath);
  if (!latestLogPath) {
    return { path: null, offset: 0 };
  }

  try {
    return {
      path: latestLogPath,
      offset: statSync(latestLogPath).size,
    };
  } catch {
    return {
      path: latestLogPath,
      offset: 0,
    };
  }
}

export function readRecentRotatingLogEntries(baseLogPath: string, lastN = 200): GlobalLogEntry[] {
  const chunks: string[][] = [];
  let remaining = lastN;
  const candidates = listSortedRotatingLogPaths(baseLogPath).reverse();

  for (const filePath of candidates) {
    if (remaining <= 0) break;
    const lines = tailTextFile(filePath, remaining);
    if (lines.length === 0) continue;
    chunks.unshift(lines);
    remaining -= lines.length;
  }

  return chunks
    .flat()
    .slice(-lastN)
    .map(parseGlobalLogLine);
}

export function readRotatingLogEntriesSince(
  baseLogPath: string,
  cursor: number | RotatingLogCursor
): { lines: GlobalLogEntry[]; newOffset: number; cursor: RotatingLogCursor } {
  const candidates = listSortedRotatingLogPaths(baseLogPath);
  const normalizedCursor: RotatingLogCursor =
    typeof cursor === 'number'
      ? { path: baseLogPath, offset: cursor }
      : cursor;

  if (candidates.length === 0) {
    return {
      lines: [],
      newOffset: normalizedCursor.offset,
      cursor: { path: null, offset: normalizedCursor.offset },
    };
  }

  const latestLogPath = candidates.at(-1) ?? null;
  if (!latestLogPath) {
    return {
      lines: [],
      newOffset: normalizedCursor.offset,
      cursor: { path: null, offset: normalizedCursor.offset },
    };
  }

  const cursorIndex = normalizedCursor.path ? candidates.indexOf(normalizedCursor.path) : -1;
  const startIndex = cursorIndex >= 0 ? cursorIndex : 0;
  const lines: GlobalLogEntry[] = [];

  for (let index = startIndex; index < candidates.length; index += 1) {
    const filePath = candidates[index];
    const fileSize = statSync(filePath).size;
    let readOffset = 0;

    if (index === startIndex && normalizedCursor.path === filePath) {
      readOffset = normalizedCursor.offset > fileSize ? 0 : normalizedCursor.offset;
    }

    if (fileSize <= readOffset) {
      continue;
    }

    const content = readTextFileFromOffset(filePath, readOffset);
    if (!content.trim()) {
      continue;
    }

    lines.push(
      ...content
        .split('\n')
        .filter((line) => line.trim())
        .map(parseGlobalLogLine)
    );
  }

  const latestFileSize = statSync(latestLogPath).size;

  return {
    lines,
    newOffset: latestFileSize,
    cursor: { path: latestLogPath, offset: latestFileSize },
  };
}
