import { join } from 'node:path';
import type { DecisionEventRecord } from '../../core/decision-events/index.js';
import { tailNdjson } from './ndjson-tail.js';

export function readRecentDecisionEvents(projectRoot: string, limit = 50): DecisionEventRecord[] {
  const ndjsonPath = join(projectRoot, '.ornn', 'state', 'decision-events.ndjson');
  const lines = tailNdjson(ndjsonPath, Math.max(limit * 2, 200));
  const events: DecisionEventRecord[] = [];

  for (const line of lines) {
    try {
      const raw = JSON.parse(line) as Partial<DecisionEventRecord>;
      if (!raw.id || !raw.tag) continue;
      events.push({
        id: String(raw.id),
        timestamp: String(raw.timestamp ?? ''),
        tag: String(raw.tag),
        businessCategory: raw.businessCategory ?? null,
        businessTag: raw.businessTag ?? null,
        episodeId: raw.episodeId ?? null,
        inputSummary: raw.inputSummary ?? null,
        judgment: raw.judgment ?? null,
        nextAction: raw.nextAction ?? null,
        skillId: raw.skillId ?? null,
        runtime: raw.runtime ?? null,
        windowId: raw.windowId ?? null,
        traceId: raw.traceId ?? null,
        sessionId: raw.sessionId ?? null,
        status: raw.status ?? null,
        detail: raw.detail ?? null,
        confidence: raw.confidence ?? null,
        changeType: raw.changeType ?? null,
        reason: raw.reason ?? null,
        strategy: raw.strategy ?? null,
        traceCount: raw.traceCount ?? null,
        sessionCount: raw.sessionCount ?? null,
        ruleName: raw.ruleName ?? null,
        linesAdded: raw.linesAdded ?? null,
        linesRemoved: raw.linesRemoved ?? null,
        runtimeDrift: raw.runtimeDrift ?? null,
        evidence: raw.evidence ?? null,
      });
    } catch {
      // skip malformed lines
    }
  }

  return events
    .sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)))
    .slice(0, limit);
}
