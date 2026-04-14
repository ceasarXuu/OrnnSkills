import type { EvaluationResult, WindowAnalysisHint } from '../../types/index.js';
import type { WindowAnalysisCoordinatorResult } from '../window-analysis-coordinator/index.js';

export type PatchContextIssueCode = 'missing_target_section';

export type WindowAnalysisOutcome =
  | {
      kind: 'analysis_failed';
      reasonCode: string;
      userMessage: string;
      technicalDetail?: string;
      evaluation?: EvaluationResult;
    }
  | {
      kind: 'need_more_context';
      evaluation: EvaluationResult;
      nextWindowHint: WindowAnalysisHint;
    }
  | {
      kind: 'no_optimization';
      evaluation: EvaluationResult;
    }
  | {
      kind: 'incomplete_patch_context';
      evaluation: EvaluationResult;
      nextWindowHint: WindowAnalysisHint;
      issue: PatchContextIssueCode;
    }
  | {
      kind: 'apply_optimization';
      evaluation: EvaluationResult;
    };

export interface ResolveWindowAnalysisOutcomeInput {
  analysis: WindowAnalysisCoordinatorResult;
  getPatchContextIssue?: (evaluation: EvaluationResult) => PatchContextIssueCode | null;
}

export function getWindowPatchContextIssue(
  evaluation: EvaluationResult
): PatchContextIssueCode | null {
  if (!evaluation.should_patch || !evaluation.change_type) {
    return null;
  }

  if (
    (evaluation.change_type === 'prune_noise' || evaluation.change_type === 'rewrite_section') &&
    !evaluation.target_section?.trim()
  ) {
    return 'missing_target_section';
  }

  return null;
}

function getApplyOptimizationValidationError(
  evaluation: EvaluationResult
): { reasonCode: string; userMessage: string } | null {
  if (!evaluation.should_patch) {
    return {
      reasonCode: 'missing_should_patch',
      userMessage: 'Window analysis returned apply_optimization without should_patch=true.',
    };
  }

  if (!evaluation.change_type) {
    return {
      reasonCode: 'missing_change_type',
      userMessage: 'Window analysis returned apply_optimization without a change_type.',
    };
  }

  return null;
}

export function resolveWindowAnalysisOutcome(
  input: ResolveWindowAnalysisOutcomeInput
): WindowAnalysisOutcome {
  const analysis = input.analysis;

  if (!analysis.success || !analysis.decision) {
    return {
      kind: 'analysis_failed',
      reasonCode: analysis.errorCode ?? analysis.error ?? 'analysis_failed',
      userMessage: analysis.userMessage ?? 'Window analysis did not return a usable result.',
      technicalDetail: analysis.technicalDetail,
    };
  }

  const evaluation = analysis.evaluation;
  if (!evaluation) {
    return {
      kind: 'analysis_failed',
      reasonCode: 'missing_normalized_evaluation',
      userMessage: 'Window analysis did not return a normalized evaluation.',
    };
  }

  if (analysis.decision === 'need_more_context') {
    if (!analysis.nextWindowHint) {
      return {
        kind: 'analysis_failed',
        reasonCode: 'missing_next_window_hint',
        userMessage: 'Window analysis asked for more context but did not provide the next window hint.',
        evaluation,
      };
    }
    return {
      kind: 'need_more_context',
      evaluation,
      nextWindowHint: analysis.nextWindowHint,
    };
  }

  if (analysis.decision === 'no_optimization' || !evaluation.should_patch) {
    return {
      kind: 'no_optimization',
      evaluation,
    };
  }

  if (analysis.decision === 'apply_optimization') {
    const validationError = getApplyOptimizationValidationError(evaluation);
    if (validationError) {
      return {
        kind: 'analysis_failed',
        reasonCode: validationError.reasonCode,
        userMessage: validationError.userMessage,
        evaluation,
      };
    }
  }

  const patchContextIssue =
    input.getPatchContextIssue?.(evaluation) ?? getWindowPatchContextIssue(evaluation);
  if (patchContextIssue) {
    if (!analysis.nextWindowHint) {
      return {
        kind: 'analysis_failed',
        reasonCode: 'missing_next_window_hint',
        userMessage: 'Window analysis suggested expanding the window but did not provide the next window hint.',
        technicalDetail: patchContextIssue,
        evaluation,
      };
    }
    return {
      kind: 'incomplete_patch_context',
      evaluation,
      nextWindowHint: analysis.nextWindowHint,
      issue: patchContextIssue,
    };
  }

  return {
    kind: 'apply_optimization',
    evaluation,
  };
}
