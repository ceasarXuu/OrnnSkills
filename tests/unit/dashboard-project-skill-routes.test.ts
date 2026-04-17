import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  listProjects: vi.fn(),
  readSkills: vi.fn(),
  readSkillContent: vi.fn(),
  createShadowRegistry: vi.fn(),
  createSkillDeployer: vi.fn(),
  SkillVersionManager: vi.fn(),
  versionManager: {
    createVersion: vi.fn(),
    getEffectiveVersion: vi.fn(),
  },
  shadowRegistry: {
    init: vi.fn(),
    updateContent: vi.fn(),
  },
  deployer: {
    deploy: vi.fn(),
  },
}));

vi.mock('../../src/dashboard/projects-registry.js', () => ({
  listProjects: mocks.listProjects,
}));

vi.mock('../../src/dashboard/data-reader.js', () => ({
  readSkills: mocks.readSkills,
  readSkillContent: mocks.readSkillContent,
}));

vi.mock('../../src/core/shadow-registry/index.js', () => ({
  createShadowRegistry: mocks.createShadowRegistry,
}));

vi.mock('../../src/core/skill-deployer/index.js', () => ({
  createSkillDeployer: mocks.createSkillDeployer,
}));

vi.mock('../../src/core/skill-version/index.js', () => ({
  SkillVersionManager: function SkillVersionManager(...args: unknown[]) {
    if (!mocks.SkillVersionManager.getMockImplementation()) {
      mocks.SkillVersionManager.mockImplementation(() => mocks.versionManager);
    }
    return mocks.SkillVersionManager(...args);
  },
}));

describe('dashboard project skill routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createShadowRegistry.mockReturnValue(mocks.shadowRegistry);
    mocks.createSkillDeployer.mockReturnValue(mocks.deployer);
    mocks.SkillVersionManager.mockImplementation(() => mocks.versionManager);
  });

  it('returns false for unrelated project routes', async () => {
    const { handleProjectSkillRoutes } = await import('../../src/dashboard/routes/project-skill-routes.js');

    const handled = await handleProjectSkillRoutes({
      subPath: '/status',
      method: 'GET',
      projectPath: '/tmp/demo',
      url: new URL('http://127.0.0.1/api/projects/demo/status'),
      json: vi.fn(),
      parseBody: vi.fn(),
      notFound: vi.fn(),
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    });

    expect(handled).toBe(false);
  });

  it('handles GET /api/projects/:id/skills', async () => {
    const { handleProjectSkillRoutes } = await import('../../src/dashboard/routes/project-skill-routes.js');
    const json = vi.fn();
    const skills = [{ skillId: 'demo-skill', runtime: 'codex' }];
    mocks.readSkills.mockReturnValue(skills);

    const handled = await handleProjectSkillRoutes({
      subPath: '/skills',
      method: 'GET',
      projectPath: '/tmp/demo',
      url: new URL('http://127.0.0.1/api/projects/demo/skills'),
      json,
      parseBody: vi.fn(),
      notFound: vi.fn(),
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    });

    expect(handled).toBe(true);
    expect(mocks.readSkills).toHaveBeenCalledWith('/tmp/demo');
    expect(json).toHaveBeenCalledWith({ skills });
  });

  it('handles GET /api/projects/:id/skills/:skillId', async () => {
    const { handleProjectSkillRoutes } = await import('../../src/dashboard/routes/project-skill-routes.js');
    const json = vi.fn();
    mocks.readSkillContent.mockReturnValue('# skill');
    mocks.readSkills.mockReturnValue([
      {
        skillId: 'demo-skill',
        runtime: 'claude',
        versionsAvailable: [1, 2, 3],
        effectiveVersion: 3,
        status: 'active',
      },
    ]);
    mocks.versionManager.getEffectiveVersion.mockReturnValue({ version: 3 });

    const handled = await handleProjectSkillRoutes({
      subPath: '/skills/demo-skill',
      method: 'GET',
      projectPath: '/tmp/demo',
      url: new URL('http://127.0.0.1/api/projects/demo/skills/demo-skill?runtime=claude'),
      json,
      parseBody: vi.fn(),
      notFound: vi.fn(),
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    });

    expect(handled).toBe(true);
    expect(mocks.readSkillContent).toHaveBeenCalledWith('/tmp/demo', 'demo-skill', 'claude');
    expect(json).toHaveBeenCalledWith({
      skillId: 'demo-skill',
      runtime: 'claude',
      content: '# skill',
      versions: [1, 2, 3],
      effectiveVersion: 3,
      status: 'active',
    });
  });

  it('handles PUT /api/projects/:id/skills/:skillId and saves a new version', async () => {
    const { handleProjectSkillRoutes } = await import('../../src/dashboard/routes/project-skill-routes.js');
    const json = vi.fn();
    mocks.readSkillContent.mockReturnValue('# old skill');
    mocks.shadowRegistry.updateContent.mockReturnValue({ skillId: 'demo-skill', runtime: 'codex' });
    mocks.versionManager.createVersion.mockReturnValue({
      version: 4,
      metadata: { version: 4, isDisabled: false },
    });
    mocks.deployer.deploy.mockReturnValue({
      success: true,
      deployedPath: '/tmp/demo/.codex/skills/demo-skill/SKILL.md',
    });

    const handled = await handleProjectSkillRoutes({
      subPath: '/skills/demo-skill',
      method: 'PUT',
      projectPath: '/tmp/demo',
      url: new URL('http://127.0.0.1/api/projects/demo/skills/demo-skill'),
      json,
      parseBody: vi.fn().mockResolvedValue({ content: '# new skill' }),
      notFound: vi.fn(),
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    });

    expect(handled).toBe(true);
    expect(mocks.versionManager.createVersion).toHaveBeenCalledWith(
      '# new skill',
      'Manual edit from dashboard',
      []
    );
    expect(mocks.deployer.deploy).toHaveBeenCalledWith(
      'demo-skill',
      expect.objectContaining({ version: 4 })
    );
    expect(json).toHaveBeenCalledWith({
      ok: true,
      unchanged: false,
      skillId: 'demo-skill',
      runtime: 'codex',
      version: 4,
      metadata: { version: 4, isDisabled: false },
      deployedPath: '/tmp/demo/.codex/skills/demo-skill/SKILL.md',
    });
  });

  it('handles POST /api/projects/:id/skills/:skillId/apply-to-all', async () => {
    const { handleProjectSkillRoutes } = await import('../../src/dashboard/routes/project-skill-routes.js');
    const json = vi.fn();
    const sourceProject = '/tmp/source';
    const peerProject = '/tmp/peer';
    const skippedProject = '/tmp/skipped';
    const content = '# propagated skill';

    const sourceShadowRegistry = {
      init: vi.fn(),
      updateContent: vi.fn().mockReturnValue({ skillId: 'demo-skill', runtime: 'codex' }),
    };
    const peerShadowRegistry = {
      init: vi.fn(),
      updateContent: vi.fn().mockReturnValue({ skillId: 'demo-skill', runtime: 'claude' }),
    };
    const sourceVersionManager = {
      createVersion: vi.fn().mockReturnValue({ version: 4, metadata: { version: 4 } }),
      getEffectiveVersion: vi.fn(),
    };
    const peerVersionManager = {
      createVersion: vi.fn().mockReturnValue({ version: 7, metadata: { version: 7 } }),
      getEffectiveVersion: vi.fn(),
    };
    const sourceDeployer = {
      deploy: vi.fn().mockReturnValue({ success: true, deployedPath: '/tmp/source/.codex/skills/demo-skill/SKILL.md' }),
    };
    const peerDeployer = {
      deploy: vi.fn().mockReturnValue({ success: true, deployedPath: '/tmp/peer/.claude/skills/demo-skill/SKILL.md' }),
    };

    mocks.listProjects.mockReturnValue([
      { path: sourceProject },
      { path: peerProject },
      { path: skippedProject },
    ]);
    mocks.readSkills.mockImplementation((projectPath: string) => {
      if (projectPath === sourceProject) return [{ skillId: 'demo-skill', runtime: 'codex' }];
      if (projectPath === peerProject) return [{ skillId: 'demo-skill', runtime: 'claude' }];
      if (projectPath === skippedProject) return [{ skillId: 'demo-skill', runtime: 'opencode' }];
      return [];
    });
    mocks.readSkillContent.mockImplementation((projectPath: string, skillId: string, runtime: string) => {
      if (skillId !== 'demo-skill') return null;
      if (projectPath === sourceProject && runtime === 'codex') return '# stale source';
      if (projectPath === peerProject && runtime === 'claude') return '# stale peer';
      if (projectPath === skippedProject && runtime === 'opencode') return content;
      return null;
    });
    mocks.createShadowRegistry.mockImplementation((projectPath: string) => {
      if (projectPath === sourceProject) return sourceShadowRegistry;
      if (projectPath === peerProject) return peerShadowRegistry;
      return mocks.shadowRegistry;
    });
    mocks.SkillVersionManager.mockImplementation((options: { projectPath: string; runtime: string }) => {
      if (options.projectPath === sourceProject && options.runtime === 'codex') return sourceVersionManager;
      if (options.projectPath === peerProject && options.runtime === 'claude') return peerVersionManager;
      return mocks.versionManager;
    });
    mocks.createSkillDeployer.mockImplementation((options: { projectPath: string; runtime: string }) => {
      if (options.projectPath === sourceProject && options.runtime === 'codex') return sourceDeployer;
      if (options.projectPath === peerProject && options.runtime === 'claude') return peerDeployer;
      return mocks.deployer;
    });

    const handled = await handleProjectSkillRoutes({
      subPath: '/skills/demo-skill/apply-to-all',
      method: 'POST',
      projectPath: sourceProject,
      url: new URL('http://127.0.0.1/api/projects/source/skills/demo-skill/apply-to-all?runtime=codex'),
      json,
      parseBody: vi.fn().mockResolvedValue({ content, runtime: 'codex' }),
      notFound: vi.fn(),
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    });

    expect(handled).toBe(true);
    expect(sourceVersionManager.createVersion).toHaveBeenCalledWith(content, 'Manual edit from dashboard', []);
    expect(peerVersionManager.createVersion).toHaveBeenCalledWith(content, `Bulk apply from ${sourceProject} (codex)`, []);
    expect(json).toHaveBeenCalledWith({
      ok: true,
      skillId: 'demo-skill',
      runtime: 'codex',
      source: {
        saved: true,
        version: 4,
      },
      totalTargets: 2,
      updatedTargets: 1,
      skippedTargets: 1,
      failedTargets: 0,
    });
  });
});
