/**
 * LLM Analyzer Agent
 *
 * 使用 LLM 分析 skill 的使用 traces 并生成优化建议
 */

import { createChildLogger } from '../../utils/logger.js';
import { createLLM } from '../../llm/factory.js';
import { buildAnalysisPrompt, type PromptContext } from './prompt-builder.js';
import { parseAnalysisOutput, type ParsedAnalysis, type ParseResult } from './output-parser.js';
import type { Trace } from '../../types/index.js';

const logger = createChildLogger('analyzer-agent');

export interface AnalyzerAgentOptions {
  provider?: string;
  model?: string;
  apiKey?: string;
  baseUrl?: string;
  /**
   * Minimum confidence threshold for accepting analysis
   * @default 0.7
   */
  confidenceThreshold?: number;
  /**
   * Maximum number of traces to include in analysis
   * @default 20
   */
  maxTraces?: number;
}

export interface AnalysisRequest {
  skillId: string;
  skillContent: string;
  currentVersion: number;
  traces: Trace[];
}

export interface AnalysisResponse {
  success: boolean;
  result?: ParsedAnalysis;
  error?: string;
  tokenUsage?: {
    prompt: number;
    completion: number;
    total: number;
  };
}

/**
 * LLM Analyzer Agent
 *
 * Responsibilities:
 * 1. Build analysis prompt from skill content and traces
 * 2. Call LLM to analyze
 * 3. Parse and validate output
 * 4. Return structured analysis result
 */
export class LLMAnalyzerAgent {
  private options: AnalyzerAgentOptions;

  constructor(options: AnalyzerAgentOptions = {}) {
    this.options = {
      confidenceThreshold: 0.7,
      maxTraces: 20,
      ...options,
    };
  }

  /**
   * Analyze a skill based on its usage traces
   */
  async analyze(request: AnalysisRequest): Promise<AnalysisResponse> {
    logger.info(`Analyzing skill: ${request.skillId} (v${request.currentVersion})`);

    try {
      // Prepare traces (limit to maxTraces)
      const traces = request.traces.slice(-this.options.maxTraces!);
      logger.debug(`Using ${traces.length} traces for analysis`);

      // Build prompt
      const context: PromptContext = {
        skillId: request.skillId,
        skillContent: request.skillContent,
        currentVersion: request.currentVersion,
        traces,
      };
      const prompt = buildAnalysisPrompt(context);

      // Call LLM
      logger.debug('Calling LLM for analysis...');
      let llmResponse: string;
      
      try {
        llmResponse = await this.callLLM(prompt.systemPrompt, prompt.userPrompt);
      } catch (llmError) {
        const errorMsg = llmError instanceof Error ? llmError.message : String(llmError);

        if (errorMsg.includes('timed out')) {
          logger.error('LLM call timed out');
          return {
            success: false,
            error: 'Analysis timed out. The LLM took too long to respond.',
          };
        } else {
          throw llmError;
        }
      }

      // Parse output
      const parseResult = parseAnalysisOutput(llmResponse);

      if (!isParsedAnalysis(parseResult)) {
        logger.error(`Failed to parse analysis: ${parseResult.error}`);
        return {
          success: false,
          error: parseResult.error,
        };
      }

      // Check confidence threshold
      if (parseResult.confidence < this.options.confidenceThreshold!) {
        logger.warn(
          `Analysis confidence (${parseResult.confidence}) below threshold (${this.options.confidenceThreshold})`
        );
        return {
          success: false,
          error: `Analysis confidence (${parseResult.confidence}) below threshold (${this.options.confidenceThreshold})`,
          result: parseResult,
        };
      }

      logger.info(
        `Analysis complete: ${parseResult.suggestions.length} suggestions, confidence: ${parseResult.confidence}`
      );

      return {
        success: true,
        result: parseResult,
        tokenUsage: {
          prompt: 0,
          completion: 0,
          total: 0,
        },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`Analysis failed for ${request.skillId}:`, error);

      return {
        success: false,
        error: errorMsg,
      };
    }
  }

  /**
   * Call LLM with prompts
   * Includes timeout and error handling
   */
  private async callLLM(systemPrompt: string, userPrompt: string): Promise<string> {
    const llm = createLLM({
      provider: this.options.provider || 'deepseek',
      modelName: this.options.model || 'deepseek-chat',
      apiKey: this.options.apiKey || '',
    });

    // Combine system and user prompts
    const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;

    // Call with timeout
    return this.callWithTimeout(() => llm.complete(fullPrompt), 60000);
  }

  /**
   * Call function with timeout
   */
  private async callWithTimeout<T>(fn: () => Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
      ),
    ]);
  }

  /**
   * Quick check if analysis is needed
   * Returns true if there are enough traces to warrant analysis
   */
  shouldAnalyze(traces: Trace[], minTraces = 5): boolean {
    return traces.length >= minTraces;
  }

  /**
   * Get analysis statistics
   */
  getStats(): {
    confidenceThreshold: number;
    maxTraces: number;
  } {
    return {
      confidenceThreshold: this.options.confidenceThreshold!,
      maxTraces: this.options.maxTraces!,
    };
  }

}

/**
 * Type guard for ParseResult
 */
function isParsedAnalysis(result: ParseResult): result is ParsedAnalysis {
  return !('success' in result && result.success === false);
}

/**
 * Create an LLMAnalyzerAgent instance
 */
export function createLLMAnalyzerAgent(options?: AnalyzerAgentOptions): LLMAnalyzerAgent {
  return new LLMAnalyzerAgent(options);
}
