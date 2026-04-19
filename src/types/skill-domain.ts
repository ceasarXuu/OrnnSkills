export type SkillDomainRuntime = 'codex' | 'claude' | 'opencode';

export type SkillIdentityMethod = 'normalized_skill_id' | 'skill_key' | 'content_digest' | 'legacy_shadow';

export type SkillUsageStatus = 'active' | 'idle' | 'unused' | 'partial';

export type SkillUsageFactKind = 'observed_call' | 'analyzed_touch' | 'optimized_revision';

export type SkillUsageFactSource = 'trace_refs' | 'agent_usage' | 'revision_history';

export interface SkillUsageSummary {
  observedCalls: number;
  analyzedTouches: number;
  optimizedCount: number;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  lastUsedAt: string | null;
  status: SkillUsageStatus;
}

export interface SkillUsageFact {
  factId: string;
  familyId: string;
  instanceId: string | null;
  projectId: string;
  projectPath: string;
  skillId: string;
  runtime: SkillDomainRuntime | null;
  kind: SkillUsageFactKind;
  source: SkillUsageFactSource;
  timestamp: string | null;
  count: number;
  traceId?: string | null;
  confidence: number;
}

export interface SkillFamilyIdentityLink {
  familyId: string;
  instanceId: string;
  method: SkillIdentityMethod;
  confidence: number;
}

export interface SkillRevision {
  revisionId: string;
  instanceId: string;
  familyId: string;
  projectId: string;
  projectPath: string;
  skillId: string;
  runtime: SkillDomainRuntime;
  version: number;
  previousVersion: number | null;
  previousRevisionId: string | null;
  createdAt: string | null;
  reason: string;
  traceIds: string[];
  isDisabled: boolean;
  isEffective: boolean;
  contentDigest: string | null;
}

export interface SkillInstance {
  instanceId: string;
  naturalKey: string;
  familyId: string;
  familyName: string;
  skillKey: string;
  projectId: string;
  projectPath: string;
  skillId: string;
  runtime: SkillDomainRuntime;
  installPath: string;
  shadowPath: string;
  status: string;
  createdAt: string | null;
  updatedAt: string | null;
  installedAt: string | null;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  lastUsedAt: string | null;
  effectiveVersion: number | null;
  effectiveRevisionId: string | null;
  versionCount: number;
  contentDigest: string | null;
  usage: SkillUsageSummary;
}

export interface ProjectSkillGroup {
  familyId: string;
  familyName: string;
  skillKey: string;
  instanceCount: number;
  runtimeCount: number;
  runtimes: SkillDomainRuntime[];
  status: string;
  lastUsedAt: string | null;
  observedCalls: number;
  analyzedTouches: number;
  optimizedCount: number;
  instances: SkillInstance[];
}

export interface SkillFamily {
  familyId: string;
  familyName: string;
  skillKey: string;
  normalizedName: string;
  projectCount: number;
  instanceCount: number;
  runtimeCount: number;
  revisionCount: number;
  projectPaths: string[];
  runtimes: SkillDomainRuntime[];
  installedAt: string | null;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  lastUsedAt: string | null;
  status: SkillUsageStatus;
  identityMethod: SkillIdentityMethod;
  identityConfidence: number;
  hasDivergedContent: boolean;
  usage: SkillUsageSummary;
}

export interface ProjectSkillDomainProjection {
  projectId: string;
  projectPath: string;
  generatedAt: string;
  sourceSignature?: string;
  families: SkillFamily[];
  skillGroups: ProjectSkillGroup[];
  instances: SkillInstance[];
  revisions: SkillRevision[];
  identityLinks: SkillFamilyIdentityLink[];
  usageFacts: SkillUsageFact[];
}
