import { createSkillDeployer } from '../../core/skill-deployer/index.js';
import { refreshSkillDomainProjection } from '../../core/skill-domain/projector.js';
import { createShadowRegistry } from '../../core/shadow-registry/index.js';
import { SkillVersionManager } from '../../core/skill-version/index.js';
import { readSkillContent } from '../data-reader.js';
import type { RuntimeType } from '../../types/index.js';

interface SkillVersionLogger {
  info(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

export function resolveDashboardRuntime(runtimeFromBody?: unknown, runtimeFromQuery?: string | null): RuntimeType {
  const runtimeCandidate =
    typeof runtimeFromBody === 'string' && runtimeFromBody.length > 0 ? runtimeFromBody : runtimeFromQuery;
  return runtimeCandidate === 'claude' || runtimeCandidate === 'opencode' || runtimeCandidate === 'codex'
    ? runtimeCandidate
    : 'codex';
}

export function saveSkillVersion(params: {
  projectPath: string;
  skillId: string;
  runtime: RuntimeType;
  content: string;
  reason: string;
  logContext: string;
  logger: SkillVersionLogger;
}) {
  const { projectPath, skillId, runtime, content, reason, logContext, logger } = params;
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

  refreshSkillDomainProjection(projectPath);

  return {
    ok: true as const,
    unchanged: false as const,
    version: created.version,
    metadata: created.metadata,
    deployedPath: deployResult.deployedPath,
    created,
  };
}

export function toggleSkillVersionState(params: {
  projectPath: string;
  skillId: string;
  runtime: RuntimeType;
  version: number;
  disabled: boolean;
  logger: SkillVersionLogger;
}) {
  const { projectPath, skillId, runtime, version, disabled, logger } = params;

  try {
    const versionManager = new SkillVersionManager({
      projectPath,
      skillId,
      runtime,
    });
    const updatedVersion = versionManager.setVersionDisabled(version, disabled);
    if (!updatedVersion) {
      return { ok: false as const, notFound: true as const };
    }

    const effectiveVersion = versionManager.getEffectiveVersion();
    if (!effectiveVersion) {
      return {
        ok: false as const,
        status: 400 as const,
        error: 'No effective version available after update',
      };
    }

    const shadowRegistry = createShadowRegistry(projectPath);
    shadowRegistry.init();
    const updatedShadow = shadowRegistry.updateContent(skillId, effectiveVersion.content, runtime);
    if (!updatedShadow) {
      return { ok: false as const, notFound: true as const };
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
      return {
        ok: false as const,
        status: 500 as const,
        error: 'Version state updated but deploy failed',
        detail: deployResult.error,
        version,
        effectiveVersion: effectiveVersion.version,
      };
    }

    logger.info('Dashboard toggled skill version state', {
      projectPath,
      skillId,
      runtime,
      version,
      disabled,
      effectiveVersion: effectiveVersion.version,
    });

    refreshSkillDomainProjection(projectPath);

    return {
      ok: true as const,
      skillId,
      runtime,
      version,
      disabled: !!updatedVersion.metadata.isDisabled,
      effectiveVersion: effectiveVersion.version,
      metadata: updatedVersion.metadata,
    };
  } catch (error) {
    return {
      ok: false as const,
      status: 400 as const,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
