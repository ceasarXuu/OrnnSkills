import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { hashString } from '../../utils/hash.js';
import { buildShadowId } from '../../utils/parse.js';
import type { ShadowStatus, RuntimeType } from '../../types/index.js';
import { createChildLogger } from '../../utils/logger.js';

const logger = createChildLogger('shadow-bootstrapper');

interface OriginSkillRecord {
  skill_id: string;
  origin_path: string;
  origin_version: string;
  source: 'local';
  installed_at: string;
  last_seen_at: string;
}

interface ShadowSkillRecord {
  project_id: string;
  skill_id: string;
  runtime: RuntimeType;
  shadow_id: string;
  origin_skill_id: string;
  origin_version_at_fork: string;
  shadow_path: string;
  current_revision: number;
  status: ShadowStatus;
  created_at: string;
  last_optimized_at: string;
}

export interface ShadowBootstrapperInput {
  projectRoot: string;
  db: {
    upsertOriginSkill: (origin: OriginSkillRecord) => void;
    upsertShadowSkill: (shadow: ShadowSkillRecord) => void;
  };
  shadowRegistry: {
    has: (skillId: string, runtime: RuntimeType) => boolean;
    create: (skillId: string, content: string, originVersion: string, runtime: RuntimeType) => void;
    get: (skillId: string, runtime: RuntimeType) => { status?: string } | null | undefined;
    readContent: (skillId: string, runtime: RuntimeType) => string | undefined;
    updateContent: (skillId: string, content: string, runtime: RuntimeType) => void;
  };
  traceSkillMapper: {
    registerSkill: (origin: OriginSkillRecord, shadow: ShadowSkillRecord) => void;
  };
  createVersionManager: (input: {
    projectPath: string;
    skillId: string;
    runtime: RuntimeType;
  }) => { createVersion: (content: string, reason: string, sourceSessions: string[]) => void };
  originPaths: string[];
  enabledRuntimes: RuntimeType[];
  includeHomeSkillRoots?: boolean;
}

export interface ShadowBootstrapperResult {
  discovered: number;
  registered: number;
  createdShadows: number;
  bootstrapVersionedUpdates: number;
  materializedToProject: number;
  selectedSkills: number;
  roots: string[];
  prioritizedProjectRoots: string[];
}

function resolveRootRuntime(projectRoot: string, root: string): RuntimeType | null {
  if (root.includes(`${projectRoot}/.codex/skills`) || root.includes('/.codex/skills')) {
    return 'codex';
  }
  if (root.includes(`${projectRoot}/.claude/skills`) || root.includes('/.claude/skills')) {
    return 'claude';
  }
  if (root.includes(`${projectRoot}/.opencode/skills`) || root.includes('/.opencode/skills')) {
    return 'opencode';
  }
  return null;
}

function getProjectSkillPath(projectRoot: string, runtime: RuntimeType, skillId: string): string {
  switch (runtime) {
    case 'codex':
      return join(projectRoot, '.codex', 'skills', skillId, 'SKILL.md');
    case 'claude':
      return join(projectRoot, '.claude', 'skills', skillId, 'SKILL.md');
    case 'opencode':
      return join(projectRoot, '.opencode', 'skills', skillId, 'SKILL.md');
    default:
      return join(projectRoot, 'skills', skillId, 'SKILL.md');
  }
}

function materializeSkillToProject(
  projectRoot: string,
  runtime: RuntimeType,
  skillId: string,
  content: string
): boolean {
  const targetPath = getProjectSkillPath(projectRoot, runtime, skillId);
  if (existsSync(targetPath)) return false;

  mkdirSync(join(projectRoot, `.${runtime}`, 'skills', skillId), { recursive: true });
  writeFileSync(targetPath, content, 'utf-8');
  return true;
}

export function bootstrapSkillsForMonitoring(
  input: ShadowBootstrapperInput
): ShadowBootstrapperResult {
  const projectRoots = [
    join(input.projectRoot, '.codex', 'skills'),
    join(input.projectRoot, '.claude', 'skills'),
    join(input.projectRoot, '.opencode', 'skills'),
    join(input.projectRoot, 'skills'),
    join(input.projectRoot, '.skills'),
    join(input.projectRoot, '.agents', 'skills'),
  ];
  const globalRoots = [
    ...input.originPaths,
    ...(input.includeHomeSkillRoots === false
      ? []
      : [
          join(homedir(), '.agents', 'skills'),
          join(homedir(), '.codex', 'skills'),
        ]),
  ];
  const candidateRoots = [...new Set<string>([...projectRoots, ...globalRoots])];
  const selectedSourceByRuntimeSkill = new Map<
    string,
    { root: string; skillPath: string; content: string; isProjectSource: boolean }
  >();

  let discovered = 0;
  let registered = 0;
  let createdShadows = 0;
  let bootstrapVersionedUpdates = 0;
  let materializedToProject = 0;
  const originUpserted = new Set<string>();

  for (const root of candidateRoots) {
    if (!existsSync(root)) continue;

    let entries = [] as import('node:fs').Dirent[];
    try {
      entries = readdirSync(root, { withFileTypes: true, encoding: 'utf8' });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const skillId = entry.name;
      const skillDir = join(root, skillId);
      const skillFileCandidates = [join(skillDir, 'SKILL.md'), join(skillDir, 'skill.md')];
      const skillPath = skillFileCandidates.find((path) => existsSync(path));
      if (!skillPath) continue;

      discovered++;
      const isProjectSource = root.startsWith(input.projectRoot);
      const runtimeScope = resolveRootRuntime(input.projectRoot, root);
      const applicableRuntimes =
        runtimeScope === null ? input.enabledRuntimes : input.enabledRuntimes.filter((item) => item === runtimeScope);

      let content = '';
      try {
        content = readFileSync(skillPath, 'utf-8');
      } catch {
        continue;
      }

      for (const runtime of applicableRuntimes) {
        const scopedKey = `${runtime}::${skillId}`;
        if (selectedSourceByRuntimeSkill.has(scopedKey)) continue;
        selectedSourceByRuntimeSkill.set(scopedKey, {
          root,
          skillPath,
          content,
          isProjectSource,
        });
      }
    }
  }

  for (const [scopedKey, selected] of selectedSourceByRuntimeSkill.entries()) {
    const [runtime, skillId] = scopedKey.split('::') as [RuntimeType, string];
    const now = new Date().toISOString();
    const originVersion = hashString(selected.content);

    if (!originUpserted.has(skillId)) {
      input.db.upsertOriginSkill({
        skill_id: skillId,
        origin_path: selected.skillPath,
        origin_version: originVersion,
        source: 'local',
        installed_at: now,
        last_seen_at: now,
      });
      originUpserted.add(skillId);
    }

    if (!input.shadowRegistry.has(skillId, runtime)) {
      input.shadowRegistry.create(skillId, selected.content, originVersion, runtime);
      createdShadows++;
    } else {
      const current = input.shadowRegistry.readContent(skillId, runtime);
      if (current !== undefined && current !== selected.content) {
        input.shadowRegistry.updateContent(skillId, selected.content, runtime);
        input.createVersionManager({
          projectPath: input.projectRoot,
          skillId,
          runtime,
        }).createVersion(
          selected.content,
          `Bootstrap source sync (${selected.isProjectSource ? 'project' : 'global'} -> project-preferred)`,
          []
        );
        bootstrapVersionedUpdates++;
      }
    }

    const shadowEntry = input.shadowRegistry.get(skillId, runtime);
    const status: ShadowStatus = shadowEntry?.status === 'frozen' ? 'frozen' : 'active';
    const shadow = {
      project_id: input.projectRoot,
      skill_id: scopedKey,
      runtime,
      shadow_id: buildShadowId(skillId, input.projectRoot, runtime),
      origin_skill_id: skillId,
      origin_version_at_fork: originVersion,
      shadow_path: join(input.projectRoot, '.ornn', 'shadows', runtime, `${skillId}.md`),
      current_revision: 0,
      status,
      created_at: now,
      last_optimized_at: now,
    };
    input.db.upsertShadowSkill(shadow);
    input.traceSkillMapper.registerSkill({
      skill_id: skillId,
      origin_path: selected.skillPath,
      origin_version: originVersion,
      source: 'local',
      installed_at: now,
      last_seen_at: now,
    }, shadow);
    registered++;

    if (!selected.isProjectSource) {
      if (materializeSkillToProject(input.projectRoot, runtime, skillId, selected.content)) {
        materializedToProject++;
      }
    }
  }

  logger.info('Skill monitoring bootstrap completed', {
    discovered,
    registered,
    createdShadows,
    bootstrapVersionedUpdates,
    roots: candidateRoots,
    prioritizedProjectRoots: projectRoots,
    selectedSkills: selectedSourceByRuntimeSkill.size,
    materializedToProject,
  });

  return {
    discovered,
    registered,
    createdShadows,
    bootstrapVersionedUpdates,
    materializedToProject,
    selectedSkills: selectedSourceByRuntimeSkill.size,
    roots: candidateRoots,
    prioritizedProjectRoots: projectRoots,
  };
}
