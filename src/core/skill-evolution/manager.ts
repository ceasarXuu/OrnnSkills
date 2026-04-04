/**
 * Skill Evolution Manager
 *
 * 管理多个 Skill Evolution Threads
 * 负责 thread 的创建、销毁和路由
 */

import { createChildLogger } from '../../utils/logger.js';
import { SkillEvolutionThread, type SkillEvolutionState } from './thread.js';
import type { Trace, RuntimeType } from '../../types/index.js';

const logger = createChildLogger('skill-evolution-manager');

export interface SkillEvolutionManagerOptions {
  projectPath: string;
  onSkillTrigger?: (skillId: string, state: SkillEvolutionState) => void;
}

export interface TrackedSkill {
  skillId: string;
  originPath: string;
  runtime: RuntimeType;
  thread: SkillEvolutionThread;
  createdAt: Date;
}

/**
 * Skill Evolution Manager
 *
 * Responsibilities:
 * 1. Manage multiple skill evolution threads
 * 2. Route traces to appropriate threads
 * 3. Track skill invocation counts
 * 4. Handle thread lifecycle
 */
export class SkillEvolutionManager {
  private options: SkillEvolutionManagerOptions;
  private threads: Map<string, TrackedSkill> = new Map();

  constructor(options: SkillEvolutionManagerOptions) {
    this.options = options;
  }

  /**
   * Start tracking a skill
   */
  trackSkill(skillId: string, originPath: string, runtime: RuntimeType): SkillEvolutionThread {
    // Check if already tracking
    if (this.threads.has(skillId)) {
      logger.debug('Skill already being tracked', { skillId });
      return this.threads.get(skillId)!.thread;
    }

    logger.info('Tracking skill', { skillId, runtime, originPath });

    // Create evolution thread
    const thread = new SkillEvolutionThread({
      skillId,
      originPath,
      runtime,
      onTrigger: (state: SkillEvolutionState): void => {
        this.handleTrigger(skillId, state);
      },
    });

    thread.start();

    const trackedSkill: TrackedSkill = {
      skillId,
      originPath,
      runtime,
      thread,
      createdAt: new Date(),
    };

    this.threads.set(skillId, trackedSkill);
    logger.debug('Skill tracking started', { skillId });

    return thread;
  }

  /**
   * Stop tracking a skill
   */
  untrackSkill(skillId: string): boolean {
    const tracked = this.threads.get(skillId);
    if (!tracked) {
      return false;
    }

    tracked.thread.stop();
    this.threads.delete(skillId);
    logger.info('Skill tracking stopped', { skillId });
    return true;
  }

  /**
   * Route trace to skill thread
   */
  routeTrace(skillId: string, trace: Trace): boolean {
    const tracked = this.threads.get(skillId);
    if (!tracked) {
      logger.warn('Cannot route trace: skill not being tracked', { skillId });
      return false;
    }

    const result = tracked.thread.addTrace(trace);

    if (result.triggered) {
      logger.info('Skill triggered', { skillId, reason: result.reason });
    }

    return true;
  }

  /**
   * Record skill invocation
   */
  recordInvocation(skillId: string): boolean {
    const tracked = this.threads.get(skillId);
    if (!tracked) {
      logger.warn('Cannot record invocation: skill not being tracked', { skillId });
      return false;
    }

    const result = tracked.thread.recordInvocation();

    if (result.triggered) {
      logger.info('Skill triggered by re-invocation', { skillId });
    }

    return true;
  }

  /**
   * Handle trigger event
   */
  private handleTrigger(skillId: string, state: SkillEvolutionState): void {
    logger.info('Skill evolution triggered', { skillId, version: state.version, queueSize: state.queue.length });

    if (this.options.onSkillTrigger) {
      this.options.onSkillTrigger(skillId, state);
    }
  }

  /**
   * Get tracked skill
   */
  getTrackedSkill(skillId: string): TrackedSkill | undefined {
    return this.threads.get(skillId);
  }

  /**
   * Get skill thread
   */
  getThread(skillId: string): SkillEvolutionThread | undefined {
    return this.threads.get(skillId)?.thread;
  }

  /**
   * Get all tracked skills
   */
  getAllTrackedSkills(): TrackedSkill[] {
    return Array.from(this.threads.values());
  }

  /**
   * Get all skill IDs
   */
  getSkillIds(): string[] {
    return Array.from(this.threads.keys());
  }

  /**
   * Check if skill is being tracked
   */
  isTracking(skillId: string): boolean {
    return this.threads.has(skillId);
  }

  /**
   * Get statistics for all skills
   */
  getStats(): {
    totalSkills: number;
    skills: Array<{
      skillId: string;
      runtime: RuntimeType;
      version: number;
      queueSize: number;
      status: string;
    }>;
  } {
    const skills = Array.from(this.threads.values()).map((tracked) => {
      const stats = tracked.thread.getStats();
      return {
        skillId: tracked.skillId,
        runtime: tracked.runtime,
        version: stats.version,
        queueSize: stats.queueSize,
        status: stats.status,
      };
    });

    return {
      totalSkills: skills.length,
      skills,
    };
  }

  /**
   * Mark skill as submitted (after analysis)
   */
  markSubmitted(skillId: string): boolean {
    const tracked = this.threads.get(skillId);
    if (!tracked) {
      return false;
    }

    tracked.thread.markSubmitted();
    return true;
  }

  /**
   * Increment skill version
   */
  incrementVersion(skillId: string): number | null {
    const tracked = this.threads.get(skillId);
    if (!tracked) {
      return null;
    }

    return tracked.thread.incrementVersion();
  }

  /**
   * Stop all threads
   */
  stopAll(): void {
    logger.info('Stopping all skill evolution threads', { count: this.threads.size });
    for (const [skillId, tracked] of this.threads) {
      tracked.thread.stop();
      logger.debug('Skill thread stopped', { skillId });
    }
    this.threads.clear();
    logger.info('All skill evolution threads stopped');
  }

  /**
   * Get total number of tracked skills
   */
  getTrackedCount(): number {
    return this.threads.size;
  }
}

/**
 * Create a SkillEvolutionManager instance
 */
export function createSkillEvolutionManager(
  options: SkillEvolutionManagerOptions
): SkillEvolutionManager {
  return new SkillEvolutionManager(options);
}
