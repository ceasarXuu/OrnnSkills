/**
 * Dashboard Data Reader
 *
 * 从单个项目的 .ornn/ 目录读取所有 dashboard 所需数据。
 * 全部为只读操作，不修改任何状态。
 */

import {
  existsSync,
  readFileSync,
} from 'node:fs';
import { basename, join } from 'node:path';
import { homedir } from 'node:os';
import type { DecisionEventRecord } from '../core/decision-events/index.js';
import type { TaskEpisodeSnapshot } from '../core/task-episode/index.js';
import { collectSkillVersionTreeSignature, readFileSignature } from '../core/skill-domain/source-signature.js';
import type { ProjectSkillGroup, SkillInstance } from '../types/index.js';
import {
  createRotatingLogCursor,
  readRecentRotatingLogEntries,
  readRotatingLogEntriesSince,
  type GlobalLogEntry,
  type RotatingLogCursor,
} from '../utils/global-log-source.js';
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
  listTraceNdjsonPaths,
  readRecentActivityTraces,
  readRecentTraces,
  computeTraceStats,
  type TraceEntry,
  type TraceStats,
} from './readers/trace-reader.js';
import { readRecentDecisionEvents } from './readers/decision-events-reader.js';
import { readDaemonStatus, type DaemonStatus } from './readers/daemon-status-reader.js';
import {
  readAgentUsageStats,
  type AgentUsageStats,
} from './readers/agent-usage-reader.js';
export { readSkills, readSkillContent, readSkillVersion } from './readers/skills-reader.js';
export type { SkillInfo, SkillVersionMeta, DashboardSkillInfo } from './readers/skills-reader.js';
export { readRecentTraces, readTracesByIds, computeTraceStats } from './readers/trace-reader.js';
export type { TraceEntry, TraceStats } from './readers/trace-reader.js';
export { readRecentDecisionEvents } from './readers/decision-events-reader.js';
export { readDaemonStatus } from './readers/daemon-status-reader.js';
export type { DaemonStatus } from './readers/daemon-status-reader.js';
export { readAgentUsageStats, readAgentUsageRecords } from './readers/agent-usage-reader.js';
export type { AgentUsageStats, AgentUsageBucket } from './readers/agent-usage-reader.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ProjectData {
  daemon: DaemonStatus;
  skills: DashboardSkillInfo[];
  skillGroups: Array<
    Pick<
      ProjectSkillGroup,
      | 'familyId'
      | 'familyName'
      | 'skillKey'
      | 'instanceCount'
      | 'runtimeCount'
      | 'runtimes'
      | 'status'
      | 'lastUsedAt'
      | 'observedCalls'
      | 'analyzedTouches'
      | 'optimizedCount'
    >
  >;
  skillInstances: Array<
    Pick<
      SkillInstance,
      | 'instanceId'
      | 'familyId'
      | 'familyName'
      | 'skillKey'
      | 'projectId'
      | 'projectPath'
      | 'skillId'
      | 'runtime'
      | 'status'
      | 'lastUsedAt'
      | 'effectiveVersion'
    >
  >;
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
    skillGroups: [],
    skillInstances: [],
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
  const skillsDir = join(projectRoot, '.ornn', 'skills');
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
    readFileSignature(join(stateDir, 'skill-domain-projection.json')),
    readFileSignature(join(shadowsDir, 'index.json')),
    collectSkillVersionTreeSignature(skillsDir),
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
