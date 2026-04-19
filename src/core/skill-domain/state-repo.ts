import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ProjectSkillDomainProjection } from '../../types/index.js';

const PROJECTION_FILE_NAME = 'skill-domain-projection.json';

export function getSkillDomainProjectionPath(projectPath: string): string {
  return join(projectPath, '.ornn', 'state', PROJECTION_FILE_NAME);
}

export function readStoredSkillDomainProjection(projectPath: string): ProjectSkillDomainProjection | null {
  const filePath = getSkillDomainProjectionPath(projectPath);
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(filePath, 'utf-8')) as ProjectSkillDomainProjection;
  } catch {
    return null;
  }
}

export function writeStoredSkillDomainProjection(
  projectPath: string,
  projection: ProjectSkillDomainProjection
): void {
  const filePath = getSkillDomainProjectionPath(projectPath);
  mkdirSync(join(projectPath, '.ornn', 'state'), { recursive: true });
  const content = JSON.stringify(projection, null, 2);
  if (existsSync(filePath)) {
    try {
      const current = readFileSync(filePath, 'utf-8');
      if (current === content) {
        return;
      }
    } catch {
      // Fall through to rewrite.
    }
  }
  writeFileSync(filePath, content, 'utf-8');
}
