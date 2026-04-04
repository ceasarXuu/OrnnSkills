/**
 * Skill Evolution Thread
 *
 * 管理单个 skill 的演化生命周期
 * 包括：trace 收集、触发条件检查、版本管理
 */

import { createChildLogger } from '../../utils/logger.js';
import type { Trace, RuntimeType } from '../../types/index.js';

const logger = createChildLogger('skill-evolution-thread');

export interface SkillEvolutionState {
  skillId: string;
  originPath: string;
  runtime: RuntimeType;
  status: 'collecting' | 'analyzing' | 'idle';

  // Queue management
  queue: Trace[];
  submittedCount: number;
  invokeCount: number;

  // Version management
  version: number;

  // Trigger tracking
  lastTriggerAt: Date | null;
  totalTurnsCollected: number;
}

export interface SkillEvolutionOptions {
  skillId: string;
  originPath: string;
  runtime: RuntimeType;
  turnsThreshold?: number;
  onTrigger?: (state: SkillEvolutionState) => void;
}

export interface TriggerResult {
  triggered: boolean;
  reason: string;
  state: SkillEvolutionState;
}

/**
 * Skill Evolution Thread
 *
 * Responsibilities:
 * 1. Collect traces related to a specific skill
 * 2. Check trigger conditions (10 turns or re-invoke)
 * 3. Manage evolution state
 * 4. Notify when optimization should be triggered
 */
export class SkillEvolutionThread {
  private options: SkillEvolutionOptions;
  private state: SkillEvolutionState;
  private isRunning: boolean = false;

  constructor(options: SkillEvolutionOptions) {
    this.options = {
      turnsThreshold: 10,
      ...options,
    };

    this.state = {
      skillId: options.skillId,
      originPath: options.originPath,
      runtime: options.runtime,
      status: 'idle',
      queue: [],
      submittedCount: 0,
      invokeCount: 0,
      version: 0,
      lastTriggerAt: null,
      totalTurnsCollected: 0,
    };
  }

  /**
   * Start the evolution thread
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('Skill evolution thread already running', { skillId: this.state.skillId });
      return;
    }

    this.isRunning = true;
    this.state.status = 'collecting';
    logger.info('Skill evolution thread started', { skillId: this.state.skillId });
  }

  /**
   * Stop the evolution thread
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    this.state.status = 'idle';
    logger.info('Skill evolution thread stopped', { skillId: this.state.skillId });
  }

  /**
   * Add a trace to the queue
   */
  addTrace(trace: Trace): TriggerResult {
    if (!this.isRunning) {
      return {
        triggered: false,
        reason: 'Thread not running',
        state: this.state,
      };
    }

    // Add to queue
    this.state.queue.push(trace);
    this.state.totalTurnsCollected++;

    logger.debug('Trace added to queue', {
      skillId: this.state.skillId,
      traceId: trace.trace_id,
      queueSize: this.state.queue.length,
    });

    // Check trigger conditions
    return this.checkTriggers();
  }

  /**
   * Record a skill invocation
   */
  recordInvocation(): TriggerResult {
    this.state.invokeCount++;
    logger.debug('Invocation recorded', { skillId: this.state.skillId, invokeCount: this.state.invokeCount });

    // Check if this is a re-invocation (invokeCount > submittedCount)
    if (this.state.invokeCount > this.state.submittedCount) {
      logger.info('Re-invocation detected', { skillId: this.state.skillId });
      return this.trigger('Re-invocation detected');
    }

    return {
      triggered: false,
      reason: 'Waiting for more data',
      state: this.state,
    };
  }

  /**
   * Check trigger conditions
   */
  private checkTriggers(): TriggerResult {
    // Count unique turns by turn_id
    const uniqueTurns = this.countUniqueTurns();

    if (uniqueTurns >= (this.options.turnsThreshold || 10)) {
      logger.info('Turn threshold reached', {
        skillId: this.state.skillId,
        turns: uniqueTurns,
        threshold: this.options.turnsThreshold,
      });
      return this.trigger(`Turn threshold reached (${uniqueTurns} turns)`);
    }

    return {
      triggered: false,
      reason: `Collecting data (${uniqueTurns}/${this.options.turnsThreshold} turns)`,
      state: this.state,
    };
  }

  /**
   * Count unique turns in queue
   * Groups traces by turn_id to avoid double counting
   */
  private countUniqueTurns(): number {
    const uniqueTurnIds = new Set<string>();

    for (const trace of this.state.queue) {
      // Use turn_id if available, otherwise use trace_id as fallback
      const turnId = trace.turn_id || trace.trace_id;
      uniqueTurnIds.add(turnId);
    }

    return uniqueTurnIds.size;
  }

  /**
   * Trigger evolution
   */
  private trigger(reason: string): TriggerResult {
    this.state.status = 'analyzing';
    this.state.lastTriggerAt = new Date();

    // Call the trigger callback
    if (this.options.onTrigger) {
      try {
        this.options.onTrigger(this.state);
      } catch (error) {
        logger.error('Trigger callback failed', { skillId: this.state.skillId, error });
      }
    }

    return {
      triggered: true,
      reason,
      state: this.state,
    };
  }

  /**
   * Mark current queue as submitted
   */
  markSubmitted(): void {
    this.state.submittedCount = this.state.invokeCount;
    this.state.queue = []; // Clear the queue
    this.state.status = 'collecting';
    this.state.totalTurnsCollected = 0;
    logger.info('Skill queue submitted', { skillId: this.state.skillId });
  }

  /**
   * Increment version
   */
  incrementVersion(): number {
    this.state.version++;
    logger.info('Skill version incremented', { skillId: this.state.skillId, version: this.state.version });
    return this.state.version;
  }

  /**
   * Get current state
   */
  getState(): SkillEvolutionState {
    return { ...this.state };
  }

  /**
   * Get queue size
   */
  getQueueSize(): number {
    return this.state.queue.length;
  }

  /**
   * Get all traces in queue
   */
  getQueue(): Trace[] {
    return [...this.state.queue];
  }

  /**
   * Check if running
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Get statistics
   */
  getStats(): {
    skillId: string;
    version: number;
    queueSize: number;
    totalTurns: number;
    invokeCount: number;
    submittedCount: number;
    status: string;
  } {
    return {
      skillId: this.state.skillId,
      version: this.state.version,
      queueSize: this.state.queue.length,
      totalTurns: this.state.totalTurnsCollected,
      invokeCount: this.state.invokeCount,
      submittedCount: this.state.submittedCount,
      status: this.state.status,
    };
  }
}

/**
 * Create a SkillEvolutionThread instance
 */
export function createSkillEvolutionThread(options: SkillEvolutionOptions): SkillEvolutionThread {
  return new SkillEvolutionThread(options);
}
