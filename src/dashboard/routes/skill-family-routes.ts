import {
  aggregateSkillFamilies,
  readAggregateSkillFamiliesSignature,
  readSkillFamilyById,
  readSkillFamilyInstances,
  readSkillFamilySignature,
} from '../../core/skill-domain/projector.js';
import { listProjects } from '../projects-registry.js';

interface SkillFamilyRouteContext {
  path: string;
  method: string;
  json: (data: unknown, status?: number) => void;
  jsonWithEtag?: (data: unknown, etag: string, status?: number) => void;
  respondNotModified?: (etag: string) => boolean;
  notFound: () => void;
}

function listProjectPaths(): string[] {
  return listProjects().map((project) => project.path);
}

export function handleSkillFamilyRoutes(context: SkillFamilyRouteContext): boolean {
  const { path, method, json, jsonWithEtag, respondNotModified, notFound } = context;

  function sendJsonWithOptionalEtag(data: unknown, etag: string) {
    if (respondNotModified?.(etag)) {
      return;
    }
    if (jsonWithEtag) {
      jsonWithEtag(data, etag);
      return;
    }
    json(data);
  }

  if (path === '/api/skills/families' && method === 'GET') {
    const projectPaths = listProjectPaths();
    const etag = readAggregateSkillFamiliesSignature(projectPaths);
    sendJsonWithOptionalEtag({ families: aggregateSkillFamilies(projectPaths) }, etag);
    return true;
  }

  const familyInstancesMatch = path.match(/^\/api\/skills\/families\/([^/]+)\/instances$/);
  if (familyInstancesMatch && method === 'GET') {
    const projectPaths = listProjectPaths();
    const familyId = decodeURIComponent(familyInstancesMatch[1]);
    const etag = readSkillFamilySignature(projectPaths, familyId);
    sendJsonWithOptionalEtag({ instances: readSkillFamilyInstances(projectPaths, familyId) }, etag);
    return true;
  }

  const familyMatch = path.match(/^\/api\/skills\/families\/([^/]+)$/);
  if (familyMatch && method === 'GET') {
    const projectPaths = listProjectPaths();
    const familyId = decodeURIComponent(familyMatch[1]);
    const family = readSkillFamilyById(projectPaths, familyId);
    if (!family) {
      notFound();
      return true;
    }
    sendJsonWithOptionalEtag({ family }, readSkillFamilySignature(projectPaths, familyId));
    return true;
  }

  return false;
}
