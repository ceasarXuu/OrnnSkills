import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  readSkillVersion: vi.fn(),
  createShadowRegistry: vi.fn(),
  createSkillDeployer: vi.fn(),
  SkillVersionManager: vi.fn(),
  versionManager: {
    setVersionDisabled: vi.fn(),
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

vi.mock('../../src/dashboard/data-reader.js', () => ({
  readSkillVersion: mocks.readSkillVersion,
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

describe('dashboard project version routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createShadowRegistry.mockReturnValue(mocks.shadowRegistry);
    mocks.createSkillDeployer.mockReturnValue(mocks.deployer);
    mocks.SkillVersionManager.mockImplementation(() => mocks.versionManager);
  });

  it('returns false for unrelated project routes', async () => {
    const { handleProjectVersionRoutes } = await import('../../src/dashboard/routes/project-version-routes.js');

    const handled = await handleProjectVersionRoutes({
      subPath: '/skills/demo-skill',
      method: 'GET',
      projectPath: '/tmp/demo',
      url: new URL('http://127.0.0.1/api/projects/demo/skills/demo-skill'),
      json: vi.fn(),
      parseBody: vi.fn(),
      notFound: vi.fn(),
      logger: { info: vi.fn(), error: vi.fn() },
    });

    expect(handled).toBe(false);
  });

  it('handles PATCH /api/projects/:id/skills/:skillId/versions/:v', async () => {
    const { handleProjectVersionRoutes } = await import('../../src/dashboard/routes/project-version-routes.js');
    const json = vi.fn();
    mocks.versionManager.setVersionDisabled.mockReturnValue({
      metadata: { version: 4, isDisabled: true },
    });
    mocks.versionManager.getEffectiveVersion.mockReturnValue({
      version: 3,
      content: '# active v3',
      metadata: { version: 3, isDisabled: false },
    });
    mocks.shadowRegistry.updateContent.mockReturnValue({ skillId: 'demo-skill', runtime: 'codex' });
    mocks.deployer.deploy.mockReturnValue({
      success: true,
      deployedPath: '/tmp/demo/.codex/skills/demo-skill/SKILL.md',
    });

    const handled = await handleProjectVersionRoutes({
      subPath: '/skills/demo-skill/versions/4',
      method: 'PATCH',
      projectPath: '/tmp/demo',
      url: new URL('http://127.0.0.1/api/projects/demo/skills/demo-skill/versions/4?runtime=codex'),
      json,
      parseBody: vi.fn().mockResolvedValue({ disabled: true }),
      notFound: vi.fn(),
      logger: { info: vi.fn(), error: vi.fn() },
    });

    expect(handled).toBe(true);
    expect(mocks.versionManager.setVersionDisabled).toHaveBeenCalledWith(4, true);
    expect(mocks.shadowRegistry.updateContent).toHaveBeenCalledWith('demo-skill', '# active v3', 'codex');
    expect(mocks.deployer.deploy).toHaveBeenCalledWith(
      'demo-skill',
      expect.objectContaining({ version: 3, content: '# active v3' })
    );
    expect(json).toHaveBeenCalledWith({
      ok: true,
      skillId: 'demo-skill',
      runtime: 'codex',
      version: 4,
      disabled: true,
      effectiveVersion: 3,
      metadata: { version: 4, isDisabled: true },
    });
  });

  it('handles GET /api/projects/:id/skills/:skillId/versions/:v', async () => {
    const { handleProjectVersionRoutes } = await import('../../src/dashboard/routes/project-version-routes.js');
    const json = vi.fn();
    const versionPayload = {
      version: 4,
      content: '# skill v4',
      metadata: { version: 4, isDisabled: false },
    };
    mocks.readSkillVersion.mockReturnValue(versionPayload);

    const handled = await handleProjectVersionRoutes({
      subPath: '/skills/demo-skill/versions/4',
      method: 'GET',
      projectPath: '/tmp/demo',
      url: new URL('http://127.0.0.1/api/projects/demo/skills/demo-skill/versions/4?runtime=claude'),
      json,
      parseBody: vi.fn(),
      notFound: vi.fn(),
      logger: { info: vi.fn(), error: vi.fn() },
    });

    expect(handled).toBe(true);
    expect(mocks.readSkillVersion).toHaveBeenCalledWith('/tmp/demo', 'demo-skill', 4, 'claude');
    expect(json).toHaveBeenCalledWith(versionPayload);
  });
});
