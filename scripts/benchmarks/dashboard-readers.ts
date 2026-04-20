import { Bench } from 'tinybench';
import { readProjectSnapshot, readProjectSnapshotVersion } from '../../src/dashboard/data-reader.js';
import { createDashboardSseHub } from '../../src/dashboard/sse/hub.js';
import { readAgentUsageStats } from '../../src/dashboard/readers/agent-usage-reader.js';
import { countProcessedTraceIds } from '../../src/dashboard/readers/trace-reader.js';
import {
  DATASET_PRESETS,
  createDashboardBenchmarkFixture,
  type DatasetPreset,
} from './lib/dashboard-fixture.js';
import { formatMilliseconds, summarizeSamples } from './lib/statistics.js';

type MetricName =
  | 'agentUsage.revalidate.summary'
  | 'agentUsage.cached'
  | 'processedTraces.revalidate.oneFile'
  | 'processedTraces.cached'
  | 'projectSnapshot.steady'
  | 'projectSnapshotVersion.steady'
  | 'sseBroadcast.steady';

interface MetricBudget {
  readonly p95Ms: number;
}

interface BenchmarkMetric {
  readonly name: MetricName;
  readonly kind: 'revalidate' | 'steady';
  readonly samples: number[];
  readonly meanMs: number;
  readonly p50Ms: number;
  readonly p95Ms: number;
  readonly p99Ms: number;
  readonly maxMs: number;
  readonly budgetMs: number | null;
  readonly pass: boolean | null;
}

const BUDGETS: Record<DatasetPreset['name'], Record<MetricName, MetricBudget>> = {
  smoke: {
    'agentUsage.revalidate.summary': { p95Ms: 4 },
    'agentUsage.cached': { p95Ms: 0.8 },
    'processedTraces.revalidate.oneFile': { p95Ms: 6 },
    'processedTraces.cached': { p95Ms: 1.2 },
    'projectSnapshot.steady': { p95Ms: 35 },
    'projectSnapshotVersion.steady': { p95Ms: 8 },
    'sseBroadcast.steady': { p95Ms: 15 },
  },
  standard: {
    'agentUsage.revalidate.summary': { p95Ms: 5 },
    'agentUsage.cached': { p95Ms: 1 },
    'processedTraces.revalidate.oneFile': { p95Ms: 8 },
    'processedTraces.cached': { p95Ms: 1.5 },
    'projectSnapshot.steady': { p95Ms: 45 },
    'projectSnapshotVersion.steady': { p95Ms: 12 },
    'sseBroadcast.steady': { p95Ms: 30 },
  },
  stress: {
    'agentUsage.revalidate.summary': { p95Ms: 8 },
    'agentUsage.cached': { p95Ms: 1.5 },
    'processedTraces.revalidate.oneFile': { p95Ms: 12 },
    'processedTraces.cached': { p95Ms: 2 },
    'projectSnapshot.steady': { p95Ms: 80 },
    'projectSnapshotVersion.steady': { p95Ms: 20 },
    'sseBroadcast.steady': { p95Ms: 60 },
  },
};

function parseArgs(): { dataset: DatasetPreset; assertBudgets: boolean } {
  const args = process.argv.slice(2);
  const datasetFlagIndex = args.indexOf('--dataset');
  const datasetName = datasetFlagIndex >= 0 ? args[datasetFlagIndex + 1] : 'standard';
  if (!datasetName || !(datasetName in DATASET_PRESETS)) {
    throw new Error(`Unknown dataset preset: ${datasetName ?? '(missing)'}`);
  }

  return {
    dataset: DATASET_PRESETS[datasetName as keyof typeof DATASET_PRESETS],
    assertBudgets: args.includes('--assert'),
  };
}

function createNoopResponse() {
  return {
    writeHead() {},
    write() {},
    end() {},
  };
}

function buildMetric(
  name: MetricName,
  kind: BenchmarkMetric['kind'],
  samples: number[],
  budgetMs: number | null
): BenchmarkMetric {
  const summary = summarizeSamples(samples);
  const pass = budgetMs === null ? null : summary.p95 <= budgetMs;
  return {
    name,
    kind,
    samples,
    meanMs: summary.mean,
    p50Ms: summary.p50,
    p95Ms: summary.p95,
    p99Ms: summary.p99,
    maxMs: summary.max,
    budgetMs,
    pass,
  };
}

function printMetrics(dataset: DatasetPreset, metrics: BenchmarkMetric[]): void {
  const header = [
    'Metric'.padEnd(38),
    'Mode'.padEnd(10),
    'p50(ms)'.padStart(10),
    'p95(ms)'.padStart(10),
    'p99(ms)'.padStart(10),
    'mean(ms)'.padStart(10),
    'max(ms)'.padStart(10),
    'budget'.padStart(10),
    'status'.padStart(8),
  ].join(' ');

  console.log(`Dataset: ${dataset.name}`);
  console.log(
    `Workload: ${dataset.skills} skills, ${dataset.traceFiles} trace files x ${dataset.tracesPerFile} traces, ${dataset.decisionEvents} decision events, ${dataset.agentUsageRecords} agent-usage records`
  );
  console.log(header);
  console.log('-'.repeat(header.length));

  for (const metric of metrics) {
    console.log([
      metric.name.padEnd(38),
      metric.kind.padEnd(10),
      formatMilliseconds(metric.p50Ms).padStart(10),
      formatMilliseconds(metric.p95Ms).padStart(10),
      formatMilliseconds(metric.p99Ms).padStart(10),
      formatMilliseconds(metric.meanMs).padStart(10),
      formatMilliseconds(metric.maxMs).padStart(10),
      (metric.budgetMs === null ? '-' : formatMilliseconds(metric.budgetMs)).padStart(10),
      (metric.pass === null ? '-' : metric.pass ? 'PASS' : 'FAIL').padStart(8),
    ].join(' '));
  }
}

async function measureRevalidateOperation(
  name: MetricName,
  budgetMs: number,
  iterations: number,
  invalidate: () => void,
  run: () => unknown
): Promise<BenchmarkMetric> {
  run();
  const samples: number[] = [];
  for (let index = 0; index < iterations; index += 1) {
    invalidate();
    const startedAt = performance.now();
    run();
    samples.push(performance.now() - startedAt);
  }
  return buildMetric(name, 'revalidate', samples, budgetMs);
}

async function measureSteadyBenchmarks(
  dataset: DatasetPreset,
  setup: {
    readonly primaryProjectRoot: string;
    readonly sseProjects: ReturnType<typeof createDashboardBenchmarkFixture>['sseProjects'];
  }
): Promise<BenchmarkMetric[]> {
  readAgentUsageStats(setup.primaryProjectRoot);
  countProcessedTraceIds(setup.primaryProjectRoot);
  readProjectSnapshot(setup.primaryProjectRoot);
  readProjectSnapshotVersion(setup.primaryProjectRoot);

  const hub = createDashboardSseHub({
    createGlobalLogCursor: () => ({ path: null, offset: 0 }),
    readGlobalLogs: () => [],
    readLogsSince: (cursor) => ({ lines: [], cursor }),
    readProjectSnapshotVersion,
    logger: { warn() {} },
  });
  hub.initializeCursor();
  for (let index = 0; index < Math.max(4, Math.min(8, dataset.sseProjects)); index += 1) {
    hub.connectClient(createNoopResponse(), setup.sseProjects);
  }
  hub.broadcast(setup.sseProjects);

  const bench = new Bench({
    time: 800,
    warmupTime: 200,
    retainSamples: true,
    throws: true,
  });

  bench.add('agentUsage.cached', () => {
    readAgentUsageStats(setup.primaryProjectRoot);
  });
  bench.add('processedTraces.cached', () => {
    countProcessedTraceIds(setup.primaryProjectRoot);
  });
  bench.add('projectSnapshot.steady', () => {
    readProjectSnapshot(setup.primaryProjectRoot);
  });
  bench.add('projectSnapshotVersion.steady', () => {
    readProjectSnapshotVersion(setup.primaryProjectRoot);
  });
  bench.add('sseBroadcast.steady', () => {
    hub.broadcast(setup.sseProjects);
  });

  await bench.run();

  return bench.tasks.map((task) => {
    const samples = (task.result?.latency.samples ?? []).map((value) => Number(value));
    const metricName = task.name as MetricName;
    return buildMetric(metricName, 'steady', samples, BUDGETS[dataset.name][metricName].p95Ms);
  });
}

async function main(): Promise<void> {
  const { dataset, assertBudgets } = parseArgs();
  const fixture = createDashboardBenchmarkFixture(dataset);
  const previousHome = process.env.HOME;
  process.env.HOME = fixture.homeDir;

  try {
    const revalidateMetrics = await Promise.all([
      measureRevalidateOperation(
        'agentUsage.revalidate.summary',
        BUDGETS[dataset.name]['agentUsage.revalidate.summary'].p95Ms,
        14,
        () => fixture.touchAgentUsageSummary(),
        () => readAgentUsageStats(fixture.primaryProjectRoot)
      ),
      measureRevalidateOperation(
        'processedTraces.revalidate.oneFile',
        BUDGETS[dataset.name]['processedTraces.revalidate.oneFile'].p95Ms,
        14,
        () => fixture.touchTraceFile(),
        () => countProcessedTraceIds(fixture.primaryProjectRoot)
      ),
    ]);

    const steadyMetrics = await measureSteadyBenchmarks(dataset, {
      primaryProjectRoot: fixture.primaryProjectRoot,
      sseProjects: fixture.sseProjects,
    });

    const metrics = [...revalidateMetrics, ...steadyMetrics];
    printMetrics(dataset, metrics);

    if (assertBudgets) {
      const failures = metrics.filter((metric) => metric.pass === false);
      if (failures.length > 0) {
        console.error('');
        console.error('Performance budgets exceeded:');
        for (const failure of failures) {
          console.error(
            `- ${failure.name}: p95 ${formatMilliseconds(failure.p95Ms)}ms > budget ${formatMilliseconds(failure.budgetMs ?? 0)}ms`
          );
        }
        process.exitCode = 1;
      }
    }
  } finally {
    if (previousHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = previousHome;
    }
    fixture.cleanup();
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});