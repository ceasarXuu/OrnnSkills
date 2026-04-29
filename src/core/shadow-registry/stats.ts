/**
 * Shadow Registry — Stats helpers
 *
 * Extracted from index.ts to keep individual files under the 500-line policy.
 */
import type { ShadowEntry } from './types.js';

export interface ShadowRegistryStats {
  total: number;
  byStatus: Record<'pending' | 'analyzing' | 'optimized' | 'deployed' | 'discarded', number>;
  totalTraces: number;
}

/**
 * Compute scoped keys eligible for cleanup (discarded/deployed older than
 * `maxAgeDays`). Returns the keys; the caller is responsible for removing
 * them through the registry's normal `delete` flow.
 */
export function selectExpiredShadowKeys(
  index: Map<string, ShadowEntry>,
  maxAgeDays: number,
  now: Date = new Date(),
): string[] {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - maxAgeDays);

  const expired: string[] = [];
  for (const [key, entry] of index.entries()) {
    if (entry.status !== 'discarded' && entry.status !== 'deployed') continue;
    if (new Date(entry.updatedAt) < cutoff) {
      expired.push(key);
    }
  }
  return expired;
}

/**
 * Aggregate the index map into a stats object. `frozen`/`active` statuses are
 * counted as `pending` for backward compatibility.
 */
export function computeShadowStats(index: Map<string, ShadowEntry>): ShadowRegistryStats {
  const entries = Array.from(index.values());
  const byStatus: ShadowRegistryStats['byStatus'] = {
    pending: 0,
    analyzing: 0,
    optimized: 0,
    deployed: 0,
    discarded: 0,
  };

  let totalTraces = 0;

  for (const entry of entries) {
    const status =
      entry.status === 'frozen' || entry.status === 'active' ? 'pending' : entry.status;
    byStatus[status]++;
    totalTraces += entry.traceCount;
  }

  return {
    total: entries.length,
    byStatus,
    totalTraces,
  };
}
