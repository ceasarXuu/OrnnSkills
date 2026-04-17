import { existsSync, lstatSync, readFileSync, readdirSync, readlinkSync } from 'node:fs';
import { join } from 'node:path';
import type { ShadowEntry } from '../../core/shadow-registry/index.js';

export interface SkillVersionMeta {
  version: number;
  createdAt: string;
  reason: string;
  traceIds: string[];
  previousVersion: number | null;
  isDisabled?: boolean;
  disabledAt?: string | null;
  activityScopeId?: string;
}

export interface SkillInfo extends ShadowEntry {
  versionsAvailable: number[];
  effectiveVersion?: number | null;
}

export interface DashboardSkillInfo {
  skillId: string;
  runtime: 'codex' | 'claude' | 'opencode';
  status: ShadowEntry['status'];
  updatedAt: string;
  traceCount: number;
  analysisResult?: {
    confidence: number;
  };
  versionsAvailable: number[];
  effectiveVersion?: number | null;
}

function listVersionsForSkill(
  projectRoot: string,
  skillId: string,
  runtime: 'codex' | 'claude' | 'opencode' = 'codex'
): number[] {
  const candidates = [
    join(projectRoot, '.ornn', 'skills', runtime, skillId, 'versions'),
    join(projectRoot, '.ornn', 'skills', skillId, 'versions'),
  ];

  for (const versionsDir of candidates) {
    if (!existsSync(versionsDir)) continue;
    try {
      return readdirSync(versionsDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && /^v\d+$/.test(entry.name))
        .map((entry) => parseInt(entry.name.slice(1), 10))
        .sort((a, b) => a - b);
    } catch {
      // try next candidate
    }
  }

  return [];
}

function readEffectiveVersionForSkill(
  projectRoot: string,
  skillId: string,
  runtime: 'codex' | 'claude' | 'opencode' = 'codex'
): number | null {
  const candidates = [
    join(projectRoot, '.ornn', 'skills', runtime, skillId, 'versions', 'latest'),
    join(projectRoot, '.ornn', 'skills', skillId, 'versions', 'latest'),
  ];

  for (const latestPath of candidates) {
    if (!existsSync(latestPath)) continue;
    try {
      const stats = lstatSync(latestPath);
      if (!stats.isSymbolicLink()) continue;
      const target = readlinkSync(latestPath);
      const match = target.match(/v(\d+)/);
      if (match) {
        return parseInt(match[1], 10);
      }
    } catch {
      // try next candidate
    }
  }

  return null;
}

export function readSkills(projectRoot: string): SkillInfo[] {
  const indexPath = join(projectRoot, '.ornn', 'shadows', 'index.json');
  if (!existsSync(indexPath)) return [];

  try {
    const raw = readFileSync(indexPath, 'utf-8');
    const parsed = JSON.parse(raw) as ShadowEntry[] | Record<string, ShadowEntry>;
    const entries = Array.isArray(parsed) ? parsed : Object.values(parsed);
    return entries.map((entry) => ({
      ...entry,
      content: '',
      runtime: entry.runtime ?? 'codex',
      versionsAvailable: listVersionsForSkill(
        projectRoot,
        entry.skillId,
        (entry.runtime ?? 'codex') as 'codex' | 'claude' | 'opencode'
      ),
      effectiveVersion: readEffectiveVersionForSkill(
        projectRoot,
        entry.skillId,
        (entry.runtime ?? 'codex') as 'codex' | 'claude' | 'opencode'
      ),
    }));
  } catch {
    return [];
  }
}

export function toDashboardSkillInfo(skill: SkillInfo): DashboardSkillInfo {
  return {
    skillId: skill.skillId,
    runtime: (skill.runtime ?? 'codex') as 'codex' | 'claude' | 'opencode',
    status: skill.status,
    updatedAt: skill.updatedAt,
    traceCount: skill.traceCount,
    analysisResult: typeof skill.analysisResult?.confidence === 'number'
      ? { confidence: skill.analysisResult.confidence }
      : undefined,
    versionsAvailable: skill.versionsAvailable,
    effectiveVersion: skill.effectiveVersion ?? null,
  };
}

export function readSkillContent(
  projectRoot: string,
  skillId: string,
  runtime: 'codex' | 'claude' | 'opencode' = 'codex'
): string | null {
  const candidates = [
    join(projectRoot, '.ornn', 'shadows', runtime, `${skillId}.md`),
    join(projectRoot, '.ornn', 'shadows', `${skillId}.md`),
  ];

  const shadowPath = candidates.find((path) => existsSync(path));
  if (!shadowPath) return null;
  try {
    return readFileSync(shadowPath, 'utf-8');
  } catch {
    return null;
  }
}

export function readSkillVersion(
  projectRoot: string,
  skillId: string,
  version: number,
  runtime: 'codex' | 'claude' | 'opencode' = 'codex'
): { content: string; metadata: SkillVersionMeta } | null {
  const versionDirs = [
    join(projectRoot, '.ornn', 'skills', runtime, skillId, 'versions', `v${version}`),
    join(projectRoot, '.ornn', 'skills', skillId, 'versions', `v${version}`),
  ];

  for (const versionDir of versionDirs) {
    const contentPath = join(versionDir, 'skill.md');
    const metadataPath = join(versionDir, 'metadata.json');
    if (!existsSync(contentPath) || !existsSync(metadataPath)) continue;
    try {
      const content = readFileSync(contentPath, 'utf-8');
      const metadata = JSON.parse(readFileSync(metadataPath, 'utf-8')) as SkillVersionMeta;
      return { content, metadata };
    } catch {
      // try next candidate
    }
  }

  return null;
}
