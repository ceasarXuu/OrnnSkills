/**
 * Shadow Registry — Disk serialization helpers
 *
 * Extracted from index.ts to keep individual files under the 500-line policy.
 * These helpers operate on plain inputs/outputs so they can be unit-tested in
 * isolation from `ShadowRegistry`.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  renameSync,
} from 'fs';
import { join } from 'path';
import { createChildLogger } from '../../utils/logger.js';
import type { RuntimeType } from '../../types/index.js';
import type { ShadowEntry } from './types.js';

const logger = createChildLogger('shadow-registry');

function normalizeRuntime(runtime?: RuntimeType): RuntimeType {
  return runtime ?? 'codex';
}

function buildScopedKey(skillId: string, runtime?: RuntimeType): string {
  return `${normalizeRuntime(runtime)}::${skillId}`;
}

/**
 * Migrate legacy flat shadow files (in `shadowsDir`) into the runtime-scoped
 * `codex/` subdirectory. Idempotent and best-effort: failures are logged but
 * do not throw.
 */
export function migrateLegacyFlatShadowFiles(shadowsDir: string): void {
  let moved = 0;
  let skipped = 0;

  try {
    const entries = readdirSync(shadowsDir, { withFileTypes: true });
    const codexDir = join(shadowsDir, 'codex');
    mkdirSync(codexDir, { recursive: true });

    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (!entry.name.endsWith('.md')) continue;

      const oldPath = join(shadowsDir, entry.name);
      const newPath = join(codexDir, entry.name);

      if (existsSync(newPath)) {
        skipped++;
        continue;
      }

      renameSync(oldPath, newPath);
      moved++;
    }
  } catch (error) {
    logger.warn('Legacy shadow file migration failed', { error });
    return;
  }

  if (moved > 0 || skipped > 0) {
    logger.info('Legacy shadow file migration completed', { moved, skipped });
  }
}

/**
 * Load index from disk into a Map keyed by scoped key.
 */
export function loadShadowIndex(indexPath: string): Map<string, ShadowEntry> {
  if (!existsSync(indexPath)) {
    return new Map();
  }

  try {
    const data = readFileSync(indexPath, 'utf-8');
    const entries = JSON.parse(data) as Array<Partial<ShadowEntry>>;
    const mappedEntries: Array<[string, ShadowEntry]> = [];
    for (const e of entries) {
      if (!e.skillId) continue;
      const runtime = normalizeRuntime(e.runtime);
      mappedEntries.push([
        buildScopedKey(e.skillId, runtime),
        {
          skillId: e.skillId,
          runtime,
          version: e.version ?? '',
          content: e.content ?? '',
          status: e.status ?? 'pending',
          createdAt: e.createdAt ?? new Date().toISOString(),
          updatedAt: e.updatedAt ?? new Date().toISOString(),
          traceCount: e.traceCount ?? 0,
          analysisResult: e.analysisResult,
        },
      ]);
    }
    logger.debug(`Loaded ${entries.length} shadow entries from index`);
    return new Map(mappedEntries);
  } catch (error) {
    logger.error('Failed to load shadow index:', error);
    return new Map();
  }
}

/**
 * Save index to disk. Index only stores metadata; body is read on-demand from
 * the matching shadow file.
 */
export function saveShadowIndex(indexPath: string, index: Map<string, ShadowEntry>): void {
  try {
    const entries = Array.from(index.values()).map(({ content: _content, ...meta }) => meta);
    writeFileSync(indexPath, JSON.stringify(entries, null, 2), 'utf-8');
    logger.debug(`Saved ${entries.length} shadow entries to index`);
  } catch (error) {
    logger.error('Failed to save shadow index:', error);
    throw error;
  }
}
