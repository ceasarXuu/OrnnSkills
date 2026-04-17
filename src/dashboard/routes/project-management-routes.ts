interface RouteLogger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

interface ProjectRouteState {
  path: string;
  name?: string;
  monitoringState?: 'active' | 'paused';
  pausedAt?: string | null;
  isPaused?: boolean;
  isRunning?: boolean;
  skillCount?: number;
}

interface ProjectMonitoringResult extends ProjectRouteState {
  path: string;
}

interface OnboardedProject {
  projectPath: string;
  initialized: boolean;
  daemonStarted: boolean;
  daemonRunning: boolean;
}

interface ProjectManagementRouteContext {
  path: string;
  method: string;
  projectPath?: string;
  subPath?: string;
  json: (data: unknown, status?: number) => void;
  parseBody: () => Promise<unknown>;
  getProjectsWithStatus: () => ProjectRouteState[];
  onboardProjectForMonitoring: (projectPath: string, name?: string) => Promise<OnboardedProject>;
  pickProjectDirectory: () => Promise<string | null | undefined>;
  setProjectMonitoringState: (
    projectPath: string,
    monitoringState: 'active' | 'paused'
  ) => ProjectMonitoringResult | null;
  readGlobalLogs: (limit: number) => unknown[];
  logger: RouteLogger;
}

export async function handleProjectManagementRoutes(
  context: ProjectManagementRouteContext
): Promise<boolean> {
  const {
    path,
    method,
    projectPath,
    subPath,
    json,
    parseBody,
    getProjectsWithStatus,
    onboardProjectForMonitoring,
    pickProjectDirectory,
    setProjectMonitoringState,
    readGlobalLogs,
    logger,
  } = context;

  if (path === '/api/projects' && method === 'GET') {
    json({ projects: getProjectsWithStatus() });
    return true;
  }

  if (path === '/api/projects/pick' && method === 'POST') {
    try {
      logger.info('Opening native project picker');
      const selectedProjectPath = await pickProjectDirectory();
      if (!selectedProjectPath) {
        logger.info('Native project picker cancelled');
        json({ ok: false, cancelled: true });
        return true;
      }

      const onboarding = await onboardProjectForMonitoring(selectedProjectPath);
      logger.info('Native project picker selected project', {
        projectPath: onboarding.projectPath,
        source: 'api.projects.pick',
        initialized: onboarding.initialized,
        daemonStarted: onboarding.daemonStarted,
      });
      json({
        ok: true,
        path: onboarding.projectPath,
        initialized: onboarding.initialized,
        daemonStarted: onboarding.daemonStarted,
        daemonRunning: onboarding.daemonRunning,
        projects: getProjectsWithStatus(),
      });
    } catch (error) {
      logger.error('Native project picker failed', { error: String(error) });
      json({ ok: false, error: String(error) }, 500);
    }
    return true;
  }

  if (path === '/api/projects' && method === 'POST') {
    try {
      const body = (await parseBody()) as { path?: string; name?: string };
      if (!body.path) {
        json({ ok: false, error: 'path is required' }, 400);
        return true;
      }

      const onboarding = await onboardProjectForMonitoring(body.path, body.name);
      logger.debug('Initialized project dashboard language', {
        projectPath: onboarding.projectPath,
        source: 'api.projects.add',
      });
      json({
        ok: true,
        path: onboarding.projectPath,
        initialized: onboarding.initialized,
        daemonStarted: onboarding.daemonStarted,
        daemonRunning: onboarding.daemonRunning,
        projects: getProjectsWithStatus(),
      });
    } catch (error) {
      json({ ok: false, error: String(error) }, 400);
    }
    return true;
  }

  if (path === '/api/logs' && method === 'GET') {
    json({ lines: readGlobalLogs(200) });
    return true;
  }

  if (projectPath && subPath === '/monitoring' && method === 'PATCH') {
    const body = (await parseBody()) as { paused?: unknown };
    if (typeof body.paused !== 'boolean') {
      json({ ok: false, error: 'paused must be a boolean' }, 400);
      return true;
    }

    const nextState = body.paused ? 'paused' : 'active';
    const updatedProject = setProjectMonitoringState(projectPath, nextState);
    if (!updatedProject) {
      json({ ok: false, error: 'project not found' }, 404);
      return true;
    }

    logger.info('Dashboard project monitoring state updated', {
      projectPath,
      monitoringState: nextState,
    });

    const projects = getProjectsWithStatus();
    const project = projects.find((entry) => entry.path === projectPath) ?? {
      ...updatedProject,
      isPaused: nextState === 'paused',
      isRunning: false,
      skillCount: 0,
    };
    json({
      ok: true,
      project,
      projects,
    });
    return true;
  }

  return false;
}
