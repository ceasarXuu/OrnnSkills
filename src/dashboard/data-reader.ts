/**
 * Dashboard Data Reader
 *
 * 从单个项目的 .ornn/ 目录读取所有 dashboard 所需数据。
 * 全部为只读操作，不修改任何状态。
 */

import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  openSync,
  readSync,
  closeSync,
} from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { ShadowEntry } from '../core/shadow-registry/index.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DaemonStatus {
  isRunning: boolean;
  pid: number | null;
  startedAt: string | null;
  processedTraces: number;
  lastCheckpointAt: string | null;
  retryQueueSize: number;
  optimizationStatus: {
    currentState: 'idle' | 'analyzing' | 'optimizing' | 'error';
    currentSkillId: string | null;
    lastOptimizationAt: string | null;
    lastError: string | null;
    queueSize: number;
  };
}

export interface SkillVersionMeta {
  version: number;
  createdAt: string;
  reason: string;
  traceIds: string[];
  previousVersion: number | null;
}

export interface SkillInfo extends ShadowEntry {
  versionsAvailable: number[];
}

export interface TraceEntry {
  trace_id: string;
  runtime: string;
  session_id: string;
  turn_id: string;
  event_type: string;
  timestamp: string;
  skill_refs: string[];
  status: string;
}

export interface TraceStats {
  total: number;
  byRuntime: Record<string, number>;
  byStatus: Record<string, number>;
  byEventType: Record<string, number>;
}

export interface ProjectData {
  daemon: DaemonStatus;
  skills: SkillInfo[];
  traceStats: TraceStats;
  recentTraces: TraceEntry[];
}

// ─── Daemon Status ────────────────────────────────────────────────────────────

function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function readDaemonStatus(projectRoot: string): DaemonStatus {
  const checkpointPath = join(projectRoot, '.ornn', 'state', 'daemon-checkpoint.json');
  const pidPath = join(projectRoot, '.ornn', 'daemon.pid');

  let checkpoint: Omit<DaemonStatus, 'isRunning' | 'pid'> = {
    startedAt: null,
    processedTraces: 0,
    lastCheckpointAt: null,
    retryQueueSize: 0,
    optimizationStatus: {
      currentState: 'idle',
      currentSkillId: null,
      lastOptimizationAt: null,
      lastError: null,
      queueSize: 0,
    },
  };

  if (existsSync(checkpointPath)) {
    try {
      const raw = readFileSync(checkpointPath, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<DaemonStatus>;
      checkpoint = { ...checkpoint, ...parsed };
    } catch {
      // use defaults
    }
  }

  let pid: number | null = null;
  if (existsSync(pidPath)) {
    try {
      pid = parseInt(readFileSync(pidPath, 'utf-8').trim(), 10);
      if (isNaN(pid)) pid = null;
    } catch {
      pid = null;
    }
  }

  const isRunning = pid !== null && isProcessRunning(pid);

  return {
    isRunning,
    pid,
    ...checkpoint,
  };
}

// ─── Shadow Skills ────────────────────────────────────────────────────────────

function listVersionsForSkill(projectRoot: string, skillId: string): number[] {
  const versionsDir = join(projectRoot, '.ornn', 'skills', skillId, 'versions');
  if (!existsSync(versionsDir)) return [];

  try {
    return readdirSync(versionsDir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && /^v\d+$/.test(e.name))
      .map((e) => parseInt(e.name.slice(1), 10))
      .sort((a, b) => a - b);
  } catch {
    return [];
  }
}

export function readSkills(projectRoot: string): SkillInfo[] {
  const indexPath = join(projectRoot, '.ornn', 'shadows', 'index.json');
  if (!existsSync(indexPath)) return [];

  try {
    const raw = readFileSync(indexPath, 'utf-8');
    const parsed = JSON.parse(raw) as ShadowEntry[] | Record<string, ShadowEntry>;
    const entries = Array.isArray(parsed) ? parsed : Object.values(parsed);
    return entries.map((entry) => ({
      ...entry,
      // Dashboard 列表与 SSE 不需要完整正文，避免大 payload 导致前端卡顿
      content: '',
      runtime: entry.runtime ?? 'codex',
      versionsAvailable: listVersionsForSkill(projectRoot, entry.skillId),
    }));
  } catch {
    return [];
  }
}

// ─── Skill Content ────────────────────────────────────────────────────────────

export function readSkillContent(
  projectRoot: string,
  skillId: string,
  runtime: 'codex' | 'claude' | 'opencode' = 'codex'
): string | null {
  const candidates = [
    join(projectRoot, '.ornn', 'shadows', runtime, `${skillId}.md`),
    join(projectRoot, '.ornn', 'shadows', `${skillId}.md`), // backward compatibility
  ];

  const shadowPath = candidates.find((p) => existsSync(p));
  if (!shadowPath) return null;
  try {
    return readFileSync(shadowPath, 'utf-8');
  } catch {
    return null;
  }
}

export function readSkillVersion(
  projectRoot: string,
  skillId: string,
  version: number
): { content: string; metadata: SkillVersionMeta } | null {
  const versionDir = join(projectRoot, '.ornn', 'skills', skillId, 'versions', `v${version}`);
  const contentPath = join(versionDir, 'skill.md');
  const metadataPath = join(versionDir, 'metadata.json');

  if (!existsSync(contentPath) || !existsSync(metadataPath)) return null;

  try {
    const content = readFileSync(contentPath, 'utf-8');
    const metadata = JSON.parse(readFileSync(metadataPath, 'utf-8')) as SkillVersionMeta;
    return { content, metadata };
  } catch {
    return null;
  }
}

// ─── Traces (NDJSON tail) ─────────────────────────────────────────────────────

/**
 * 读取 NDJSON 文件的最后 N 行（tail 风格，避免大文件全量加载）
 */
function tailNdjson(filePath: string, maxLines = 200): string[] {
  if (!existsSync(filePath)) return [];

  const CHUNK = 65536; // 64KB
  const fd = openSync(filePath, 'r');
  try {
    const fileSize = statSync(filePath).size;
    if (fileSize === 0) return [];

    let pos = fileSize;
    let lines: string[] = [];
    let remainder = '';

    while (pos > 0 && lines.length < maxLines) {
      const readSize = Math.min(CHUNK, pos);
      pos -= readSize;
      const buf = Buffer.alloc(readSize);
      readSync(fd, buf, 0, readSize, pos);
      const chunk = buf.toString('utf-8') + remainder;
      const parts = chunk.split('\n');
      remainder = parts[0];
      // parts[1..] are complete lines (reversed)
      for (let i = parts.length - 1; i >= 1; i--) {
        if (parts[i].trim()) lines.push(parts[i]);
      }
    }
    if (remainder.trim()) lines.push(remainder);

    return lines.slice(0, maxLines).reverse();
  } finally {
    closeSync(fd);
  }
}

export function readRecentTraces(projectRoot: string, limit = 50): TraceEntry[] {
  const ndjsonPath = join(projectRoot, '.ornn', 'state', 'default.ndjson');
  const lines = tailNdjson(ndjsonPath, 200);

  const traces: TraceEntry[] = [];
  for (const line of lines) {
    try {
      const raw = JSON.parse(line) as Partial<TraceEntry> & { skill_refs?: string[] };
      if (!raw.trace_id) continue;
      // Dashboard 只保留展示所需字段，避免 user_input / payload 等大字段导致页面卡顿
      traces.push({
        trace_id: String(raw.trace_id),
        runtime: String(raw.runtime ?? 'unknown'),
        session_id: String(raw.session_id ?? ''),
        turn_id: String(raw.turn_id ?? ''),
        event_type: String(raw.event_type ?? 'unknown'),
        timestamp: String(raw.timestamp ?? ''),
        skill_refs: Array.isArray(raw.skill_refs) ? raw.skill_refs : [],
        status: String(raw.status ?? 'unknown'),
      });
    } catch {
      // skip malformed lines
    }
  }

  return traces.slice(-limit).reverse();
}

export function computeTraceStats(traces: TraceEntry[]): TraceStats {
  const byRuntime: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  const byEventType: Record<string, number> = {};

  for (const t of traces) {
    byRuntime[t.runtime] = (byRuntime[t.runtime] ?? 0) + 1;
    byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;
    byEventType[t.event_type] = (byEventType[t.event_type] ?? 0) + 1;
  }

  return { total: traces.length, byRuntime, byStatus, byEventType };
}

// ─── Global Logs ──────────────────────────────────────────────────────────────

export interface LogLine {
  raw: string;
  level: string;
  timestamp: string;
  context: string;
  message: string;
}

function parseLogLine(raw: string): LogLine {
  // Format: [YYYY-MM-DD HH:mm:ss] LEVEL  [context] message
  const match = raw.match(/^\[([^\]]+)\]\s+(\w+)\s+(?:\[([^\]]+)\]\s+)?(.*)$/);
  if (match) {
    return {
      raw,
      timestamp: match[1],
      level: match[2].toUpperCase(),
      context: match[3] ?? '',
      message: match[4] ?? raw,
    };
  }
  return { raw, level: 'INFO', timestamp: '', context: '', message: raw };
}

export function readGlobalLogs(lastN = 200): LogLine[] {
  const logPath = join(homedir(), '.ornn', 'logs', 'combined.log');
  const lines = tailNdjson(logPath, lastN);
  return lines.map(parseLogLine);
}

/**
 * 读取全局日志文件，返回从 byteOffset 开始的新内容和新的 offset
 */
export function readLogsSince(byteOffset: number): { lines: LogLine[]; newOffset: number } {
  const logPath = join(homedir(), '.ornn', 'logs', 'combined.log');
  if (!existsSync(logPath)) return { lines: [], newOffset: byteOffset };

  const fileSize = statSync(logPath).size;
  if (fileSize <= byteOffset) return { lines: [], newOffset: byteOffset };

  const readSize = fileSize - byteOffset;
  const fd = openSync(logPath, 'r');
  let newContent: string;
  try {
    const buf = Buffer.alloc(readSize);
    readSync(fd, buf, 0, readSize, byteOffset);
    newContent = buf.toString('utf-8');
  } finally {
    closeSync(fd);
  }

  const lines = newContent
    .split('\n')
    .filter((l) => l.trim())
    .map(parseLogLine);

  return { lines, newOffset: fileSize };
}

// ─── Full Project Snapshot ────────────────────────────────────────────────────

export function readProjectSnapshot(projectRoot: string): ProjectData {
  const traces = readRecentTraces(projectRoot, 50);
  return {
    daemon: readDaemonStatus(projectRoot),
    skills: readSkills(projectRoot),
    traceStats: computeTraceStats(traces),
    recentTraces: traces,
  };
}
