import { hashString } from '../../utils/hash.js';
import { parseShadowId } from '../../utils/parse.js';
import type { EvolutionRecord, EvaluationResult, PatchResult } from '../../types/index.js';

export interface ExecuteOptimizationPatchInput {
  shadowId: string;
  evaluation: EvaluationResult;
  readContent: (skillId: string, runtime: 'codex' | 'claude' | 'opencode') => string | undefined;
  writeContent: (
    skillId: string,
    content: string,
    runtime: 'codex' | 'claude' | 'opencode'
  ) => void | Promise<void>;
  generatePatch: (
    changeType: NonNullable<EvaluationResult['change_type']>,
    currentContent: string,
    context: Record<string, unknown>
  ) => Promise<PatchResult>;
  getLatestRevision: (shadowId: string) => number;
  createSnapshot: (shadowId: string, revision: number | string) => unknown;
  recordJournal: (shadowId: string, data: Omit<EvolutionRecord, 'revision'>) => unknown;
  onPatchApplied?: (shadowId: string) => void | Promise<void>;
}

export interface ExecuteOptimizationPatchResult {
  ok: boolean;
  error?: string;
  revision?: number;
  linesAdded?: number;
  linesRemoved?: number;
}

function countPatchLines(patch: string): { linesAdded: number; linesRemoved: number } {
  let linesAdded = 0;
  let linesRemoved = 0;
  for (const line of patch.split('\n')) {
    if (!line) continue;
    if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('@@')) continue;
    if (line.startsWith('+')) linesAdded += 1;
    if (line.startsWith('-')) linesRemoved += 1;
  }
  return { linesAdded, linesRemoved };
}

export async function executeOptimizationPatch(
  input: ExecuteOptimizationPatchInput
): Promise<ExecuteOptimizationPatchResult> {
  const parsed = parseShadowId(input.shadowId);
  const skillId = parsed?.skillId ?? input.shadowId.split('@')[0];
  const runtime = parsed?.runtime ?? 'codex';

  try {
    const currentContent = input.readContent(skillId, runtime);
    if (!currentContent) {
      return {
        ok: false,
        error: '当前技能内容为空，无法生成优化结果。',
      };
    }

    const patchResult = await input.generatePatch(input.evaluation.change_type!, currentContent, {
      pattern: input.evaluation.reason,
      reason: input.evaluation.reason,
      section: input.evaluation.target_section,
    });

    if (!patchResult.success) {
      return {
        ok: false,
        error: patchResult.error ?? 'Patch 生成失败。',
      };
    }

    const currentRevision = input.getLatestRevision(input.shadowId);
    input.createSnapshot(input.shadowId, currentRevision);
    await input.writeContent(skillId, patchResult.newContent, runtime);
    input.recordJournal(input.shadowId, {
      shadow_id: input.shadowId,
      timestamp: new Date().toISOString(),
      reason: input.evaluation.reason ?? 'Auto optimization',
      source_sessions: input.evaluation.source_sessions,
      change_type: input.evaluation.change_type!,
      patch: patchResult.patch,
      before_hash: hashString(currentContent),
      after_hash: hashString(patchResult.newContent),
      applied_by: 'auto',
    });

    if (input.evaluation.change_type === 'rewrite_section' || (currentRevision + 1) % 5 === 0) {
      input.createSnapshot(input.shadowId, currentRevision + 1);
    }

    if (input.onPatchApplied) {
      await input.onPatchApplied(input.shadowId);
    }

    const patchStats = countPatchLines(patchResult.patch);
    return {
      ok: true,
      revision: currentRevision + 1,
      linesAdded: patchStats.linesAdded,
      linesRemoved: patchStats.linesRemoved,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
