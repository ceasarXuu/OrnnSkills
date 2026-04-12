import type { Trace } from '../../types/index.js';
import type { TraceSkillMapping } from '../trace-skill-mapper/index.js';

export interface SessionWindowCandidate {
  skill_id: string;
  shadow_id: string;
  sessionId: string;
  mappedTraces: Trace[];
  sessionTraces: Trace[];
  confidence: number;
}

export interface CollectSessionWindowCandidatesInput {
  recentTraces: Trace[];
  loadSessionTraces: (sessionId: string) => Promise<Trace[]>;
  mapTrace: (trace: Trace) => TraceSkillMapping;
  minConfidence?: number;
}

export async function collectSessionWindowCandidates(
  input: CollectSessionWindowCandidatesInput
): Promise<SessionWindowCandidate[]> {
  const minConfidence = input.minConfidence ?? 0.5;
  const sessionIds = [...new Set(input.recentTraces.map((trace) => trace.session_id).filter(Boolean))];
  const candidates: SessionWindowCandidate[] = [];

  for (const sessionId of sessionIds) {
    const sessionTraces = (await input.loadSessionTraces(sessionId))
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    if (sessionTraces.length === 0) {
      continue;
    }

    const grouped = new Map<string, SessionWindowCandidate>();
    for (const trace of sessionTraces) {
      const mapping = input.mapTrace(trace);
      if (!mapping.skill_id || !mapping.shadow_id || mapping.confidence < minConfidence) {
        continue;
      }

      const key = `${sessionId}::${mapping.shadow_id}`;
      const existing = grouped.get(key);
      if (existing) {
        existing.mappedTraces.push(trace);
        existing.confidence = Math.max(existing.confidence, mapping.confidence);
        continue;
      }

      grouped.set(key, {
        skill_id: mapping.skill_id,
        shadow_id: mapping.shadow_id,
        sessionId,
        mappedTraces: [trace],
        sessionTraces,
        confidence: mapping.confidence,
      });
    }

    candidates.push(...grouped.values());
  }

  return candidates;
}
