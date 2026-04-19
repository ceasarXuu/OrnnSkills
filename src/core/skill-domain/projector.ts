import type { ProjectSkillDomainProjection, SkillFamily, SkillInstance } from '../../types/index.js';
import { maxNullableIso } from './id.js';
import { buildProjectSkillGroups, projectSkillInstances } from './instance-projector.js';
import { readSkillFamilyByIdFromProjections, readSkillFamilyInstancesFromProjections, resolveSkillFamilies } from './family-resolver.js';
import { projectSkillRevisions } from './revision-projector.js';
import { readStoredSkillDomainProjection, writeStoredSkillDomainProjection } from './state-repo.js';
import { readSkillDomainSourceSignature } from './source-signature.js';
import { rollupProjectSkillUsage } from './usage-rollup.js';

function buildGeneratedAt(projection: Pick<ProjectSkillDomainProjection, 'instances' | 'revisions' | 'usageFacts'>): string {
  return maxNullableIso(
    ...projection.instances.flatMap((instance) => [instance.createdAt, instance.updatedAt, instance.lastUsedAt]),
    ...projection.revisions.map((revision) => revision.createdAt),
    ...projection.usageFacts.map((fact) => fact.timestamp)
  ) ?? '1970-01-01T00:00:00.000Z';
}

export function projectSkillDomain(projectPath: string): ProjectSkillDomainProjection {
  const sourceSignature = readSkillDomainSourceSignature(projectPath);
  const stored = readStoredSkillDomainProjection(projectPath);
  if (stored?.sourceSignature === sourceSignature) {
    return stored;
  }

  return buildSkillDomainProjection(projectPath, sourceSignature);
}

export function refreshSkillDomainProjection(projectPath: string): ProjectSkillDomainProjection {
  const projection = buildSkillDomainProjection(projectPath, readSkillDomainSourceSignature(projectPath));
  writeStoredSkillDomainProjection(projectPath, projection);
  return projection;
}

function buildSkillDomainProjection(
  projectPath: string,
  sourceSignature: string
): ProjectSkillDomainProjection {
  const baseInstances = projectSkillInstances(projectPath);
  const revisions = projectSkillRevisions(projectPath, baseInstances);
  const rolledUp = rollupProjectSkillUsage(projectPath, baseInstances, revisions);
  const instances = rolledUp.instances.map((instance) => ({
    ...instance,
    effectiveRevisionId:
      revisions.find((revision) => revision.instanceId === instance.instanceId && revision.version === instance.effectiveVersion)?.revisionId ?? null,
    versionCount: revisions.filter((revision) => revision.instanceId === instance.instanceId).length || instance.versionCount,
  } satisfies SkillInstance));
  const skillGroups = buildProjectSkillGroups(instances);
  const families = resolveSkillFamilies([
    {
      projectId: projectPath,
      projectPath,
      generatedAt: '1970-01-01T00:00:00.000Z',
      families: [],
      skillGroups: [],
      instances,
      revisions,
      identityLinks: instances.map((instance) => ({
        familyId: instance.familyId,
        instanceId: instance.instanceId,
        method: 'normalized_skill_id' as const,
        confidence: 1,
      })),
      usageFacts: rolledUp.usageFacts,
    },
  ]);
  const projection: ProjectSkillDomainProjection = {
    projectId: projectPath,
    projectPath,
    generatedAt: buildGeneratedAt({ instances, revisions, usageFacts: rolledUp.usageFacts }),
    sourceSignature,
    families,
    skillGroups,
    instances,
    revisions,
    identityLinks: instances.map((instance) => ({
      familyId: instance.familyId,
      instanceId: instance.instanceId,
      method: 'normalized_skill_id',
      confidence: 1,
    })),
    usageFacts: rolledUp.usageFacts,
  };
  return projection;
}

export function aggregateSkillFamilies(projectPaths: string[]): SkillFamily[] {
  return resolveSkillFamilies(projectPaths.map((projectPath) => projectSkillDomain(projectPath)));
}

export function readSkillFamilyById(projectPaths: string[], familyId: string): SkillFamily | null {
  return readSkillFamilyByIdFromProjections(projectPaths.map((projectPath) => projectSkillDomain(projectPath)), familyId);
}

export function readSkillFamilyInstances(projectPaths: string[], familyId: string): SkillInstance[] {
  return readSkillFamilyInstancesFromProjections(projectPaths.map((projectPath) => projectSkillDomain(projectPath)), familyId);
}

export function getProjectedSkillInstanceById(projectPath: string, instanceId: string): SkillInstance | null {
  return projectSkillDomain(projectPath).instances.find((instance) => instance.instanceId === instanceId) ?? null;
}
