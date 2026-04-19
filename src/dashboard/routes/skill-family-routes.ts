import { aggregateSkillFamilies, readSkillFamilyById, readSkillFamilyInstances } from '../../core/skill-domain/projector.js';
import { listProjects } from '../projects-registry.js';

interface SkillFamilyRouteContext {
  path: string;
  method: string;
  json: (data: unknown, status?: number) => void;
  notFound: () => void;
}

function listProjectPaths(): string[] {
  return listProjects().map((project) => project.path);
}

export async function handleSkillFamilyRoutes(context: SkillFamilyRouteContext): Promise<boolean> {
  const { path, method, json, notFound } = context;

  if (path === '/api/skills/families' && method === 'GET') {
    json({ families: aggregateSkillFamilies(listProjectPaths()) });
    return true;
  }

  const familyInstancesMatch = path.match(/^\/api\/skills\/families\/([^/]+)\/instances$/);
  if (familyInstancesMatch && method === 'GET') {
    const familyId = decodeURIComponent(familyInstancesMatch[1]);
    json({ instances: readSkillFamilyInstances(listProjectPaths(), familyId) });
    return true;
  }

  const familyMatch = path.match(/^\/api\/skills\/families\/([^/]+)$/);
  if (familyMatch && method === 'GET') {
    const familyId = decodeURIComponent(familyMatch[1]);
    const family = readSkillFamilyById(listProjectPaths(), familyId);
    if (!family) {
      notFound();
      return true;
    }
    json({ family });
    return true;
  }

  return false;
}
