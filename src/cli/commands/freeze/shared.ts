/**
 * Shared types for the freeze/unfreeze CLI commands.
 *
 * Extracted from src/cli/commands/freeze.ts.
 */
import type { RuntimeType } from '../../../types/index.js';

export interface FreezeOptions {
  project: string;
  all?: boolean;
  force?: boolean;
  dryRun?: boolean;
  interactive?: boolean;
  runtime?: string;
}

export type ShadowSummary = {
  skill_id?: string;
  skillId?: string;
  status?: string;
  runtime?: RuntimeType;
};
