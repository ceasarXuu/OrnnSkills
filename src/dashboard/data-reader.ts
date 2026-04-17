/**
 * Dashboard Data Reader
 *
 * 从单个项目的 .ornn/ 目录读取所有 dashboard 所需数据。
 * 全部为只读操作，不修改任何状态。
 */

import {
  existsSync,
  readFileSync,
  statSync,
} from 'node:fs';
import { basename, join } from 'node:path';
import { homedir } from 'node:os';
import type { DecisionEventRecord } from '../core/decision-events/index.js';
import { normalizeAgentUsageModelId, type AgentUsageSummary } from '../core/agent-usage/index.js';
import type { TaskEpisodeSnapshot } from '../core/task-episode/index.js';
import type { AgentUsageRecord } from '../types/index.js';
import {
  createRotatingLogCursor,
  readRecentRotatingLogEntries,
  readRotatingLogEntriesSince,
  type GlobalLogEntry,
  type RotatingLogCursor,
} from '../utils/global-log-source.js';
import { getProjectRegistration } from './projects-registry.js';
import {
  buildActivityScopeSummariesFromData,
  type ActivityScopeSummary,
} from './activity-scope-reader.js';
import {
  readSkills,
  toDashboardSkillInfo,
  type DashboardSkillInfo,
} from './readers/skills-reader.js';
import { tailNdjson } from './readers/ndjson-tail.js';
import {
  countProcessedTraceIds,
  listTraceNdjsonPaths,
  readRecentActivityTraces,
  readRecentTraces,
  computeTraceStats,
  type TraceEntry,
  type TraceStats,
} from './readers/trace-reader.js';
import { readRecentDecisionEvents } from './readers/decision-events-reader.js';
export { readSkills, readSkillContent, readSkillVersion } from './readers/skills-reader.js';
export type { SkillInfo, SkillVersionMeta, DashboardSkillInfo } from './readers/skills-reader.js';
export { readRecentTraces, readTracesByIds, computeTraceStats } from './readers/trace-reader.js';
export type { TraceEntry, TraceStats } from './readers/trace-reader.js';
export { readRecentDecisionEvents } from './readers/decision-events-reader.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DaemonStatus {
  isRunning: boolean;
  isPaused?: boolean;
  pid: number | null;
  startedAt: string | null;
  processedTraces: number;
  lastCheckpointAt: string | null;
  retryQueueSize: number;
  monitoringState?: 'active' | 'paused';
  pausedAt?: string | null;
  optimizationStatus: {
    currentState: 'idle' | 'analyzing' | 'optimizing' | 'error';
    currentSkillId: string | null;
    lastOptimizationAt: string | null;
    lastError: string | null;
    queueSize: number;
  };
}

export interface ProjectData {
  daemon: DaemonStatus;
  skills: DashboardSkillInfo[];
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
const SNAPSHOT_RECENT_TRACE_LIMIT = 30;
const SNAPSHOT_DECISION_EVENT_LIMIT = 35;
const SNAPSHOT_SKILL_CONTEXT_LIMIT = 12;
const SNAPSHOT_SKILL_CONTEXT_SCAN_LINES = 4000;

function getGlobalDaemonPidPath(): string {
  return join(homedir(), '.ornn', 'daemon.pid');
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
  const registration = getProjectRegistration(projectRoot);
  const monitoringState = registration?.monitoringState === 'paused' ? 'paused' : 'active';
  const isPaused = monitoringState === 'paused';
  const pausedAt = isPaused ? registration?.pausedAt ?? null : null;
  const effectiveOptimizationStatus = isPaused
    ? {
        ...backfilled,
        currentState: 'idle' as const,
        currentSkillId: null,
        lastError: null,
        queueSize: 0,
      }
    : backfilled;

  return {
    ...checkpoint,
    isRunning: isPaused ? false : isRunning,
    isPaused,
    pid,
    monitoringState,
    pausedAt,
    optimizationStatus: effectiveOptimizationStatus,
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

function readFileSignature(filePath: string): string {
  if (!existsSync(filePath)) return 'missing';
  try {
    const stat = statSync(filePath);
    return `${stat.size}:${Math.floor(stat.mtimeMs)}`;
  } catch {
    return 'error';
  }
}

// ─── Global Logs ──────────────────────────────────────────────────────────────

export type LogLine = GlobalLogEntry;
export type LogCursor = RotatingLogCursor;

function getGlobalLogPath(fileName: string): string {
  return join(homedir(), '.ornn', 'logs', fileName);
}

export function createGlobalLogCursor(fileName = 'combined.log'): LogCursor {
  return createRotatingLogCursor(getGlobalLogPath(fileName));
}

export function readGlobalLogs(lastN = 200): LogLine[] {
  return readRecentRotatingLogEntries(getGlobalLogPath('combined.log'), lastN);
}

/**
 * 读取全局日志文件，返回从 byteOffset 开始的新内容和新的 offset
 */
export function readLogsSince(
  cursor: number | LogCursor
): { lines: LogLine[]; newOffset: number; cursor: LogCursor } {
  return readRotatingLogEntriesSince(getGlobalLogPath('combined.log'), cursor);
}

// ─── Full Project Snapshot ────────────────────────────────────────────────────

export function readProjectSnapshot(projectRoot: string): ProjectData {
  const recentTraces = readRecentTraces(projectRoot, SNAPSHOT_RECENT_TRACE_LIMIT);
  const decisionEvents = readRecentDecisionEvents(projectRoot, SNAPSHOT_DECISION_EVENT_LIMIT);
  const taskEpisodes = readTaskEpisodeSnapshot(projectRoot);
  return {
    daemon: readDaemonStatus(projectRoot),
    skills: readSkills(projectRoot).map(toDashboardSkillInfo),
    traceStats: computeTraceStats(recentTraces),
    recentTraces: readRecentActivityTraces(
      projectRoot,
      SNAPSHOT_RECENT_TRACE_LIMIT,
      SNAPSHOT_SKILL_CONTEXT_LIMIT,
      SNAPSHOT_SKILL_CONTEXT_SCAN_LINES
    ),
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
    readFileSignature(join(homedir(), '.ornn', 'projects.json')),
  ];
  return parts.join('|');
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
