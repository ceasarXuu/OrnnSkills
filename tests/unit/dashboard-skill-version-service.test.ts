import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  readSkillContent: vi.fn(),
  createShadowRegistry: vi.fn(),
  createSkillDeployer: vi.fn(),
  SkillVersionManager: vi.fn(),
  refreshSkillDomainProjection: vi.fn(),
  versionManager: {
    createVersion: vi.fn(),
    getEffectiveVersion: vi.fn(),
    setVersionDisabled: vi.fn(),
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

vi.mock('../../src/core/skill-domain/projector.js', () => ({
  refreshSkillDomainProjection: mocks.refreshSkillDomainProjection,
}));

describe('dashboard skill version service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createShadowRegistry.mockReturnValue(mocks.shadowRegistry);
    mocks.createSkillDeployer.mockReturnValue(mocks.deployer);
    mocks.SkillVersionManager.mockImplementation(() => mocks.versionManager);
  });

  it('saves and deploys a new skill version when content changes', async () => {
    const { saveSkillVersion } = await import('../../src/dashboard/services/skill-version-service.js');
    const logger = { info: vi.fn(), error: vi.fn() };

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

    const result = saveSkillVersion({
      projectPath: '/tmp/demo',
      skillId: 'demo-skill',
      runtime: 'codex',
      content: '# new skill',
      reason: 'Manual edit from dashboard',
      logContext: 'Dashboard saved skill edit and created version',
      logger,
    });

    expect(result).toEqual({
      ok: true,
      unchanged: false,
      version: 4,
      metadata: { version: 4, isDisabled: false },
      deployedPath: '/tmp/demo/.codex/skills/demo-skill/SKILL.md',
      created: expect.objectContaining({ version: 4 }),
    });
    expect(mocks.versionManager.createVersion).toHaveBeenCalledWith(
      '# new skill',
      'Manual edit from dashboard',
      []
    );
    expect(mocks.deployer.deploy).toHaveBeenCalledWith(
      'demo-skill',
      expect.objectContaining({ version: 4 })
    );
    expect(mocks.refreshSkillDomainProjection).toHaveBeenCalledWith('/tmp/demo');
  });

  it('toggles a version disabled state and redeploys the effective version', async () => {
    const { toggleSkillVersionState } = await import('../../src/dashboard/services/skill-version-service.js');
    const logger = { info: vi.fn(), error: vi.fn() };

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

    const result = toggleSkillVersionState({
      projectPath: '/tmp/demo',
      skillId: 'demo-skill',
      runtime: 'codex',
      version: 4,
      disabled: true,
      logger,
    });

    expect(result).toEqual({
      ok: true,
      skillId: 'demo-skill',
      runtime: 'codex',
      version: 4,
      disabled: true,
      effectiveVersion: 3,
      metadata: { version: 4, isDisabled: true },
    });
    expect(mocks.versionManager.setVersionDisabled).toHaveBeenCalledWith(4, true);
    expect(mocks.shadowRegistry.updateContent).toHaveBeenCalledWith('demo-skill', '# active v3', 'codex');
    expect(mocks.deployer.deploy).toHaveBeenCalledWith(
      'demo-skill',
      expect.objectContaining({ version: 3, content: '# active v3' })
    );
    expect(mocks.refreshSkillDomainProjection).toHaveBeenCalledWith('/tmp/demo');
  });
});
