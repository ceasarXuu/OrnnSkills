import type { SkillInstance, SkillUsageFact, SkillUsageSummary, SkillRevision } from '../../types/index.js';
import { hashContent } from '../../utils/hash.js';
import { buildFamilyId, maxNullableIso, minNullableIso, normalizeRuntime, parseSkillRef } from './id.js';
import { readAllLegacyAgentUsageTouches, readAllLegacyTraces } from './legacy-state.js';

function buildFactId(parts: Array<string | number | null | undefined>): string {
  return hashContent(parts.map((part) => String(part ?? '')).join('::')).slice(0, 20);
}

function buildUsageSummary(
  facts: SkillUsageFact[],
  baselineFirstSeenAt: string | null,
  baselineLastSeenAt: string | null
): SkillUsageSummary {
  const observedCalls = facts
    .filter((fact) => fact.kind === 'observed_call')
    .reduce((sum, fact) => sum + fact.count, 0);
  const analyzedTouches = facts
    .filter((fact) => fact.kind === 'analyzed_touch')
    .reduce((sum, fact) => sum + fact.count, 0);
  const optimizedCount = facts
    .filter((fact) => fact.kind === 'optimized_revision')
    .reduce((sum, fact) => sum + fact.count, 0);
  const observedTimestamps = facts
    .filter((fact) => fact.kind === 'observed_call' || fact.kind === 'analyzed_touch')
    .map((fact) => fact.timestamp)
    .filter((value): value is string => typeof value === 'string' && value.length > 0);
  const allTimestamps = facts
    .map((fact) => fact.timestamp)
    .filter((value): value is string => typeof value === 'string' && value.length > 0);
  const firstSeenAt = minNullableIso(baselineFirstSeenAt, ...allTimestamps);
  const lastSeenAt = maxNullableIso(baselineLastSeenAt, ...allTimestamps);
  const lastUsedAt = maxNullableIso(...observedTimestamps);

  return {
    observedCalls,
    analyzedTouches,
    optimizedCount,
    firstSeenAt,
    lastSeenAt,
    lastUsedAt,
    status: lastUsedAt ? 'active' : firstSeenAt ? 'idle' : 'unused',
  };
}

function resolveInstanceForUsage(instances: SkillInstance[], skillId: string, runtime: string | null): string | null {
  const candidates = instances.filter((instance) => instance.skillId === skillId);
  if (candidates.length === 0) {
    return null;
  }
  if (runtime) {
    const matched = candidates.find((instance) => instance.runtime === normalizeRuntime(runtime));
    return matched?.instanceId ?? null;
  }
  return candidates.length === 1 ? candidates[0].instanceId : null;
}

export function rollupProjectSkillUsage(
  projectPath: string,
  instances: SkillInstance[],
  revisions: SkillRevision[]
): {
  usageFacts: SkillUsageFact[];
  instances: SkillInstance[];
  familyUsageById: Map<string, SkillUsageSummary>;
} {
  const usageFacts: SkillUsageFact[] = [];
  const traces = readAllLegacyTraces(projectPath);
  const touches = readAllLegacyAgentUsageTouches(projectPath);

  for (const trace of traces) {
    for (const rawRef of trace.skillRefs) {
      const parsedRef = parseSkillRef(rawRef);
      if (!parsedRef.skillId) {
        continue;
      }
      const familyId = buildFamilyId(parsedRef.skillId);
      usageFacts.push({
        factId: buildFactId(['trace', trace.traceId, rawRef, trace.timestamp]),
        familyId,
        instanceId: resolveInstanceForUsage(instances, parsedRef.skillId, parsedRef.runtime),
        projectId: projectPath,
        projectPath,
        skillId: parsedRef.skillId,
        runtime: parsedRef.runtime,
        kind: 'observed_call',
        source: 'trace_refs',
        timestamp: trace.timestamp,
        count: 1,
        traceId: trace.traceId,
        confidence: parsedRef.runtime ? 1 : 0.6,
      });
    }
  }

  for (const touch of touches) {
    const familyId = buildFamilyId(touch.skillId);
    usageFacts.push({
      factId: buildFactId(['agent', touch.skillId, touch.timestamp, touch.count]),
      familyId,
      instanceId: resolveInstanceForUsage(instances, touch.skillId, null),
      projectId: projectPath,
      projectPath,
      skillId: touch.skillId,
      runtime: null,
      kind: 'analyzed_touch',
      source: 'agent_usage',
      timestamp: touch.timestamp,
      count: touch.count,
      confidence: 0.7,
    });
  }

  for (const revision of revisions) {
    if (revision.version <= 1) {
      continue;
    }
    usageFacts.push({
      factId: buildFactId(['revision', revision.revisionId]),
      familyId: revision.familyId,
      instanceId: revision.instanceId,
      projectId: revision.projectId,
      projectPath: revision.projectPath,
      skillId: revision.skillId,
      runtime: revision.runtime,
      kind: 'optimized_revision',
      source: 'revision_history',
      timestamp: revision.createdAt,
      count: 1,
      confidence: 1,
    });
  }

  const factsByInstance = new Map<string, SkillUsageFact[]>();
  const factsByFamily = new Map<string, SkillUsageFact[]>();
  for (const fact of usageFacts) {
    if (fact.instanceId) {
      const instanceFacts = factsByInstance.get(fact.instanceId) ?? [];
      instanceFacts.push(fact);
      factsByInstance.set(fact.instanceId, instanceFacts);
    }
    const familyFacts = factsByFamily.get(fact.familyId) ?? [];
    familyFacts.push(fact);
    factsByFamily.set(fact.familyId, familyFacts);
  }

  const instancesWithUsage = instances.map((instance) => {
    const summary = buildUsageSummary(
      factsByInstance.get(instance.instanceId) ?? [],
      instance.firstSeenAt,
      instance.lastSeenAt
    );
    return {
      ...instance,
      lastUsedAt: summary.lastUsedAt,
      usage: summary,
    } satisfies SkillInstance;
  });

  const familyUsageById = new Map<string, SkillUsageSummary>();
  for (const [familyId, familyFacts] of factsByFamily.entries()) {
    const familyInstances = instancesWithUsage.filter((instance) => instance.familyId === familyId);
    familyUsageById.set(
      familyId,
      buildUsageSummary(
        familyFacts,
        minNullableIso(...familyInstances.map((instance) => instance.firstSeenAt)),
        maxNullableIso(...familyInstances.map((instance) => instance.lastSeenAt))
      )
    );
  }

  return {
    usageFacts,
    instances: instancesWithUsage,
    familyUsageById,
  };
}
