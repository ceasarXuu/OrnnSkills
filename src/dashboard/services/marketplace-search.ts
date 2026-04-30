export interface MarketplaceSource {
  repo: string;
  skill: string;
  url: string;
}

export interface MarketplaceResult {
  found: boolean;
  source?: MarketplaceSource;
  content?: string;
}

interface MarketplaceLogger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

/**
 * Strip ANSI escape codes from a string.
 */
function stripAnsi(input: string): string {
  // eslint-disable-next-line no-control-regex
  return input.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
}

/**
 * Parse `npx skills find` output and extract the first `owner/repo@skill` match.
 * Skips instruction/template lines (e.g. "Install with npx skills add <owner/repo@skill>").
 */
function parseSkillsFindOutput(raw: string): { owner: string; repo: string; skill: string } | null {
  const cleaned = stripAnsi(raw);
  // Only match lines that contain an install count (e.g. "65.1K installs"),
  // which are actual results — not the instruction template line.
  const lines = cleaned.split('\n');
  for (const line of lines) {
    if (!line.includes('installs')) continue;
    const match = line.match(/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)@([A-Za-z0-9_.:-]+)/);
    if (match) {
      const [owner, repo] = match[1].split('/');
      return { owner, repo, skill: match[2] };
    }
  }
  return null;
}

interface GithubContentEntry {
  name: string;
  path: string;
  type: string;
}

/**
 * Fetch the SKILL.md content from a GitHub repository.
 * Tries to find the matching skill directory under `skills/`.
 */
async function fetchSkillFromGithub(
  owner: string,
  repo: string,
  skillId: string,
  logger: MarketplaceLogger,
): Promise<{ dir: string; content: string } | null> {
  // List the skills/ directory
  const listUrl = `https://api.github.com/repos/${owner}/${repo}/contents/skills`;
  const listResponse = await fetch(listUrl, {
    headers: { Accept: 'application/vnd.github.v3+json', 'User-Agent': 'ornn-skills-dashboard' },
  });
  if (!listResponse.ok) {
    logger.warn('Marketplace GitHub directory listing failed', {
      owner,
      repo,
      status: listResponse.status,
    });
    return null;
  }

  const entries = (await listResponse.json()) as GithubContentEntry[];
  const dirs = entries.filter((e) => e.type === 'dir');

  // Try exact match first, then partial match
  const matched =
    dirs.find((d) => d.name === skillId) ??
    dirs.find((d) => d.name.includes(skillId) || skillId.includes(d.name));
  if (!matched) {
    logger.info('Marketplace skill directory not found in repo', {
      owner,
      repo,
      skillId,
      availableDirs: dirs.map((d) => d.name),
    });
    return null;
  }

  const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/HEAD/skills/${matched.name}/SKILL.md`;
  const contentResponse = await fetch(rawUrl, {
    headers: { 'User-Agent': 'ornn-skills-dashboard' },
  });
  if (!contentResponse.ok) {
    logger.warn('Marketplace SKILL.md fetch failed', {
      owner,
      repo,
      dir: matched.name,
      status: contentResponse.status,
    });
    return null;
  }

  const content = await contentResponse.text();
  logger.info('Marketplace skill content fetched', {
    owner,
    repo,
    dir: matched.name,
    contentLength: content.length,
  });
  return { dir: matched.name, content };
}

/**
 * Search the marketplace for a skill by ID.
 *
 * 1. Runs `npx skills find <skillId>` to locate the skill in the marketplace index.
 * 2. Fetches the SKILL.md content from the matched GitHub repo.
 */
export async function searchMarketplace(
  skillId: string,
  logger: MarketplaceLogger,
): Promise<MarketplaceResult> {
  // Step 1: Run `npx skills find` (lazy import to avoid breaking tests that mock node:child_process)
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const execFileAsync = promisify(execFile);

  let raw: string;
  try {
    const { stdout } = await execFileAsync('npx', ['skills', 'find', skillId], {
      timeout: 30_000,
      env: { ...process.env, NO_COLOR: '1' },
    });
    raw = stdout;
  } catch (error) {
    logger.warn('Marketplace npx skills find failed', {
      skillId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { found: false };
  }

  // Step 2: Parse output
  const parsed = parseSkillsFindOutput(raw);
  if (!parsed) {
    logger.info('Marketplace no match in skills find output', { skillId });
    return { found: false };
  }

  // Step 3: Fetch from GitHub
  const result = await fetchSkillFromGithub(parsed.owner, parsed.repo, parsed.skill, logger);
  if (!result) {
    return { found: false };
  }

  logger.info('Marketplace skill found', {
    skillId,
    repo: `${parsed.owner}/${parsed.repo}`,
    skill: result.dir,
  });

  return {
    found: true,
    source: {
      repo: `${parsed.owner}/${parsed.repo}`,
      skill: result.dir,
      url: `https://github.com/${parsed.owner}/${parsed.repo}/tree/HEAD/skills/${result.dir}`,
    },
    content: result.content,
  };
}
