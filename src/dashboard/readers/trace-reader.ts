import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Trace } from '../../types/index.js';
import { tailNdjson } from './ndjson-tail.js';

export interface TraceEntry {
  trace_id: string;
  runtime: string;
  session_id: string;
  turn_id: string;
  event_type: string;
  timestamp: string;
  skill_refs: string[];
  status: string;
}

export interface TraceStats {
  total: number;
  byRuntime: Record<string, number>;
  byStatus: Record<string, number>;
  byEventType: Record<string, number>;
}

export function listTraceNdjsonPaths(projectRoot: string): string[] {
  const stateDir = join(projectRoot, '.ornn', 'state');
  if (!existsSync(stateDir)) return [];

  try {
    return readdirSync(stateDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.ndjson'))
      .map((entry) => entry.name)
      .filter((name) => name !== 'decision-events.ndjson' && name !== 'agent-usage.ndjson')
      .sort()
      .map((name) => join(stateDir, name));
  } catch {
    return [];
  }
}

export function countProcessedTraceIds(projectRoot: string): number {
  const traceIds = new Set<string>();
  for (const filePath of listTraceNdjsonPaths(projectRoot)) {
    let content = '';
    try {
      content = readFileSync(filePath, 'utf-8');
    } catch {
      continue;
    }
    for (const line of content.split(/\r?\n/)) {
      if (!line.trim()) continue;
      try {
        const raw = JSON.parse(line) as { trace_id?: unknown };
        if (typeof raw.trace_id === 'string' && raw.trace_id) {
          traceIds.add(raw.trace_id);
        }
      } catch {
        // ignore malformed rows
      }
    }
  }
  return traceIds.size;
}

function collectRecentTraceCandidates(projectRoot: string, maxLinesPerFile: number): TraceEntry[] {
  const tracePaths = listTraceNdjsonPaths(projectRoot);
  const traces = new Map<string, TraceEntry>();

  for (const ndjsonPath of tracePaths) {
    const lines = tailNdjson(ndjsonPath, maxLinesPerFile);
    for (const line of lines) {
      try {
        const raw = JSON.parse(line) as Partial<TraceEntry> & { skill_refs?: string[] };
        if (!raw.trace_id) continue;
        traces.set(String(raw.trace_id), {
          trace_id: String(raw.trace_id),
          runtime: String(raw.runtime ?? 'unknown'),
          session_id: String(raw.session_id ?? ''),
          turn_id: String(raw.turn_id ?? ''),
          event_type: String(raw.event_type ?? 'unknown'),
          timestamp: String(raw.timestamp ?? ''),
          skill_refs: Array.isArray(raw.skill_refs) ? raw.skill_refs : [],
          status: String(raw.status ?? 'unknown'),
        });
      } catch {
        // skip malformed lines
      }
    }
  }

  return [...traces.values()].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export function readRecentTraces(projectRoot: string, limit = 50): TraceEntry[] {
  return collectRecentTraceCandidates(projectRoot, Math.max(limit * 4, 200)).slice(0, limit);
}

export function readRecentActivityTraces(
  projectRoot: string,
  recentTraceLimit = 30,
  skillContextLimit = 12,
  skillContextScanLines = 4000
): TraceEntry[] {
  const latestTraces = readRecentTraces(projectRoot, recentTraceLimit);
  const existingIds = new Set(latestTraces.map((trace) => trace.trace_id));
  const skillContext = collectRecentTraceCandidates(projectRoot, skillContextScanLines)
    .filter((trace) => trace.skill_refs.length > 0 && !existingIds.has(trace.trace_id))
    .slice(0, skillContextLimit);

  if (skillContext.length === 0) return latestTraces;
  return latestTraces
    .concat(skillContext)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export function computeTraceStats(traces: TraceEntry[]): TraceStats {
  const byRuntime: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  const byEventType: Record<string, number> = {};

  for (const trace of traces) {
    byRuntime[trace.runtime] = (byRuntime[trace.runtime] ?? 0) + 1;
    byStatus[trace.status] = (byStatus[trace.status] ?? 0) + 1;
    byEventType[trace.event_type] = (byEventType[trace.event_type] ?? 0) + 1;
  }

  return { total: traces.length, byRuntime, byStatus, byEventType };
}

function parseTraceRecord(line: string): Trace | null {
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

export function readTracesByIds(projectRoot: string, traceIds: string[]): Trace[] {
  const wanted = new Set(traceIds.filter(Boolean));
  if (wanted.size === 0) return [];

  const traces = new Map<string, Trace>();
  for (const filePath of listTraceNdjsonPaths(projectRoot)) {
    let content = '';
    try {
      content = readFileSync(filePath, 'utf-8');
    } catch {
      continue;
    }

    for (const line of content.split(/\r?\n/)) {
      if (!line.trim()) continue;
      const trace = parseTraceRecord(line);
      if (!trace || !wanted.has(trace.trace_id)) continue;
      traces.set(trace.trace_id, trace);
      if (traces.size >= wanted.size) {
        break;
      }
    }
    if (traces.size >= wanted.size) {
      break;
    }
  }

  return [...traces.values()].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

export function readTracesBySessionWindow(
  projectRoot: string,
  sessionIds: string[],
  startedAt: string,
  endedAt: string
): Trace[] {
  const stateDir = join(projectRoot, '.ornn', 'state');
  const traces: Trace[] = [];

  for (const sessionId of new Set(sessionIds.filter(Boolean))) {
    const filePath = join(stateDir, `${sessionId}.ndjson`);
    if (!existsSync(filePath)) {
      continue;
    }

    let content = '';
    try {
      content = readFileSync(filePath, 'utf-8');
    } catch {
      continue;
    }

    for (const line of content.split(/\r?\n/)) {
      if (!line.trim()) continue;
      const trace = parseTraceRecord(line);
      if (!trace) continue;
      if (trace.timestamp < startedAt || trace.timestamp > endedAt) continue;
      traces.push(trace);
    }
  }

  return traces.sort((left, right) => left.timestamp.localeCompare(right.timestamp));
}
