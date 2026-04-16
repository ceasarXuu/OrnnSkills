/**
 * Projects Registry
 *
 * 全局项目注册表，管理所有已初始化 ornn 的项目路径。
 * 存储在 ~/.ornn/projects.json
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, basename, resolve } from 'node:path';
import { homedir } from 'node:os';

export type ProjectMonitoringState = 'active' | 'paused';

export interface RegisteredProject {
  path: string;
  name: string;
  registeredAt: string;
  lastSeenAt: string;
  monitoringState?: ProjectMonitoringState;
  pausedAt?: string | null;
}

export interface ProjectsRegistry {
  projects: RegisteredProject[];
}

function normalizeProjectPath(projectPath: string): string {
  return resolve(projectPath);
}

function getGlobalOrnnDir(): string {
  return join(homedir(), '.ornn');
}

function getProjectsFilePath(): string {
  return join(getGlobalOrnnDir(), 'projects.json');
}

function normalizeProject(project: RegisteredProject): RegisteredProject {
  const monitoringState: ProjectMonitoringState =
    project.monitoringState === 'paused' ? 'paused' : 'active';

  return {
    ...project,
    monitoringState,
    pausedAt: monitoringState === 'paused' ? project.pausedAt ?? null : null,
  };
}

function readRegistry(): ProjectsRegistry {
  const projectsFile = getProjectsFilePath();
  if (!existsSync(projectsFile)) {
    return { projects: [] };
  }
  try {
    const raw = readFileSync(projectsFile, 'utf-8');
    const parsed = JSON.parse(raw) as ProjectsRegistry;
    return {
      projects: Array.isArray(parsed.projects)
        ? parsed.projects.map((project) => normalizeProject(project))
        : [],
    };
  } catch {
    return { projects: [] };
  }
}

function writeRegistry(registry: ProjectsRegistry): void {
  const globalOrnnDir = getGlobalOrnnDir();
  const projectsFile = getProjectsFilePath();
  if (!existsSync(globalOrnnDir)) {
    mkdirSync(globalOrnnDir, { recursive: true });
  }
  writeFileSync(
    projectsFile,
    JSON.stringify(
      {
        projects: registry.projects.map((project) => normalizeProject(project)),
      },
      null,
      2
    ),
    'utf-8'
  );
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
      monitoringState: 'active',
      pausedAt: null,
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
  return readRegistry().projects.map((project) => normalizeProject(project));
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
      monitoringState: 'active',
      pausedAt: null,
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

export function getProjectRegistration(projectPath: string): RegisteredProject | null {
  const normalizedPath = normalizeProjectPath(projectPath);
  const registry = readRegistry();
  const project = registry.projects.find((entry) => entry.path === normalizedPath);
  return project ? normalizeProject(project) : null;
}

export function setProjectMonitoringState(
  projectPath: string,
  monitoringState: ProjectMonitoringState
): RegisteredProject | null {
  const normalizedPath = normalizeProjectPath(projectPath);
  const registry = readRegistry();
  const project = registry.projects.find((entry) => entry.path === normalizedPath);
  if (!project) {
    return null;
  }

  project.monitoringState = monitoringState;
  project.pausedAt = monitoringState === 'paused' ? new Date().toISOString() : null;
  project.lastSeenAt = new Date().toISOString();
  writeRegistry(registry);
  return normalizeProject(project);
}
