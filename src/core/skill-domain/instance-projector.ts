import { dirname } from 'node:path';
import type { ProjectSkillGroup, SkillInstance } from '../../types/index.js';
import {
  buildFamilyId,
  buildInstanceId,
  buildInstanceNaturalKey,
  buildSkillKey,
  normalizeContentDigest,
} from './id.js';
import {
  listLegacyVersions,
  readLegacyEffectiveVersionNumber,
  readLegacyShadowContent,
  readLegacyShadowEntries,
  resolveLegacyShadowPath,
} from './legacy-state.js';

function emptyUsage() {
  return {
    observedCalls: 0,
    analyzedTouches: 0,
    optimizedCount: 0,
    firstSeenAt: null,
    lastSeenAt: null,
    lastUsedAt: null,
    status: 'unused' as const,
  };
}

export function projectSkillInstances(projectPath: string): SkillInstance[] {
  return readLegacyShadowEntries(projectPath)
    .map((entry) => {
      const shadowPath = resolveLegacyShadowPath(projectPath, entry.skillId, entry.runtime);
      const content = readLegacyShadowContent(projectPath, entry.skillId, entry.runtime);
      const versions = listLegacyVersions(projectPath, entry.skillId, entry.runtime);
      const effectiveVersion = readLegacyEffectiveVersionNumber(projectPath, entry.skillId, entry.runtime);
      const familyId = buildFamilyId(entry.skillId);
      const naturalKey = buildInstanceNaturalKey(projectPath, entry.runtime, shadowPath);
      return {
        instanceId: buildInstanceId(projectPath, entry.runtime, shadowPath),
        naturalKey,
        familyId,
        familyName: entry.skillId,
        skillKey: buildSkillKey(entry.skillId),
        projectId: projectPath,
        projectPath,
        skillId: entry.skillId,
        runtime: entry.runtime,
        installPath: dirname(shadowPath),
        shadowPath,
        status: entry.status,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
        installedAt: entry.createdAt,
        firstSeenAt: entry.createdAt,
        lastSeenAt: entry.updatedAt ?? entry.createdAt,
        lastUsedAt: null,
        effectiveVersion,
        effectiveRevisionId: null,
        versionCount: Math.max(versions.length, effectiveVersion ? 1 : 0),
        contentDigest: normalizeContentDigest(content),
        usage: emptyUsage(),
      } satisfies SkillInstance;
    })
    .sort((left, right) => left.familyName.localeCompare(right.familyName) || left.runtime.localeCompare(right.runtime));
}

export function buildProjectSkillGroups(instances: SkillInstance[]): ProjectSkillGroup[] {
  const groups = new Map<string, SkillInstance[]>();
  for (const instance of instances) {
    const existing = groups.get(instance.familyId) ?? [];
    existing.push(instance);
    groups.set(instance.familyId, existing);
  }

  return [...groups.entries()]
    .map(([familyId, members]) => {
      const runtimes = [...new Set(members.map((instance) => instance.runtime))].sort();
      const observedCalls = members.reduce((sum, instance) => sum + instance.usage.observedCalls, 0);
      const analyzedTouches = members.reduce((sum, instance) => sum + instance.usage.analyzedTouches, 0);
      const optimizedCount = members.reduce((sum, instance) => sum + instance.usage.optimizedCount, 0);
      return {
        familyId,
        familyName: members[0]?.familyName ?? '',
        skillKey: members[0]?.skillKey ?? '',
        instanceCount: members.length,
        runtimeCount: runtimes.length,
        runtimes,
        status: members.some((instance) => instance.status === 'active') ? 'active' : members[0]?.status ?? 'active',
        lastUsedAt: members.map((instance) => instance.lastUsedAt).filter(Boolean).sort().at(-1) ?? null,
        observedCalls,
        analyzedTouches,
        optimizedCount,
        instances: members.slice().sort((left, right) => left.runtime.localeCompare(right.runtime)),
      } satisfies ProjectSkillGroup;
    })
    .sort((left, right) => left.familyName.localeCompare(right.familyName));
}
