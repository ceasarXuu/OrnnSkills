import { getDashboardHtml } from '../ui.js';
import type { Language } from '../i18n.js';

interface DashboardV3DocumentResponse {
  body: string;
  hasBuild: boolean;
}

interface DashboardV3DocumentOptions {
  buildId?: string;
  lang?: Language;
  requestPath?: string;
}

export function isDashboardV3DocumentRequest(requestPath: string): boolean {
  return (
    requestPath === '/v3' ||
    requestPath === '/v3/' ||
    requestPath === '/v3/skills' ||
    requestPath === '/v3/skills/' ||
    requestPath === '/v3/project' ||
    requestPath === '/v3/project/' ||
    requestPath === '/v3/config' ||
    requestPath === '/v3/config/'
  );
}

function resolveDashboardV3RequestedMainTab(
  requestPath: string,
): 'skills' | 'project' | 'config' {
  if (requestPath === '/v3/config' || requestPath === '/v3/config/') {
    return 'config';
  }

  if (requestPath === '/v3/project' || requestPath === '/v3/project/') {
    return 'project';
  }

  return 'skills';
}

export function getDashboardV3DocumentResponse(
  options: DashboardV3DocumentOptions = {},
): DashboardV3DocumentResponse {
  const requestPath = options.requestPath || '/v3/skills';
  const lang = options.lang || 'en';
  const buildId = options.buildId || 'dev';

  return {
    body: getDashboardHtml(0, lang, buildId, {
      requestedMainTab: resolveDashboardV3RequestedMainTab(requestPath),
    }),
    hasBuild: true,
  };
}

export function resolveDashboardV3StaticAsset(
  _requestPath: string,
): null {
  return null;
}
