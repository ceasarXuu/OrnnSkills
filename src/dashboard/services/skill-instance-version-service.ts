import { getProjectedSkillInstanceById, readSkillFamilyInstances } from '../../core/skill-domain/projector.js';
import { readSkillContent } from '../data-reader.js';
import { listProjects } from '../projects-registry.js';
import { saveSkillVersion, toggleSkillVersionState } from './skill-version-service.js';

interface SkillInstanceLogger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

export function saveSkillInstanceVersion(params: {
  projectPath: string;
  instanceId: string;
  content: string;
  reason: string;
  logger: SkillInstanceLogger;
}) {
  const instance = getProjectedSkillInstanceById(params.projectPath, params.instanceId);
  if (!instance) {
    return { ok: false as const, notFound: true as const };
  }

  const result = saveSkillVersion({
    projectPath: params.projectPath,
    skillId: instance.skillId,
    runtime: instance.runtime,
    content: params.content,
    reason: params.reason,
    logContext: 'Dashboard saved skill instance edit and created version',
    logger: params.logger,
  });

  if (!result.ok) {
    return result;
  }

  return {
    ...result,
    instance,
  };
}

export function toggleSkillInstanceVersionState(params: {
  projectPath: string;
  instanceId: string;
  version: number;
  disabled: boolean;
  logger: SkillInstanceLogger;
}) {
  const instance = getProjectedSkillInstanceById(params.projectPath, params.instanceId);
  if (!instance) {
    return { ok: false as const, notFound: true as const };
  }

  const result = toggleSkillVersionState({
    projectPath: params.projectPath,
    skillId: instance.skillId,
    runtime: instance.runtime,
    version: params.version,
    disabled: params.disabled,
    logger: params.logger,
  });

  if (!result.ok) {
    return result;
  }

  return {
    ...result,
    instance,
  };
}

export function previewSkillInstanceFamilyTargets(params: {
  projectPath: string;
  instanceId: string;
}) {
  const instance = getProjectedSkillInstanceById(params.projectPath, params.instanceId);
  if (!instance) {
    return { ok: false as const, notFound: true as const };
  }

  const projectPaths = listProjects().map((project) => project.path);
  const targets = readSkillFamilyInstances(projectPaths, instance.familyId).filter((target) => {
    return !(target.projectPath === instance.projectPath && target.instanceId === instance.instanceId);
  });

  return {
    ok: true as const,
    instance,
    totalTargets: targets.length,
    targets,
  };
}

export function applySkillInstanceToFamily(params: {
  projectPath: string;
  instanceId: string;
  content: string;
  reason: string;
  logger: SkillInstanceLogger;
}) {
  const preview = previewSkillInstanceFamilyTargets({
    projectPath: params.projectPath,
    instanceId: params.instanceId,
  });
  if (!preview.ok) {
    return preview;
  }

  const sourceResult = saveSkillInstanceVersion({
    projectPath: params.projectPath,
    instanceId: params.instanceId,
    content: params.content,
    reason: params.reason,
    logger: params.logger,
  });
  if (!sourceResult.ok) {
    return sourceResult;
  }

  let updatedTargets = 0;
  let skippedTargets = 0;
  let failedTargets = 0;

  for (const target of preview.targets) {
    const targetContent = readSkillContent(target.projectPath, target.skillId, target.runtime);
    if (targetContent === null) {
      failedTargets++;
      params.logger.warn('Dashboard family apply target content not found', {
        sourceProjectPath: params.projectPath,
        targetProjectPath: target.projectPath,
        instanceId: target.instanceId,
        familyId: preview.instance.familyId,
      });
      continue;
    }

    if (targetContent === params.content) {
      skippedTargets++;
      continue;
    }

    const result = saveSkillVersion({
      projectPath: target.projectPath,
      skillId: target.skillId,
      runtime: target.runtime,
      content: params.content,
      reason: `Apply from ${params.projectPath} (${preview.instance.runtime})`,
      logContext: 'Dashboard apply-to-family propagated skill instance version',
      logger: params.logger,
    });
    if (!result.ok) {
      failedTargets++;
      params.logger.warn('Dashboard apply-to-family failed for target skill instance', {
        sourceProjectPath: params.projectPath,
        targetProjectPath: target.projectPath,
        instanceId: target.instanceId,
        familyId: preview.instance.familyId,
        error: result.error,
        detail: result.detail,
      });
      continue;
    }

    if (result.unchanged) {
      skippedTargets++;
      continue;
    }

    updatedTargets++;
  }

  params.logger.info('Dashboard apply-to-family completed for skill instance', {
    sourceProjectPath: params.projectPath,
    instanceId: params.instanceId,
    familyId: preview.instance.familyId,
    totalTargets: preview.targets.length,
    updatedTargets,
    skippedTargets,
    failedTargets,
  });

  return {
    ok: true as const,
    instance: preview.instance,
    source: {
      saved: !sourceResult.unchanged,
      version: sourceResult.version ?? null,
    },
    totalTargets: preview.targets.length,
    updatedTargets,
    skippedTargets,
    failedTargets,
  };
}
