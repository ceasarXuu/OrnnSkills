/**
 * Projects Registry
 *
 * 全局项目注册表，管理所有已初始化 ornn 的项目路径。
 * 存储在 ~/.ornn/projects.json
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, basename, resolve } from 'node:path';
import { homedir } from 'node:os';

const GLOBAL_ORNN_DIR = join(homedir(), '.ornn');
const PROJECTS_FILE = join(GLOBAL_ORNN_DIR, 'projects.json');

export interface RegisteredProject {
  path: string;
  name: string;
  registeredAt: string;
  lastSeenAt: string;
}

export interface ProjectsRegistry {
  projects: RegisteredProject[];
}

function normalizeProjectPath(projectPath: string): string {
  return resolve(projectPath);
}

function readRegistry(): ProjectsRegistry {
  if (!existsSync(PROJECTS_FILE)) {
    return { projects: [] };
  }
  try {
    const raw = readFileSync(PROJECTS_FILE, 'utf-8');
    return JSON.parse(raw) as ProjectsRegistry;
  } catch {
    return { projects: [] };
  }
}

function writeRegistry(registry: ProjectsRegistry): void {
  if (!existsSync(GLOBAL_ORNN_DIR)) {
    mkdirSync(GLOBAL_ORNN_DIR, { recursive: true });
  }
  writeFileSync(PROJECTS_FILE, JSON.stringify(registry, null, 2), 'utf-8');
}

/**
 * 注册项目到全局注册表（幂等：已存在则不重复添加）
 */
export function registerProject(projectPath: string): void {
  const normalizedPath = normalizeProjectPath(projectPath);
  const registry = readRegistry();
  const existing = registry.projects.find((p) => p.path === normalizedPath);
  const now = new Date().toISOString();

  if (existing) {
    existing.lastSeenAt = now;
  } else {
    registry.projects.push({
      path: normalizedPath,
      name: basename(normalizedPath),
      registeredAt: now,
      lastSeenAt: now,
    });
  }

  writeRegistry(registry);
}

/**
 * 更新项目的 lastSeenAt（daemon 启动时调用）
 */
export function touchProject(projectPath: string): void {
  const normalizedPath = normalizeProjectPath(projectPath);
  const registry = readRegistry();
  const existing = registry.projects.find((p) => p.path === normalizedPath);
  if (existing) {
    existing.lastSeenAt = new Date().toISOString();
    writeRegistry(registry);
  }
}

/**
 * 获取所有注册的项目
 */
export function listProjects(): RegisteredProject[] {
  return readRegistry().projects;
}

/**
 * 手动添加或移除项目
 */
export function addProject(projectPath: string, name?: string): void {
  const normalizedPath = normalizeProjectPath(projectPath);
  const registry = readRegistry();
  const existing = registry.projects.find((p) => p.path === normalizedPath);
  const now = new Date().toISOString();

  if (!existing) {
    registry.projects.push({
      path: normalizedPath,
      name: name ?? basename(normalizedPath),
      registeredAt: now,
      lastSeenAt: now,
    });
    writeRegistry(registry);
  } else if (name) {
    existing.name = name;
    existing.lastSeenAt = now;
    writeRegistry(registry);
  }
}

export function removeProject(projectPath: string): void {
  const normalizedPath = normalizeProjectPath(projectPath);
  const registry = readRegistry();
  registry.projects = registry.projects.filter((p) => p.path !== normalizedPath);
  writeRegistry(registry);
}
