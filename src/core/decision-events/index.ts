import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { NDJSONWriter } from '../../storage/ndjson.js';
import { createChildLogger } from '../../utils/logger.js';
import type { DecisionEventEvidence } from '../../types/index.js';

const logger = createChildLogger('decision-events');

export interface DecisionEventRecord {
  id: string;
  timestamp: string;
  tag: string;
  businessCategory?: string | null;
  businessTag?: string | null;
  episodeId?: string | null;
  inputSummary?: string | null;
  judgment?: string | null;
  nextAction?: string | null;
  skillId?: string | null;
  runtime?: string | null;
  windowId?: string | null;
  traceId?: string | null;
  sessionId?: string | null;
  status?: string | null;
  detail?: string | null;
  confidence?: number | null;
  changeType?: string | null;
  reason?: string | null;
  strategy?: string | null;
  traceCount?: number | null;
  sessionCount?: number | null;
  ruleName?: string | null;
  linesAdded?: number | null;
  linesRemoved?: number | null;
  runtimeDrift?: boolean | null;
  evidence?: DecisionEventEvidence | null;
}

export class DecisionEventRecorder {
  private writer: NDJSONWriter<DecisionEventRecord>;

  constructor(projectRoot: string) {
    this.writer = new NDJSONWriter<DecisionEventRecord>(
      join(projectRoot, '.ornn', 'state', 'decision-events.ndjson')
    );
  }

  record(event: Omit<DecisionEventRecord, 'id' | 'timestamp'> & { id?: string; timestamp?: string }): void {
    const normalized: DecisionEventRecord = {
      id: event.id ?? randomUUID(),
      timestamp: event.timestamp ?? new Date().toISOString(),
      tag: event.tag,
      businessCategory: event.businessCategory ?? null,
      businessTag: event.businessTag ?? null,
      episodeId: event.episodeId ?? null,
      inputSummary: event.inputSummary ?? null,
      judgment: event.judgment ?? null,
      nextAction: event.nextAction ?? null,
      skillId: event.skillId ?? null,
      runtime: event.runtime ?? null,
      windowId: event.windowId ?? null,
      traceId: event.traceId ?? null,
      sessionId: event.sessionId ?? null,
      status: event.status ?? null,
      detail: event.detail ?? null,
      confidence: event.confidence ?? null,
      changeType: event.changeType ?? null,
      reason: event.reason ?? null,
      strategy: event.strategy ?? null,
      traceCount: event.traceCount ?? null,
      sessionCount: event.sessionCount ?? null,
      ruleName: event.ruleName ?? null,
      linesAdded: event.linesAdded ?? null,
      linesRemoved: event.linesRemoved ?? null,
      runtimeDrift: event.runtimeDrift ?? null,
      evidence: event.evidence ?? null,
    };

    try {
      this.writer.append(normalized);
      logger.debug('Decision event recorded', {
        tag: normalized.tag,
        skillId: normalized.skillId,
        runtime: normalized.runtime,
        status: normalized.status,
      });
    } catch (error) {
      logger.warn('Failed to record decision event', {
        tag: normalized.tag,
        skillId: normalized.skillId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

export function createDecisionEventRecorder(projectRoot: string): DecisionEventRecorder {
  return new DecisionEventRecorder(projectRoot);
}
