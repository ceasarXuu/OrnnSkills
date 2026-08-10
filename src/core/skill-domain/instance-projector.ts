import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { configManager } from '../../config/index.js';
import type { ProjectSkillGroup, SkillDomainRuntime, SkillInstance } from '../../types/index.js';
import {
  buildFamilyId,
  buildInstanceId,
  buildInstanceNaturalKey,
  buildSkillKey,
  normalizeContentDigest,
} from './id.js';

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

function inferRuntimeFromRoot(root: string): SkillDomainRuntime | null {
  if (root.includes('/.codex/skills')) return 'codex';
  if (root.includes('/.claude/skills')) return 'claude';
  if (root.includes('/.opencode/skills')) return 'opencode';
  return null;
}

function projectSkillRoots(projectPath: string): string[] {
  return [
    '.codex/skills',
    '.claude/skills',
    '.opencode/skills',
    'skills',
    '.skills',
    '.agents/skills',
  ].map((relative) => join(projectPath, relative));
}

function globalSkillRoots(): string[] {
  const roots = [...configManager.getOriginPaths()];
  roots.push(join(homedir(), '.agents', 'skills'), join(homedir(), '.codex', 'skills'));
  return roots;
}

function scanRootForInstances(
  root: string,
  projectPath: string,
  runtime: SkillDomainRuntime | null
): SkillInstance[] {
  if (!existsSync(root)) return [];

  let entries: import('node:fs').Dirent[] = [];
  try {
    entries = readdirSync(root, { withFileTypes: true, encoding: 'utf8' });
  } catch {
    return [];
  }

  const instances: SkillInstance[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const skillId = entry.name;
    const skillDir = join(root, skillId);
    const skillFileCandidates = [join(skillDir, 'SKILL.md'), join(skillDir, 'skill.md')];
    const skillPath = skillFileCandidates.find((path) => existsSync(path));
    if (!skillPath) continue;

    let content = '';
    let mtimeMs = 0;
    try {
      content = readFileSync(skillPath, 'utf-8');
      mtimeMs = statSync(skillPath).mtimeMs;
    } catch {
      continue;
    }

    const normalizedRuntime: SkillDomainRuntime | null = runtime;
    const familyId = buildFamilyId(skillId);
    const naturalKey = buildInstanceNaturalKey(projectPath, normalizedRuntime, skillDir);
    const createdAt = new Date(mtimeMs).toISOString();

    instances.push({
      instanceId: buildInstanceId(projectPath, normalizedRuntime, skillDir),
      naturalKey,
      familyId,
      familyName: skillId,
      skillKey: buildSkillKey(skillId),
      projectId: projectPath,
      projectPath,
      skillId,
      runtime: normalizedRuntime,
      installPath: skillDir,
      shadowPath: '',
      status: 'active',
      createdAt,
      updatedAt: createdAt,
      installedAt: createdAt,
      firstSeenAt: createdAt,
      lastSeenAt: createdAt,
      lastUsedAt: null,
      effectiveVersion: null,
      effectiveRevisionId: null,
      versionCount: 0,
      contentDigest: normalizeContentDigest(content),
      usage: emptyUsage(),
    } satisfies SkillInstance);
  }

  return instances;
}

/**
 * 直读宿主 skills 目录（D6）：扫描项目内与全局宿主 roots，实时反映 skills 增删改。
 * 不再以 shadow 索引为数据源；shadow 降级为纯演化工作副本。
 */
export function projectSkillInstances(
  projectPath: string,
  options: { includeGlobalRoots?: boolean } = {}
): SkillInstance[] {
  const instances: SkillInstance[] = [];

  for (const root of projectSkillRoots(projectPath)) {
    const runtime = inferRuntimeFromRoot(root);
    instances.push(...scanRootForInstances(root, projectPath, runtime));
  }

  if (options.includeGlobalRoots !== false) {
    for (const root of globalSkillRoots()) {
      const runtime = inferRuntimeFromRoot(root);
      const globalProjectId = '~';
      instances.push(...scanRootForInstances(root, globalProjectId, runtime));
    }
  }

  return instances.sort(
    (left, right) =>
      left.familyName.localeCompare(right.familyName) ||
      (left.runtime ?? 'generic').localeCompare(right.runtime ?? 'generic') ||
      left.installPath.localeCompare(right.installPath)
  );
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
      const runtimes = [...new Set(members.map((instance) => instance.runtime ?? 'generic'))].sort();
      const observedCalls = members.reduce((sum, instance) => sum + instance.usage.observedCalls, 0);
      const analyzedTouches = members.reduce((sum, instance) => sum + instance.usage.analyzedTouches, 0);
      const optimizedCount = members.reduce((sum, instance) => sum + instance.usage.optimizedCount, 0);
      return {
        familyId,
        familyName: members[0]?.familyName ?? '',
        skillKey: members[0]?.skillKey ?? '',
        instanceCount: members.length,
        runtimeCount: runtimes.length,
        runtimes: runtimes as SkillDomainRuntime[],
        status: members.some((instance) => instance.status === 'active') ? 'active' : members[0]?.status ?? 'active',
        lastUsedAt: members.map((instance) => instance.lastUsedAt).filter(Boolean).sort().at(-1) ?? null,
        observedCalls,
        analyzedTouches,
        optimizedCount,
        instances: members
          .slice()
          .sort((left, right) => (left.runtime ?? 'generic').localeCompare(right.runtime ?? 'generic')),
      } satisfies ProjectSkillGroup;
    })
    .sort((left, right) => left.familyName.localeCompare(right.familyName));
}

export function resolveHostSkillFilePath(projectPath: string, skillId: string): string | null {
  for (const root of projectSkillRoots(projectPath)) {
    const skillPath = join(root, skillId, 'SKILL.md');
    if (existsSync(skillPath)) return skillPath;
    const altPath = join(root, skillId, 'skill.md');
    if (existsSync(altPath)) return altPath;
  }
  return null;
}

export function resolveHostSkillFilePathFromInstall(installPath: string): string | null {
  const candidates = [join(installPath, 'SKILL.md'), join(installPath, 'skill.md')];
  return candidates.find((path) => existsSync(path)) ?? null;
}
