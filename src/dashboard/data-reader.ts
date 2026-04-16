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
  lstatSync,
  readlinkSync,
} from 'node:fs';
import { basename, join } from 'node:path';
import { homedir } from 'node:os';
import type { ShadowEntry } from '../core/shadow-registry/index.js';
import type { DecisionEventRecord } from '../core/decision-events/index.js';
import { normalizeAgentUsageModelId, type AgentUsageSummary } from '../core/agent-usage/index.js';
import type { TaskEpisodeSnapshot } from '../core/task-episode/index.js';
import type { AgentUsageRecord, Trace } from '../types/index.js';
import {
  buildActivityScopeSummariesFromData,
  type ActivityScopeSummary,
} from './activity-scope-reader.js';

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
  isDisabled?: boolean;
  disabledAt?: string | null;
}

export interface SkillInfo extends ShadowEntry {
  versionsAvailable: number[];
  effectiveVersion?: number | null;
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
  decisionEvents: DecisionEventRecord[];
  activityScopes: ActivityScopeSummary[];
  agentUsage: AgentUsageStats;
}

export interface AgentUsageStats {
  callCount: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  durationMsTotal: number;
  avgDurationMs: number;
  lastCallAt: string | null;
  byModel: Record<string, AgentUsageBucket>;
  byScope: Record<string, AgentUsageBucket>;
  bySkill: Record<string, AgentUsageBucket>;
}

export interface AgentUsageBucket {
  callCount: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  durationMsTotal: number;
  avgDurationMs: number;
  lastCallAt: string | null;
}

interface CachedAgentUsageStats {
  signature: string;
  stats: AgentUsageStats;
}

const agentUsageStatsCache = new Map<string, CachedAgentUsageStats>();
const SNAPSHOT_RECENT_TRACE_LIMIT = 50;
const SNAPSHOT_DECISION_EVENT_LIMIT = 150;
const SNAPSHOT_SKILL_CONTEXT_LIMIT = 24;
const SNAPSHOT_SKILL_CONTEXT_SCAN_LINES = 4000;

function getGlobalDaemonPidPath(): string {
  return join(homedir(), '.ornn', 'daemon.pid');
}

function listTraceNdjsonPaths(projectRoot: string): string[] {
  const stateDir = join(projectRoot, '.ornn', 'state');
  if (!existsSync(stateDir)) return [];

  try {
    return readdirSync(stateDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.ndjson'))
      .map((entry) => entry.name)
      .filter((name) => name !== 'decision-events.ndjson' && name !== 'agent-usage.ndjson')
      .sort()
      .map((name) => join(stateDir, name));
  } catch {
    return [];
  }
}

function countProcessedTraceIds(projectRoot: string): number {
  const traceIds = new Set<string>();
  for (const filePath of listTraceNdjsonPaths(projectRoot)) {
    let content = '';
    try {
      content = readFileSync(filePath, 'utf-8');
    } catch {
      continue;
    }
    for (const line of content.split(/\r?\n/)) {
      if (!line.trim()) continue;
      try {
        const raw = JSON.parse(line) as { trace_id?: unknown };
        if (typeof raw.trace_id === 'string' && raw.trace_id) {
          traceIds.add(raw.trace_id);
        }
      } catch {
        // ignore malformed rows
      }
    }
  }
  return traceIds.size;
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
  const projectPidPath = join(projectRoot, '.ornn', 'daemon.pid');
  const pidPath = existsSync(projectPidPath) ? projectPidPath : getGlobalDaemonPidPath();

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
  if ((checkpoint.processedTraces ?? 0) <= 0) {
    checkpoint.processedTraces = countProcessedTraceIds(projectRoot);
  }

  const backfilled = backfillOptimizationStatus(projectRoot, checkpoint.optimizationStatus);

  return {
    ...checkpoint,
    isRunning,
    pid,
    optimizationStatus: backfilled,
  };
}

function backfillOptimizationStatus(
  projectRoot: string,
  current: DaemonStatus['optimizationStatus']
): DaemonStatus['optimizationStatus'] {
  let next = { ...current };
  const taskEpisodesPath = join(projectRoot, '.ornn', 'state', 'task-episodes.json');
  if (existsSync(taskEpisodesPath)) {
    try {
      const parsed = JSON.parse(readFileSync(taskEpisodesPath, 'utf-8')) as {
        episodes?: Array<{
          state?: string;
          skillSegments?: Array<{ skillId?: string }>;
          analysisStatus?: string;
        }>;
      };
      const activeEpisode = parsed.episodes?.find((episode) => episode.analysisStatus === 'running' || episode.state === 'analyzing');
      if (activeEpisode) {
        next = {
          ...next,
          currentState: 'analyzing',
          currentSkillId: activeEpisode.skillSegments?.[0]?.skillId ?? next.currentSkillId,
          queueSize: Math.max(next.queueSize, 1),
        };
      }
    } catch {
      // ignore malformed snapshot
    }
  }

  const events = readRecentDecisionEvents(projectRoot, 200);
  if (!next.lastOptimizationAt) {
    const latestPatch = events.find((event) => event.tag === 'patch_applied');
    if (latestPatch?.timestamp) {
      next.lastOptimizationAt = latestPatch.timestamp;
    }
  }
  if (!next.lastError) {
    const latestTerminalEvent = events.find((event) =>
      event.tag === 'analysis_failed' ||
      event.tag === 'patch_applied' ||
      event.tag === 'evaluation_result'
    );
    if (latestTerminalEvent?.tag === 'analysis_failed') {
      next = {
        ...next,
        lastError: latestTerminalEvent.detail ?? latestTerminalEvent.reason ?? next.lastError,
      };
    }
  }

  return next;
}

// ─── Shadow Skills ────────────────────────────────────────────────────────────

function listVersionsForSkill(
  projectRoot: string,
  skillId: string,
  runtime: 'codex' | 'claude' | 'opencode' = 'codex'
): number[] {
  const candidates = [
    join(projectRoot, '.ornn', 'skills', runtime, skillId, 'versions'),
    // backward compatibility (old layout without runtime segment)
    join(projectRoot, '.ornn', 'skills', skillId, 'versions'),
  ];

  for (const versionsDir of candidates) {
    if (!existsSync(versionsDir)) continue;
    try {
      return readdirSync(versionsDir, { withFileTypes: true })
        .filter((e) => e.isDirectory() && /^v\d+$/.test(e.name))
        .map((e) => parseInt(e.name.slice(1), 10))
        .sort((a, b) => a - b);
    } catch {
      // try next candidate
    }
  }

  return [];
}

function readEffectiveVersionForSkill(
  projectRoot: string,
  skillId: string,
  runtime: 'codex' | 'claude' | 'opencode' = 'codex'
): number | null {
  const candidates = [
    join(projectRoot, '.ornn', 'skills', runtime, skillId, 'versions', 'latest'),
    join(projectRoot, '.ornn', 'skills', skillId, 'versions', 'latest'),
  ];

  for (const latestPath of candidates) {
    if (!existsSync(latestPath)) continue;
    try {
      const stats = lstatSync(latestPath);
      if (!stats.isSymbolicLink()) continue;
      const target = readlinkSync(latestPath);
      const match = target.match(/v(\d+)/);
      if (match) {
        return parseInt(match[1], 10);
      }
    } catch {
      // try next candidate
    }
  }

  return null;
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
      versionsAvailable: listVersionsForSkill(
        projectRoot,
        entry.skillId,
        (entry.runtime ?? 'codex') as 'codex' | 'claude' | 'opencode'
      ),
      effectiveVersion: readEffectiveVersionForSkill(
        projectRoot,
        entry.skillId,
        (entry.runtime ?? 'codex') as 'codex' | 'claude' | 'opencode'
      ),
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
  version: number,
  runtime: 'codex' | 'claude' | 'opencode' = 'codex'
): { content: string; metadata: SkillVersionMeta } | null {
  const versionDirs = [
    join(projectRoot, '.ornn', 'skills', runtime, skillId, 'versions', `v${version}`),
    // backward compatibility (old layout without runtime segment)
    join(projectRoot, '.ornn', 'skills', skillId, 'versions', `v${version}`),
  ];

  for (const versionDir of versionDirs) {
    const contentPath = join(versionDir, 'skill.md');
    const metadataPath = join(versionDir, 'metadata.json');
    if (!existsSync(contentPath) || !existsSync(metadataPath)) continue;
    try {
      const content = readFileSync(contentPath, 'utf-8');
      const metadata = JSON.parse(readFileSync(metadataPath, 'utf-8')) as SkillVersionMeta;
      return { content, metadata };
    } catch {
      // try next candidate
    }
  }

  return null;
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

function readFileSignature(filePath: string): string {
  if (!existsSync(filePath)) return 'missing';
  try {
    const stat = statSync(filePath);
    return `${stat.size}:${Math.floor(stat.mtimeMs)}`;
  } catch {
    return 'error';
  }
}

function collectRecentTraceCandidates(projectRoot: string, maxLinesPerFile: number): TraceEntry[] {
  const tracePaths = listTraceNdjsonPaths(projectRoot);
  const traces = new Map<string, TraceEntry>();

  for (const ndjsonPath of tracePaths) {
    const lines = tailNdjson(ndjsonPath, maxLinesPerFile);
    for (const line of lines) {
      try {
        const raw = JSON.parse(line) as Partial<TraceEntry> & { skill_refs?: string[] };
        if (!raw.trace_id) continue;
        traces.set(String(raw.trace_id), {
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
  }

  return [...traces.values()]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export function readRecentTraces(projectRoot: string, limit = 50): TraceEntry[] {
  return collectRecentTraceCandidates(projectRoot, Math.max(limit * 4, 200)).slice(0, limit);
}

function readRecentActivityTraces(projectRoot: string): TraceEntry[] {
  const latestTraces = readRecentTraces(projectRoot, SNAPSHOT_RECENT_TRACE_LIMIT);
  const existingIds = new Set(latestTraces.map((trace) => trace.trace_id));
  const skillContext = collectRecentTraceCandidates(projectRoot, SNAPSHOT_SKILL_CONTEXT_SCAN_LINES)
    .filter((trace) => trace.skill_refs.length > 0 && !existingIds.has(trace.trace_id))
    .slice(0, SNAPSHOT_SKILL_CONTEXT_LIMIT);

  if (skillContext.length === 0) return latestTraces;
  return latestTraces
    .concat(skillContext)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
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
  const recentTraces = readRecentTraces(projectRoot, SNAPSHOT_RECENT_TRACE_LIMIT);
  const decisionEvents = readRecentDecisionEvents(projectRoot, SNAPSHOT_DECISION_EVENT_LIMIT);
  const taskEpisodes = readTaskEpisodeSnapshot(projectRoot);
  return {
    daemon: readDaemonStatus(projectRoot),
    skills: readSkills(projectRoot),
    traceStats: computeTraceStats(recentTraces),
    recentTraces: readRecentActivityTraces(projectRoot),
    decisionEvents,
    activityScopes: buildActivityScopeSummariesFromData({
      projectName: basename(projectRoot),
      episodes: taskEpisodes.episodes.slice(-150),
      decisionEvents,
    }).slice(0, 150),
    agentUsage: readAgentUsageStats(projectRoot),
  };
}

export function readProjectSnapshotVersion(projectRoot: string): string {
  const stateDir = join(projectRoot, '.ornn', 'state');
  const shadowsDir = join(projectRoot, '.ornn', 'shadows');
  const traceSignatures = listTraceNdjsonPaths(projectRoot)
    .map((filePath) => `${filePath}:${readFileSignature(filePath)}`)
    .join(',');
  const parts = [
    readFileSignature(join(projectRoot, '.ornn', 'daemon.pid')),
    readFileSignature(getGlobalDaemonPidPath()),
    readFileSignature(join(stateDir, 'daemon-checkpoint.json')),
    readFileSignature(join(stateDir, 'task-episodes.json')),
    traceSignatures || 'missing',
    readFileSignature(join(stateDir, 'decision-events.ndjson')),
    readFileSignature(join(stateDir, 'agent-usage.ndjson')),
    readFileSignature(join(stateDir, 'agent-usage-summary.json')),
    readFileSignature(join(shadowsDir, 'index.json')),
  ];
  return parts.join('|');
}

export function readRecentDecisionEvents(projectRoot: string, limit = 50): DecisionEventRecord[] {
  const ndjsonPath = join(projectRoot, '.ornn', 'state', 'decision-events.ndjson');
  const lines = tailNdjson(ndjsonPath, Math.max(limit * 2, 200));
  const events: DecisionEventRecord[] = [];
  for (const line of lines) {
    try {
      const raw = JSON.parse(line) as Partial<DecisionEventRecord>;
      if (!raw.id || !raw.tag) continue;
      events.push({
        id: String(raw.id),
        timestamp: String(raw.timestamp ?? ''),
        tag: String(raw.tag),
        businessCategory: raw.businessCategory ?? null,
        businessTag: raw.businessTag ?? null,
        episodeId: raw.episodeId ?? null,
        inputSummary: raw.inputSummary ?? null,
        judgment: raw.judgment ?? null,
        nextAction: raw.nextAction ?? null,
        skillId: raw.skillId ?? null,
        runtime: raw.runtime ?? null,
        windowId: raw.windowId ?? null,
        traceId: raw.traceId ?? null,
        sessionId: raw.sessionId ?? null,
        status: raw.status ?? null,
        detail: raw.detail ?? null,
        confidence: raw.confidence ?? null,
        changeType: raw.changeType ?? null,
        reason: raw.reason ?? null,
        strategy: raw.strategy ?? null,
        traceCount: raw.traceCount ?? null,
        sessionCount: raw.sessionCount ?? null,
        ruleName: raw.ruleName ?? null,
        linesAdded: raw.linesAdded ?? null,
        linesRemoved: raw.linesRemoved ?? null,
        runtimeDrift: raw.runtimeDrift ?? null,
        evidence: raw.evidence ?? null,
      });
    } catch {
      // skip malformed lines
    }
  }

  return events
    .sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)))
    .slice(0, limit);
}

export function readTaskEpisodeSnapshot(projectRoot: string): TaskEpisodeSnapshot {
  const snapshotPath = join(projectRoot, '.ornn', 'state', 'task-episodes.json');
  if (!existsSync(snapshotPath)) {
    return {
      updatedAt: new Date().toISOString(),
      episodes: [],
    };
  }

  try {
    const parsed = JSON.parse(readFileSync(snapshotPath, 'utf-8')) as Partial<TaskEpisodeSnapshot>;
    return {
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
      episodes: Array.isArray(parsed.episodes) ? parsed.episodes : [],
    };
  } catch {
    return {
      updatedAt: new Date().toISOString(),
      episodes: [],
    };
  }
}

function emptyAgentUsageStats(): AgentUsageStats {
  return {
    callCount: 0,
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    durationMsTotal: 0,
    avgDurationMs: 0,
    lastCallAt: null,
    byModel: {},
    byScope: {},
    bySkill: {},
  };
}

export function readAgentUsageStats(projectRoot: string): AgentUsageStats {
  const ndjsonPath = join(projectRoot, '.ornn', 'state', 'agent-usage.ndjson');
  if (existsSync(ndjsonPath)) {
    const signature = readFileSignature(ndjsonPath);
    const cached = agentUsageStatsCache.get(ndjsonPath);
    if (cached && cached.signature === signature) {
      return cached.stats;
    }
    const stats = readAgentUsageStatsFromNdjson(ndjsonPath);
    agentUsageStatsCache.set(ndjsonPath, { signature, stats });
    return stats;
  }

  const summaryPath = join(projectRoot, '.ornn', 'state', 'agent-usage-summary.json');
  if (!existsSync(summaryPath)) return emptyAgentUsageStats();
  const signature = readFileSignature(summaryPath);
  const cached = agentUsageStatsCache.get(summaryPath);
  if (cached && cached.signature === signature) {
    return cached.stats;
  }
  try {
    const parsed = JSON.parse(readFileSync(summaryPath, 'utf-8')) as Partial<AgentUsageSummary>;
    const stats = {
      callCount: typeof parsed.callCount === 'number' ? parsed.callCount : 0,
      promptTokens: typeof parsed.promptTokens === 'number' ? parsed.promptTokens : 0,
      completionTokens: typeof parsed.completionTokens === 'number' ? parsed.completionTokens : 0,
      totalTokens: typeof parsed.totalTokens === 'number' ? parsed.totalTokens : 0,
      durationMsTotal: typeof (parsed as { durationMsTotal?: unknown }).durationMsTotal === 'number'
        ? (parsed as { durationMsTotal: number }).durationMsTotal
        : 0,
      avgDurationMs: typeof (parsed as { avgDurationMs?: unknown }).avgDurationMs === 'number'
        ? (parsed as { avgDurationMs: number }).avgDurationMs
        : 0,
      lastCallAt: typeof (parsed as { lastCallAt?: unknown }).lastCallAt === 'string'
        ? (parsed as { lastCallAt: string }).lastCallAt
        : null,
      byModel: parsed.byModel && typeof parsed.byModel === 'object'
        ? normalizeUsageBucketMap(parsed.byModel as Record<string, unknown>)
        : {},
      byScope: parsed.byScope && typeof parsed.byScope === 'object'
        ? normalizeUsageBucketMap(parsed.byScope as Record<string, unknown>)
        : {},
      bySkill: (parsed as { bySkill?: unknown }).bySkill && typeof (parsed as { bySkill?: unknown }).bySkill === 'object'
        ? normalizeUsageBucketMap((parsed as { bySkill: Record<string, unknown> }).bySkill)
        : {},
    };
    agentUsageStatsCache.set(summaryPath, { signature, stats });
    return stats;
  } catch {
    return emptyAgentUsageStats();
  }
}

function readAgentUsageStatsFromNdjson(filePath: string): AgentUsageStats {
  const stats = emptyAgentUsageStats();
  try {
    const lines = readFileSync(filePath, 'utf-8')
      .split('\n')
      .filter((line) => line.trim().length > 0);

    for (const line of lines) {
      try {
        const record = JSON.parse(line) as Partial<AgentUsageRecord>;
        ingestUsageRecord(stats, record);
      } catch {
        // skip malformed rows
      }
    }

    finalizeUsageStats(stats);
    return stats;
  } catch {
    return emptyAgentUsageStats();
  }
}

export function readAgentUsageRecords(projectRoot: string, limit = 400): AgentUsageRecord[] {
  const filePath = join(projectRoot, '.ornn', 'state', 'agent-usage.ndjson');
  if (!existsSync(filePath)) return [];

  const lines = tailNdjson(filePath, Math.max(limit * 2, 400));
  const records: AgentUsageRecord[] = [];
  for (const line of lines) {
    try {
      const raw = JSON.parse(line) as Partial<AgentUsageRecord>;
      if (!raw.id || !raw.timestamp || !raw.scope || !raw.eventId || !raw.model) continue;
      records.push({
        id: String(raw.id),
        timestamp: String(raw.timestamp),
        scope: raw.scope,
        eventId: String(raw.eventId),
        skillId: typeof raw.skillId === 'string' ? raw.skillId : null,
        episodeId: typeof raw.episodeId === 'string' ? raw.episodeId : null,
        triggerTraceId: typeof raw.triggerTraceId === 'string' ? raw.triggerTraceId : null,
        windowId: typeof raw.windowId === 'string' ? raw.windowId : null,
        model: String(raw.model),
        promptTokens: typeof raw.promptTokens === 'number' ? raw.promptTokens : 0,
        completionTokens: typeof raw.completionTokens === 'number' ? raw.completionTokens : 0,
        totalTokens: typeof raw.totalTokens === 'number' ? raw.totalTokens : 0,
        durationMs: typeof raw.durationMs === 'number' ? raw.durationMs : 0,
      });
    } catch {
      // ignore malformed rows
    }
  }

  return records
    .sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)))
    .slice(-limit);
}

function parseTraceRecord(line: string): Trace | null {
  try {
    const raw = JSON.parse(line) as Partial<Trace>;
    if (!raw.trace_id || !raw.timestamp || !raw.runtime || !raw.session_id || !raw.turn_id || !raw.event_type || !raw.status) {
      return null;
    }
    return {
      trace_id: String(raw.trace_id),
      runtime: raw.runtime,
      session_id: String(raw.session_id),
      turn_id: String(raw.turn_id),
      event_type: raw.event_type,
      timestamp: String(raw.timestamp),
      user_input: typeof raw.user_input === 'string' ? raw.user_input : undefined,
      assistant_output: typeof raw.assistant_output === 'string' ? raw.assistant_output : undefined,
      tool_name: typeof raw.tool_name === 'string' ? raw.tool_name : undefined,
      tool_args: raw.tool_args && typeof raw.tool_args === 'object' ? raw.tool_args : undefined,
      tool_result: raw.tool_result && typeof raw.tool_result === 'object' ? raw.tool_result : undefined,
      files_changed: Array.isArray(raw.files_changed) ? raw.files_changed.map((item) => String(item)) : undefined,
      skill_refs: Array.isArray(raw.skill_refs) ? raw.skill_refs.map((item) => String(item)) : undefined,
      status: raw.status,
      metadata: raw.metadata && typeof raw.metadata === 'object' ? raw.metadata : undefined,
    };
  } catch {
    return null;
  }
}

export function readTracesByIds(projectRoot: string, traceIds: string[]): Trace[] {
  const wanted = new Set(traceIds.filter(Boolean));
  if (wanted.size === 0) return [];

  const traces = new Map<string, Trace>();
  for (const filePath of listTraceNdjsonPaths(projectRoot)) {
    let content = '';
    try {
      content = readFileSync(filePath, 'utf-8');
    } catch {
      continue;
    }

    for (const line of content.split(/\r?\n/)) {
      if (!line.trim()) continue;
      const trace = parseTraceRecord(line);
      if (!trace || !wanted.has(trace.trace_id)) continue;
      traces.set(trace.trace_id, trace);
      if (traces.size >= wanted.size) {
        break;
      }
    }
    if (traces.size >= wanted.size) {
      break;
    }
  }

  return [...traces.values()].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

function emptyUsageBucket(): AgentUsageBucket {
  return {
    callCount: 0,
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    durationMsTotal: 0,
    avgDurationMs: 0,
    lastCallAt: null,
  };
}

function normalizeUsageBucketMap(input: Record<string, unknown>): Record<string, AgentUsageBucket> {
  const out: Record<string, AgentUsageBucket> = {};
  for (const [key, value] of Object.entries(input)) {
    if (!value || typeof value !== 'object') continue;
    const item = value as Partial<AgentUsageBucket>;
    const normalizedKey = normalizeAgentUsageModelId(key) || key;
    const bucket = emptyUsageBucket();
    bucket.callCount = typeof item.callCount === 'number' ? item.callCount : 0;
    bucket.promptTokens = typeof item.promptTokens === 'number' ? item.promptTokens : 0;
    bucket.completionTokens = typeof item.completionTokens === 'number' ? item.completionTokens : 0;
    bucket.totalTokens = typeof item.totalTokens === 'number' ? item.totalTokens : 0;
    bucket.durationMsTotal = typeof item.durationMsTotal === 'number' ? item.durationMsTotal : 0;
    bucket.avgDurationMs = typeof item.avgDurationMs === 'number'
      ? item.avgDurationMs
      : (bucket.callCount > 0 ? Math.round(bucket.durationMsTotal / bucket.callCount) : 0);
    bucket.lastCallAt = typeof item.lastCallAt === 'string' ? item.lastCallAt : null;
    const existing = out[normalizedKey];
    if (existing) {
      existing.callCount += bucket.callCount;
      existing.promptTokens += bucket.promptTokens;
      existing.completionTokens += bucket.completionTokens;
      existing.totalTokens += bucket.totalTokens;
      existing.durationMsTotal += bucket.durationMsTotal;
      if (bucket.lastCallAt && (!existing.lastCallAt || bucket.lastCallAt > existing.lastCallAt)) {
        existing.lastCallAt = bucket.lastCallAt;
      }
      existing.avgDurationMs = existing.callCount > 0 ? Math.round(existing.durationMsTotal / existing.callCount) : 0;
      continue;
    }
    out[normalizedKey] = bucket;
  }
  return out;
}

function ingestUsageRecord(stats: AgentUsageStats, record: Partial<AgentUsageRecord>): void {
  const model = typeof record.model === 'string' ? normalizeAgentUsageModelId(record.model) : '';
  const scope = typeof record.scope === 'string' ? record.scope.trim() : '';
  const skillId = typeof record.skillId === 'string' ? record.skillId.trim() : '';
  if (!model || !scope) return;

  const promptTokens = typeof record.promptTokens === 'number' ? record.promptTokens : 0;
  const completionTokens = typeof record.completionTokens === 'number' ? record.completionTokens : 0;
  const totalTokens = typeof record.totalTokens === 'number' ? record.totalTokens : 0;
  const durationMs = typeof record.durationMs === 'number' ? record.durationMs : 0;
  const timestamp = typeof record.timestamp === 'string' ? record.timestamp : null;

  applyUsageDelta(stats, promptTokens, completionTokens, totalTokens, durationMs, timestamp);
  applyUsageDelta(
    ensureUsageBucket(stats.byModel, model),
    promptTokens,
    completionTokens,
    totalTokens,
    durationMs,
    timestamp
  );
  applyUsageDelta(
    ensureUsageBucket(stats.byScope, scope),
    promptTokens,
    completionTokens,
    totalTokens,
    durationMs,
    timestamp
  );
  if (skillId) {
    applyUsageDelta(
      ensureUsageBucket(stats.bySkill, skillId),
      promptTokens,
      completionTokens,
      totalTokens,
      durationMs,
      timestamp
    );
  }
}

function ensureUsageBucket(map: Record<string, AgentUsageBucket>, key: string): AgentUsageBucket {
  if (!map[key]) {
    map[key] = emptyUsageBucket();
  }
  return map[key];
}

function applyUsageDelta(
  target: AgentUsageStats | AgentUsageBucket,
  promptTokens: number,
  completionTokens: number,
  totalTokens: number,
  durationMs: number,
  timestamp: string | null
): void {
  target.callCount += 1;
  target.promptTokens += promptTokens;
  target.completionTokens += completionTokens;
  target.totalTokens += totalTokens;
  target.durationMsTotal += durationMs;
  if (timestamp && (!target.lastCallAt || timestamp > target.lastCallAt)) {
    target.lastCallAt = timestamp;
  }
}

function finalizeUsageStats(stats: AgentUsageStats): void {
  stats.avgDurationMs = stats.callCount > 0 ? Math.round(stats.durationMsTotal / stats.callCount) : 0;
  finalizeUsageBucketMap(stats.byModel);
  finalizeUsageBucketMap(stats.byScope);
  finalizeUsageBucketMap(stats.bySkill);
}

function finalizeUsageBucketMap(map: Record<string, AgentUsageBucket>): void {
  for (const bucket of Object.values(map)) {
    bucket.avgDurationMs = bucket.callCount > 0 ? Math.round(bucket.durationMsTotal / bucket.callCount) : 0;
  }
}
