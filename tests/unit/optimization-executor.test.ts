import { describe, expect, it, vi } from 'vitest';
import { executeOptimizationPatch } from '../../src/core/optimization-executor/index.js';
import type { EvaluationResult } from '../../src/types/index.js';

const evaluation: EvaluationResult = {
  should_patch: true,
  change_type: 'prune_noise',
  target_section: 'TODO',
  reason: 'Repeated noise should be pruned.',
  source_sessions: ['sess-1'],
  confidence: 0.91,
  rule_name: 'llm_window_analysis',
};

describe('executeOptimizationPatch', () => {
  it('fails when the current shadow content is missing', async () => {
    const result = await executeOptimizationPatch({
      shadowId: 'codex::test-skill@/tmp/project',
      evaluation,
      readContent: () => '',
      writeContent: vi.fn(),
      generatePatch: vi.fn(),
      getLatestRevision: vi.fn(),
      createSnapshot: vi.fn(),
      recordJournal: vi.fn(),
      onPatchApplied: vi.fn(),
    });

    expect(result).toMatchObject({
      ok: false,
      error: '当前技能内容为空，无法生成优化结果。',
    });
  });

  it('writes content, records journal, and reports patch stats on success', async () => {
    const writeContent = vi.fn();
    const generatePatch = vi.fn().mockResolvedValue({
      success: true,
      patch: '@@ -1 +1 @@\n-old\n+new\n',
      newContent: '# Updated Skill',
      changeType: 'prune_noise',
    });
    const createSnapshot = vi.fn();
    const recordJournal = vi.fn();
    const onPatchApplied = vi.fn();

    const result = await executeOptimizationPatch({
      shadowId: 'codex::test-skill@/tmp/project',
      evaluation,
      readContent: () => '# Current Skill',
      writeContent,
      generatePatch,
      getLatestRevision: () => 3,
      createSnapshot,
      recordJournal,
      onPatchApplied,
    });

    expect(result).toMatchObject({
      ok: true,
      revision: 4,
      linesAdded: 1,
      linesRemoved: 1,
    });
    expect(createSnapshot).toHaveBeenCalledWith('codex::test-skill@/tmp/project', 3);
    expect(writeContent).toHaveBeenCalledWith('test-skill', '# Updated Skill', 'codex');
    expect(recordJournal).toHaveBeenCalledTimes(1);
    expect(onPatchApplied).toHaveBeenCalledWith('codex::test-skill@/tmp/project');
  });
});
