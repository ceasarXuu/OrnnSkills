/**
 * 全局类型定义入口
 */

// Origin Skill 类型
export interface OriginSkill {
  skill_id: string;
  origin_path: string;
  origin_version: string; // file hash
  source: 'local' | 'marketplace' | 'git';
  installed_at: string;
  last_seen_at: string;
}

// Shadow Skill 状态
export type ShadowStatus = 'active' | 'frozen' | 'rebasing' | 'needs_attention';

// Project Skill Shadow 类型
export interface ProjectSkillShadow {
  project_id: string;
  skill_id: string;
  runtime?: RuntimeType;
  shadow_id: string; // "A@repo-x"
  origin_skill_id: string;
  origin_version_at_fork: string;
  shadow_path: string;
  current_revision: number;
  status: ShadowStatus;
  created_at: string;
  last_optimized_at: string;
}

// Shadow Skill 运行状态
export interface ShadowSkillState {
  shadow_id: string;
  current_content_hash: string;
  current_revision: number;
  last_hit_at: string;
  last_optimized_at: string;
  hit_count: number;
  success_count: number;
  manual_override_count: number;
  health_score: number; // 0-100
}

// Change Type - Patch 类型
export type ChangeType =
  | 'append_context'
  | 'tighten_trigger'
  | 'add_fallback'
  | 'prune_noise'
  | 'rewrite_section';

// Evolution Record 演化记录
export interface EvolutionRecord {
  revision: number;
  shadow_id: string;
  timestamp: string;
  reason: string;
  source_sessions: string[];
  change_type: ChangeType;
  patch: string;
  before_hash: string;
  after_hash: string;
  applied_by: 'auto' | 'manual';
}

// Snapshot 信息
export interface SnapshotInfo {
  revision: number;
  timestamp: string;
  file_path: string;
  content_hash: string;
}

// Trace 事件类型
export type TraceEventType =
  | 'user_input'
  | 'assistant_output'
  | 'tool_call'
  | 'tool_result'
  | 'file_change'
  | 'retry'
  | 'status';

// Trace 状态
export type TraceStatus = 'success' | 'failure' | 'retry' | 'interrupted';

// Runtime 类型
export type RuntimeType = 'codex' | 'opencode' | 'claude';

// Preprocessed Trace - Observer 预处理后的统一格式
export interface PreprocessedTrace {
  sessionId: string;
  turnId: string;
  timestamp: string;
  eventType: TraceEventType;
  content: unknown;
  projectContext?: {
    cwd: string;
    gitBranch?: string;
  };
  skillRefs?: string[];
  metadata?: Record<string, unknown>;
}

// Trace 数据结构
export interface Trace {
  trace_id: string;
  runtime: RuntimeType;
  session_id: string;
  turn_id: string;
  event_type: TraceEventType;
  timestamp: string;
  user_input?: string;
  assistant_output?: string;
  tool_name?: string;
  tool_args?: Record<string, unknown>;
  tool_result?: Record<string, unknown>;
  files_changed?: string[];
  skill_refs?: string[];  // 提取的 skill 引用
  status: TraceStatus;
  metadata?: Record<string, unknown>;
}

// Trace-Skill 映射结果
export interface TraceSkillMapping {
  trace_id: string;
  skill_id: string | null;
  shadow_id: string | null;
  confidence: number;
  reason: string;
}

// Skill 分组的 Traces
export interface SkillTracesGroup {
  skill_id: string;
  shadow_id: string;
  traces: Trace[];
  confidence: number;
}

// Evaluation Result 评估结果
export interface EvaluationResult {
  should_patch: boolean;
  change_type?: ChangeType;
  reason?: string;
  source_sessions: string[];
  confidence: number; // 0-1
  target_section?: string;
}

// Patch Result
export interface PatchResult {
  success: boolean;
  patch: string; // unified diff
  newContent: string;
  changeType: ChangeType;
  error?: string;
}

// Auto Optimize Policy 自动优化策略
export interface AutoOptimizePolicy {
  min_signal_count: number;
  min_source_sessions: number;
  min_confidence: number;
  cooldown_hours: number;
  max_patches_per_day: number;
  pause_after_rollback_hours: number;
}

// Session 信息
export interface Session {
  session_id: string;
  runtime: RuntimeType;
  project_id: string | null;
  started_at: string;
  ended_at: string | null;
  trace_count: number;
}

// Snapshot 详情（包含内容）
export interface Snapshot extends SnapshotInfo {
  shadow_id: string;
  content: string;
}

// Journal 查询选项
export interface JournalQueryOptions {
  fromRevision?: number;
  toRevision?: number;
  limit?: number;
  changeType?: ChangeType;
}

// CLI 输出格式
export interface CliOutput {
  success: boolean;
  message: string;
  data?: unknown;
  error?: string;
}

// 配置类型
export interface EVOConfig {
  origin_paths: {
    paths: string[];
  };
  observer: {
    enabled_runtimes: RuntimeType[];
    trace_retention_days: number;
  };
  evaluator: {
    min_signal_count: number;
    min_source_sessions: number;
    min_confidence: number;
  };
  patch: {
    allowed_types: ChangeType[];
    cooldown_hours: number;
    max_patches_per_day: number;
  };
  journal: {
    snapshot_interval: number;
    max_snapshots: number;
  };
  daemon: {
    auto_start: boolean;
    log_level: 'debug' | 'info' | 'warn' | 'error';
  };
}

// 项目配置
export interface ProjectConfig {
  project: {
    name: string;
    auto_optimize: boolean;
  };
  skills: Record<
    string,
    {
      auto_optimize?: boolean;
      allowed_patch_types?: ChangeType[];
    }
  >;
}
