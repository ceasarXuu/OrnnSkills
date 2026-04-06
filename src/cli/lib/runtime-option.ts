import type { RuntimeType } from '../../types/index.js';

export function parseRuntimeOption(runtime?: string): RuntimeType | undefined {
  if (!runtime) return undefined;
  if (runtime === 'codex' || runtime === 'claude' || runtime === 'opencode') {
    return runtime;
  }
  throw new Error(`Invalid runtime "${runtime}". Use one of: codex, claude, opencode.`);
}

