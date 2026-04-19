import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  aggregateSkillFamilies: vi.fn(),
  readSkillFamilyById: vi.fn(),
  readSkillFamilyInstances: vi.fn(),
  listProjects: vi.fn(),
}));

vi.mock('../../src/core/skill-domain/projector.js', () => ({
  aggregateSkillFamilies: mocks.aggregateSkillFamilies,
  readSkillFamilyById: mocks.readSkillFamilyById,
  readSkillFamilyInstances: mocks.readSkillFamilyInstances,
}));

vi.mock('../../src/dashboard/projects-registry.js', () => ({
  listProjects: mocks.listProjects,
}));

describe('dashboard skill family routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listProjects.mockReturnValue([
      { path: '/tmp/a' },
      { path: '/tmp/b' },
    ]);
  });

  it('handles GET /api/skills/families', async () => {
    const { handleSkillFamilyRoutes } = await import('../../src/dashboard/routes/skill-family-routes.js');
    const json = vi.fn();
    const families = [{ familyId: 'family-1', familyName: 'demo-skill' }];
    mocks.aggregateSkillFamilies.mockReturnValue(families);

    const handled = await handleSkillFamilyRoutes({
      path: '/api/skills/families',
      method: 'GET',
      json,
      notFound: vi.fn(),
    });

    expect(handled).toBe(true);
    expect(mocks.aggregateSkillFamilies).toHaveBeenCalledWith(['/tmp/a', '/tmp/b']);
    expect(json).toHaveBeenCalledWith({ families });
  });

  it('handles GET /api/skills/families/:familyId', async () => {
    const { handleSkillFamilyRoutes } = await import('../../src/dashboard/routes/skill-family-routes.js');
    const json = vi.fn();
    const family = { familyId: 'family-1', familyName: 'demo-skill' };
    mocks.readSkillFamilyById.mockReturnValue(family);

    const handled = await handleSkillFamilyRoutes({
      path: '/api/skills/families/family-1',
      method: 'GET',
      json,
      notFound: vi.fn(),
    });

    expect(handled).toBe(true);
    expect(mocks.readSkillFamilyById).toHaveBeenCalledWith(['/tmp/a', '/tmp/b'], 'family-1');
    expect(json).toHaveBeenCalledWith({ family });
  });

  it('handles GET /api/skills/families/:familyId/instances', async () => {
    const { handleSkillFamilyRoutes } = await import('../../src/dashboard/routes/skill-family-routes.js');
    const json = vi.fn();
    const instances = [{ instanceId: 'instance-1', familyId: 'family-1' }];
    mocks.readSkillFamilyInstances.mockReturnValue(instances);

    const handled = await handleSkillFamilyRoutes({
      path: '/api/skills/families/family-1/instances',
      method: 'GET',
      json,
      notFound: vi.fn(),
    });

    expect(handled).toBe(true);
    expect(mocks.readSkillFamilyInstances).toHaveBeenCalledWith(['/tmp/a', '/tmp/b'], 'family-1');
    expect(json).toHaveBeenCalledWith({ instances });
  });
});