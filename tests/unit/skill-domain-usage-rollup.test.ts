import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('skill domain usage rollup (host direct read)', () => {
  const testDir = join(tmpdir(), `ornn-skill-domain-usage-${Date.now()}`);

  beforeEach(() => {
    mkdirSync(join(testDir, '.ornn', 'state'), { recursive: true });
    mkdirSync(join(testDir, '.codex', 'skills', 'systematic-debugging'), { recursive: true });
    mkdirSync(join(testDir, '.claude', 'skills', 'systematic-debugging'), { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('keeps ambiguous usage on family scope and only backfills instance scope when attribution is reliable', async () => {
    const { projectSkillDomain } = await import('../../src/core/skill-domain/projector.js');

    writeFileSync(join(testDir, '.codex', 'skills', 'systematic-debugging', 'SKILL.md'), '# codex\n', 'utf-8');
    writeFileSync(join(testDir, '.claude', 'skills', 'systematic-debugging', 'SKILL.md'), '# claude\n', 'utf-8');

    writeFileSync(
      join(testDir, '.ornn', 'state', 'session-a.ndjson'),
      [
        JSON.stringify({
          trace_id: 'trace-1',
          runtime: 'codex',
          session_id: 'session-a',
          turn_id: 'turn-1',
          event_type: 'tool_call',
          timestamp: '2026-04-18T10:00:00.000Z',
          status: 'success',
          skill_refs: ['systematic-debugging'],
        }),
        JSON.stringify({
          trace_id: 'trace-2',
          runtime: 'claude',
          session_id: 'session-a',
          turn_id: 'turn-2',
          event_type: 'tool_call',
          timestamp: '2026-04-18T10:05:00.000Z',
          status: 'success',
          skill_refs: ['systematic-debugging@claude'],
        }),
      ].join('\n') + '\n',
      'utf-8'
    );

    writeFileSync(
      join(testDir, '.ornn', 'state', 'agent-usage.ndjson'),
      [
        JSON.stringify({
          id: 'usage-1',
          timestamp: '2026-04-18T10:10:00.000Z',
          scope: 'skill_call_analyzer',
          eventId: 'evt-1',
          skillId: 'systematic-debugging',
          model: 'gpt-4.1',
          promptTokens: 10,
          completionTokens: 5,
          totalTokens: 15,
          durationMs: 120,
        }),
      ].join('\n') + '\n',
      'utf-8'
    );

    const projection = projectSkillDomain(testDir, { includeGlobalRoots: false });
    const family = projection.families[0];
    const codexInstance = projection.instances.find((instance) => instance.runtime === 'codex');
    const claudeInstance = projection.instances.find((instance) => instance.runtime === 'claude');

    expect(family?.usage).toMatchObject({
      observedCalls: 2,
      analyzedTouches: 1,
      optimizedCount: 0,
      lastUsedAt: '2026-04-18T10:10:00.000Z',
    });
    expect(codexInstance?.usage).toMatchObject({
      observedCalls: 0,
      analyzedTouches: 0,
    });
    expect(claudeInstance?.usage).toMatchObject({
      observedCalls: 1,
      analyzedTouches: 0,
    });
  });
});