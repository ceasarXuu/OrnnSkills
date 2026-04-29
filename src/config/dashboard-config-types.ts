/**
 * Dashboard config — Shared types
 *
 * Extracted from dashboard-config.ts to keep individual files under the
 * 500-line policy.
 */
import type { LLMSafetyOptions } from "../llm/request-guard.js";
import type {
  DashboardPromptSources,
  DashboardPromptOverrides,
} from "./prompt-overrides.js";

export interface ProviderConfig {
  provider: string;
  modelName: string;
  apiKeyEnvVar: string;
}

export interface OrnnConfig {
  ornn?: {
    version?: string;
    log_level?: string;
    project_path?: string;
  };
  llm?: {
    default_provider?: string;
  };
  providers?: Record<string, ProviderConfig>;
  tracking?: {
    auto_optimize?: boolean;
    user_confirm?: boolean;
    runtime_sync?: boolean;
  };
  llm_safety?: {
    enabled?: boolean;
    window_ms?: number;
    max_requests_per_window?: number;
    max_concurrent_requests?: number;
    max_estimated_tokens_per_window?: number;
  };
  prompt_overrides?: {
    skill_call_analyzer?: string;
    skillCallAnalyzer?: string;
    skill_call_analyzer_source?: "built_in" | "custom";
    skillCallAnalyzerSource?: "built_in" | "custom";
    decision_explainer?: string;
    decisionExplainer?: string;
    decision_explainer_source?: "built_in" | "custom";
    decisionExplainerSource?: "built_in" | "custom";
    readiness_probe?: string;
    readinessProbe?: string;
    readiness_probe_source?: "built_in" | "custom";
    readinessProbeSource?: "built_in" | "custom";
  };
}

export interface DashboardProviderConfig {
  provider: string;
  modelName: string;
  apiKeyEnvVar: string;
  apiKey?: string;
  hasApiKey?: boolean;
}

export interface DashboardConfig {
  autoOptimize: boolean;
  userConfirm: boolean;
  runtimeSync: boolean;
  llmSafety: LLMSafetyOptions;
  promptSources: DashboardPromptSources;
  promptOverrides: DashboardPromptOverrides;
  defaultProvider: string;
  logLevel: string;
  providers: DashboardProviderConfig[];
}
