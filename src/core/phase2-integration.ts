/**
 * Phase 2 Integration
 *
 * 将 Observer、Router 和 TraceStore 集成在一起，形成完整的 Trace 处理流水线。
 */

import { ProjectObserver, type ProjectObserverOptions } from './observer/project-observer.js';
import { TraceRouter, type RouterOptions } from './router/index.js';
import { TraceStore, type TraceStoreOptions } from './trace-store/index.js';
import { createChildLogger } from '../utils/logger.js';
import type { Trace, TraceSkillMapping } from '../types/index.js';

const logger = createChildLogger('phase2-integration');

export interface Phase2IntegrationOptions {
  projectPath: string;
  enableObserver?: boolean;
  enableRouter?: boolean;
  enableStore?: boolean;
  observerOptions?: Partial<ProjectObserverOptions>;
  routerOptions?: Partial<RouterOptions>;
  storeOptions?: Partial<TraceStoreOptions>;
  onTrace?: (trace: Trace) => void;
  onSkillTrace?: (mapping: TraceSkillMapping, trace: Trace) => void;
}

/**
 * Phase 2 Integration
 *
 * 集成 Observer、Router 和 TraceStore 的完整 Trace 处理流水线：
 *
 * 1. Observer: 监听 Codex/Claude trace 文件
 * 2. Router: 根据 skill_refs 路由 Trace
 * 3. TraceStore: 存储和管理 Trace
 *
 * 数据流：
 * Codex/Claude Files -> Observer -> Router -> TraceStore
 *                               -> onSkillTrace callback
 */
export class Phase2Integration {
  private options: Phase2IntegrationOptions;
  private observer: ProjectObserver | null = null;
  private router: TraceRouter | null = null;
  private store: TraceStore | null = null;
  private isRunning: boolean = false;

  constructor(options: Phase2IntegrationOptions) {
    this.options = {
      enableObserver: true,
      enableRouter: true,
      enableStore: true,
      ...options,
    };

    this.initialize();
  }

  /**
   * Initialize components
   */
  private initialize(): void {
    logger.info('Initializing Phase 2 integration...');

    // Initialize TraceStore
    if (this.options.enableStore) {
      this.store = new TraceStore({
        projectPath: this.options.projectPath,
        ...this.options.storeOptions,
      });
      logger.info('TraceStore initialized');
    }

    // Initialize Router
    if (this.options.enableRouter) {
      this.router = new TraceRouter({
        projectPath: this.options.projectPath,
        onSkillTrace: (mapping, trace) => {
          this.handleSkillTrace(mapping, trace);
        },
        onUnknownTrace: (trace) => {
          this.handleUnknownTrace(trace);
        },
        ...this.options.routerOptions,
      });
      logger.info('TraceRouter initialized');
    }

    // Initialize Observer
    if (this.options.enableObserver) {
      this.observer = new ProjectObserver({
        projectPath: this.options.projectPath,
        onTrace: (trace) => {
          this.handleTrace(trace);
        },
        ...this.options.observerOptions,
      });
      logger.info('ProjectObserver initialized');
    }

    logger.info('Phase 2 integration initialized');
  }

  /**
   * Start the integration
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Phase 2 integration already running');
      return;
    }

    logger.info('Starting Phase 2 integration...');

    if (this.observer) {
      await this.observer.start();
    }

    this.isRunning = true;
    logger.info('Phase 2 integration started');
  }

  /**
   * Stop the integration
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('Phase 2 integration not running');
      return;
    }

    logger.info('Stopping Phase 2 integration...');

    if (this.observer) {
      await this.observer.stop();
    }

    this.isRunning = false;
    logger.info('Phase 2 integration stopped');
  }

  /**
   * Handle incoming trace from Observer
   */
  private handleTrace(trace: Trace): void {
    logger.debug(`Handling trace: ${trace.trace_id}`);

    // Store the trace
    if (this.store) {
      this.store.store(trace);
    }

    // Route the trace
    if (this.router) {
      this.router.route(trace);
    }

    // Call user callback
    if (this.options.onTrace) {
      this.options.onTrace(trace);
    }
  }

  /**
   * Handle skill-mapped trace from Router
   */
  private handleSkillTrace(mapping: TraceSkillMapping, trace: Trace): void {
    logger.debug(`Handling skill trace: ${trace.trace_id} -> ${mapping.skill_id}`);

    // Call user callback
    if (this.options.onSkillTrace) {
      this.options.onSkillTrace(mapping, trace);
    }
  }

  /**
   * Handle unknown trace (no skill refs)
   */
  private handleUnknownTrace(trace: Trace): void {
    logger.debug(`Handling unknown trace: ${trace.trace_id}`);
    // Unknown traces are already stored, no additional action needed
  }

  /**
   * Manually inject a trace (for testing or external sources)
   */
  injectTrace(trace: Trace): void {
    logger.debug(`Injecting trace: ${trace.trace_id}`);
    this.handleTrace(trace);
  }

  /**
   * Get the TraceStore instance
   */
  getStore(): TraceStore | null {
    return this.store;
  }

  /**
   * Get the TraceRouter instance
   */
  getRouter(): TraceRouter | null {
    return this.router;
  }

  /**
   * Get the ProjectObserver instance
   */
  getObserver(): ProjectObserver | null {
    return this.observer;
  }

  /**
   * Check if running
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Get integration statistics
   */
  getStats(): {
    isRunning: boolean;
    storeStats: ReturnType<TraceStore['getStats']> | null;
    routerStats: ReturnType<TraceRouter['getStats']> | null;
  } {
    return {
      isRunning: this.isRunning,
      storeStats: this.store?.getStats() || null,
      routerStats: this.router?.getStats() || null,
    };
  }

  /**
   * Query traces from store
   */
  queryTraces(query: Parameters<TraceStore['query']>[0]): ReturnType<TraceStore['query']> {
    if (!this.store) {
      throw new Error('TraceStore not enabled');
    }
    return this.store.query(query);
  }

  /**
   * Get all traces from store
   */
  getAllTraces(): Trace[] {
    if (!this.store) {
      throw new Error('TraceStore not enabled');
    }
    return this.store.getAll();
  }

  /**
   * Export traces to JSON
   */
  exportTraces(): string {
    if (!this.store) {
      throw new Error('TraceStore not enabled');
    }
    return this.store.exportToJSON();
  }

  /**
   * Import traces from JSON
   */
  importTraces(json: string): void {
    if (!this.store) {
      throw new Error('TraceStore not enabled');
    }
    this.store.importFromJSON(json);
  }
}

/**
 * Create a Phase2Integration instance
 */
export function createPhase2Integration(options: Phase2IntegrationOptions): Phase2Integration {
  return new Phase2Integration(options);
}
