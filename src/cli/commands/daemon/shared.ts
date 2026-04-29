/**
 * Shared types & utilities for `ornn daemon` subcommands.
 *
 * Extracted from src/cli/commands/daemon.ts to keep individual command
 * factories under the 500-line policy.
 */
import { resolve } from 'node:path';
import { listProjects } from '../../../dashboard/projects-registry.js';
import { normalizeDashboardLang } from '../../lib/daemon-helpers.js';

export const DEFAULT_DASHBOARD_PORT = 47432;

export interface DaemonOptions {
  project: string;
  dashboard: boolean;
  port: string;
  lang: string;
  background: boolean;
  open: boolean;
}

export function resolveLaunchContext(projectPath: string): string {
  return resolve(projectPath);
}

export function getRegisteredProjectRoots(): string[] {
  return listProjects().map((project) => resolve(project.path));
}

export function getRegisteredProjectRootsOrThrow(): string[] {
  const projectRoots = getRegisteredProjectRoots();
  if (projectRoots.length === 0) {
    throw new Error(
      'No initialized projects found. Run "ornn init" in at least one project first.'
    );
  }
  return projectRoots;
}

export function buildArgs(options: DaemonOptions): string[] {
  const args: string[] = [];
  const dashboardLang = normalizeDashboardLang(options.lang);
  if (options.dashboard === false) args.push('--no-dashboard');
  if (options.port) args.push('--port', options.port);
  if (options.lang) args.push('--lang', dashboardLang);
  if (options.open === false) args.push('--no-open');
  if (options.background) args.push('--background');
  return args;
}
