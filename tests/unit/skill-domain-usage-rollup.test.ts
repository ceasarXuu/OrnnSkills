import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('skill domain usage rollup', () => {
  const testDir = join(tmpdir(), `ornn-skill-domain-usage-${Date.now()}`);

  beforeEach(() => {
    mkdirSync(join(testDir, '.ornn', 'state'), { recursive: true });
    mkdirSync(join(testDir, '.ornn', 'shadows', 'codex'), { recursive: true });
    mkdirSync(join(testDir, '.ornn', 'shadows', 'claude'), { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('keeps ambiguous usage on family scope and only backfills instance scope when attribution is reliable', async () => {
    const { projectSkillDomain } = await import('../../src/core/skill-domain/projector.js');

    writeFileSync(
      join(testDir, '.ornn', 'shadows', 'index.json'),
      JSON.stringify([
        {
          skillId: 'systematic-debugging',
          runtime: 'codex',
          version: '1',
          status: 'active',
          createdAt: '2026-04-18T09:00:00.000Z',
          updatedAt: '2026-04-18T09:10:00.000Z',
          traceCount: 0,
        },
        {
          skillId: 'systematic-debugging',
          runtime: 'claude',
          version: '2',
          status: 'active',
          createdAt: '2026-04-18T09:05:00.000Z',
          updatedAt: '2026-04-18T09:20:00.000Z',
          traceCount: 0,
        },
      ]),
      'utf-8'
    );
    writeFileSync(join(testDir, '.ornn', 'shadows', 'codex', 'systematic-debugging.md'), '# codex\n', 'utf-8');
    writeFileSync(join(testDir, '.ornn', 'shadows', 'claude', 'systematic-debugging.md'), '# claude\n', 'utf-8');

    for (const [runtime, version] of [
      ['codex', 1],
      ['claude', 2],
    ] as const) {
      const versionsDir = join(testDir, '.ornn', 'skills', runtime, 'systematic-debugging', 'versions');
      mkdirSync(join(versionsDir, `v${version}`), { recursive: true });
      writeFileSync(join(versionsDir, `v${version}`, 'skill.md'), `# ${runtime}\n`, 'utf-8');
      writeFileSync(
        join(versionsDir, `v${version}`, 'metadata.json'),
        JSON.stringify({
          version,
          createdAt: `2026-04-18T09:${runtime === 'codex' ? '00' : '20'}:00.000Z`,
          reason: version === 1 ? 'seed' : 'optimize',
          traceIds: [],
          previousVersion: version === 1 ? null : 1,
          isDisabled: false,
        }),
        'utf-8'
      );
      symlinkSync(`v${version}`, join(versionsDir, 'latest'));
    }

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

    const projection = projectSkillDomain(testDir);
    const family = projection.families[0];
    const codexInstance = projection.instances.find((instance) => instance.runtime === 'codex');
    const claudeInstance = projection.instances.find((instance) => instance.runtime === 'claude');

    expect(family?.usage).toMatchObject({
      observedCalls: 2,
      analyzedTouches: 1,
      optimizedCount: 1,
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