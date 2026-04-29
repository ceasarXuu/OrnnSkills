/**
 * Shadow Registry — Types
 *
 * Extracted from index.ts to keep individual files under the 500-line policy.
 */
import type { RuntimeType } from '../../types/index.js';

export interface ShadowEntry {
  skillId: string;
  runtime?: RuntimeType;
  version: string;
  content: string;
  status: 'pending' | 'analyzing' | 'optimized' | 'deployed' | 'discarded' | 'frozen' | 'active';
  createdAt: string;
  updatedAt: string;
  traceCount: number;
  analysisResult?: {
    summary: string;
    confidence: number;
    suggestions: string[];
  };
  // Backward compatibility aliases (snake_case)
  skill_id?: string;
  created_at?: string;
  last_optimized_at?: string;
  current_revision?: number;
}

export interface ShadowRegistryOptions {
  projectPath: string;
}

export type ShadowStatus = ShadowEntry['status'];
