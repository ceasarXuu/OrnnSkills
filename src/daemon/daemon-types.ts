import type { FSWatcher } from 'chokidar';
import type { ProjectMonitoringState } from '../dashboard/projects-registry.js';
import type { Trace } from '../types/index.js';

export interface OptimizationStatus {
  currentState: 'idle' | 'analyzing' | 'optimizing' | 'error';
  currentSkillId: string | null;
  lastOptimizationAt: string | null;
  lastError: string | null;
  queueSize: number;
}

export interface DaemonState {
  isRunning: boolean;
  startedAt: string;
  processedTraces: number;
  lastCheckpointAt: string | null;
  retryQueueSize: number;
  monitoringState: ProjectMonitoringState;
  pausedAt: string | null;
  optimizationStatus: OptimizationStatus;
}

export interface RetryQueueEntry {
  traceId: string;
  projectRoot: string | null;
  attempts: number;
  lastErrorMessage?: string;
  addedAt: number;
}

export interface ShadowManagerLike {
  init(): Promise<void>;
  processTrace(trace: Trace): Promise<void>;
  close(): Promise<void>;
  cleanupOldTraces(retentionDays: number): number;
}

export interface ProjectRuntime {
  projectRoot: string;
  shadowManager: ShadowManagerLike;
  watcher: FSWatcher | null;
  processedTraces: number;
  lastCheckpointAt: string | null;
  checkpointFlushTimer: NodeJS.Timeout | null;
}

export interface ProjectMonitoringSnapshot {
  monitoringState: ProjectMonitoringState;
  pausedAt: string | null;
}
