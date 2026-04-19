import { existsSync, lstatSync, readFileSync, readdirSync, readlinkSync } from 'node:fs';
import { join } from 'node:path';
import type { VersionMetadata } from '../skill-version/index.js';
import { normalizeRuntime } from './id.js';

export interface LegacyShadowEntry {
  skillId: string;
  runtime: ReturnType<typeof normalizeRuntime>;
  version: string;
  status: string;
  createdAt: string | null;
  updatedAt: string | null;
  traceCount: number;
}

export interface LegacyVersionRecord {
  version: number;
  content: string;
  metadata: VersionMetadata;
}

export interface LegacyTraceUsageRecord {
  traceId: string;
  timestamp: string | null;
  runtime: ReturnType<typeof normalizeRuntime>;
  skillRefs: string[];
}

export interface LegacyAgentUsageTouch {
  skillId: string;
  timestamp: string | null;
  count: number;
}

function toNullableIso(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function getLegacyVersionDirs(projectPath: string, skillId: string, runtime: ReturnType<typeof normalizeRuntime>): string[] {
  return [
    join(projectPath, '.ornn', 'skills', runtime, skillId, 'versions'),
    join(projectPath, '.ornn', 'skills', skillId, 'versions'),
  ];
}

export function resolveLegacyShadowPath(
  projectPath: string,
  skillId: string,
  runtime: ReturnType<typeof normalizeRuntime>
): string {
  const scopedPath = join(projectPath, '.ornn', 'shadows', runtime, `${skillId}.md`);
  if (existsSync(scopedPath)) {
    return scopedPath;
  }
  return join(projectPath, '.ornn', 'shadows', `${skillId}.md`);
}

export function readLegacyShadowEntries(projectPath: string): LegacyShadowEntry[] {
  const indexPath = join(projectPath, '.ornn', 'shadows', 'index.json');
  if (!existsSync(indexPath)) {
    return [];
  }

  try {
    const parsed = JSON.parse(readFileSync(indexPath, 'utf-8')) as Array<Record<string, unknown>> | Record<string, Record<string, unknown>>;
    const rawEntries = Array.isArray(parsed) ? parsed : Object.values(parsed);
    return rawEntries
      .map((entry) => ({
        skillId: typeof entry.skillId === 'string' ? entry.skillId : '',
        runtime: normalizeRuntime(typeof entry.runtime === 'string' ? entry.runtime : undefined),
        version: typeof entry.version === 'string' ? entry.version : '',
        status: typeof entry.status === 'string' ? entry.status : 'active',
        createdAt: toNullableIso(entry.createdAt),
        updatedAt: toNullableIso(entry.updatedAt),
        traceCount: typeof entry.traceCount === 'number' ? entry.traceCount : 0,
      }))
      .filter((entry) => entry.skillId.length > 0)
      .sort((left, right) => {
        const skillIdComparison = left.skillId.localeCompare(right.skillId);
        if (skillIdComparison !== 0) return skillIdComparison;
        return left.runtime.localeCompare(right.runtime);
      });
  } catch {
    return [];
  }
}

export function readLegacyShadowContent(
  projectPath: string,
  skillId: string,
  runtime: ReturnType<typeof normalizeRuntime>
): string | null {
  const shadowPath = resolveLegacyShadowPath(projectPath, skillId, runtime);
  if (!existsSync(shadowPath)) {
    return null;
  }

  try {
    return readFileSync(shadowPath, 'utf-8');
  } catch {
    return null;
  }
}

export function listLegacyVersions(
  projectPath: string,
  skillId: string,
  runtime: ReturnType<typeof normalizeRuntime>
): number[] {
  for (const versionsDir of getLegacyVersionDirs(projectPath, skillId, runtime)) {
    if (!existsSync(versionsDir)) {
      continue;
    }

    try {
      return readdirSync(versionsDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && /^v\d+$/.test(entry.name))
        .map((entry) => Number.parseInt(entry.name.slice(1), 10))
        .filter((version) => Number.isFinite(version))
        .sort((left, right) => left - right);
    } catch {
      // Continue with the fallback candidate.
    }
  }

  return [];
}

export function readLegacyEffectiveVersionNumber(
  projectPath: string,
  skillId: string,
  runtime: ReturnType<typeof normalizeRuntime>
): number | null {
  for (const versionsDir of getLegacyVersionDirs(projectPath, skillId, runtime)) {
    const latestPath = join(versionsDir, 'latest');
    if (!existsSync(latestPath)) {
      continue;
    }

    try {
      const stats = lstatSync(latestPath);
      if (!stats.isSymbolicLink()) {
        continue;
      }
      const target = readlinkSync(latestPath);
      const match = target.match(/v(\d+)/);
      if (match) {
        return Number.parseInt(match[1], 10);
      }
    } catch {
      // Continue with the fallback candidate.
    }
  }

  const versions = listLegacyVersions(projectPath, skillId, runtime);
  return versions.at(-1) ?? null;
}

export function readLegacyVersionRecord(
  projectPath: string,
  skillId: string,
  runtime: ReturnType<typeof normalizeRuntime>,
  version: number
): LegacyVersionRecord | null {
  for (const versionsDir of getLegacyVersionDirs(projectPath, skillId, runtime)) {
    const versionDir = join(versionsDir, `v${version}`);
    const contentPath = join(versionDir, 'skill.md');
    const metadataPath = join(versionDir, 'metadata.json');
    if (!existsSync(contentPath) || !existsSync(metadataPath)) {
      continue;
    }

    try {
      return {
        version,
        content: readFileSync(contentPath, 'utf-8'),
        metadata: JSON.parse(readFileSync(metadataPath, 'utf-8')) as VersionMetadata,
      };
    } catch {
      // Continue with the fallback candidate.
    }
  }

  return null;
}

export function readAllLegacyTraces(projectPath: string): LegacyTraceUsageRecord[] {
  const stateDir = join(projectPath, '.ornn', 'state');
  if (!existsSync(stateDir)) {
    return [];
  }

  const traces = new Map<string, LegacyTraceUsageRecord>();
  try {
    const files = readdirSync(stateDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.ndjson'))
      .map((entry) => entry.name)
      .filter((fileName) => fileName !== 'decision-events.ndjson' && fileName !== 'agent-usage.ndjson')
      .sort();

    for (const fileName of files) {
      const filePath = join(stateDir, fileName);
      let content = '';
      try {
        content = readFileSync(filePath, 'utf-8');
      } catch {
        continue;
      }

      for (const line of content.split(/\r?\n/)) {
        if (!line.trim()) continue;
        try {
          const row = JSON.parse(line) as Record<string, unknown>;
          if (typeof row.trace_id !== 'string' || row.trace_id.length === 0) {
            continue;
          }
          traces.set(row.trace_id, {
            traceId: row.trace_id,
            timestamp: toNullableIso(row.timestamp),
            runtime: normalizeRuntime(typeof row.runtime === 'string' ? row.runtime : undefined),
            skillRefs: Array.isArray(row.skill_refs) ? row.skill_refs.map((item) => String(item)) : [],
          });
        } catch {
          // Ignore malformed rows.
        }
      }
    }
  } catch {
    return [];
  }

  return [...traces.values()].sort((left, right) => String(left.timestamp ?? '').localeCompare(String(right.timestamp ?? '')));
}

export function readAllLegacyAgentUsageTouches(projectPath: string): LegacyAgentUsageTouch[] {
  const ndjsonPath = join(projectPath, '.ornn', 'state', 'agent-usage.ndjson');
  if (existsSync(ndjsonPath)) {
    try {
      return readFileSync(ndjsonPath, 'utf-8')
        .split(/\r?\n/)
        .filter((line) => line.trim().length > 0)
        .flatMap((line) => {
          try {
            const record = JSON.parse(line) as Record<string, unknown>;
            const skillId = typeof record.skillId === 'string' ? record.skillId.trim() : '';
            if (!skillId) {
              return [];
            }
            return [{
              skillId,
              timestamp: toNullableIso(record.timestamp),
              count: 1,
            } satisfies LegacyAgentUsageTouch];
          } catch {
            return [];
          }
        });
    } catch {
      return [];
    }
  }

  const summaryPath = join(projectPath, '.ornn', 'state', 'agent-usage-summary.json');
  if (!existsSync(summaryPath)) {
    return [];
  }

  try {
    const parsed = JSON.parse(readFileSync(summaryPath, 'utf-8')) as {
      bySkill?: Record<string, { callCount?: number; lastCallAt?: string | null }>;
    };
    return Object.entries(parsed.bySkill ?? {}).flatMap(([skillId, bucket]) => {
      const count = typeof bucket.callCount === 'number' ? bucket.callCount : 0;
      if (!skillId || count <= 0) {
        return [];
      }
      return [{
        skillId,
        timestamp: toNullableIso(bucket.lastCallAt),
        count,
      } satisfies LegacyAgentUsageTouch];
    });
  } catch {
    return [];
  }
}
