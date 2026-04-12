import type { RuntimeType, Trace } from '../../types/index.js';

export interface SkillCallWindow {
  windowId: string;
  skillId: string;
  runtime: RuntimeType;
  sessionId: string;
  closeReason: string;
  startedAt: string;
  lastTraceAt: string;
  traces: Trace[];
}

export interface SkillCallWindowInput {
  windowId: string;
  skillId: string;
  runtime: RuntimeType;
  sessionId: string;
  closeReason: string;
  traces: Trace[];
  startedAt?: string;
  lastTraceAt?: string;
}

export function createSkillCallWindow(input: SkillCallWindowInput): SkillCallWindow {
  const orderedTraces = [...input.traces].sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  return {
    windowId: input.windowId,
    skillId: input.skillId,
    runtime: input.runtime,
    sessionId: input.sessionId,
    closeReason: input.closeReason,
    startedAt: input.startedAt ?? orderedTraces[0]?.timestamp ?? new Date().toISOString(),
    lastTraceAt: input.lastTraceAt ?? orderedTraces[orderedTraces.length - 1]?.timestamp ?? new Date().toISOString(),
    traces: orderedTraces,
  };
}
