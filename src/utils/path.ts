import { join, resolve, relative, dirname, basename, extname } from 'node:path';
import { existsSync, statSync } from 'node:fs';
import { homedir } from 'node:os';

/**
 * 展开路径中的 ~ 为用户主目录
 */
export function expandHome(path: string): string {
  if (path.startsWith('~/') || path === '~') {
    return path.replace('~', homedir());
  }
  return path;
}

/**
 * 获取项目的 .evo 目录路径
 */
export function getEvoDir(projectRoot: string): string {
  return join(projectRoot, '.evo');
}

/**
 * 获取项目的 skills 目录路径
 */
export function getSkillsDir(projectRoot: string): string {
  return join(projectRoot, '.evo', 'skills');
}

/**
 * 获取项目的 state 目录路径
 */
export function getStateDir(projectRoot: string): string {
  return join(projectRoot, '.evo', 'state');
}

/**
 * 获取项目的 config 目录路径
 */
export function getConfigDir(projectRoot: string): string {
  return join(projectRoot, '.evo', 'config');
}

/**
 * 获取 shadow skill 的路径
 */
export function getShadowSkillPath(projectRoot: string, skillId: string): string {
  return join(projectRoot, '.evo', 'skills', skillId, 'current.md');
}

/**
 * 获取 shadow skill 的 meta.json 路径
 */
export function getShadowMetaPath(projectRoot: string, skillId: string): string {
  return join(projectRoot, '.evo', 'skills', skillId, 'meta.json');
}

/**
 * 获取 shadow skill 的 journal 路径
 */
export function getShadowJournalPath(projectRoot: string, skillId: string): string {
  return join(projectRoot, '.evo', 'skills', skillId, 'journal.ndjson');
}

/**
 * 获取 shadow skill 的 snapshots 目录路径
 */
export function getSnapshotsDir(projectRoot: string, skillId: string): string {
  return join(projectRoot, '.evo', 'skills', skillId, 'snapshots');
}

/**
 * 检查路径是否存在
 */
export function pathExists(path: string): boolean {
  return existsSync(path);
}

/**
 * 检查是否是目录
 */
export function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

/**
 * 检查是否是文件
 */
export function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

/**
 * 获取相对路径
 */
export function getRelativePath(from: string, to: string): string {
  return relative(from, to);
}

/**
 * 获取文件扩展名
 */
export function getExtension(path: string): string {
  return extname(path);
}

/**
 * 获取文件名（不含扩展名）
 */
export function getFileNameWithoutExt(path: string): string {
  return basename(path, extname(path));
}

/**
 * 获取目录名
 */
export function getDirName(path: string): string {
  return dirname(path);
}

// 重新导出常用的 path 函数
export { join, resolve, relative, dirname, basename, extname };