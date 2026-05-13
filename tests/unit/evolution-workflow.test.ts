import { describe, expect, it } from 'vitest';
import { createEvolutionRun } from '../../src/core/evolution/domain.js';
import { createEvolutionWorkflow } from '../../src/core/evolution/workflow.js';

describe('evolution workflow coordinator', () => {
  it('advances a run and emits a status changed event', () => {
    const workflow = createEvolutionWorkflow({
      createEventId: () => 'event-1',
      now: () => '2026-05-13T00:01:00.000Z',
    });
    const run = createEvolutionRun({
      runId: 'run-1',
      episodeId: 'episode-1',
      skillId: 'skill-a',
      runtime: 'codex',
      status: 'collecting',
      createdAt: '2026-05-13T00:00:00.000Z',
      updatedAt: '2026-05-13T00:00:00.000Z',
    });

    const result = workflow.advance(run, 'analyzing', 'episode window reached readiness threshold');

    expect(result.run.status).toBe('analyzing');
    expect(result.events).toEqual([
      {
        type: 'evolution.run_status_changed',
        eventId: 'event-1',
        occurredAt: '2026-05-13T00:01:00.000Z',
        runId: 'run-1',
        episodeId: 'episode-1',
        skillId: 'skill-a',
        from: 'collecting',
        to: 'analyzing',
        reason: 'episode window reached readiness threshold',
      },
    ]);
  });

  it('rejects invalid workflow jumps before emitting events', () => {
    const workflow = createEvolutionWorkflow({
      createEventId: () => 'event-1',
      now: () => '2026-05-13T00:01:00.000Z',
    });
    const run = createEvolutionRun({
      runId: 'run-1',
      episodeId: 'episode-1',
      skillId: 'skill-a',
      runtime: 'codex',
      status: 'collecting',
      createdAt: '2026-05-13T00:00:00.000Z',
      updatedAt: '2026-05-13T00:00:00.000Z',
    });

    expect(() => workflow.advance(run, 'applied')).toThrow(
      'Invalid evolution run transition: collecting -> applied'
    );
  });
});
