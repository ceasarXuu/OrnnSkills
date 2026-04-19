import { hashContent } from '../../utils/hash.js';
import type { SkillDomainRuntime } from '../../types/index.js';

export function normalizeRuntime(runtime?: string | null): SkillDomainRuntime {
  return runtime === 'claude' || runtime === 'opencode' ? runtime : 'codex';
}

export function normalizeSkillId(skillId: string): string {
  return skillId.trim().replace(/\\/g, '/').replace(/\.md$/i, '').toLowerCase();
}

export function buildSkillKey(skillId: string): string {
  return normalizeSkillId(skillId);
}

export function buildFamilyId(skillId: string): string {
  return `family_${hashContent(`family:${buildSkillKey(skillId)}`).slice(0, 16)}`;
}

export function buildInstanceNaturalKey(projectPath: string, runtime: SkillDomainRuntime, shadowPath: string): string {
  return `${projectPath}::${runtime}::${shadowPath}`;
}

export function buildInstanceId(projectPath: string, runtime: SkillDomainRuntime, shadowPath: string): string {
  return `instance_${hashContent(buildInstanceNaturalKey(projectPath, runtime, shadowPath)).slice(0, 16)}`;
}

export function buildRevisionId(instanceId: string, version: number): string {
  return `${instanceId}::v${version}`;
}

export function normalizeContentDigest(content: string | null | undefined): string | null {
  if (typeof content !== 'string') {
    return null;
  }
  return hashContent(content.replace(/\r\n/g, '\n').trimEnd());
}

export function parseSkillRef(skillRef: string): { skillId: string; runtime: SkillDomainRuntime | null } {
  const trimmed = String(skillRef || '').trim();
  if (!trimmed) {
    return { skillId: '', runtime: null };
  }

  const runtimeMatch = trimmed.match(/^(.*)@(codex|claude|opencode)$/i);
  if (!runtimeMatch) {
    return { skillId: trimmed, runtime: null };
  }

  return {
    skillId: runtimeMatch[1],
    runtime: normalizeRuntime(runtimeMatch[2]),
  };
}

export function compareNullableIso(a: string | null | undefined, b: string | null | undefined): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a.localeCompare(b);
}

export function maxNullableIso(...values: Array<string | null | undefined>): string | null {
  return values.filter((value): value is string => typeof value === 'string' && value.length > 0).sort().at(-1) ?? null;
}

export function minNullableIso(...values: Array<string | null | undefined>): string | null {
  return values.filter((value): value is string => typeof value === 'string' && value.length > 0).sort().at(0) ?? null;
}
