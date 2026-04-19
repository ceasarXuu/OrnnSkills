import { projectSkillDomain, getProjectedSkillInstanceById } from '../../core/skill-domain/projector.js';
import { readSkillVersion } from '../data-reader.js';
import {
  applySkillInstanceToFamily,
  previewSkillInstanceFamilyTargets,
  saveSkillInstanceVersion,
  toggleSkillInstanceVersionState,
} from '../services/skill-instance-version-service.js';

interface RouteLogger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

interface ProjectSkillInstanceRouteContext {
  subPath: string;
  method: string;
  projectPath: string;
  url: URL;
  json: (data: unknown, status?: number) => void;
  parseBody: () => Promise<unknown>;
  notFound: () => void;
  logger: RouteLogger;
}

export async function handleProjectSkillInstanceRoutes(
  context: ProjectSkillInstanceRouteContext
): Promise<boolean> {
  const { subPath, method, projectPath, json, parseBody, notFound, logger } = context;

  if (subPath === '/skill-groups' && method === 'GET') {
    json({ skillGroups: projectSkillDomain(projectPath).skillGroups });
    return true;
  }

  if (subPath === '/skill-instances' && method === 'GET') {
    json({ instances: projectSkillDomain(projectPath).instances });
    return true;
  }

  const applyPreviewMatch = subPath.match(/^\/skill-instances\/([^/]+)\/apply-preview$/);
  if (applyPreviewMatch && method === 'GET') {
    const instanceId = decodeURIComponent(applyPreviewMatch[1]);
    const result = previewSkillInstanceFamilyTargets({
      projectPath,
      instanceId,
    });
    if (!result.ok && result.notFound) {
      notFound();
      return true;
    }
    json({
      instanceId,
      instance: result.instance,
      totalTargets: result.totalTargets,
      targets: result.targets,
    });
    return true;
  }

  const applyToFamilyMatch = subPath.match(/^\/skill-instances\/([^/]+)\/apply-to-family$/);
  if (applyToFamilyMatch && method === 'POST') {
    const instanceId = decodeURIComponent(applyToFamilyMatch[1]);
    const body = (await parseBody()) as { content?: unknown; reason?: unknown };
    if (typeof body.content !== 'string') {
      json({ ok: false, error: 'content must be a string' }, 400);
      return true;
    }

    const result = applySkillInstanceToFamily({
      projectPath,
      instanceId,
      content: body.content,
      reason:
        typeof body.reason === 'string' && body.reason.trim().length > 0
          ? body.reason.trim()
          : 'Manual edit from dashboard',
      logger,
    });
    if (!result.ok && result.notFound) {
      notFound();
      return true;
    }
    if (!result.ok) {
      json({ ok: false, error: result.error }, 500);
      return true;
    }

    json({
      ok: true,
      instanceId,
      familyId: result.instance.familyId,
      source: result.source,
      totalTargets: result.totalTargets,
      updatedTargets: result.updatedTargets,
      skippedTargets: result.skippedTargets,
      failedTargets: result.failedTargets,
    });
    return true;
  }

  const versionMatch = subPath.match(/^\/skill-instances\/([^/]+)\/versions\/(\d+)$/);
  if (versionMatch) {
    const instanceId = decodeURIComponent(versionMatch[1]);
    const version = Number.parseInt(versionMatch[2], 10);
    const instance = getProjectedSkillInstanceById(projectPath, instanceId);
    if (!instance) {
      notFound();
      return true;
    }

    if (method === 'GET') {
      const result = readSkillVersion(projectPath, instance.skillId, version, instance.runtime);
      if (!result) {
        notFound();
        return true;
      }
      json(result);
      return true;
    }

    if (method === 'PATCH') {
      const body = (await parseBody()) as { disabled?: unknown };
      if (typeof body.disabled !== 'boolean') {
        json({ ok: false, error: 'disabled must be a boolean' }, 400);
        return true;
      }

      const result = toggleSkillInstanceVersionState({
        projectPath,
        instanceId,
        version,
        disabled: body.disabled,
        logger,
      });
      if (!result.ok && result.notFound) {
        notFound();
        return true;
      }
      if (!result.ok) {
        json({ ok: false, error: result.error }, result.status ?? 400);
        return true;
      }
      json({ ...result, instanceId });
      return true;
    }
  }

  const instanceMatch = subPath.match(/^\/skill-instances\/([^/]+)$/);
  if (!instanceMatch) {
    return false;
  }

  const instanceId = decodeURIComponent(instanceMatch[1]);
  const instance = getProjectedSkillInstanceById(projectPath, instanceId);
  if (!instance) {
    notFound();
    return true;
  }

  if (method === 'GET') {
    json({ instance });
    return true;
  }

  if (method === 'PUT') {
    const body = (await parseBody()) as { content?: unknown; reason?: unknown };
    if (typeof body.content !== 'string') {
      json({ ok: false, error: 'content must be a string' }, 400);
      return true;
    }

    const result = saveSkillInstanceVersion({
      projectPath,
      instanceId,
      content: body.content,
      reason:
        typeof body.reason === 'string' && body.reason.trim().length > 0
          ? body.reason.trim()
          : 'Manual edit from dashboard',
      logger,
    });
    if (!result.ok && result.notFound) {
      notFound();
      return true;
    }
    if (!result.ok) {
      json({ ok: false, error: result.error }, 500);
      return true;
    }
    json({
      ok: true,
      instanceId,
      version: result.version,
      metadata: result.metadata,
      deployedPath: result.deployedPath,
      unchanged: result.unchanged,
      instance: result.instance,
    });
    return true;
  }

  return false;
}