/**
 * User Confirmation
 *
 * 在技能优化部署前提供用户确认机制。
 * 显示优化前后的对比，让用户决定是否应用优化。
 */

import { createChildLogger } from '../../utils/logger.js';

const logger = createChildLogger('user-confirmation');

export interface ConfirmationOptions {
  autoConfirm?: boolean;
  timeoutMs?: number;
}

export interface SkillDiff {
  skillId: string;
  skillName: string;
  originalContent: string;
  optimizedContent: string;
  changes: Array<{
    type: 'added' | 'removed' | 'modified';
    line: number;
    content: string;
  }>;
  analysisSummary: string;
  confidence: number;
}

export interface ConfirmationResult {
  confirmed: boolean;
  skillId: string;
  reason?: string;
  timestamp: string;
}

export type ConfirmationHandler = (diff: SkillDiff) => Promise<ConfirmationResult>;

/**
 * User Confirmation Manager
 *
 * Responsibilities:
 * 1. Display skill optimization diff to user
 * 2. Collect user confirmation (approve/reject)
 * 3. Support auto-confirm mode for CI/CD
 * 4. Provide timeout handling
 * 5. Log confirmation decisions
 */
export class UserConfirmation {
  private options: Required<ConfirmationOptions>;
  private handler: ConfirmationHandler;

  constructor(
    handler: ConfirmationHandler,
    options: ConfirmationOptions = {}
  ) {
    this.handler = handler;
    this.options = {
      autoConfirm: false,
      timeoutMs: 300000, // 5 minutes default
      ...options,
    };
  }

  /**
   * Request confirmation for skill optimization
   */
  async confirm(diff: SkillDiff): Promise<ConfirmationResult> {
    // Auto-confirm mode
    if (this.options.autoConfirm) {
      logger.info(`Auto-confirmed optimization for skill: ${diff.skillId}`);
      return {
        confirmed: true,
        skillId: diff.skillId,
        reason: 'Auto-confirmed',
        timestamp: new Date().toISOString(),
      };
    }

    // Use custom handler with timeout
    try {
      const result = await this.withTimeout(
        () => this.handler(diff),
        this.options.timeoutMs
      );

      logger.info(
        `User ${result.confirmed ? 'confirmed' : 'rejected'} optimization for skill: ${diff.skillId}`
      );

      return {
        ...result,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error(`Confirmation timed out for skill: ${diff.skillId}`);
      return {
        confirmed: false,
        skillId: diff.skillId,
        reason: 'Timeout',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Wrap a promise with timeout
   */
  private withTimeout<T>(fn: () => Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), timeoutMs)
      ),
    ]);
  }

  /**
   * Create a CLI confirmation handler
   */
  static createCLIHandler(): ConfirmationHandler {
    return async (diff: SkillDiff): Promise<ConfirmationResult> => {
      // Print diff summary
      console.log('\n' + '='.repeat(80));
      console.log(`🔧 Skill Optimization: ${diff.skillName}`);
      console.log('='.repeat(80));
      console.log(`\n📊 Analysis Summary:`);
      console.log(`   ${diff.analysisSummary}`);
      console.log(`\n🎯 Confidence: ${(diff.confidence * 100).toFixed(1)}%`);
      console.log(`\n📝 Changes:`);

      if (diff.changes.length === 0) {
        console.log('   No significant changes detected');
      } else {
        for (const change of diff.changes.slice(0, 10)) {
          const icon = change.type === 'added' ? '+' : change.type === 'removed' ? '-' : '~';
          console.log(`   ${icon} Line ${change.line}: ${change.content.slice(0, 50)}...`);
        }
        if (diff.changes.length > 10) {
          console.log(`   ... and ${diff.changes.length - 10} more changes`);
        }
      }

      console.log('\n' + '-'.repeat(80));

      // For now, return auto-confirm (in real implementation, would use inquirer)
      // This is a placeholder that can be replaced with actual CLI prompts
      return {
        confirmed: true,
        skillId: diff.skillId,
        reason: 'CLI auto-confirm (placeholder)',
        timestamp: new Date().toISOString(),
      };
    };
  }

  /**
   * Create a programmatic confirmation handler (for testing)
   */
  static createProgrammaticHandler(
    decision: boolean,
    reason?: string
  ): ConfirmationHandler {
    return async (diff: SkillDiff): Promise<ConfirmationResult> => {
      return {
        confirmed: decision,
        skillId: diff.skillId,
        reason: reason || (decision ? 'Programmatic approval' : 'Programmatic rejection'),
        timestamp: new Date().toISOString(),
      };
    };
  }

  /**
   * Create a diff from original and optimized content
   */
  static createDiff(
    skillId: string,
    skillName: string,
    originalContent: string,
    optimizedContent: string,
    analysisSummary: string,
    confidence: number
  ): SkillDiff {
    const originalLines = originalContent.split('\n');
    const optimizedLines = optimizedContent.split('\n');
    const changes: SkillDiff['changes'] = [];

    // Simple line-by-line comparison
    const maxLines = Math.max(originalLines.length, optimizedLines.length);
    for (let i = 0; i < maxLines; i++) {
      const original = originalLines[i] || '';
      const optimized = optimizedLines[i] || '';

      if (original !== optimized) {
        if (!original && optimized) {
          changes.push({ type: 'added', line: i + 1, content: optimized });
        } else if (original && !optimized) {
          changes.push({ type: 'removed', line: i + 1, content: original });
        } else {
          changes.push({ type: 'modified', line: i + 1, content: optimized });
        }
      }
    }

    return {
      skillId,
      skillName,
      originalContent,
      optimizedContent,
      changes,
      analysisSummary,
      confidence,
    };
  }
}

/**
 * Create a UserConfirmation instance
 */
export function createUserConfirmation(
  handler: ConfirmationHandler,
  options?: ConfirmationOptions
): UserConfirmation {
  return new UserConfirmation(handler, options);
}

/**
 * Create a CLI-based user confirmation
 */
export function createCLIUserConfirmation(
  options?: ConfirmationOptions
): UserConfirmation {
  return new UserConfirmation(UserConfirmation.createCLIHandler(), options);
}

/**
 * Create a programmatic user confirmation (for testing)
 */
export function createProgrammaticUserConfirmation(
  decision: boolean,
  reason?: string,
  options?: ConfirmationOptions
): UserConfirmation {
  return new UserConfirmation(
    UserConfirmation.createProgrammaticHandler(decision, reason),
    options
  );
}
