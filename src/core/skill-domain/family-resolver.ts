import type { ProjectSkillDomainProjection, SkillFamily, SkillRevision, SkillUsageFact, SkillUsageSummary } from '../../types/index.js';
import { buildSkillKey, maxNullableIso, minNullableIso } from './id.js';

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

function buildFamilyUsage(
  instances: ProjectSkillDomainProjection['instances'],
  usageFacts: SkillUsageFact[]
): SkillUsageSummary {
  const observedCalls = usageFacts
    .filter((fact) => fact.kind === 'observed_call')
    .reduce((sum, fact) => sum + fact.count, 0);
  const analyzedTouches = usageFacts
    .filter((fact) => fact.kind === 'analyzed_touch')
    .reduce((sum, fact) => sum + fact.count, 0);
  const optimizedCount = usageFacts
    .filter((fact) => fact.kind === 'optimized_revision')
    .reduce((sum, fact) => sum + fact.count, 0);
  const allTimestamps = usageFacts
    .map((fact) => fact.timestamp)
    .filter((value): value is string => typeof value === 'string' && value.length > 0);
  const usedTimestamps = usageFacts
    .filter((fact) => fact.kind === 'observed_call' || fact.kind === 'analyzed_touch')
    .map((fact) => fact.timestamp)
    .filter((value): value is string => typeof value === 'string' && value.length > 0);
  return {
    observedCalls,
    analyzedTouches,
    optimizedCount,
    firstSeenAt: minNullableIso(
      ...instances.map((instance) => instance.firstSeenAt),
      ...allTimestamps
    ),
    lastSeenAt: maxNullableIso(
      ...instances.map((instance) => instance.lastSeenAt),
      ...allTimestamps
    ),
    lastUsedAt: maxNullableIso(...usedTimestamps),
    status: usedTimestamps.length > 0 ? 'active' : instances.some((instance) => instance.firstSeenAt) ? 'idle' : 'unused',
  };
}

export function resolveSkillFamilies(projections: ProjectSkillDomainProjection[]): SkillFamily[] {
  const revisions = projections.flatMap((projection) => projection.revisions);
  const usageFacts = projections.flatMap((projection) => projection.usageFacts);
  const familyGroups = new Map<string, ProjectSkillDomainProjection['instances']>();

  for (const projection of projections) {
    for (const instance of projection.instances) {
      const existing = familyGroups.get(instance.familyId) ?? [];
      existing.push(instance);
      familyGroups.set(instance.familyId, existing);
    }
  }

  return [...familyGroups.entries()]
    .map(([familyId, instances]) => buildSkillFamily(
      familyId,
      instances,
      revisions,
      usageFacts.filter((fact) => fact.familyId === familyId)
    ))
    .sort((left, right) => left.familyName.localeCompare(right.familyName));
}

function buildSkillFamily(
  familyId: string,
  instances: ProjectSkillDomainProjection['instances'],
  revisions: SkillRevision[],
  usageFacts: SkillUsageFact[]
): SkillFamily {
  const familyRevisions = revisions.filter((revision) => revision.familyId === familyId);
  const runtimes = [...new Set(instances.map((instance) => instance.runtime))].sort();
  const projectPaths = [...new Set(instances.map((instance) => instance.projectPath))].sort();
  const contentDigests = [...new Set(instances.map((instance) => instance.contentDigest).filter(Boolean))];
  const usage = buildFamilyUsage(instances, usageFacts);

  const fallback = instances[0];
  return {
    familyId,
    familyName: fallback?.familyName ?? '',
    skillKey: fallback?.skillKey ?? buildSkillKey(fallback?.familyName ?? ''),
    normalizedName: buildSkillKey(fallback?.familyName ?? ''),
    projectCount: projectPaths.length,
    instanceCount: instances.length,
    runtimeCount: runtimes.length,
    revisionCount: familyRevisions.length,
    projectPaths,
    runtimes,
    installedAt: minNullableIso(...instances.map((instance) => instance.installedAt)),
    firstSeenAt: usage.firstSeenAt,
    lastSeenAt: usage.lastSeenAt,
    lastUsedAt: usage.lastUsedAt,
    status: usage.status,
    identityMethod: 'normalized_skill_id',
    identityConfidence: 1,
    hasDivergedContent: contentDigests.length > 1,
    usage: instances.length > 0 ? usage : emptyUsage(),
  };
}

export function readSkillFamilyByIdFromProjections(
  projections: ProjectSkillDomainProjection[],
  familyId: string
): SkillFamily | null {
  return resolveSkillFamilies(projections).find((family) => family.familyId === familyId) ?? null;
}

export function readSkillFamilyInstancesFromProjections(
  projections: ProjectSkillDomainProjection[],
  familyId: string
) {
  return projections
    .flatMap((projection) => projection.instances)
    .filter((instance) => instance.familyId === familyId)
    .sort((left, right) => left.projectPath.localeCompare(right.projectPath) || left.runtime.localeCompare(right.runtime));
}
