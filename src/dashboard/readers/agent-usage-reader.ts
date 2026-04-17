import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { normalizeAgentUsageModelId, type AgentUsageSummary } from '../../core/agent-usage/index.js';
import type { AgentUsageRecord } from '../../types/index.js';
import { tailNdjson } from './ndjson-tail.js';

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

function readFileSignature(filePath: string): string {
  if (!existsSync(filePath)) return 'missing';
  try {
    const stat = statSync(filePath);
    return `${stat.size}:${Math.floor(stat.mtimeMs)}`;
  } catch {
    return 'error';
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

function finalizeUsageBucketMap(map: Record<string, AgentUsageBucket>): void {
  for (const bucket of Object.values(map)) {
    bucket.avgDurationMs = bucket.callCount > 0 ? Math.round(bucket.durationMsTotal / bucket.callCount) : 0;
  }
}

function finalizeUsageStats(stats: AgentUsageStats): void {
  stats.avgDurationMs = stats.callCount > 0 ? Math.round(stats.durationMsTotal / stats.callCount) : 0;
  finalizeUsageBucketMap(stats.byModel);
  finalizeUsageBucketMap(stats.byScope);
  finalizeUsageBucketMap(stats.bySkill);
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
    } satisfies AgentUsageStats;
    agentUsageStatsCache.set(summaryPath, { signature, stats });
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
