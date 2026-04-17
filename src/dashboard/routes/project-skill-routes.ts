import { createSkillDeployer } from '../../core/skill-deployer/index.js';
import { createShadowRegistry } from '../../core/shadow-registry/index.js';
import { SkillVersionManager } from '../../core/skill-version/index.js';
import { listProjects } from '../projects-registry.js';
import { readSkillContent, readSkills } from '../data-reader.js';
import type { RuntimeType } from '../../types/index.js';

interface RouteLogger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

interface ProjectSkillRouteContext {
  subPath: string;
  method: string;
  projectPath: string;
  url: URL;
  json: (data: unknown, status?: number) => void;
  parseBody: () => Promise<unknown>;
  notFound: () => void;
  logger: RouteLogger;
}

function resolveRuntime(runtimeFromBody?: unknown, runtimeFromQuery?: string | null): RuntimeType {
  const runtimeCandidate =
    typeof runtimeFromBody === 'string' && runtimeFromBody.length > 0 ? runtimeFromBody : runtimeFromQuery;
  return runtimeCandidate === 'claude' || runtimeCandidate === 'opencode' || runtimeCandidate === 'codex'
    ? runtimeCandidate
    : 'codex';
}

function saveSkillVersion(
  context: Pick<ProjectSkillRouteContext, 'logger'>,
  params: {
    projectPath: string;
    skillId: string;
    runtime: RuntimeType;
    content: string;
    reason: string;
    logContext: string;
  }
) {
  const { logger } = context;
  const { projectPath, skillId, runtime, content, reason, logContext } = params;
  const oldContent = readSkillContent(projectPath, skillId, runtime);
  if (oldContent === null) {
    return { ok: false as const, notFound: true as const };
  }

  const versionManager = new SkillVersionManager({
    projectPath,
    skillId,
    runtime,
  });
  const currentEffectiveVersion = versionManager.getEffectiveVersion()?.version ?? null;
  if (content === oldContent) {
    return {
      ok: true as const,
      unchanged: true as const,
      version: currentEffectiveVersion,
    };
  }

  const shadowRegistry = createShadowRegistry(projectPath);
  shadowRegistry.init();
  const updated = shadowRegistry.updateContent(skillId, content, runtime);
  if (!updated) {
    return { ok: false as const, notFound: true as const };
  }

  const created = versionManager.createVersion(content, reason, []);
  const deployer = createSkillDeployer({
    runtime,
    projectPath,
  });
  const deployResult = deployer.deploy(skillId, created);
  if (!deployResult.success) {
    logger.error(`${logContext} created version but failed to deploy latest`, {
      projectPath,
      skillId,
      runtime,
      version: created.version,
      error: deployResult.error,
    });
    return {
      ok: false as const,
      version: created.version,
      error: `Version created (v${created.version}) but deploy failed`,
      detail: deployResult.error,
    };
  }

  logger.info(logContext, {
    projectPath,
    skillId,
    runtime,
    version: created.version,
    deployedPath: deployResult.deployedPath,
  });

  return {
    ok: true as const,
    unchanged: false as const,
    version: created.version,
    metadata: created.metadata,
    deployedPath: deployResult.deployedPath,
    created,
  };
}

function listSameNamedSkillTargets(
  sourceProjectPath: string,
  skillId: string,
  sourceRuntime: RuntimeType
): Array<{ projectPath: string; runtime: RuntimeType }> {
  const seen = new Set<string>();
  const targets: Array<{ projectPath: string; runtime: RuntimeType }> = [];

  for (const project of listProjects()) {
    const skills = readSkills(project.path);
    for (const skill of skills) {
      if (skill.skillId !== skillId) continue;
      const runtime: RuntimeType = skill.runtime ?? 'codex';
      if (project.path === sourceProjectPath && runtime === sourceRuntime) {
        continue;
      }
      const key = `${project.path}::${runtime}`;
      if (seen.has(key)) continue;
      seen.add(key);
      targets.push({ projectPath: project.path, runtime });
    }
  }

  return targets;
}

export async function handleProjectSkillRoutes(context: ProjectSkillRouteContext): Promise<boolean> {
  const { subPath, method, projectPath, url, json, parseBody, notFound, logger } = context;

  if (subPath === '/skills' && method === 'GET') {
    json({ skills: readSkills(projectPath) });
    return true;
  }

  const skillMatch = subPath.match(/^\/skills\/([^/]+)$/);
  if (skillMatch && method === 'GET') {
    const skillId = decodeURIComponent(skillMatch[1]);
    const runtime = resolveRuntime(undefined, url.searchParams.get('runtime'));
    const content = readSkillContent(projectPath, skillId, runtime);
    const skills = readSkills(projectPath);
    const skill = skills.find((entry) => entry.skillId === skillId && (entry.runtime ?? 'codex') === runtime);
    const versionManager = new SkillVersionManager({
      projectPath,
      skillId,
      runtime,
    });
    if (content === null) {
      logger.warn('Skill content not found for dashboard request', {
        projectPath,
        skillId,
        runtime,
      });
    }
    json({
      skillId,
      runtime,
      content,
      versions: skill?.versionsAvailable ?? [],
      effectiveVersion: versionManager.getEffectiveVersion()?.version ?? skill?.effectiveVersion ?? null,
      status: skill?.status,
    });
    return true;
  }

  if (skillMatch && method === 'PUT') {
    const skillId = decodeURIComponent(skillMatch[1]);
    const body = (await parseBody()) as {
      content?: unknown;
      runtime?: unknown;
      reason?: unknown;
    };
    if (typeof body.content !== 'string') {
      json({ ok: false, error: 'content must be a string' }, 400);
      return true;
    }

    const runtime = resolveRuntime(body.runtime, url.searchParams.get('runtime'));
    const reason =
      typeof body.reason === 'string' && body.reason.trim().length > 0 ? body.reason.trim() : 'Manual edit from dashboard';
    const result = saveSkillVersion(
      { logger },
      {
        projectPath,
        skillId,
        runtime,
        content: body.content,
        reason,
        logContext: 'Dashboard saved skill edit and created version',
      }
    );

    if (!result.ok && result.notFound) {
      notFound();
      return true;
    }

    if (!result.ok) {
      json(
        {
          ok: false,
          error: result.error,
          detail: result.detail,
          version: result.version,
        },
        500
      );
      return true;
    }

    json({
      ok: true,
      unchanged: result.unchanged,
      skillId,
      runtime,
      version: result.version,
      metadata: result.metadata,
      deployedPath: result.deployedPath,
    });
    return true;
  }

  const applyToAllMatch = subPath.match(/^\/skills\/([^/]+)\/apply-to-all$/);
  if (applyToAllMatch && method === 'POST') {
    const skillId = decodeURIComponent(applyToAllMatch[1]);
    const body = (await parseBody()) as {
      content?: unknown;
      runtime?: unknown;
      reason?: unknown;
    };
    if (typeof body.content !== 'string') {
      json({ ok: false, error: 'content must be a string' }, 400);
      return true;
    }

    const runtime = resolveRuntime(body.runtime, url.searchParams.get('runtime'));
    const sourceReason =
      typeof body.reason === 'string' && body.reason.trim().length > 0 ? body.reason.trim() : 'Manual edit from dashboard';
    const sourceResult = saveSkillVersion(
      { logger },
      {
        projectPath,
        skillId,
        runtime,
        content: body.content,
        reason: sourceReason,
        logContext: 'Dashboard bulk apply saved source skill version',
      }
    );

    if (!sourceResult.ok && sourceResult.notFound) {
      notFound();
      return true;
    }

    if (!sourceResult.ok) {
      json(
        {
          ok: false,
          error: sourceResult.error,
          detail: sourceResult.detail,
          version: sourceResult.version,
        },
        500
      );
      return true;
    }

    const targets = listSameNamedSkillTargets(projectPath, skillId, runtime);
    let updatedTargets = 0;
    let skippedTargets = 0;
    let failedTargets = 0;

    for (const target of targets) {
      const targetContent = readSkillContent(target.projectPath, skillId, target.runtime);
      if (targetContent === null) {
        failedTargets++;
        logger.warn('Dashboard bulk apply target content not found', {
          sourceProjectPath: projectPath,
          targetProjectPath: target.projectPath,
          skillId,
          runtime: target.runtime,
        });
        continue;
      }

      if (targetContent === body.content) {
        skippedTargets++;
        continue;
      }

      const targetResult = saveSkillVersion(
        { logger },
        {
          projectPath: target.projectPath,
          skillId,
          runtime: target.runtime,
          content: body.content,
          reason: `Bulk apply from ${projectPath} (${runtime})`,
          logContext: 'Dashboard bulk apply propagated skill version',
        }
      );

      if (!targetResult.ok) {
        failedTargets++;
        logger.warn('Dashboard bulk apply failed for target skill', {
          sourceProjectPath: projectPath,
          targetProjectPath: target.projectPath,
          skillId,
          runtime: target.runtime,
          error: targetResult.error,
          detail: targetResult.detail,
        });
        continue;
      }

      if (targetResult.unchanged) {
        skippedTargets++;
        continue;
      }

      updatedTargets++;
    }

    logger.info('Dashboard bulk apply completed for same-named skills', {
      sourceProjectPath: projectPath,
      skillId,
      runtime,
      totalTargets: targets.length,
      updatedTargets,
      skippedTargets,
      failedTargets,
    });

    json({
      ok: true,
      skillId,
      runtime,
      source: {
        saved: !sourceResult.unchanged,
        version: sourceResult.version ?? null,
      },
      totalTargets: targets.length,
      updatedTargets,
      skippedTargets,
      failedTargets,
    });
    return true;
  }

  return false;
}
