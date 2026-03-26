/**
 * Phase 5 Integration
 *
 * 集成 LLM Analyzer 到 Skill Evolution 流程
 * 当 Skill Evolution Thread 触发时，调用 Analyzer 进行分析和优化
 */

import { createChildLogger } from '../utils/logger.js';
import { LLMAnalyzerAgent, createLLMAnalyzerAgent } from './analyzer/index.js';
import { extractChangesSummary } from './analyzer/output-parser.js';
import { Phase4Integration, createPhase4Integration } from './phase4-integration.js';
import type { SkillEvolutionState } from './skill-evolution/index.js';
import type { RuntimeType } from '../types/index.js';

const logger = createChildLogger('phase5-integration');

export interface Phase5IntegrationOptions {
  projectPath: string;
  runtime: RuntimeType;
  analyzerOptions?: Parameters<typeof createLLMAnalyzerAgent>[0];
  onAnalysisComplete?: (skillId: string, success: boolean, newVersion?: number) => void;
}

export interface AnalysisJob {
  skillId: string;
  state: SkillEvolutionState;
  status: 'pending' | 'analyzing' | 'completed' | 'failed';
  result?: {
    success: boolean;
    newVersion?: number;
    reason: string;
  };
}

/**
 * Phase 5 Integration
 *
 * Responsibilities:
 * 1. Receive trigger from Skill Evolution Thread
 * 2. Read current skill content and traces
 * 3. Call LLM Analyzer to analyze
 * 4. Create new version with improved content
 * 5. Deploy to runtime
 */
export class Phase5Integration {
  private options: Phase5IntegrationOptions;
  private analyzer: LLMAnalyzerAgent;
  private phase4: Phase4Integration;
  private analysisJobs: Map<string, AnalysisJob> = new Map();
  private isAnalyzing: Set<string> = new Set(); // Track skills being analyzed

  constructor(options: Phase5IntegrationOptions) {
    this.options = options;
    this.analyzer = createLLMAnalyzerAgent(options.analyzerOptions);
    this.phase4 = createPhase4Integration({
      projectPath: options.projectPath,
      runtime: options.runtime,
    });

    logger.info('Phase 5 integration initialized');
  }

  /**
   * Handle skill evolution trigger
   * This is called when Skill Evolution Thread triggers (10 turns or re-invoke)
   */
  async handleEvolutionTrigger(skillId: string, state: SkillEvolutionState): Promise<void> {
    logger.info(`Handling evolution trigger for skill: ${skillId}`);

    // Check if already analyzing this skill
    if (this.isAnalyzing.has(skillId)) {
      logger.warn(`Skill ${skillId} is already being analyzed, skipping`);
      return;
    }

    // Check if we have enough traces
    if (!this.analyzer.shouldAnalyze(state.queue, 5)) {
      logger.info(`Not enough traces for ${skillId} (${state.queue.length}), skipping analysis`);
      return;
    }

    // Mark as analyzing
    this.isAnalyzing.add(skillId);

    // Create analysis job
    const job: AnalysisJob = {
      skillId,
      state,
      status: 'analyzing',
    };
    this.analysisJobs.set(skillId, job);

    try {
      // Get current skill content
      const currentVersion = this.phase4.getCurrentVersion(skillId);
      if (currentVersion === 0) {
        throw new Error(`No versions found for skill ${skillId}, cannot analyze`);
      }

      const versions = this.phase4.getAllVersions(skillId);
      const latestVersion = versions[versions.length - 1];
      if (!latestVersion) {
        throw new Error(`Cannot get latest version for skill ${skillId}`);
      }

      // Call analyzer
      logger.info(`Starting analysis for ${skillId} with ${state.queue.length} traces`);
      const analysisResult = await this.analyzer.analyze({
        skillId,
        skillContent: latestVersion.content,
        currentVersion,
        traces: state.queue,
      });

      if (!analysisResult.success || !analysisResult.result) {
        throw new Error(analysisResult.error || 'Analysis failed');
      }

      const result = analysisResult.result;
      logger.info(`Analysis complete for ${skillId}: ${result.suggestions.length} suggestions`);

      // Create new version
      const reason = extractChangesSummary(result);
      const traceIds = state.queue.map((t) => t.trace_id);

      const newVersion = this.phase4.createOptimizedVersion(
        skillId,
        result.improvedSkill,
        reason,
        traceIds,
        analysisResult.tokenUsage,
        this.options.analyzerOptions?.model
      );

      if (!newVersion) {
        throw new Error(`Failed to create new version for ${skillId}`);
      }

      // Deploy new version
      const deployResult = this.phase4.deployVersion(skillId, newVersion);

      // Update job
      job.status = 'completed';
      job.result = {
        success: deployResult.success,
        newVersion: newVersion.version,
        reason,
      };

      logger.info(`Evolution complete for ${skillId}: v${newVersion.version} deployed`);

      // Notify callback
      if (this.options.onAnalysisComplete) {
        this.options.onAnalysisComplete(skillId, true, newVersion.version);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`Evolution failed for ${skillId}:`, error);

      job.status = 'failed';
      job.result = {
        success: false,
        reason: errorMsg,
      };

      if (this.options.onAnalysisComplete) {
        this.options.onAnalysisComplete(skillId, false);
      }
    } finally {
      this.isAnalyzing.delete(skillId);
    }
  }

  /**
   * Get analysis job status
   */
  getJobStatus(skillId: string): AnalysisJob | undefined {
    return this.analysisJobs.get(skillId);
  }

  /**
   * Get all analysis jobs
   */
  getAllJobs(): AnalysisJob[] {
    return Array.from(this.analysisJobs.values());
  }

  /**
   * Check if skill is being analyzed
   */
  isAnalyzingSkill(skillId: string): boolean {
    return this.isAnalyzing.has(skillId);
  }

  /**
   * Get Phase 4 integration (for version management)
   */
  getPhase4Integration(): Phase4Integration {
    return this.phase4;
  }

  /**
   * Get analyzer agent
   */
  getAnalyzer(): LLMAnalyzerAgent {
    return this.analyzer;
  }
}

/**
 * Create a Phase5Integration instance
 */
export function createPhase5Integration(options: Phase5IntegrationOptions): Phase5Integration {
  return new Phase5Integration(options);
}
