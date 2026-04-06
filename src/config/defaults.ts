import type { EVOConfig } from '../types/index.js';

/**
 * 默认配置
 */
export const DEFAULT_CONFIG: EVOConfig = {
  origin_paths: {
    paths: ['~/.skills', '~/.claude/skills', '~/.agents/skills', '~/.codex/skills'],
  },
  observer: {
    enabled_runtimes: ['codex', 'opencode', 'claude'],
    trace_retention_days: 30,
  },
  evaluator: {
    min_signal_count: 3,
    min_source_sessions: 2,
    min_confidence: 0.7,
  },
  patch: {
    allowed_types: ['append_context', 'tighten_trigger', 'add_fallback', 'prune_noise'],
    cooldown_hours: 24,
    max_patches_per_day: 3,
  },
  journal: {
    snapshot_interval: 5,
    max_snapshots: 20,
  },
  daemon: {
    auto_start: true,
    log_level: 'info',
  },
};
