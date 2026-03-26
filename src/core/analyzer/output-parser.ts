/**
 * Output Parser
 *
 * 解析 LLM Analyzer 的输出，提取分析结果和改进后的 skill
 */

import { createChildLogger } from '../../utils/logger.js';

const logger = createChildLogger('analyzer-output-parser');

export interface Suggestion {
  type: 'add' | 'modify' | 'clarify' | 'remove';
  section: string;
  description: string;
  rationale: string;
  priority: 'high' | 'medium' | 'low';
}

export interface AnalysisResult {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  missingScenarios: string[];
  userPainPoints: string[];
}

export interface ParsedAnalysis {
  analysis: AnalysisResult;
  suggestions: Suggestion[];
  improvedSkill: string;
  confidence: number;
  rawResponse: string;
}

export interface ParseError {
  success: false;
  error: string;
  rawResponse: string;
}

export type ParseResult = ParsedAnalysis | ParseError;

/**
 * Extract JSON from response
 * Tries multiple strategies to find JSON content
 */
function extractJSON(response: string): string | null {
  // Strategy 1: Look for JSON in code blocks
  const codeBlockMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    const content = codeBlockMatch[1].trim();
    if (content.startsWith('{') && content.endsWith('}')) {
      return content;
    }
  }

  // Strategy 2: Look for JSON object at the start or end of response
  const startMatch = response.match(/^\s*(\{[\s\S]*\})\s*$/);
  if (startMatch) {
    return startMatch[1];
  }

  // Strategy 3: Find the largest valid JSON object in the response
  const jsonMatches = response.match(/\{[\s\S]*?\}/g);
  if (jsonMatches) {
    // Try each match from largest to smallest
    const sortedMatches = jsonMatches.sort((a, b) => b.length - a.length);
    for (const match of sortedMatches) {
      try {
        JSON.parse(match);
        return match; // Return first valid JSON
      } catch {
        continue;
      }
    }
  }

  return null;
}

/**
 * Parse LLM analysis output
 */
export function parseAnalysisOutput(response: string): ParseResult {
  logger.debug('Parsing analysis output');

  try {
    // Extract JSON from response
    const jsonContent = extractJSON(response);
    if (!jsonContent) {
      return {
        success: false,
        error: 'No JSON found in response',
        rawResponse: response,
      };
    }

    const parsed = JSON.parse(jsonContent);

    // Validate required fields
    const validationError = validateParsedOutput(parsed);
    if (validationError) {
      return {
        success: false,
        error: validationError,
        rawResponse: response,
      };
    }

    const result: ParsedAnalysis = {
      analysis: {
        summary: parsed.analysis.summary || '',
        strengths: parsed.analysis.strengths || [],
        weaknesses: parsed.analysis.weaknesses || [],
        missingScenarios: parsed.analysis.missingScenarios || [],
        userPainPoints: parsed.analysis.userPainPoints || [],
      },
      suggestions: parsed.suggestions || [],
      improvedSkill: parsed.improvedSkill || '',
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
      rawResponse: response,
    };

    logger.info(`Parsed analysis with ${result.suggestions.length} suggestions, confidence: ${result.confidence}`);
    return result;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('Failed to parse analysis output:', error);

    return {
      success: false,
      error: `Parse error: ${errorMsg}`,
      rawResponse: response,
    };
  }
}

/**
 * Validate parsed output structure
 */
function validateParsedOutput(parsed: unknown): string | null {
  if (typeof parsed !== 'object' || parsed === null) {
    return 'Response is not an object';
  }

  const p = parsed as Record<string, unknown>;

  // Check analysis
  if (!p.analysis || typeof p.analysis !== 'object') {
    return 'Missing or invalid "analysis" field';
  }

  const analysis = p.analysis as Record<string, unknown>;
  if (typeof analysis.summary !== 'string') {
    return 'Missing or invalid "analysis.summary" field';
  }

  // Check improvedSkill
  if (typeof p.improvedSkill !== 'string' || p.improvedSkill.length === 0) {
    return 'Missing or invalid "improvedSkill" field';
  }

  // Check suggestions (optional but recommended)
  if (p.suggestions !== undefined) {
    if (!Array.isArray(p.suggestions)) {
      return 'Invalid "suggestions" field (should be array)';
    }

    for (let i = 0; i < p.suggestions.length; i++) {
      const suggestion = p.suggestions[i] as Record<string, unknown>;
      const suggestionError = validateSuggestion(suggestion, i);
      if (suggestionError) {
        return suggestionError;
      }
    }
  }

  return null;
}

/**
 * Validate a single suggestion
 */
function validateSuggestion(suggestion: Record<string, unknown>, index: number): string | null {
  const validTypes = ['add', 'modify', 'clarify', 'remove'];
  const validPriorities = ['high', 'medium', 'low'];

  if (!validTypes.includes(suggestion.type as string)) {
    return `Suggestion ${index}: invalid type "${suggestion.type}"`;
  }

  if (typeof suggestion.section !== 'string') {
    return `Suggestion ${index}: missing or invalid section`;
  }

  if (typeof suggestion.description !== 'string') {
    return `Suggestion ${index}: missing or invalid description`;
  }

  if (suggestion.priority && !validPriorities.includes(suggestion.priority as string)) {
    return `Suggestion ${index}: invalid priority "${suggestion.priority}"`;
  }

  return null;
}

/**
 * Check if analysis has high confidence
 */
export function hasHighConfidence(result: ParsedAnalysis, threshold = 0.7): boolean {
  return result.confidence >= threshold;
}

/**
 * Get high priority suggestions
 */
export function getHighPrioritySuggestions(result: ParsedAnalysis): Suggestion[] {
  return result.suggestions.filter((s) => s.priority === 'high');
}

/**
 * Format analysis result for display
 */
export function formatAnalysisResult(result: ParsedAnalysis): string {
  const lines: string[] = [];

  lines.push(`## Analysis Summary`);
  lines.push(result.analysis.summary);
  lines.push('');

  if (result.analysis.strengths.length > 0) {
    lines.push(`### Strengths`);
    result.analysis.strengths.forEach((s) => lines.push(`- ${s}`));
    lines.push('');
  }

  if (result.analysis.weaknesses.length > 0) {
    lines.push(`### Areas for Improvement`);
    result.analysis.weaknesses.forEach((w) => lines.push(`- ${w}`));
    lines.push('');
  }

  if (result.suggestions.length > 0) {
    lines.push(`### Suggestions (${result.suggestions.length})`);
    result.suggestions.forEach((s, i) => {
      lines.push(`${i + 1}. **[${s.priority.toUpperCase()}]** ${s.type}: ${s.description}`);
      lines.push(`   - Section: ${s.section}`);
      lines.push(`   - Rationale: ${s.rationale}`);
    });
    lines.push('');
  }

  lines.push(`### Confidence: ${Math.round(result.confidence * 100)}%`);

  return lines.join('\n');
}

/**
 * Extract changes summary from analysis
 */
export function extractChangesSummary(result: ParsedAnalysis): string {
  const changes: string[] = [];

  for (const suggestion of result.suggestions) {
    changes.push(`${suggestion.type} ${suggestion.section}: ${suggestion.description}`);
  }

  return changes.join('; ');
}
