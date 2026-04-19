import type { SkillInstance, SkillRevision } from '../../types/index.js';
import { buildRevisionId, normalizeContentDigest } from './id.js';
import { listLegacyVersions, readLegacyVersionRecord } from './legacy-state.js';

export function projectSkillRevisions(projectPath: string, instances: SkillInstance[]): SkillRevision[] {
  const revisions: SkillRevision[] = [];

  for (const instance of instances) {
    const versions = listLegacyVersions(projectPath, instance.skillId, instance.runtime);
    for (const version of versions) {
      const record = readLegacyVersionRecord(projectPath, instance.skillId, instance.runtime, version);
      if (!record) {
        continue;
      }

      const revisionId = buildRevisionId(instance.instanceId, version);
      revisions.push({
        revisionId,
        instanceId: instance.instanceId,
        familyId: instance.familyId,
        projectId: instance.projectId,
        projectPath: instance.projectPath,
        skillId: instance.skillId,
        runtime: instance.runtime,
        version,
        previousVersion: typeof record.metadata.previousVersion === 'number' ? record.metadata.previousVersion : null,
        previousRevisionId:
          typeof record.metadata.previousVersion === 'number'
            ? buildRevisionId(instance.instanceId, record.metadata.previousVersion)
            : null,
        createdAt: typeof record.metadata.createdAt === 'string' ? record.metadata.createdAt : null,
        reason: typeof record.metadata.reason === 'string' ? record.metadata.reason : 'legacy-version',
        traceIds: Array.isArray(record.metadata.traceIds) ? record.metadata.traceIds.map((traceId) => String(traceId)) : [],
        isDisabled: !!record.metadata.isDisabled,
        isEffective: version === instance.effectiveVersion,
        contentDigest: normalizeContentDigest(record.content),
      });
    }
  }

  return revisions.sort((left, right) => {
    const instanceComparison = left.instanceId.localeCompare(right.instanceId);
    if (instanceComparison !== 0) return instanceComparison;
    return left.version - right.version;
  });
}
