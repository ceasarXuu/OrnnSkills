import type { Trace } from '../types/index.js';
import { createChildLogger } from '../utils/logger.js';
import type { RetryQueueEntry } from './daemon-types.js';

const logger = createChildLogger('daemon-retry-queue');

export class RetryQueueStore {
  private readonly retryQueue = new Map<string, RetryQueueEntry>();

  constructor(
    private readonly options: {
      maxRetries: number;
      maxQueueSize: number;
    }
  ) {}

  get size(): number {
    return this.retryQueue.size;
  }

  has(traceId: string): boolean {
    return this.retryQueue.has(traceId);
  }

  sizeForProject(projectRoot: string): number {
    let count = 0;
    for (const entry of this.retryQueue.values()) {
      if (entry.projectRoot === projectRoot) {
        count += 1;
      }
    }
    return count;
  }

  add(trace: Trace, error: Error, projectRoot: string | null): void {
    const traceId = trace.trace_id;

    if (this.retryQueue.has(traceId)) {
      logger.debug('Trace already in retry queue, skipping', { traceId });
      return;
    }

    if (this.retryQueue.size >= this.options.maxQueueSize) {
      const firstKey = this.retryQueue.keys().next().value;
      if (typeof firstKey === 'string') {
        this.retryQueue.delete(firstKey);
        logger.warn('Retry queue is full, dropping oldest trace', { droppedTraceId: firstKey });
      }
    }

    this.retryQueue.set(traceId, {
      traceId,
      projectRoot,
      attempts: 0,
      lastErrorMessage: error.message,
      addedAt: Date.now(),
    });

    logger.debug('Trace added to retry queue', {
      traceId,
      projectRoot,
      queueSize: this.retryQueue.size,
    });
  }

  clearForProject(projectRoot: string): number {
    let removed = 0;
    for (const [traceId, entry] of this.retryQueue.entries()) {
      if (entry.projectRoot !== projectRoot) {
        continue;
      }

      this.retryQueue.delete(traceId);
      removed += 1;
    }

    if (removed > 0) {
      logger.info('Cleared retry queue entries for project runtime', {
        projectRoot,
        removed,
      });
    }

    return removed;
  }

  process(): void {
    if (this.retryQueue.size === 0) {
      return;
    }

    const entriesToProcess = Array.from(this.retryQueue.entries());
    for (const [traceId, entry] of entriesToProcess) {
      if (entry.attempts >= this.options.maxRetries) {
        logger.error('Trace exceeded max retries, discarding', {
          traceId,
          projectRoot: entry.projectRoot,
          attempts: entry.attempts,
          lastErrorMessage: entry.lastErrorMessage,
        });
        this.retryQueue.delete(traceId);
        continue;
      }

      try {
        logger.warn('Retry queue processing requires trace store lookup', {
          traceId,
          projectRoot: entry.projectRoot,
        });
        this.retryQueue.delete(traceId);
      } catch (error) {
        entry.attempts += 1;
        entry.lastErrorMessage = error instanceof Error ? error.message : String(error);

        if (entry.attempts >= this.options.maxRetries) {
          logger.error('Trace failed after max retries', {
            traceId,
            projectRoot: entry.projectRoot,
            attempts: entry.attempts,
            error: entry.lastErrorMessage,
          });
          this.retryQueue.delete(traceId);
        } else {
          logger.debug('Trace retry failed, will retry again', {
            traceId,
            projectRoot: entry.projectRoot,
            attempts: entry.attempts,
          });
        }
      }
    }
  }
}
