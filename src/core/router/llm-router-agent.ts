/**
 * LLM Router Agent
 *
 * 使用 LLM 智能识别 trace 关联的 skills。
 * 结合显式引用提取和隐式关联识别。
 *
 * Architecture:
 * - LLMRouterAgent 负责识别 skills（显式 + 隐式）
 * - 识别结果通过 TraceRouter 进行路由
 * - 这是识别层，不是路由层
 */

import { createChildLogger } from '../../utils/logger.js';
import { createLLM } from '../../llm/factory.js';
import { extractSkillRefsFromTrace } from '../../utils/skill-refs.js';
import type { Trace } from '../../types/index.js';

const logger = createChildLogger('llm-router-agent');

export interface LLMRouterAgentOptions {
  provider?: string;
  model?: string;
  apiKey?: string;
  baseUrl?: string;
  /**
   * Whether to enable implicit skill recognition via LLM
   * @default false (until LLM integration is complete)
   */
  enableImplicitRecognition?: boolean;
}

export interface SkillRecognitionResult {
  skillIds: string[];
  explicitRefs: string[];
  implicitRefs: string[];
  confidence: number;
  reasoning: string;
}

/**
 * LLM Router Agent
 *
 * Responsibilities:
 * 1. Extract explicit skill references from trace (fast, local)
 * 2. Use LLM to identify implicit skill associations (slow, optional)
 * 3. Return recognition results for routing
 *
 * Note: This is a recognition layer, not a routing layer.
 * Use TraceRouter for actual routing.
 */
export class LLMRouterAgent {
  private options: LLMRouterAgentOptions;

  constructor(options: LLMRouterAgentOptions = {}) {
    this.options = {
      enableImplicitRecognition: false, // Disabled by default until LLM is ready
      ...options,
    };
  }

  /**
   * Analyze trace and identify associated skills
   */
  async analyzeTrace(trace: Trace, contextTraces: Trace[] = []): Promise<SkillRecognitionResult> {
    logger.debug(`Analyzing trace: ${trace.trace_id}`);

    // Step 1: Extract explicit references
    const explicitRefs = this.extractExplicitRefs(trace);
    logger.debug(`Explicit refs found: ${explicitRefs.join(', ') || 'none'}`);

    // Step 2: Use LLM for implicit association (if enabled and needed)
    let implicitRefs: string[] = [];
    let llmReasoning = '';
    let confidence = explicitRefs.length > 0 ? 0.9 : 0.5;

    if (this.options.enableImplicitRecognition && (explicitRefs.length === 0 || contextTraces.length > 0)) {
      try {
        const llmResult = await this.callLLMForImplicitRefs(trace, contextTraces);
        implicitRefs = llmResult.skillIds.filter(id => !explicitRefs.includes(id));
        llmReasoning = llmResult.reasoning;
        confidence = llmResult.confidence;
        logger.debug(`Implicit refs found: ${implicitRefs.join(', ') || 'none'}`);
      } catch (error) {
        logger.warn('LLM implicit analysis failed:', error);
        // Fall back to explicit refs only
      }
    }

    // Combine results
    const allSkillIds = [...new Set([...explicitRefs, ...implicitRefs])];

    const result: SkillRecognitionResult = {
      skillIds: allSkillIds,
      explicitRefs,
      implicitRefs,
      confidence,
      reasoning: this.generateReasoning(explicitRefs, implicitRefs, llmReasoning),
    };

    logger.info(`Trace ${trace.trace_id} associated with skills: ${allSkillIds.join(', ') || 'none'}`);
    return result;
  }

  /**
   * Extract explicit skill references from trace
   * Supports: [$skill-name] and @skill-name formats
   */
  extractExplicitRefs(trace: Trace): string[] {
    return extractSkillRefsFromTrace(trace);
  }

  /**
   * Call LLM to identify implicit skill associations
   */
  private async callLLMForImplicitRefs(
    trace: Trace,
    contextTraces: Trace[]
  ): Promise<{ skillIds: string[]; confidence: number; reasoning: string }> {
    const llm = createLLM({
      provider: this.options.provider || 'deepseek',
      modelName: this.options.model || 'deepseek-chat',
      apiKey: this.options.apiKey || '',
    });

    const prompt = this.buildPrompt(trace, contextTraces);

    try {
      const response = await llm.complete(prompt);
      return this.parseLLMResponse(response);
    } catch (error) {
      logger.error('LLM call failed:', error);
      throw error;
    }
  }

  /**
   * Build prompt for LLM
   */
  private buildPrompt(trace: Trace, contextTraces: Trace[]): string {
    const context = contextTraces.length > 0
      ? `Previous context:\n${contextTraces.slice(-3).map(t =>
          `- ${t.event_type}: ${t.user_input || t.assistant_output || ''}`.slice(0, 200)
        ).join('\n')}`
      : 'No previous context.';

    return `You are a skill routing analyzer. Your task is to identify which skills are implicitly associated with the current trace.

## Current Trace
- Event Type: ${trace.event_type}
- User Input: ${trace.user_input || 'N/A'}
- Assistant Output: ${trace.assistant_output || 'N/A'}
- Tool Name: ${trace.tool_name || 'N/A'}

## Context
${context}

## Analysis Instructions
1. Check if the current trace is continuing a discussion about a previously mentioned skill
2. Look for implicit references (e.g., "fix that", "improve it", "try again")
3. Consider the conversation flow and context

## Output Format
Return a JSON object with this structure:
{
  "skillIds": ["skill-id-1", "skill-id-2"],
  "confidence": 0.8,
  "reasoning": "Brief explanation of why these skills are associated"
}

If no skills are implicitly associated, return: {"skillIds": [], "confidence": 0, "reasoning": "No implicit associations found"}

## Response:`;
  }

  /**
   * Parse LLM response
   */
  private parseLLMResponse(response: string): { skillIds: string[]; confidence: number; reasoning: string } {
    try {
      // Try to extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        skillIds: Array.isArray(parsed.skillIds) ? parsed.skillIds : [],
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0,
        reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : '',
      };
    } catch (error) {
      logger.warn('Failed to parse LLM response:', error);
      return {
        skillIds: [],
        confidence: 0,
        reasoning: 'Failed to parse LLM response',
      };
    }
  }

  /**
   * Generate human-readable reasoning
   */
  private generateReasoning(explicitRefs: string[], implicitRefs: string[], llmReasoning: string): string {
    const parts: string[] = [];

    if (explicitRefs.length > 0) {
      parts.push(`Explicitly referenced: ${explicitRefs.join(', ')}`);
    }

    if (implicitRefs.length > 0) {
      parts.push(`Implicitly associated: ${implicitRefs.join(', ')}`);
    }

    if (llmReasoning && implicitRefs.length > 0) {
      parts.push(`Reasoning: ${llmReasoning}`);
    }

    if (parts.length === 0) {
      parts.push('No skill associations found');
    }

    return parts.join('; ');
  }

  /**
   * Batch analyze multiple traces
   */
  async analyzeTraces(traces: Trace[]): Promise<Map<string, SkillRecognitionResult>> {
    const results = new Map<string, SkillRecognitionResult>();

    for (let i = 0; i < traces.length; i++) {
      const trace = traces[i];
      // Use previous traces as context
      const contextTraces = traces.slice(0, i);
      const result = await this.analyzeTrace(trace, contextTraces);
      results.set(trace.trace_id, result);
    }

    return results;
  }
}

/**
 * Create LLM Router Agent instance
 */
export function createLLMRouterAgent(options?: LLMRouterAgentOptions): LLMRouterAgent {
  return new LLMRouterAgent(options);
}
