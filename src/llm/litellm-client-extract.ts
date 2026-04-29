/**
 * LiteLLM client — Response extraction helpers
 *
 * Extracted from litellm-client.ts to keep individual files under the
 * 500-line policy. Pure helpers; no class state required (callers pass in
 * the per-instance config they need).
 */
import { extractJsonObject } from '../utils/json-response.js';
import type { LiteLLMCompletionOptions } from './litellm-types.js';

type LiteLLMResponse = import('./litellm-response-guard.js').ValidatedLiteLLMResponse;

export interface CompletionExtractionDiagnostics {
  responseModel: string | null;
  finishReason: string | null;
  hasContent: boolean;
  hasReasoningContent: boolean;
  reasoningHasJson: boolean;
  reasoningExcerpt: string | null;
  totalTokens: number | null;
}

export interface CompletionExtractionResult {
  content: string;
  source: 'content' | 'reasoning_json' | null;
  diagnostics: CompletionExtractionDiagnostics;
}

export function truncateForDiagnostics(value: string, maxLength = 160): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength)}...`;
}

export function extractCompletionContent(
  response: LiteLLMResponse,
  responseFormat: LiteLLMCompletionOptions['responseFormat'] = 'text',
): CompletionExtractionResult {
  if (!response.choices || response.choices.length === 0) {
    throw new Error('No choices in LLM response');
  }

  const choice = response.choices[0];
  const message = choice.message || { content: '', role: 'assistant' };
  const content = typeof message.content === 'string' ? message.content.trim() : '';
  const reasoningContent =
    typeof message.reasoning_content === 'string' ? message.reasoning_content.trim() : '';
  const reasoningJson =
    responseFormat === 'json_object' && reasoningContent
      ? extractJsonObject(reasoningContent)
      : null;

  const diagnostics: CompletionExtractionDiagnostics = {
    responseModel: response.model || null,
    finishReason: choice.finish_reason || null,
    hasContent: Boolean(content),
    hasReasoningContent: Boolean(reasoningContent),
    reasoningHasJson: Boolean(reasoningJson),
    reasoningExcerpt: reasoningContent ? truncateForDiagnostics(reasoningContent) : null,
    totalTokens: response.usage?.total_tokens ?? null,
  };

  if (content) {
    return { content, source: 'content', diagnostics };
  }

  if (reasoningJson) {
    return { content: reasoningJson, source: 'reasoning_json', diagnostics };
  }

  return { content: '', source: null, diagnostics };
}

export function getStructuredResponseAttempts(
  provider: string,
  responseFormat: LiteLLMCompletionOptions['responseFormat'],
): number {
  if (responseFormat !== 'json_object') {
    return 1;
  }
  return provider === 'deepseek' ? 3 : 2;
}

export function getNextStructuredResponseMaxTokens(
  provider: string,
  baselineMaxTokens: number,
  currentMaxTokens: number,
  responseFormat: LiteLLMCompletionOptions['responseFormat'],
  diagnostics: CompletionExtractionDiagnostics,
  shouldRetryTruncatedStructuredContent: boolean,
): number {
  if (responseFormat !== 'json_object') {
    return currentMaxTokens;
  }

  if (!shouldRetryTruncatedStructuredContent && diagnostics.finishReason !== 'length') {
    return currentMaxTokens;
  }

  const current = Math.max(1, Math.floor(currentMaxTokens));
  const retryCap =
    provider === 'deepseek'
      ? Math.min(6400, Math.max(baselineMaxTokens, current) * 4)
      : Math.min(4096, Math.max(baselineMaxTokens, current) * 2);

  return Math.min(retryCap, current * 2);
}

export function buildEmptyResponseErrorMessage(
  provider: string,
  modelName: string,
  responseFormat: LiteLLMCompletionOptions['responseFormat'],
  attempts: number,
  diagnostics: CompletionExtractionDiagnostics | null,
): string {
  const parts = [
    'Empty content in LLM response',
    `provider=${provider}`,
    `model=${modelName}`,
    `response_format=${responseFormat || 'text'}`,
    `attempts=${attempts}`,
  ];

  if (diagnostics?.finishReason) {
    parts.push(`last_finish_reason=${diagnostics.finishReason}`);
  }
  if (diagnostics) {
    parts.push(`last_has_reasoning_content=${diagnostics.hasReasoningContent}`);
    parts.push(`last_reasoning_has_json=${diagnostics.reasoningHasJson}`);
    if (typeof diagnostics.totalTokens === 'number') {
      parts.push(`last_total_tokens=${diagnostics.totalTokens}`);
    }
    if (diagnostics.responseModel) {
      parts.push(`last_response_model=${diagnostics.responseModel}`);
    }
    if (diagnostics.reasoningExcerpt) {
      parts.push(`last_reasoning_excerpt=${JSON.stringify(diagnostics.reasoningExcerpt)}`);
    }
  }

  return parts.join(' | ');
}
