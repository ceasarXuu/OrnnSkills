import { addProject } from '../projects-registry.js';
import { writeProjectLanguage } from '../language-state.js';
import { ensureMonitoringDaemon, ensureProjectInitialized } from '../project-onboarding.js';
import type { Language } from '../i18n.js';

interface OnboardingLogger {
  info(message: string, meta?: Record<string, unknown>): void;
}

interface OnboardProjectParams {
  projectPath: string;
  name?: string;
  currentLang: Language;
  logger: OnboardingLogger;
}

export async function onboardProjectForMonitoring(params: OnboardProjectParams) {
  const { projectPath, name, currentLang, logger } = params;
  const initialization = await ensureProjectInitialized(projectPath);
  addProject(initialization.projectPath, name);
  await writeProjectLanguage(initialization.projectPath, currentLang);
  const monitoring = await ensureMonitoringDaemon(initialization.projectPath);

  logger.info('Project onboarded for dashboard monitoring', {
    projectPath: initialization.projectPath,
    initialized: initialization.initialized,
    daemonStarted: monitoring.daemonStarted,
    daemonRunning: monitoring.daemonRunning,
    source: 'dashboard.project_onboarding',
  });

  return {
    projectPath: initialization.projectPath,
    initialized: initialization.initialized,
    daemonStarted: monitoring.daemonStarted,
    daemonRunning: monitoring.daemonRunning,
  };
}
