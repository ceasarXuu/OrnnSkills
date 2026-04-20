import {
  mkdirSync,
  rmSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type {
  AgentUsageSummary,
  AgentUsageSummaryBucket,
} from '../../../src/core/agent-usage/index.js';
import type { SseProjectState } from '../../../src/dashboard/sse/hub.js';

type DatasetPresetName = 'smoke' | 'standard' | 'stress';

export interface DatasetPreset {
  readonly name: DatasetPresetName;
  readonly skills: number;
  readonly versionsPerSkill: number;
  readonly traceFiles: number;
  readonly tracesPerFile: number;
  readonly decisionEvents: number;
  readonly agentUsageRecords: number;
  readonly sseProjects: number;
  readonly sseProjectSkills: number;
  readonly sseProjectTraceFiles: number;
}

export const DATASET_PRESETS: Record<DatasetPresetName, DatasetPreset> = {
  smoke: {
    name: 'smoke',
    skills: 32,
    versionsPerSkill: 2,
    traceFiles: 2,
    tracesPerFile: 240,
    decisionEvents: 80,
    agentUsageRecords: 800,
    sseProjects: 4,
    sseProjectSkills: 16,
    sseProjectTraceFiles: 1,
  },
  standard: {
    name: 'standard',
    skills: 160,
    versionsPerSkill: 3,
    traceFiles: 6,
    tracesPerFile: 1500,
    decisionEvents: 600,
    agentUsageRecords: 12000,
    sseProjects: 12,
    sseProjectSkills: 48,
    sseProjectTraceFiles: 3,
  },
  stress: {
    name: 'stress',
    skills: 320,
    versionsPerSkill: 4,
    traceFiles: 10,
    tracesPerFile: 3000,
    decisionEvents: 1400,
    agentUsageRecords: 30000,
    sseProjects: 24,
    sseProjectSkills: 72,
    sseProjectTraceFiles: 4,
  },
};

interface ProjectBuildConfig {
  readonly name: string;
  readonly skills: number;
  readonly versionsPerSkill: number;
  readonly traceFiles: number;
  readonly tracesPerFile: number;
  readonly decisionEvents: number;
  readonly agentUsageRecords: number;
  readonly includeHeavyState: boolean;
}

export interface DashboardBenchmarkFixture {
  readonly dataset: DatasetPreset;
  readonly homeDir: string;
  readonly rootDir: string;
  readonly primaryProjectRoot: string;
  readonly projectRoots: string[];
  readonly sseProjects: SseProjectState[];
  touchAgentUsageSummary(): void;
  touchTraceFile(index?: number): void;
  cleanup(): void;
}

const BASE_TIMESTAMP_MS = Date.parse('2026-04-21T00:00:00.000Z');

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

function emptySummary(): AgentUsageSummary {
  return {
    updatedAt: new Date(BASE_TIMESTAMP_MS).toISOString(),
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

function updateSummaryBucket(
  bucket: AgentUsageSummaryBucket,
  promptTokens: number,
  completionTokens: number,
  totalTokens: number,
  durationMs: number,
  timestamp: string
): void {
  bucket.callCount += 1;
  bucket.promptTokens += promptTokens;
  bucket.completionTokens += completionTokens;
  bucket.totalTokens += totalTokens;
  bucket.durationMsTotal += durationMs;
  bucket.avgDurationMs = bucket.callCount > 0 ? Math.round(bucket.durationMsTotal / bucket.callCount) : 0;
  if (!bucket.lastCallAt || timestamp > bucket.lastCallAt) {
    bucket.lastCallAt = timestamp;
  }
}

function updateSummary(
  summary: AgentUsageSummary,
  scope: 'decision_explainer' | 'skill_call_analyzer' | 'readiness_probe',
  skillId: string,
  model: string,
  promptTokens: number,
  completionTokens: number,
  totalTokens: number,
  durationMs: number,
  timestamp: string
): void {
  summary.updatedAt = timestamp;
  summary.callCount += 1;
  summary.promptTokens += promptTokens;
  summary.completionTokens += completionTokens;
  summary.totalTokens += totalTokens;
  summary.durationMsTotal += durationMs;
  summary.avgDurationMs = summary.callCount > 0 ? Math.round(summary.durationMsTotal / summary.callCount) : 0;
  if (!summary.lastCallAt || timestamp > summary.lastCallAt) {
    summary.lastCallAt = timestamp;
  }

  if (!summary.byModel[model]) {
    summary.byModel[model] = emptySummaryBucket();
  }
  updateSummaryBucket(
    summary.byModel[model],
    promptTokens,
    completionTokens,
    totalTokens,
    durationMs,
    timestamp
  );

  updateSummaryBucket(
    summary.byScope[scope],
    promptTokens,
    completionTokens,
    totalTokens,
    durationMs,
    timestamp
  );

  if (!summary.bySkill[skillId]) {
    summary.bySkill[skillId] = emptySummaryBucket();
  }
  updateSummaryBucket(
    summary.bySkill[skillId],
    promptTokens,
    completionTokens,
    totalTokens,
    durationMs,
    timestamp
  );
}

function writeJson(filePath: string, value: unknown): void {
  writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf-8');
}

function makeTimestamp(offsetMs: number): string {
  return new Date(BASE_TIMESTAMP_MS + offsetMs).toISOString();
}

function createSkillIndex(skillCount: number): Array<Record<string, unknown>> {
  return Array.from({ length: skillCount }, (_, index) => ({
    skillId: `skill-${index}`,
    runtime: index % 5 === 0 ? 'claude' : 'codex',
    version: String((index % 6) + 1),
    status: index % 17 === 0 ? 'disabled' : 'active',
    createdAt: makeTimestamp(index * 1000),
    updatedAt: makeTimestamp(index * 1000 + 500),
    traceCount: 30 + (index % 20),
    analysisResult: {
      confidence: 0.62 + ((index % 7) * 0.04),
    },
  }));
}

function buildProject(projectRoot: string, config: ProjectBuildConfig): string[] {
  const projectStateDir = join(projectRoot, '.ornn', 'state');
  const shadowsDir = join(projectRoot, '.ornn', 'shadows');
  const skillsDir = join(projectRoot, '.ornn', 'skills', 'codex');
  mkdirSync(projectStateDir, { recursive: true });
  mkdirSync(shadowsDir, { recursive: true });
  mkdirSync(skillsDir, { recursive: true });

  writeFileSync(join(projectRoot, '.ornn', 'daemon.pid'), String(process.pid), 'utf-8');
  writeJson(join(projectStateDir, 'daemon-checkpoint.json'), {
    startedAt: makeTimestamp(0),
    processedTraces: 0,
    lastCheckpointAt: makeTimestamp(1000),
    retryQueueSize: 2,
    optimizationStatus: {
      currentState: 'idle',
      currentSkillId: null,
      lastOptimizationAt: makeTimestamp(2000),
      lastError: null,
      queueSize: 0,
    },
  });
  writeJson(join(projectStateDir, 'task-episodes.json'), {
    updatedAt: makeTimestamp(3000),
    episodes: [],
  });
  writeJson(join(shadowsDir, 'index.json'), createSkillIndex(config.skills));

  for (let skillIndex = 0; skillIndex < config.skills; skillIndex += 1) {
    const versionsDir = join(skillsDir, `skill-${skillIndex}`, 'versions');
    mkdirSync(versionsDir, { recursive: true });
    for (let version = 1; version <= config.versionsPerSkill; version += 1) {
      mkdirSync(join(versionsDir, `v${version}`), { recursive: true });
    }
    symlinkSync(`v${config.versionsPerSkill}`, join(versionsDir, 'latest'));
  }

  const tracePaths: string[] = [];
  for (let fileIndex = 0; fileIndex < config.traceFiles; fileIndex += 1) {
    const sessionId = `${config.name}-session-${fileIndex}`;
    const filePath = join(projectStateDir, `${sessionId}.ndjson`);
    const rows: string[] = [];
    for (let rowIndex = 0; rowIndex < config.tracesPerFile; rowIndex += 1) {
      const globalIndex = fileIndex * config.tracesPerFile + rowIndex;
      rows.push(JSON.stringify({
        trace_id: `${config.name}-trace-${globalIndex}`,
        runtime: globalIndex % 7 === 0 ? 'claude' : 'codex',
        session_id: sessionId,
        turn_id: `turn-${globalIndex}`,
        event_type: globalIndex % 3 === 0 ? 'tool_call' : 'assistant_output',
        timestamp: makeTimestamp(globalIndex * 250),
        status: globalIndex % 19 === 0 ? 'failure' : 'success',
        skill_refs: globalIndex % 11 === 0 ? [`skill-${globalIndex % config.skills}`] : [],
      }));
    }
    writeFileSync(filePath, rows.join('\n') + '\n', 'utf-8');
    tracePaths.push(filePath);
  }

  if (config.decisionEvents > 0) {
    const rows: string[] = [];
    for (let index = 0; index < config.decisionEvents; index += 1) {
      rows.push(JSON.stringify({
        id: `${config.name}-evt-${index}`,
        timestamp: makeTimestamp(index * 500),
        tag: index % 5 === 0 ? 'patch_applied' : 'evaluation_result',
        detail: `detail-${index}`.repeat(8),
        reason: `reason-${index}`.repeat(6),
        judgment: `judgment-${index}`.repeat(4),
        inputSummary: `input-${index}`.repeat(3),
        evidence: {
          windowId: `scope-${index % 24}`,
          rawEvidence: `evidence-${index}`.repeat(5),
        },
        traceId: `${config.name}-trace-${index}`,
        sessionId: `${config.name}-session-${index % Math.max(config.traceFiles, 1)}`,
        status: index % 5 === 0 ? 'applied' : 'continue_collecting',
      }));
    }
    writeFileSync(join(projectStateDir, 'decision-events.ndjson'), rows.join('\n') + '\n', 'utf-8');
  }

  if (config.includeHeavyState) {
    const summary = emptySummary();
    const usageRows: string[] = [];
    const scopes = ['decision_explainer', 'skill_call_analyzer', 'readiness_probe'] as const;
    const models = [
      'deepseek/deepseek-reasoner',
      'openai/gpt-5.4-mini',
      'anthropic/claude-3-7-sonnet',
    ] as const;

    for (let index = 0; index < config.agentUsageRecords; index += 1) {
      const scope = scopes[index % scopes.length];
      const skillId = `skill-${index % config.skills}`;
      const model = models[index % models.length];
      const promptTokens = 400 + ((index % 13) * 17);
      const completionTokens = 80 + ((index % 7) * 11);
      const totalTokens = promptTokens + completionTokens;
      const durationMs = 120 + ((index % 9) * 35);
      const timestamp = makeTimestamp(index * 333);
      usageRows.push(JSON.stringify({
        id: `${config.name}-usage-${index}`,
        timestamp,
        scope,
        eventId: `${config.name}-event-${index}`,
        skillId,
        episodeId: null,
        triggerTraceId: null,
        windowId: `window-${index % 64}`,
        model,
        promptTokens,
        completionTokens,
        totalTokens,
        durationMs,
      }));
      updateSummary(
        summary,
        scope,
        skillId,
        model,
        promptTokens,
        completionTokens,
        totalTokens,
        durationMs,
        timestamp
      );
    }

    const ndjsonPath = join(projectStateDir, 'agent-usage.ndjson');
    const summaryPath = join(projectStateDir, 'agent-usage-summary.json');
    writeFileSync(ndjsonPath, usageRows.join('\n') + '\n', 'utf-8');
    writeJson(summaryPath, summary);

    const ndjsonTime = new Date(BASE_TIMESTAMP_MS + 10_000);
    const summaryTime = new Date(BASE_TIMESTAMP_MS + 20_000);
    utimesSync(ndjsonPath, ndjsonTime, ndjsonTime);
    utimesSync(summaryPath, summaryTime, summaryTime);
  }

  return tracePaths;
}

export function createDashboardBenchmarkFixture(dataset: DatasetPreset): DashboardBenchmarkFixture {
  const rootDir = join(tmpdir(), `ornn-benchmark-${dataset.name}-${Date.now()}`);
  const homeDir = join(rootDir, 'home');
  const primaryProjectRoot = join(rootDir, 'primary-project');
  mkdirSync(homeDir, { recursive: true });

  const tracePaths = buildProject(primaryProjectRoot, {
    name: 'primary',
    skills: dataset.skills,
    versionsPerSkill: dataset.versionsPerSkill,
    traceFiles: dataset.traceFiles,
    tracesPerFile: dataset.tracesPerFile,
    decisionEvents: dataset.decisionEvents,
    agentUsageRecords: dataset.agentUsageRecords,
    includeHeavyState: true,
  });

  const projectRoots = [primaryProjectRoot];
  const sseProjects: SseProjectState[] = [];
  for (let index = 0; index < dataset.sseProjects; index += 1) {
    const projectRoot = join(rootDir, `sse-project-${index}`);
    buildProject(projectRoot, {
      name: `sse-${index}`,
      skills: dataset.sseProjectSkills,
      versionsPerSkill: Math.min(dataset.versionsPerSkill, 3),
      traceFiles: dataset.sseProjectTraceFiles,
      tracesPerFile: 48,
      decisionEvents: 0,
      agentUsageRecords: 0,
      includeHeavyState: false,
    });
    projectRoots.push(projectRoot);
    sseProjects.push({
      path: projectRoot,
      name: `sse-project-${index}`,
      isRunning: index % 4 !== 0,
      monitoringState: index % 5 === 0 ? 'paused' : 'active',
      pausedAt: index % 5 === 0 ? makeTimestamp(index * 1000) : null,
      skillCount: dataset.sseProjectSkills,
    });
  }

  mkdirSync(join(homeDir, '.ornn'), { recursive: true });
  writeFileSync(join(homeDir, '.ornn', 'daemon.pid'), String(process.pid), 'utf-8');
  writeJson(join(homeDir, '.ornn', 'projects.json'), {
    projects: projectRoots.map((projectRoot, index) => ({
      path: projectRoot,
      name: index === 0 ? 'primary-project' : `sse-project-${index - 1}`,
      registeredAt: makeTimestamp(index * 1000),
      lastSeenAt: makeTimestamp(index * 1000 + 500),
      monitoringState: index === 0 ? 'active' : (index % 5 === 0 ? 'paused' : 'active'),
      pausedAt: index > 0 && index % 5 === 0 ? makeTimestamp(index * 1000 + 500) : null,
    })),
  });

  let touchClockMs = BASE_TIMESTAMP_MS + 60_000;
  const nextTouchDate = () => {
    touchClockMs += 1000;
    return new Date(touchClockMs);
  };

  return {
    dataset,
    homeDir,
    rootDir,
    primaryProjectRoot,
    projectRoots,
    sseProjects,
    touchAgentUsageSummary() {
      const summaryPath = join(primaryProjectRoot, '.ornn', 'state', 'agent-usage-summary.json');
      const nextDate = nextTouchDate();
      utimesSync(summaryPath, nextDate, nextDate);
    },
    touchTraceFile(index = 0) {
      const filePath = tracePaths[index % tracePaths.length];
      const nextDate = nextTouchDate();
      utimesSync(filePath, nextDate, nextDate);
    },
    cleanup() {
      rmSync(rootDir, { recursive: true, force: true });
    },
  };
}