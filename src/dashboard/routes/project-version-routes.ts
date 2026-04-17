import { createSkillDeployer } from '../../core/skill-deployer/index.js';
import { createShadowRegistry } from '../../core/shadow-registry/index.js';
import { SkillVersionManager } from '../../core/skill-version/index.js';
import { readSkillVersion } from '../data-reader.js';
import type { RuntimeType } from '../../types/index.js';

interface RouteLogger {
  info(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

interface ProjectVersionRouteContext {
  subPath: string;
  method: string;
  projectPath: string;
  url: URL;
  json: (data: unknown, status?: number) => void;
  parseBody: () => Promise<unknown>;
  notFound: () => void;
  logger: RouteLogger;
}

function resolveRuntime(runtimeFromQuery?: string | null): RuntimeType {
  return runtimeFromQuery === 'claude' || runtimeFromQuery === 'opencode' || runtimeFromQuery === 'codex'
    ? runtimeFromQuery
    : 'codex';
}

export async function handleProjectVersionRoutes(context: ProjectVersionRouteContext): Promise<boolean> {
  const { subPath, method, projectPath, url, json, parseBody, notFound, logger } = context;
  const versionMatch = subPath.match(/^\/skills\/([^/]+)\/versions\/(\d+)$/);

  if (!versionMatch) {
    return false;
  }

  const skillId = decodeURIComponent(versionMatch[1]);
  const version = parseInt(versionMatch[2], 10);
  const runtime = resolveRuntime(url.searchParams.get('runtime'));

  if (method === 'PATCH') {
    const body = (await parseBody()) as { disabled?: unknown };
    if (typeof body.disabled !== 'boolean') {
      json({ ok: false, error: 'disabled must be a boolean' }, 400);
      return true;
    }

    try {
      const versionManager = new SkillVersionManager({
        projectPath,
        skillId,
        runtime,
      });
      const updatedVersion = versionManager.setVersionDisabled(version, body.disabled);
      if (!updatedVersion) {
        notFound();
        return true;
      }

      const effectiveVersion = versionManager.getEffectiveVersion();
      if (!effectiveVersion) {
        json({ ok: false, error: 'No effective version available after update' }, 400);
        return true;
      }

      const shadowRegistry = createShadowRegistry(projectPath);
      shadowRegistry.init();
      const updatedShadow = shadowRegistry.updateContent(skillId, effectiveVersion.content, runtime);
      if (!updatedShadow) {
        notFound();
        return true;
      }

      const deployer = createSkillDeployer({
        runtime,
        projectPath,
      });
      const deployResult = deployer.deploy(skillId, effectiveVersion);
      if (!deployResult.success) {
        logger.error('Dashboard version state updated but failed to deploy effective version', {
          projectPath,
          skillId,
          runtime,
          version,
          effectiveVersion: effectiveVersion.version,
          error: deployResult.error,
        });
        json(
          {
            ok: false,
            error: `Version state updated but deploy failed`,
            detail: deployResult.error,
            version,
            effectiveVersion: effectiveVersion.version,
          },
          500
        );
        return true;
      }

      logger.info('Dashboard toggled skill version state', {
        projectPath,
        skillId,
        runtime,
        version,
        disabled: body.disabled,
        effectiveVersion: effectiveVersion.version,
      });

      json({
        ok: true,
        skillId,
        runtime,
        version,
        disabled: !!updatedVersion.metadata.isDisabled,
        effectiveVersion: effectiveVersion.version,
        metadata: updatedVersion.metadata,
      });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      json({ ok: false, error: message }, 400);
      return true;
    }
  }

  if (method === 'GET') {
    const result = readSkillVersion(projectPath, skillId, version, runtime);
    if (!result) {
      notFound();
      return true;
    }
    json(result);
    return true;
  }

  return false;
}
