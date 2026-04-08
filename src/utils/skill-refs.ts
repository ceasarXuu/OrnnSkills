/**
 * Skill Reference Extraction Utilities
 *
 * 统一提取技能引用格式：[$skill-name] 和 @skill-name
 */

// Code keywords to filter out from @mentions
const CODE_KEYWORDS = new Set([
  'dataclass',
  'prisma',
  'staticmethod',
  'classmethod',
  'property',
  'app',
  'tool',
  'decorator',
  'abstractmethod',
  'cached_property',
  'contextmanager',
  'lru_cache',
  'overload',
  'override',
]);

// Minimum skill name length
const MIN_SKILL_LENGTH = 2;

function extractSkillRefsFromPathText(text: string): string[] {
  const refs: string[] = [];
  const pathPatterns = [
    /(?:^|[/\\])\.agents[/\\]skills[/\\]([\w-]+)[/\\]SKILL\.md\b/gi,
    /(?:^|[/\\])\.codex[/\\]skills[/\\](?:[^/\\]+[/\\])?([\w-]+)[/\\]SKILL\.md\b/gi,
    /(?:^|[/\\])\.claude[/\\]skills[/\\]([\w-]+)[/\\](?:SKILL\.md|skill\.md)\b/gi,
    /(?:^|[/\\])\.skills[/\\]([\w-]+)[/\\](?:current\.md|SKILL\.md|skill\.md)\b/gi,
  ];

  for (const pattern of pathPatterns) {
    for (const match of text.matchAll(pattern)) {
      const skillId = match[1];
      if (skillId) {
        refs.push(skillId);
      }
    }
  }

  return refs;
}

/**
 * Extract skill references from text
 * Supports: [$skill-name] and @skill-name formats
 *
 * @param text - Text to extract from
 * @returns Array of unique skill IDs
 */
export function extractSkillRefs(text: string): string[] {
  const refs: string[] = [];

  // Match [$skill-name] format
  const bracketMatches = text.match(/\[\$([\w-]+)\]/g);
  if (bracketMatches) {
    refs.push(...bracketMatches.map((m) => m.slice(2, -1)));
  }

  // Match @skill-name format
  const atMatches = text.match(/@([\w-]+)/g);
  if (atMatches) {
    const filteredMatches = atMatches
      .map((m) => m.slice(1))
      .filter((m) => !CODE_KEYWORDS.has(m.toLowerCase()) && m.length > MIN_SKILL_LENGTH);
    refs.push(...filteredMatches);
  }

  refs.push(...extractSkillRefsFromPathText(text));

  return [...new Set(refs)]; // Remove duplicates
}

/**
 * Extract skill references from multiple text sources
 *
 * @param sources - Array of text sources (strings or objects)
 * @returns Array of unique skill IDs
 */
export function extractSkillRefsFromSources(sources: (string | object | undefined)[]): string[] {
  const allRefs: string[] = [];

  for (const source of sources) {
    if (!source) continue;

    const text = typeof source === 'string' ? source : JSON.stringify(source);
    const refs = extractSkillRefs(text);
    allRefs.push(...refs);
  }

  return [...new Set(allRefs)];
}

/**
 * Extract skill references from a Trace object
 *
 * @param trace - Trace object to extract from
 * @returns Array of unique skill IDs
 */
export function extractSkillRefsFromTrace(trace: {
  user_input?: string;
  assistant_output?: string;
  tool_name?: string;
  tool_args?: unknown;
}): string[] {
  const sources: (string | object | undefined)[] = [
    trace.user_input,
    trace.assistant_output,
  ];

  // Include tool args if it's a skill invocation
  if (trace.tool_name === 'skill_invocation' && trace.tool_args) {
    sources.push(trace.tool_args);
  }

  return extractSkillRefsFromSources(sources);
}

/**
 * Check if text contains skill reference
 *
 * @param text - Text to check
 * @param skillId - Skill ID to look for
 * @returns True if skill is referenced
 */
export function hasSkillRef(text: string, skillId: string): boolean {
  const refs = extractSkillRefs(text);
  return refs.includes(skillId);
}

/**
 * Format skill reference for display
 *
 * @param skillId - Skill ID
 * @param format - Format style ('bracket' or 'at')
 * @returns Formatted skill reference
 */
export function formatSkillRef(skillId: string, format: 'bracket' | 'at' = 'bracket'): string {
  return format === 'bracket' ? `[$${skillId}]` : `@${skillId}`;
}
