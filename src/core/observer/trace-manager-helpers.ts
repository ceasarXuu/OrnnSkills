/**
 * Pure helpers for TraceManager.
 *
 * Extracted from src/core/observer/trace-manager.ts to keep that file
 * under the 500-line policy. All exports are stateless pure functions
 * (other than logger emission for filesystem failures).
 */
import { closeSync, existsSync, openSync, readdirSync, readSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createChildLogger } from '../../utils/logger.js';
import type { Trace } from '../../types/index.js';

const logger = createChildLogger('trace-manager');

export function compareTraceTimestampAsc(left: Trace, right: Trace): number {
  return new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime();
}

export function parseTraceRecord(line: string): Trace | null {
  try {
    const raw = JSON.parse(line) as Partial<Trace>;
    if (!raw.trace_id || !raw.timestamp || !raw.runtime || !raw.session_id || !raw.turn_id || !raw.event_type || !raw.status) {
      return null;
    }
    return {
      trace_id: String(raw.trace_id),
      runtime: raw.runtime,
      session_id: String(raw.session_id),
      turn_id: String(raw.turn_id),
      event_type: raw.event_type,
      timestamp: String(raw.timestamp),
      user_input: typeof raw.user_input === 'string' ? raw.user_input : undefined,
      assistant_output: typeof raw.assistant_output === 'string' ? raw.assistant_output : undefined,
      tool_name: typeof raw.tool_name === 'string' ? raw.tool_name : undefined,
      tool_args: raw.tool_args && typeof raw.tool_args === 'object' ? raw.tool_args : undefined,
      tool_result: raw.tool_result && typeof raw.tool_result === 'object' ? raw.tool_result : undefined,
      files_changed: Array.isArray(raw.files_changed) ? raw.files_changed.map((item) => String(item)) : undefined,
      skill_refs: Array.isArray(raw.skill_refs) ? raw.skill_refs.map((item) => String(item)) : undefined,
      status: raw.status,
      metadata: raw.metadata && typeof raw.metadata === 'object' ? raw.metadata : undefined,
    };
  } catch {
    return null;
  }
}

export function tailTraceRecords(filePath: string, maxLines: number): Trace[] {
  if (!existsSync(filePath)) return [];

  const chunkSize = 65536;
  const fd = openSync(filePath, 'r');
  try {
    const fileSize = statSync(filePath).size;
    if (fileSize === 0) return [];

    let position = fileSize;
    const lines: string[] = [];
    let remainder = '';

    while (position > 0 && lines.length < maxLines) {
      const readSize = Math.min(chunkSize, position);
      position -= readSize;
      const buffer = Buffer.alloc(readSize);
      readSync(fd, buffer, 0, readSize, position);
      const chunk = buffer.toString('utf-8') + remainder;
      const parts = chunk.split('\n');
      remainder = parts[0] ?? '';
      for (let index = parts.length - 1; index >= 1; index -= 1) {
        if (parts[index].trim()) {
          lines.push(parts[index]);
        }
      }
    }

    if (remainder.trim()) {
      lines.push(remainder);
    }

    return lines
      .slice(0, maxLines)
      .reverse()
      .map((line) => parseTraceRecord(line))
      .filter((trace): trace is Trace => Boolean(trace));
  } finally {
    closeSync(fd);
  }
}

export function listTraceNdjsonPaths(tracesDir: string): string[] {
  if (!existsSync(tracesDir)) return [];

  try {
    return readdirSync(tracesDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.ndjson'))
      .map((entry) => entry.name)
      .filter((name) => name !== 'decision-events.ndjson' && name !== 'agent-usage.ndjson')
      .sort()
      .map((name) => join(tracesDir, name));
  } catch (error) {
    logger.warn('Failed to list trace ndjson files', { tracesDir, error: String(error) });
    return [];
  }
}

export function mergeUniqueRecentTraces(traces: Trace[], limit: number): Trace[] {
  const deduped = new Map<string, Trace>();
  for (const trace of traces) {
    deduped.set(trace.trace_id, trace);
  }

  return [...deduped.values()]
    .sort(compareTraceTimestampAsc)
    .slice(-limit);
}
