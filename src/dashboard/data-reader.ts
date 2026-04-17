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
import type { TaskEpisodeSnapshot } from '../core/task-episode/index.js';
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
import {
  readAgentUsageStats,
  type AgentUsageStats,
} from './readers/agent-usage-reader.js';
export { readSkills, readSkillContent, readSkillVersion } from './readers/skills-reader.js';
export type { SkillInfo, SkillVersionMeta, DashboardSkillInfo } from './readers/skills-reader.js';
export { readRecentTraces, readTracesByIds, computeTraceStats } from './readers/trace-reader.js';
export type { TraceEntry, TraceStats } from './readers/trace-reader.js';
export { readRecentDecisionEvents } from './readers/decision-events-reader.js';
export { readAgentUsageStats, readAgentUsageRecords } from './readers/agent-usage-reader.js';
export type { AgentUsageStats, AgentUsageBucket } from './readers/agent-usage-reader.js';

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
