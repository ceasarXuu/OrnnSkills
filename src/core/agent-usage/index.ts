import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { NDJSONWriter } from '../../storage/ndjson.js';
import { createChildLogger } from '../../utils/logger.js';
import type { AgentUsageRecord, AgentUsageScope } from '../../types/index.js';

const logger = createChildLogger('agent-usage');

export interface AgentUsageSummary {
  updatedAt: string;
  scope: 'ornn_agent';
  callCount: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  durationMsTotal: number;
  avgDurationMs: number;
  lastCallAt: string | null;
  byModel: Record<string, AgentUsageSummaryBucket>;
  byScope: Record<AgentUsageScope, AgentUsageSummaryBucket>;
  bySkill: Record<string, AgentUsageSummaryBucket>;
}

export interface AgentUsageSummaryBucket {
  callCount: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  durationMsTotal: number;
  avgDurationMs: number;
  lastCallAt: string | null;
}

export function normalizeAgentUsageModelId(model: string): string {
  const segments = String(model || '')
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean);
  if (segments.length === 0) return '';

  while (segments.length >= 3 && segments[0].toLowerCase() === segments[1].toLowerCase()) {
    segments.splice(1, 1);
  }

  return segments.join('/');
}

export function buildAgentUsageModelId(provider: string, modelName: string): string {
  const normalizedProvider = String(provider || '').trim();
  const normalizedModel = normalizeAgentUsageModelId(modelName);
  if (!normalizedProvider) return normalizedModel;
  if (!normalizedModel) return normalizedProvider;

  const modelSegments = normalizedModel.split('/').filter(Boolean);
  if (modelSegments[0]?.toLowerCase() === normalizedProvider.toLowerCase()) {
    return normalizedModel;
  }

  return normalizeAgentUsageModelId(`${normalizedProvider}/${normalizedModel}`);
}

function mergeByModelBucket(
  target: AgentUsageSummary['byModel'],
  key: string,
  item: Partial<AgentUsageSummary['byModel'][string]>
): void {
  if (!key) return;
  if (!target[key]) {
    target[key] = emptySummaryBucket();
  }
  target[key].callCount += typeof item.callCount === 'number' ? item.callCount : 0;
  target[key].promptTokens += typeof item.promptTokens === 'number' ? item.promptTokens : 0;
  target[key].completionTokens += typeof item.completionTokens === 'number' ? item.completionTokens : 0;
  target[key].totalTokens += typeof item.totalTokens === 'number' ? item.totalTokens : 0;
}

function emptySummaryBucket(): AgentUsageSummaryBucket {
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

function mergeSummaryBucket(
  target: AgentUsageSummaryBucket,
  item: Partial<AgentUsageSummaryBucket>
): void {
  target.callCount += typeof item.callCount === 'number' ? item.callCount : 0;
  target.promptTokens += typeof item.promptTokens === 'number' ? item.promptTokens : 0;
  target.completionTokens += typeof item.completionTokens === 'number' ? item.completionTokens : 0;
  target.totalTokens += typeof item.totalTokens === 'number' ? item.totalTokens : 0;
  target.durationMsTotal += typeof item.durationMsTotal === 'number' ? item.durationMsTotal : 0;

  const lastCallAt = typeof item.lastCallAt === 'string' ? item.lastCallAt : null;
  if (lastCallAt && (!target.lastCallAt || lastCallAt > target.lastCallAt)) {
    target.lastCallAt = lastCallAt;
  }

  target.avgDurationMs = target.callCount > 0 ? Math.round(target.durationMsTotal / target.callCount) : 0;
}

function updateSummaryBucket(
  target: AgentUsageSummaryBucket,
  promptTokens: number,
  completionTokens: number,
  totalTokens: number,
  durationMs: number,
  timestamp: string
): void {
  mergeSummaryBucket(target, {
    callCount: 1,
    promptTokens,
    completionTokens,
    totalTokens,
    durationMsTotal: durationMs,
    lastCallAt: timestamp,
  });
}

function emptySummary(): AgentUsageSummary {
  return {
    updatedAt: new Date().toISOString(),
    scope: 'ornn_agent',
    callCount: 0,
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    durationMsTotal: 0,
    avgDurationMs: 0,
    lastCallAt: null,
    byModel: {},
    byScope: {
      decision_explainer: emptySummaryBucket(),
      skill_call_analyzer: emptySummaryBucket(),
      readiness_probe: emptySummaryBucket(),
    },
    bySkill: {},
  };
}

export function readAgentUsageSummary(projectPath: string): AgentUsageSummary | null {
  const summaryPath = join(projectPath, '.ornn', 'state', 'agent-usage-summary.json');
  if (!existsSync(summaryPath)) return null;
  try {
    const parsed = JSON.parse(readFileSync(summaryPath, 'utf-8')) as Partial<AgentUsageSummary>;
    const summary = emptySummary();
    summary.updatedAt = typeof parsed.updatedAt === 'string' ? parsed.updatedAt : summary.updatedAt;
    summary.callCount = typeof parsed.callCount === 'number' ? parsed.callCount : 0;
    summary.promptTokens = typeof parsed.promptTokens === 'number' ? parsed.promptTokens : 0;
    summary.completionTokens = typeof parsed.completionTokens === 'number' ? parsed.completionTokens : 0;
    summary.totalTokens = typeof parsed.totalTokens === 'number' ? parsed.totalTokens : 0;
    summary.durationMsTotal = typeof parsed.durationMsTotal === 'number' ? parsed.durationMsTotal : 0;
    summary.avgDurationMs = typeof parsed.avgDurationMs === 'number'
      ? parsed.avgDurationMs
      : (summary.callCount > 0 ? Math.round(summary.durationMsTotal / summary.callCount) : 0);
    summary.lastCallAt = typeof parsed.lastCallAt === 'string' ? parsed.lastCallAt : null;
    if (parsed.byModel && typeof parsed.byModel === 'object') {
      for (const [key, value] of Object.entries(parsed.byModel)) {
        if (!value || typeof value !== 'object') continue;
        mergeByModelBucket(
          summary.byModel,
          normalizeAgentUsageModelId(key),
          value as Partial<AgentUsageSummary['byModel'][string]>
        );
      }
    }

    const rawByScope = parsed.byScope && typeof parsed.byScope === 'object'
      ? parsed.byScope as Partial<AgentUsageSummary['byScope']>
      : {};
    for (const scope of ['decision_explainer', 'skill_call_analyzer', 'readiness_probe'] as const) {
      const item = rawByScope[scope];
      if (!item) continue;
      summary.byScope[scope] = emptySummaryBucket();
      mergeSummaryBucket(summary.byScope[scope], item);
    }

    if (parsed.bySkill && typeof parsed.bySkill === 'object') {
      for (const [skillId, value] of Object.entries(parsed.bySkill)) {
        if (!value || typeof value !== 'object') continue;
        const bucket = emptySummaryBucket();
        mergeSummaryBucket(bucket, value as Partial<AgentUsageSummaryBucket>);
        summary.bySkill[skillId] = bucket;
      }
    }
    return summary;
  } catch (error) {
    logger.warn('Failed to read agent usage summary', {
      projectPath,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export function writeAgentUsageSummary(projectPath: string, summary: AgentUsageSummary): void {
  const stateDir = join(projectPath, '.ornn', 'state');
  mkdirSync(stateDir, { recursive: true });
  writeFileSync(join(stateDir, 'agent-usage-summary.json'), JSON.stringify(summary, null, 2), 'utf-8');
}

export function recordAgentUsage(
  projectPath: string,
  record: Omit<AgentUsageRecord, 'id' | 'timestamp'>
): void {
  const normalizedModel = normalizeAgentUsageModelId(record.model);
  const model = normalizedModel || String(record.model || '').trim();
  const timestamp = new Date().toISOString();

  if (model && model !== record.model) {
    logger.warn('Normalized agent usage model id before persistence', {
      projectPath,
      originalModel: record.model,
      normalizedModel: model,
      scope: record.scope,
      eventId: record.eventId,
    });
  }
  const writer = new NDJSONWriter<AgentUsageRecord>(join(projectPath, '.ornn', 'state', 'agent-usage.ndjson'));
  writer.append({
    id: randomUUID(),
    timestamp,
    ...record,
    model,
  });

  const summary = readAgentUsageSummary(projectPath) ?? emptySummary();
  summary.updatedAt = timestamp;
  summary.callCount += 1;
  summary.promptTokens += record.promptTokens;
  summary.completionTokens += record.completionTokens;
  summary.totalTokens += record.totalTokens;
  summary.durationMsTotal += record.durationMs;
  summary.avgDurationMs = summary.callCount > 0 ? Math.round(summary.durationMsTotal / summary.callCount) : 0;
  if (!summary.lastCallAt || timestamp > summary.lastCallAt) {
    summary.lastCallAt = timestamp;
  }

  if (!summary.byModel[model]) {
    summary.byModel[model] = emptySummaryBucket();
  }
  updateSummaryBucket(
    summary.byModel[model],
    record.promptTokens,
    record.completionTokens,
    record.totalTokens,
    record.durationMs,
    timestamp
  );

  if (!summary.byScope[record.scope]) {
    summary.byScope[record.scope] = emptySummaryBucket();
  }
  updateSummaryBucket(
    summary.byScope[record.scope],
    record.promptTokens,
    record.completionTokens,
    record.totalTokens,
    record.durationMs,
    timestamp
  );

  if (record.skillId) {
    const skillId = String(record.skillId).trim();
    if (skillId) {
      if (!summary.bySkill[skillId]) {
        summary.bySkill[skillId] = emptySummaryBucket();
      }
      updateSummaryBucket(
        summary.bySkill[skillId],
        record.promptTokens,
        record.completionTokens,
        record.totalTokens,
        record.durationMs,
        timestamp
      );
    }
  }

  writeAgentUsageSummary(projectPath, summary);

  logger.debug('Agent usage recorded', {
    projectPath,
    scope: record.scope,
    eventId: record.eventId,
    skillId: record.skillId,
    model,
    totalTokens: record.totalTokens,
    cumulativeCalls: summary.callCount,
  });
}
