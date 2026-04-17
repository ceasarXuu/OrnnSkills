import type { ActivityEventContext } from '../activity-event-builder/index.js';
import type { AnalyzeSkillWindowInput, AnalyzeSkillWindowResult } from '../analyze-skill-window/index.js';
import type { DecisionEventRecorder } from '../decision-events/index.js';
import type { DaemonStatusStore } from '../daemon-status-store/index.js';
import type { Journal } from '../journal/index.js';
import type { ExecuteOptimizationPatchInput, ExecuteOptimizationPatchResult } from '../optimization-executor/index.js';
import type { ShadowRegistry, ShadowEntry } from '../shadow-registry/index.js';
import type { SkillVersionManager, VersionManagerOptions } from '../skill-version/index.js';
import type { SkillCallAnalyzer } from '../skill-call-analyzer/index.js';
import type {
  ProbeTriggerDecision,
  TaskEpisode,
  TaskEpisodeStore,
  TaskEpisodeTraceContext,
} from '../task-episode/index.js';
import type { TraceManager } from '../observer/trace-manager.js';
import type { TraceSkillMapper, TraceSkillMapping } from '../trace-skill-mapper/index.js';
import type { AutoOptimizePolicy, EvaluationResult, RuntimeType, Trace } from '../../types/index.js';

export interface TriggerOptimizeResult {
  kind:
    | 'missing_window'
    | 'analysis_failed'
    | 'need_more_context'
    | 'no_optimization'
    | 'optimization_skipped'
    | 'patch_applied'
    | 'patch_failed';
  evaluation: EvaluationResult | null;
  detail: string;
  status?: string;
}

export interface ManualOptimizationScope {
  traces: Trace[];
  context: ActivityEventContext;
  episodeId: string | null;
}

export interface ShadowRegistryLike
  extends Pick<ShadowRegistry, 'get' | 'readContent' | 'writeContent' | 'incrementTraceCount'> {}

export interface JournalManagerLike
  extends Pick<Journal, 'getLatestRevision' | 'createSnapshot' | 'record'> {}

export interface TraceManagerLike
  extends Pick<TraceManager, 'recordTrace' | 'getSessionTraces' | 'getRecentTraces' | 'cleanupOldTraces'> {}

export interface TraceSkillMapperLike extends Pick<TraceSkillMapper, 'mapTrace'> {}

export interface TaskEpisodeStoreLike
  extends Pick<
    TaskEpisodeStore,
    | 'recordTrace'
    | 'recordContextTrace'
    | 'shouldTriggerProbe'
    | 'applyNeedMoreContextHint'
    | 'markAnalysisState'
    | 'listEpisodes'
  > {}

export interface DecisionEventsLike extends Pick<DecisionEventRecorder, 'record'> {}

export interface DaemonStatusLike
  extends Pick<DaemonStatusStore, 'setIdle' | 'setAnalyzing' | 'setOptimizing' | 'setError'> {}

export interface SkillCallAnalyzerLike extends Pick<SkillCallAnalyzer, 'analyzeWindow'> {}

export interface SkillVersionManagerLike extends Pick<SkillVersionManager, 'createVersion'> {}

export type CreateSkillVersionManagerLike = (
  options: VersionManagerOptions
) => SkillVersionManagerLike;

export interface ExecuteOptimizationPatchLike {
  (input: ExecuteOptimizationPatchInput): Promise<ExecuteOptimizationPatchResult>;
}

export interface AnalyzeSkillWindowLike {
  (input: AnalyzeSkillWindowInput): Promise<AnalyzeSkillWindowResult>;
}

export interface OptimizationRunnerLike {
  handleEvaluation(
    shadowId: string,
    evaluation: EvaluationResult,
    traces: Trace[],
    context: ActivityEventContext,
    options?: { skipAnalysisRequested?: boolean; closeOnSkip?: boolean }
  ): Promise<TriggerOptimizeResult>;
}

export interface ManualAnalysisInput extends ManualOptimizationScope {
  shadowId: string;
}

export interface EpisodeProbeServiceLike {
  maybeRunEpisodeProbe(
    episode: TaskEpisode,
    shadowId: string,
    trace: Trace,
    sessionTraces: Trace[],
    eventContext?: ActivityEventContext
  ): Promise<void>;
  analyzeManualScope(input: ManualAnalysisInput): Promise<TriggerOptimizeResult>;
}

export type ShadowLookup = TraceSkillMapping;

export type OptimizationPolicy = AutoOptimizePolicy;

export type EpisodeTraceContext = TaskEpisodeTraceContext;

export type ProbeDecision = ProbeTriggerDecision;

export type ShadowStateEntry = ShadowEntry | undefined;

export type ShadowRuntime = RuntimeType;
