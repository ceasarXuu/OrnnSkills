import { createLiteLLMClient } from '../../llm/litellm-client.js';
import { readDashboardConfig } from '../../config/manager.js';
import { createChildLogger } from '../../utils/logger.js';
import { recordAgentUsage } from '../agent-usage/index.js';
import type { DecisionEventEvidence, EvaluationResult, Trace } from '../../types/index.js';

const logger = createChildLogger('decision-explainer');

export interface DecisionExplanationResult {
  summary: string;
  evidenceReadout: string[];
  causalChain: string[];
  decisionRationale: string;
  recommendedAction: string;
  uncertainties: string[];
  contradictions: string[];
}

function truncate(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength)}...`;
}

function summarizeTrace(trace: Trace): string {
  if (trace.event_type === 'user_input' && trace.user_input) {
    return `user_input: ${truncate(trace.user_input, 220)}`;
  }
  if (trace.event_type === 'assistant_output' && trace.assistant_output) {
    return `assistant_output: ${truncate(trace.assistant_output, 220)}`;
  }
  if (trace.event_type === 'tool_call') {
    return `tool_call: ${trace.tool_name || 'unknown'} ${truncate(JSON.stringify(trace.tool_args || {}), 180)}`;
  }
  if (trace.event_type === 'tool_result') {
    return `tool_result: ${trace.tool_name || 'unknown'} ${truncate(JSON.stringify(trace.tool_result || {}), 180)}`;
  }
  if (trace.event_type === 'file_change') {
    return `file_change: ${truncate(JSON.stringify(trace.files_changed || []), 180)}`;
  }
  return `${trace.event_type}: status=${trace.status}`;
}

function formatEvidenceBlock(evidence: DecisionEventEvidence | null | undefined): string {
  if (!evidence) return 'none';
  const lines: string[] = [];
  if (Array.isArray(evidence.directEvidence) && evidence.directEvidence.length > 0) {
    lines.push(`Direct Evidence: ${evidence.directEvidence.join(' | ')}`);
  }
  if (Array.isArray(evidence.causalJudgment) && evidence.causalJudgment.length > 0) {
    lines.push(`Causal Judgment: ${evidence.causalJudgment.join(' | ')}`);
  }
  if (typeof evidence.action === 'string' && evidence.action.trim()) {
    lines.push(`Action: ${evidence.action.trim()}`);
  }
  if (typeof evidence.rawEvidence === 'string' && evidence.rawEvidence.trim()) {
    lines.push(`Raw Evidence: ${truncate(evidence.rawEvidence.trim(), 600)}`);
  }
  return lines.length > 0 ? lines.join('\n') : 'none';
}

function buildPrompt(
  skillId: string,
  evaluation: EvaluationResult,
  traces: Trace[],
  evidence: DecisionEventEvidence | null | undefined
): { systemPrompt: string; userPrompt: string } {
  const systemPrompt = [
    'You are Ornn\'s decision explanation synthesizer.',
    'Your task is to convert a structured optimization decision into a human-readable explanation.',
    'Be precise, evidence-based, and avoid hype.',
    'Do not invent trace details or user intent that are not present.',
    'Output must be JSON with exactly these fields: summary, evidence_readout, causal_chain, decision_rationale, recommended_action, uncertainties, contradictions.',
    'All narrative fields must be arrays or strings of concise English sentences.',
  ].join('\n');

  const userPrompt = [
    `Skill ID: ${skillId}`,
    `Should Patch: ${evaluation.should_patch}`,
    `Change Type: ${evaluation.change_type ?? 'none'}`,
    `Confidence: ${evaluation.confidence}`,
    `Target Section: ${evaluation.target_section ?? 'none'}`,
    `Reason: ${evaluation.reason ?? 'none'}`,
    '',
    'Recorded Evidence:',
    formatEvidenceBlock(evidence),
    '',
    'Observed Trace Timeline:',
    ...traces.slice(-40).map((trace, index) => `${index + 1}. [${trace.timestamp}] ${summarizeTrace(trace)}`),
    '',
    'Produce a concise explanation for dashboard users.',
  ].join('\n');

  return { systemPrompt, userPrompt };
}

function extractJsonObject(raw: string): string | null {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start >= 0 && end > start) return raw.slice(start, end + 1);
  return null;
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

function parseResponse(payload: Record<string, unknown>, fallback: DecisionExplanationResult): DecisionExplanationResult {
  return {
    summary: typeof payload.summary === 'string' && payload.summary.trim() ? payload.summary.trim() : fallback.summary,
    evidenceReadout: normalizeStringArray(payload.evidence_readout),
    causalChain: normalizeStringArray(payload.causal_chain),
    decisionRationale:
      typeof payload.decision_rationale === 'string' && payload.decision_rationale.trim()
        ? payload.decision_rationale.trim()
        : fallback.decisionRationale,
    recommendedAction:
      typeof payload.recommended_action === 'string' && payload.recommended_action.trim()
        ? payload.recommended_action.trim()
        : fallback.recommendedAction,
    uncertainties: normalizeStringArray(payload.uncertainties),
    contradictions: normalizeStringArray(payload.contradictions),
  };
}

function buildFallbackExplanation(skillId: string, evaluation: EvaluationResult): DecisionExplanationResult {
  return {
    summary: evaluation.reason || `Decision recorded for ${skillId}.`,
    evidenceReadout: [],
    causalChain: [],
    decisionRationale: evaluation.reason || 'No explicit rationale was captured.',
    recommendedAction: evaluation.should_patch
      ? `Proceed with ${evaluation.change_type ?? 'the suggested patch'}.`
      : 'Continue monitoring before making changes.',
    uncertainties: [],
    contradictions: [],
  };
}

export async function generateDecisionExplanation(
  projectPath: string,
  skillId: string,
  evaluation: EvaluationResult,
  traces: Trace[],
  evidence?: DecisionEventEvidence | null
): Promise<DecisionExplanationResult> {
  const fallback = buildFallbackExplanation(skillId, evaluation);
  const config = await readDashboardConfig(projectPath);
  const activeProvider = config.providers[0];

  if (!activeProvider || !activeProvider.apiKey) {
    return fallback;
  }

  const client = createLiteLLMClient({
    provider: activeProvider.provider,
    modelName: activeProvider.modelName,
    apiKey: activeProvider.apiKey,
    maxTokens: 1200,
  });
  const prompt = buildPrompt(skillId, evaluation, traces, evidence);
  const model = `${activeProvider.provider}/${activeProvider.modelName}`;
  const started = Date.now();

  try {
    const raw = await client.completion({
      prompt: prompt.userPrompt,
      systemPrompt: prompt.systemPrompt,
      temperature: 0.1,
      maxTokens: 1200,
      timeout: 30000,
      responseFormat: 'json_object',
    });
    const usage = client.getTokenUsage();
    recordAgentUsage(projectPath, {
      scope: 'decision_explainer',
      eventId: skillId,
      skillId,
      model,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      totalTokens: usage.totalTokens,
      durationMs: Date.now() - started,
    });

    const jsonText = extractJsonObject(raw);
    if (!jsonText) {
      logger.warn('Decision explanation failed to return JSON', {
        projectPath,
        skillId,
        model,
      });
      return fallback;
    }

    const payload = JSON.parse(jsonText) as Record<string, unknown>;
    return parseResponse(payload, fallback);
  } catch (error) {
    logger.warn('Decision explanation failed, using fallback', {
      projectPath,
      skillId,
      model,
      error: error instanceof Error ? error.message : String(error),
    });
    return fallback;
  }
}
