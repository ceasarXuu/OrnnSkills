/**
 * Status bar for displaying runtime information
 * Simple console-based status display
 */

import { tokenTracker } from '../llm/token-tracker.js';

interface StatusInfo {
  trackedSkills: number;
  isRunning: boolean;
}

class StatusBar {
  private info: StatusInfo = {
    trackedSkills: 0,
    isRunning: false,
  };
  private renderTimeout: NodeJS.Timeout | null = null;

  /**
   * Update status information
   */
  update(updates: Partial<StatusInfo>): void {
    this.info = { ...this.info, ...updates };
    this.scheduleRender();
  }

  /**
   * Increment tracked skills count
   */
  incrementTrackedSkills(): void {
    this.info.trackedSkills++;
    this.scheduleRender();
  }

  /**
   * Schedule render with debouncing
   */
  private scheduleRender(): void {
    // Debounce: delay render to merge multiple updates
    if (this.renderTimeout) {
      clearTimeout(this.renderTimeout);
    }
    this.renderTimeout = setTimeout(() => this.render(), 100);
  }

  /**
   * Render status bar
   */
  render(): void {
    // Check if stdout is TTY
    if (!process.stdout.isTTY) {
      return;
    }

    const stats = tokenTracker.getStats();
    const totalTokens = stats.total.totalTokens;

    // Clear current line and write status
    process.stdout.write('\r\x1b[K');
    process.stdout.write(
      `Tracked Skills: ${this.info.trackedSkills} | ` +
      `Token Usage: ${totalTokens.toLocaleString()} | ` +
      `Status: ${this.info.isRunning ? '🟢 Running' : '🔴 Stopped'} | ` +
      `Press Ctrl+C to stop`
    );
  }

  /**
   * Start status bar updates
   */
  start(): void {
    this.info.isRunning = true;
    this.render();
  }

  /**
   * Stop status bar
   */
  stop(): void {
    this.info.isRunning = false;
    if (this.renderTimeout) {
      clearTimeout(this.renderTimeout);
      this.renderTimeout = null;
    }
    process.stdout.write('\n');
  }
}

// Global status bar instance
export const statusBar = new StatusBar();
