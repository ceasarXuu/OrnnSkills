/**
 * Token usage tracker for monitoring LLM consumption
 */

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export class TokenTracker {
  private totalUsage: TokenUsage = {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
  };

  private usageBySkill: Map<string, TokenUsage> = new Map();

  /**
   * Track token usage for a skill
   */
  trackUsage(skillId: string, usage: TokenUsage): void {
    // Update total
    this.totalUsage.promptTokens += usage.promptTokens;
    this.totalUsage.completionTokens += usage.completionTokens;
    this.totalUsage.totalTokens += usage.totalTokens;

    // Update skill-level
    const current = this.usageBySkill.get(skillId) || {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    };

    this.usageBySkill.set(skillId, {
      promptTokens: current.promptTokens + usage.promptTokens,
      completionTokens: current.completionTokens + usage.completionTokens,
      totalTokens: current.totalTokens + usage.totalTokens,
    });
  }

  /**
   * Get total usage statistics
   */
  getTotalUsage(): TokenUsage {
    return { ...this.totalUsage };
  }

  /**
   * Get usage by skill
   */
  getUsageBySkill(skillId: string): TokenUsage | undefined {
    const usage = this.usageBySkill.get(skillId);
    return usage ? { ...usage } : undefined;
  }

  /**
   * Get all skills usage
   */
  getAllSkillsUsage(): Record<string, TokenUsage> {
    return Object.fromEntries(
      Array.from(this.usageBySkill.entries()).map(([id, usage]) => [
        id,
        { ...usage },
      ])
    );
  }

  /**
   * Get formatted statistics for display
   */
  getStats(): {
    total: TokenUsage;
    bySkill: Record<string, TokenUsage>;
  } {
    return {
      total: this.getTotalUsage(),
      bySkill: this.getAllSkillsUsage(),
    };
  }

  /**
   * Format token count for display
   */
  static formatTokenCount(count: number): string {
    return count.toLocaleString();
  }
}

// Global token tracker instance
export const tokenTracker = new TokenTracker();
