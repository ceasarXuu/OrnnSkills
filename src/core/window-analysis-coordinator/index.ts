import { withTimeout } from '../../utils/timeout.js';
import type { EvaluationResult, WindowAnalysisHint } from '../../types/index.js';
import type { SkillCallAnalysisResult } from '../skill-call-analyzer/index.js';
import type { SkillCallWindow } from '../skill-call-window/index.js';

export interface WindowAnalysisCoordinatorInput {
  analyzeWindow: (
    projectPath: string,
    window: SkillCallWindow,
    skillContent: string
  ) => Promise<SkillCallAnalysisResult>;
  projectPath: string;
  window: SkillCallWindow;
  skillContent: string;
  timeoutMs?: number;
}

export interface WindowAnalysisCoordinatorResult extends SkillCallAnalysisResult {
  evaluation?: EvaluationResult;
  nextWindowHint?: WindowAnalysisHint;
}

function buildFallbackHint(window: SkillCallWindow): WindowAnalysisHint {
  const traceCount = Math.max(window.traces.length, 1);
  return {
    suggestedTraceDelta: Math.max(6, Math.ceil(traceCount * 0.4)),
    suggestedTurnDelta: 2,
    waitForEventTypes: [],
    mode: 'count_driven',
  };
}

function buildFallbackEvaluation(
  result: SkillCallAnalysisResult,
  window: SkillCallWindow
): EvaluationResult {
  return {
    should_patch: result.decision === 'apply_optimization',
    reason: result.userMessage ?? 'Window analysis returned no concrete conclusion.',
    source_sessions: [window.sessionId],
    confidence: 0,
    rule_name: 'llm_window_analysis',
  };
}

export async function executeWindowAnalysis(
  input: WindowAnalysisCoordinatorInput
): Promise<WindowAnalysisCoordinatorResult> {
  const run = () => input.analyzeWindow(input.projectPath, input.window, input.skillContent);
  const raw = input.timeoutMs
    ? await withTimeout(run(), input.timeoutMs, 'Window analysis')
    : await run();

  if (!raw.success || !raw.decision) {
    return {
      ...raw,
      evaluation: undefined,
      nextWindowHint: undefined,
    };
  }

  return {
    ...raw,
    evaluation:
      raw.evaluation ?? (raw.decision === 'apply_optimization'
        ? undefined
        : buildFallbackEvaluation(raw, input.window)),
    nextWindowHint: raw.nextWindowHint ?? buildFallbackHint(input.window),
  };
}
