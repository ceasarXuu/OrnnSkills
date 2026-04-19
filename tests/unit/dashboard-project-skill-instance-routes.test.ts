import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  projectSkillDomain: vi.fn(),
  getProjectedSkillInstanceById: vi.fn(),
  saveSkillInstanceVersion: vi.fn(),
  toggleSkillInstanceVersionState: vi.fn(),
  previewSkillInstanceFamilyTargets: vi.fn(),
  applySkillInstanceToFamily: vi.fn(),
}));

vi.mock('../../src/core/skill-domain/projector.js', () => ({
  projectSkillDomain: mocks.projectSkillDomain,
  getProjectedSkillInstanceById: mocks.getProjectedSkillInstanceById,
}));

vi.mock('../../src/dashboard/services/skill-instance-version-service.js', () => ({
  saveSkillInstanceVersion: mocks.saveSkillInstanceVersion,
  toggleSkillInstanceVersionState: mocks.toggleSkillInstanceVersionState,
  previewSkillInstanceFamilyTargets: mocks.previewSkillInstanceFamilyTargets,
  applySkillInstanceToFamily: mocks.applySkillInstanceToFamily,
}));

describe('dashboard project skill instance routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handles GET /api/projects/:id/skill-groups', async () => {
    const { handleProjectSkillInstanceRoutes } = await import('../../src/dashboard/routes/project-skill-instance-routes.js');
    const json = vi.fn();
    mocks.projectSkillDomain.mockReturnValue({
      skillGroups: [{ familyId: 'family-1', familyName: 'demo-skill' }],
      instances: [],
    });

    const handled = await handleProjectSkillInstanceRoutes({
      subPath: '/skill-groups',
      method: 'GET',
      projectPath: '/tmp/demo',
      url: new URL('http://127.0.0.1/api/projects/demo/skill-groups'),
      json,
      parseBody: vi.fn(),
      notFound: vi.fn(),
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    });

    expect(handled).toBe(true);
    expect(json).toHaveBeenCalledWith({ skillGroups: [{ familyId: 'family-1', familyName: 'demo-skill' }] });
  });

  it('handles GET /api/projects/:id/skill-instances/:instanceId', async () => {
    const { handleProjectSkillInstanceRoutes } = await import('../../src/dashboard/routes/project-skill-instance-routes.js');
    const json = vi.fn();
    mocks.getProjectedSkillInstanceById.mockReturnValue({ instanceId: 'instance-1', familyId: 'family-1' });

    const handled = await handleProjectSkillInstanceRoutes({
      subPath: '/skill-instances/instance-1',
      method: 'GET',
      projectPath: '/tmp/demo',
      url: new URL('http://127.0.0.1/api/projects/demo/skill-instances/instance-1'),
      json,
      parseBody: vi.fn(),
      notFound: vi.fn(),
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    });

    expect(handled).toBe(true);
    expect(mocks.getProjectedSkillInstanceById).toHaveBeenCalledWith('/tmp/demo', 'instance-1');
    expect(json).toHaveBeenCalledWith({ instance: { instanceId: 'instance-1', familyId: 'family-1' } });
  });

  it('handles PUT /api/projects/:id/skill-instances/:instanceId', async () => {
    const { handleProjectSkillInstanceRoutes } = await import('../../src/dashboard/routes/project-skill-instance-routes.js');
    const json = vi.fn();
    mocks.saveSkillInstanceVersion.mockReturnValue({
      ok: true,
      version: 3,
      metadata: { version: 3 },
      deployedPath: '/tmp/demo/.ornn/shadows/codex/demo-skill.md',
      instance: { instanceId: 'instance-1', skillId: 'demo-skill', runtime: 'codex' },
    });

    const handled = await handleProjectSkillInstanceRoutes({
      subPath: '/skill-instances/instance-1',
      method: 'PUT',
      projectPath: '/tmp/demo',
      url: new URL('http://127.0.0.1/api/projects/demo/skill-instances/instance-1'),
      json,
      parseBody: vi.fn().mockResolvedValue({ content: '# updated skill' }),
      notFound: vi.fn(),
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    });

    expect(handled).toBe(true);
    expect(mocks.saveSkillInstanceVersion).toHaveBeenCalledWith(expect.objectContaining({
      projectPath: '/tmp/demo',
      instanceId: 'instance-1',
      content: '# updated skill',
    }));
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, instanceId: 'instance-1', version: 3 }));
  });

  it('handles PATCH /api/projects/:id/skill-instances/:instanceId/versions/:v', async () => {
    const { handleProjectSkillInstanceRoutes } = await import('../../src/dashboard/routes/project-skill-instance-routes.js');
    const json = vi.fn();
    mocks.toggleSkillInstanceVersionState.mockReturnValue({
      ok: true,
      version: 2,
      disabled: true,
      effectiveVersion: 1,
      metadata: { version: 2, isDisabled: true },
      instance: { instanceId: 'instance-1', skillId: 'demo-skill', runtime: 'codex' },
    });

    const handled = await handleProjectSkillInstanceRoutes({
      subPath: '/skill-instances/instance-1/versions/2',
      method: 'PATCH',
      projectPath: '/tmp/demo',
      url: new URL('http://127.0.0.1/api/projects/demo/skill-instances/instance-1/versions/2'),
      json,
      parseBody: vi.fn().mockResolvedValue({ disabled: true }),
      notFound: vi.fn(),
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    });

    expect(handled).toBe(true);
    expect(mocks.toggleSkillInstanceVersionState).toHaveBeenCalledWith(expect.objectContaining({
      projectPath: '/tmp/demo',
      instanceId: 'instance-1',
      version: 2,
      disabled: true,
    }));
    expect(json).toHaveBeenCalledWith(expect.objectContaining({
      ok: true,
      instanceId: 'instance-1',
      version: 2,
      effectiveVersion: 1,
    }));
  });

  it('handles GET /api/projects/:id/skill-instances/:instanceId/apply-preview', async () => {
    const { handleProjectSkillInstanceRoutes } = await import('../../src/dashboard/routes/project-skill-instance-routes.js');
    const json = vi.fn();
    mocks.previewSkillInstanceFamilyTargets.mockReturnValue({
      instance: { instanceId: 'instance-1', familyId: 'family-1' },
      totalTargets: 2,
      targets: [{ instanceId: 'instance-2' }, { instanceId: 'instance-3' }],
    });

    const handled = await handleProjectSkillInstanceRoutes({
      subPath: '/skill-instances/instance-1/apply-preview',
      method: 'GET',
      projectPath: '/tmp/demo',
      url: new URL('http://127.0.0.1/api/projects/demo/skill-instances/instance-1/apply-preview'),
      json,
      parseBody: vi.fn(),
      notFound: vi.fn(),
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    });

    expect(handled).toBe(true);
    expect(mocks.previewSkillInstanceFamilyTargets).toHaveBeenCalledWith({
      projectPath: '/tmp/demo',
      instanceId: 'instance-1',
    });
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ totalTargets: 2 }));
  });

  it('handles POST /api/projects/:id/skill-instances/:instanceId/apply-to-family', async () => {
    const { handleProjectSkillInstanceRoutes } = await import('../../src/dashboard/routes/project-skill-instance-routes.js');
    const json = vi.fn();
    mocks.applySkillInstanceToFamily.mockReturnValue({
      ok: true,
      instance: { instanceId: 'instance-1', familyId: 'family-1' },
      source: { saved: true, version: 3 },
      totalTargets: 2,
      updatedTargets: 1,
      skippedTargets: 1,
      failedTargets: 0,
    });

    const handled = await handleProjectSkillInstanceRoutes({
      subPath: '/skill-instances/instance-1/apply-to-family',
      method: 'POST',
      projectPath: '/tmp/demo',
      url: new URL('http://127.0.0.1/api/projects/demo/skill-instances/instance-1/apply-to-family'),
      json,
      parseBody: vi.fn().mockResolvedValue({ content: '# updated skill' }),
      notFound: vi.fn(),
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    });

    expect(handled).toBe(true);
    expect(mocks.applySkillInstanceToFamily).toHaveBeenCalledWith(expect.objectContaining({
      projectPath: '/tmp/demo',
      instanceId: 'instance-1',
      content: '# updated skill',
    }));
    expect(json).toHaveBeenCalledWith(expect.objectContaining({
      ok: true,
      instanceId: 'instance-1',
      totalTargets: 2,
      updatedTargets: 1,
    }));
  });
});