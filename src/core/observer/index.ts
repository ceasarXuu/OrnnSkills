/**
 * Observer 模块入口
 */

export { BaseObserver } from './base-observer.js';

/**
 * @deprecated Use ProjectObserver instead. CodexObserver will be removed in v0.2.0
 */
export { CodexObserver, createCodexObserver } from './codex-observer.js';

/**
 * @deprecated Use ProjectObserver instead. ClaudeObserver will be removed in v0.2.0
 */
export { ClaudeObserver, createClaudeObserver } from './claude-observer.js';

export { TraceManager, createTraceManager } from './trace-manager.js';

export {
  ProjectObserver,
  createProjectObserver,
  type ProjectObserverOptions,
} from './project-observer.js';