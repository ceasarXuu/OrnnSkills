import { join, resolve, relative, dirname, basename, extname } from 'node:path';
import { existsSync, statSync } from 'node:fs';
import { homedir } from 'node:os';

/**
 * 验证 skill ID 是否安全（防止路径遍历攻击）
 */
export function validateSkillId(skillId: string): boolean {
  // 只允许字母、数字、连字符、下划线、点号
  // 不能包含 .. 或 / 或 \
  if (!skillId || skillId.length > 100) {
    return false;
  }
  if (skillId.includes('..') || skillId.includes('/') || skillId.includes('\\')) {
    return false;
  }
  return /^[a-zA-Z0-9_.-]+$/.test(skillId);
}

/**
 * 清理 skill ID，移除危险字符
 */
export function sanitizeSkillId(skillId: string): string {
  // 移除所有非安全字符
  const sanitized = skillId.replace(/[^a-zA-Z0-9_.-]/g, '');
  // 防止空字符串
  return sanitized || 'default';
}

/**
 * 验证并清理 skill ID，如果无效则抛出错误
 */
export function assertValidSkillId(skillId: string): void {
  if (!validateSkillId(skillId)) {
    throw new Error(`Invalid skill ID: "${skillId}". Skill IDs can only contain letters, numbers, hyphens, underscores, and dots.`);
  }
}

import { realpathSync } from 'node:fs';
import { sep } from 'node:path';

/**
 * 展开路径中的 ~ 为用户主目录（带安全验证）
 */
export function expandHome(path: string): string {
  let expanded = path;
  if (path.startsWith('~/') || path === '~') {
    expanded = path.replace('~', homedir());
  }
  
  // 规范化路径
  const normalized = resolve(expanded);
  
  // 验证路径安全性（防止路径遍历）
  if (normalized.includes('..')) {
    throw new Error('Path traversal detected: path contains ".."');
  }
  
  return normalized;
}

/**
 * 验证项目路径是否安全（防止路径遍历攻击）
 */
export function validateProjectPath(projectPath: string): string {
  // 先检查输入是否包含 ..
  if (projectPath.includes('..')) {
    throw new Error('Path traversal detected: path contains ".."');
  }
  
  // 解析为绝对路径
  const resolved = resolve(projectPath);
  
  // 解析符号链接获取真实路径
  let realPath: string;
  try {
    realPath = realpathSync(resolved);
  } catch (error) {
    throw new Error(`Invalid path: ${projectPath}`);
  }
  
  const cwd = realpathSync(process.cwd());
  
  // 检查真实路径是否在 cwd 下
  if (!realPath.startsWith(cwd + sep) && realPath !== cwd) {
    throw new Error('Project path must be within current directory');
  }
  
  return realPath;
}

/**
 * 获取项目的 .ornn 目录路径
 */
export function getEvoDir(projectRoot: string): string {
  return join(projectRoot, '.ornn');
}

/**
 * 获取项目的 skills 目录路径
 */
export function getSkillsDir(projectRoot: string): string {
  return join(projectRoot, '.ornn', 'skills');
}

/**
 * 获取项目的 state 目录路径
 */
export function getStateDir(projectRoot: string): string {
  return join(projectRoot, '.ornn', 'state');
}

/**
 * 获取项目的 config 目录路径
 */
export function getConfigDir(projectRoot: string): string {
  return join(projectRoot, '.ornn', 'config');
}

/**
 * 获取某个 skill 的 current.md 路径
 */
export function getSkillCurrentPath(projectRoot: string, skillId: string): string {
  return join(projectRoot, '.ornn', 'skills', skillId, 'current.md');
}

/**
 * 获取某个 skill 的 meta.json 路径
 */
export function getSkillMetaPath(projectRoot: string, skillId: string): string {
  return join(projectRoot, '.ornn', 'skills', skillId, 'meta.json');
}

/**
 * 获取某个 skill 的 journal.ndjson 路径
 */
export function getSkillJournalPath(projectRoot: string, skillId: string): string {
  return join(projectRoot, '.ornn', 'skills', skillId, 'journal.ndjson');
}

/**
 * 获取某个 skill 的 snapshots 目录路径
 */
export function getSkillSnapshotsDir(projectRoot: string, skillId: string): string {
  return join(projectRoot, '.ornn', 'skills', skillId, 'snapshots');
}

/**
 * 获取 shadow skill 的路径（别名）
 */
export function getShadowSkillPath(projectRoot: string, skillId: string): string {
  return getSkillCurrentPath(projectRoot, skillId);
}

/**
 * 获取 shadow meta 的路径（别名）
 */
export function getShadowMetaPath(projectRoot: string, skillId: string): string {
  return getSkillMetaPath(projectRoot, skillId);
}

/**
 * 获取 shadow journal 的路径（别名）
 */
export function getShadowJournalPath(projectRoot: string, skillId: string): string {
  return getSkillJournalPath(projectRoot, skillId);
}

/**
 * 获取 snapshots 目录（别名）
 */
export function getSnapshotsDir(projectRoot: string, skillId: string): string {
  return getSkillSnapshotsDir(projectRoot, skillId);
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