export function extractJsonObject(raw: string): string | null {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    const candidate = fenced[1].trim();
    if (isValidJsonObject(candidate)) return candidate;
  }

  const exact = raw.match(/^\s*(\{[\s\S]*\})\s*$/);
  if (exact && isValidJsonObject(exact[1])) {
    return exact[1];
  }

  const candidates = collectBalancedJsonObjects(raw);
  for (const candidate of candidates.sort((a, b) => b.length - a.length)) {
    if (isValidJsonObject(candidate)) return candidate;
  }

  return null;
}

function isValidJsonObject(candidate: string): boolean {
  try {
    const parsed = JSON.parse(candidate);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed);
  } catch {
    return false;
  }
}

function collectBalancedJsonObjects(raw: string): string[] {
  const candidates: string[] = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < raw.length; index++) {
    const char = raw[index];

    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) {
      continue;
    }
    if (char === '{') {
      if (depth === 0) start = index;
      depth += 1;
      continue;
    }
    if (char === '}') {
      if (depth === 0) continue;
      depth -= 1;
      if (depth === 0 && start >= 0) {
        candidates.push(raw.slice(start, index + 1));
        start = -1;
      }
    }
  }

  return candidates;
}
