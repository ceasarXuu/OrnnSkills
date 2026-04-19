import { existsSync, lstatSync, readdirSync, readlinkSync, statSync } from 'node:fs';
import { join } from 'node:path';

export function readFileSignature(filePath: string): string {
  if (!existsSync(filePath)) return 'missing';
  try {
    const stat = statSync(filePath);
    return `${stat.size}:${Math.floor(stat.mtimeMs)}`;
  } catch {
    return 'error';
  }
}

export function collectDirectoryContentSignature(path: string): string {
  if (!existsSync(path)) return 'missing';

  const entries: string[] = [];
  const walk = (currentPath: string, relativePath: string) => {
    let stats;
    try {
      stats = lstatSync(currentPath);
    } catch {
      return;
    }

    if (stats.isSymbolicLink()) {
      let target = '';
      try {
        target = readlinkSync(currentPath);
      } catch {
        target = 'unreadable';
      }
      entries.push(`${relativePath}:link:${target}`);
      return;
    }

    if (stats.isFile()) {
      entries.push(`${relativePath}:${stats.size}:${Math.floor(stats.mtimeMs)}`);
      return;
    }

    if (!stats.isDirectory()) {
      return;
    }

    let children = [] as Array<{ name: string }>;
    try {
      children = readdirSync(currentPath, { withFileTypes: true });
    } catch {
      return;
    }

    const sortedChildren = children.slice().sort((left, right) => left.name.localeCompare(right.name));
    for (const child of sortedChildren) {
      walk(join(currentPath, child.name), relativePath ? `${relativePath}/${child.name}` : child.name);
    }
  };

  walk(path, '');
  return entries.join(',');
}

export function collectSkillVersionTreeSignature(path: string): string {
  if (!existsSync(path)) return 'missing';

  const entries: string[] = [];
  const walk = (currentPath: string, relativePath: string) => {
    let stats;
    try {
      stats = lstatSync(currentPath);
    } catch {
      return;
    }

    if (stats.isSymbolicLink()) {
      let target = '';
      try {
        target = readlinkSync(currentPath);
      } catch {
        target = 'unreadable';
      }
      entries.push(`${relativePath}:link:${target}`);
      return;
    }

    if (!stats.isDirectory()) {
      return;
    }

    let children = [] as Array<{ name: string; isDirectory: () => boolean; isSymbolicLink: () => boolean }>;
    try {
      children = readdirSync(currentPath, { withFileTypes: true });
    } catch {
      return;
    }

    const relevantChildren = children
      .filter((child) => child.isDirectory() || child.isSymbolicLink())
      .sort((left, right) => left.name.localeCompare(right.name));

    if (relativePath) {
      entries.push(`${relativePath}:children:${relevantChildren.map((child) => child.name).join('|')}`);
    }

    for (const child of relevantChildren) {
      walk(join(currentPath, child.name), relativePath ? `${relativePath}/${child.name}` : child.name);
    }
  };

  walk(path, '');
  return entries.join(',');
}

export function readSkillDomainSourceSignature(projectPath: string): string {
  const stateDir = join(projectPath, '.ornn', 'state');
  const traceSignatures = existsSync(stateDir)
    ? readdirSync(stateDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.ndjson'))
      .filter((entry) => entry.name !== 'decision-events.ndjson' && entry.name !== 'agent-usage.ndjson')
      .map((entry) => `${entry.name}:${readFileSignature(join(stateDir, entry.name))}`)
      .sort()
      .join(',')
    : 'missing';

  return [
    collectDirectoryContentSignature(join(projectPath, '.ornn', 'shadows')),
    collectDirectoryContentSignature(join(projectPath, '.ornn', 'skills')),
    traceSignatures || 'missing',
    readFileSignature(join(stateDir, 'agent-usage.ndjson')),
    readFileSignature(join(stateDir, 'agent-usage-summary.json')),
  ].join('|');
}