import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const loggerMocks = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock('../../src/utils/logger.js', () => ({
  createChildLogger: () => loggerMocks,
}));

describe('CodexObserver reconciliation logging', () => {
  const testDir = join(tmpdir(), 'ornn-codex-observer-reconcile-' + Date.now());

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
    loggerMocks.debug.mockReset();
    loggerMocks.info.mockReset();
    loggerMocks.warn.mockReset();
    loggerMocks.error.mockReset();
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('does not warn when reconciliation only recovers a small missed file growth', async () => {
    const sessionsDir = join(testDir, 'sessions');
    mkdirSync(join(sessionsDir, '2026', '04', '16'), { recursive: true });
    const sessionPath = join(sessionsDir, '2026', '04', '16', 'rollout-2026-04-16T00-00-00-session.jsonl');
    writeFileSync(sessionPath, '{"timestamp":"2026-04-16T00:00:00.000Z","type":"event_msg","payload":{"text":"x"}}\n', 'utf-8');

    const { CodexObserver } = await import('../../src/core/observer/codex-observer.js');
    const observer = new CodexObserver(sessionsDir);

    (observer as any).processedFiles.add(sessionPath);
    (observer as any).processedByteOffset.set(sessionPath, 10);
    (observer as any).listRecentSessionFiles = () => [sessionPath];
    (observer as any).processSessionFileInternal = vi.fn();

    (observer as any).reconcileRecentSessionGrowth(1);

    expect(loggerMocks.warn).not.toHaveBeenCalledWith(
      'Recovered missed session file growth during reconciliation',
      expect.anything()
    );
    expect(loggerMocks.debug).toHaveBeenCalledWith(
      'Recovered missed session file growth during reconciliation',
      expect.objectContaining({
        path: sessionPath,
        previousOffset: 10,
      })
    );
  });
});
