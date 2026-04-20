import { performance } from 'node:perf_hooks';
import { readProjectSnapshot, readProjectSnapshotVersion } from '../../src/dashboard/data-reader.js';
import {
  getAgentUsageStatsCacheStats,
  readAgentUsageStats,
  resetAgentUsageStatsCache,
} from '../../src/dashboard/readers/agent-usage-reader.js';
import {
  countProcessedTraceIds,
  getProcessedTraceCacheStats,
  resetProcessedTraceCaches,
} from '../../src/dashboard/readers/trace-reader.js';
import {
  DATASET_PRESETS,
  createDashboardBenchmarkFixture,
  type DatasetPreset,
} from './lib/dashboard-fixture.js';
import { formatMilliseconds, summarizeSamples } from './lib/statistics.js';

interface SoakArgs {
  readonly dataset: DatasetPreset;
  readonly cycles: number;
  readonly assertBudgets: boolean;
}

function parseArgs(): SoakArgs {
  const args = process.argv.slice(2);
  const datasetFlagIndex = args.indexOf('--dataset');
  const cyclesFlagIndex = args.indexOf('--cycles');
  const datasetName = datasetFlagIndex >= 0 ? args[datasetFlagIndex + 1] : 'smoke';
  const cyclesRaw = cyclesFlagIndex >= 0 ? Number(args[cyclesFlagIndex + 1]) : 640;

  if (!datasetName || !(datasetName in DATASET_PRESETS)) {
    throw new Error(`Unknown dataset preset: ${datasetName ?? '(missing)'}`);
  }
  if (!Number.isFinite(cyclesRaw) || cyclesRaw < 1) {
    throw new Error(`Invalid cycle count: ${String(cyclesRaw)}`);
  }

  return {
    dataset: DATASET_PRESETS[datasetName as keyof typeof DATASET_PRESETS],
    cycles: Math.floor(cyclesRaw),
    assertBudgets: args.includes('--assert'),
  };
}

function maybeCollectGarbage(): void {
  if (typeof global.gc === 'function') {
    global.gc();
  }
}

function toMegabytes(bytes: number): number {
  return bytes / (1024 * 1024);
}

function printSoakReport(
  dataset: DatasetPreset,
  cycles: number,
  samples: number[],
  heapStartBytes: number,
  heapEndBytes: number
): string[] {
  const summary = summarizeSamples(samples);
  const windowSize = Math.max(32, Math.min(96, Math.floor(samples.length / 4)));
  const firstWindow = summarizeSamples(samples.slice(0, windowSize));
  const lastWindow = summarizeSamples(samples.slice(-windowSize));
  const agentUsageCache = getAgentUsageStatsCacheStats();
  const processedTraceCache = getProcessedTraceCacheStats();
  const heapDeltaMb = toMegabytes(heapEndBytes - heapStartBytes);
  const driftRatio = firstWindow.mean > 0 ? lastWindow.mean / firstWindow.mean : 1;

  const lines = [
    `Dataset: ${dataset.name}`,
    `Cycles: ${cycles}`,
    `Workload per cycle: ${dataset.skills} skills, ${dataset.traceFiles} trace files x ${dataset.tracesPerFile} traces, ${dataset.agentUsageRecords} agent-usage records`,
    `Cycle latency p50/p95/p99(ms): ${formatMilliseconds(summary.p50)} / ${formatMilliseconds(summary.p95)} / ${formatMilliseconds(summary.p99)}`,
    `Cycle latency first-window mean(ms): ${formatMilliseconds(firstWindow.mean)}`,
    `Cycle latency last-window mean(ms): ${formatMilliseconds(lastWindow.mean)}`,
    `Cycle latency drift ratio: ${driftRatio.toFixed(2)}x`,
    `Heap used start/end/delta(MB): ${toMegabytes(heapStartBytes).toFixed(1)} / ${toMegabytes(heapEndBytes).toFixed(1)} / ${heapDeltaMb.toFixed(1)}`,
    `Agent usage cache entries/max: ${agentUsageCache.entries} / ${agentUsageCache.maxEntries}`,
    `Processed trace file cache entries/max: ${processedTraceCache.fileCache.entries} / ${processedTraceCache.fileCache.maxEntries}`,
    `Processed trace project cache entries/max: ${processedTraceCache.projectCache.entries} / ${processedTraceCache.projectCache.maxEntries}`,
  ];

  return lines;
}

function collectInvariantFailures(): string[] {
  const failures: string[] = [];
  const agentUsageCache = getAgentUsageStatsCacheStats();
  const processedTraceCache = getProcessedTraceCacheStats();

  if (agentUsageCache.entries > agentUsageCache.maxEntries) {
    failures.push(
      `agent usage cache entries ${agentUsageCache.entries} exceed max ${agentUsageCache.maxEntries}`
    );
  }
  if (processedTraceCache.fileCache.entries > processedTraceCache.fileCache.maxEntries) {
    failures.push(
      `processed trace file cache entries ${processedTraceCache.fileCache.entries} exceed max ${processedTraceCache.fileCache.maxEntries}`
    );
  }
  if (processedTraceCache.projectCache.entries > processedTraceCache.projectCache.maxEntries) {
    failures.push(
      `processed trace project cache entries ${processedTraceCache.projectCache.entries} exceed max ${processedTraceCache.projectCache.maxEntries}`
    );
  }

  return failures;
}

async function main(): Promise<void> {
  const { dataset, cycles, assertBudgets } = parseArgs();
  resetAgentUsageStatsCache();
  resetProcessedTraceCaches();
  maybeCollectGarbage();
  const heapStartBytes = process.memoryUsage().heapUsed;
  const samples: number[] = [];

  for (let index = 0; index < cycles; index += 1) {
    const fixture = createDashboardBenchmarkFixture(dataset);
    const previousHome = process.env.HOME;
    process.env.HOME = fixture.homeDir;

    try {
      const startedAt = performance.now();
      readAgentUsageStats(fixture.primaryProjectRoot);
      countProcessedTraceIds(fixture.primaryProjectRoot);
      readProjectSnapshotVersion(fixture.primaryProjectRoot);
      readProjectSnapshot(fixture.primaryProjectRoot);
      samples.push(performance.now() - startedAt);
    } finally {
      if (previousHome === undefined) {
        delete process.env.HOME;
      } else {
        process.env.HOME = previousHome;
      }
      fixture.cleanup();
    }
  }

  maybeCollectGarbage();
  const heapEndBytes = process.memoryUsage().heapUsed;
  const reportLines = printSoakReport(dataset, cycles, samples, heapStartBytes, heapEndBytes);
  for (const line of reportLines) {
    console.log(line);
  }

  if (assertBudgets) {
    const failures = collectInvariantFailures();
    if (failures.length > 0) {
      console.error('');
      console.error('Soak invariants failed:');
      for (const failure of failures) {
        console.error(`- ${failure}`);
      }
      process.exitCode = 1;
    }
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});