import type { EvaluationResult, WindowAnalysisHint } from '../../types/index.js';
import type { SkillCallAnalysisResult } from '../skill-call-analyzer/index.js';
import type { SkillCallWindow } from '../skill-call-window/index.js';
import { executeWindowAnalysis } from '../window-analysis-coordinator/index.js';
import {
  getWindowPatchContextIssue,
  resolveWindowAnalysisOutcome,
} from '../window-analysis-outcome/index.js';
import { describePatchContextIssue } from '../activity-event-builder/index.js';

export type AnalyzeSkillWindowMode = 'auto' | 'manual';

export type AnalyzeSkillWindowResult =
  | {
      kind: 'missing_skill_content';
      detail: string;
      reasonCode: 'missing_skill_content';
    }
  | {
      kind: 'analysis_failed';
      detail: string;
      reasonCode: string;
      evaluation?: EvaluationResult;
      technicalDetail?: string;
    }
  | {
      kind: 'need_more_context';
      cause: 'analysis' | 'incomplete_patch_context';
      detail: string;
      evaluation: EvaluationResult;
      nextWindowHint: WindowAnalysisHint;
    }
  | {
      kind: 'no_optimization';
      detail: string;
      evaluation: EvaluationResult;
    }
  | {
      kind: 'ready_for_optimization';
      evaluation: EvaluationResult;
    };

export interface AnalyzeSkillWindowInput {
  analyzeWindow: (
    projectPath: string,
    window: SkillCallWindow,
    skillContent: string
  ) => Promise<SkillCallAnalysisResult>;
  projectPath: string;
  window: SkillCallWindow;
  skillContent: string | null | undefined;
  mode: AnalyzeSkillWindowMode;
  timeoutMs?: number;
}

export async function analyzeSkillWindow(
  input: AnalyzeSkillWindowInput
): Promise<AnalyzeSkillWindowResult> {
  if (!input.skillContent?.trim()) {
    return {
      kind: 'missing_skill_content',
      detail:
        input.mode === 'manual'
          ? '当前技能内容为空，无法启动手动窗口分析。'
          : '当前技能内容为空，无法启动窗口分析。',
      reasonCode: 'missing_skill_content',
    };
  }

  const analysis = await executeWindowAnalysis({
    analyzeWindow: input.analyzeWindow,
    projectPath: input.projectPath,
    window: input.window,
    skillContent: input.skillContent,
    timeoutMs: input.timeoutMs,
  });

  const outcome = resolveWindowAnalysisOutcome({
    analysis,
    getPatchContextIssue: getWindowPatchContextIssue,
  });

  if (outcome.kind === 'analysis_failed') {
    return {
      kind: 'analysis_failed',
      detail: outcome.userMessage,
      reasonCode: outcome.reasonCode,
      evaluation: outcome.evaluation,
      technicalDetail: outcome.technicalDetail,
    };
  }

  if (outcome.kind === 'need_more_context') {
    return {
      kind: 'need_more_context',
      cause: 'analysis',
      detail:
        analysis.userMessage ??
        outcome.evaluation.reason ??
        (input.mode === 'manual' ? '当前窗口证据不足，继续观察。' : '当前窗口证据不足，继续扩展上下文。'),
      evaluation: outcome.evaluation,
      nextWindowHint: outcome.nextWindowHint,
    };
  }

  if (outcome.kind === 'no_optimization') {
    return {
      kind: 'no_optimization',
      detail: outcome.evaluation.reason
        ? `窗口分析结论：${outcome.evaluation.reason}`
        : '窗口分析认为当前无需修改。',
      evaluation: outcome.evaluation,
    };
  }

  if (outcome.kind === 'incomplete_patch_context') {
    return {
      kind: 'need_more_context',
      cause: 'incomplete_patch_context',
      detail: `当前分析建议了优化，但还缺少可执行定位：${describePatchContextIssue(outcome.issue)}`,
      evaluation: outcome.evaluation,
      nextWindowHint: outcome.nextWindowHint,
    };
  }

  return {
    kind: 'ready_for_optimization',
    evaluation: outcome.evaluation,
  };
}
