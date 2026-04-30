/**
 * Skill inference helpers
 *
 * Extracted from src/core/trace-skill-mapper/index.ts.  These functions are
 * stateless aside from a `knownSkills` map that the caller supplies, so they
 * can be unit-tested without instantiating the full TraceSkillMapper class.
 */
import type { OriginSkill, Trace } from '../../types/index.js';

const SKILL_PATH_PATTERNS = [
  /\.skills\/([^/]+)\//,
  /\.claude\/skills\/([^/]+)\//,
  /\.opencode\/skills\/([^/]+)\//,
  /\.ornn\/skills\/([^/]+)\//,
];

const MAX_TEXT_INFERENCE_LENGTH = 5000;

export function extractSkillIdFromPath(filePath: string): string | null {
  for (const pattern of SKILL_PATH_PATTERNS) {
    const match = filePath.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
}

export function extractSkillFromCommand(
  command: string,
  knownSkills: Map<string, OriginSkill>,
): string | null {
  for (const [skillId] of knownSkills) {
    if (command.toLowerCase().includes(skillId.toLowerCase())) {
      return skillId;
    }
  }
  return null;
}

export function inferSkillFromToolCall(
  trace: Trace,
  knownSkills: Map<string, OriginSkill>,
): string | null {
  let normalizedArgs: Record<string, unknown> = {};
  if (trace.tool_args && typeof trace.tool_args === 'string') {
    try {
      normalizedArgs = JSON.parse(trace.tool_args) as Record<string, unknown>;
    } catch {
      normalizedArgs = {};
    }
  } else if (trace.tool_args && typeof trace.tool_args === 'object') {
    normalizedArgs = trace.tool_args;
  }

  if (normalizedArgs.skill_id) {
    return normalizedArgs.skill_id as string;
  }

  if (
    trace.tool_name === 'execute_command' ||
    trace.tool_name === 'exec_command' ||
    trace.tool_name === 'functions.exec_command'
  ) {
    const command = (normalizedArgs.command as string) ?? (normalizedArgs.cmd as string);
    if (command) {
      const skillId = extractSkillFromCommand(command, knownSkills);
      if (skillId) return skillId;
    }
  }

  return null;
}

export function inferSkillFromOutput(
  output: string,
  knownSkills: Map<string, OriginSkill>,
): string | null {
  if (output.length > MAX_TEXT_INFERENCE_LENGTH) return null;

  const lowerOutput = output.toLowerCase();
  for (const [skillId] of knownSkills) {
    const lowerSkillId = skillId.toLowerCase();

    if (lowerOutput.indexOf(lowerSkillId) !== -1) {
      return skillId;
    }

    const skillPatterns = [
      `skill: ${lowerSkillId}`,
      `skill:${lowerSkillId}`,
      `according to ${lowerSkillId}`,
      `using ${lowerSkillId}`,
    ];

    for (const pattern of skillPatterns) {
      if (lowerOutput.indexOf(pattern) !== -1) {
        return skillId;
      }
    }
  }
  return null;
}

export function inferSkillFromInput(
  input: string,
  knownSkills: Map<string, OriginSkill>,
): string | null {
  if (input.length > MAX_TEXT_INFERENCE_LENGTH) return null;

  const lowerInput = input.toLowerCase();
  for (const [skillId] of knownSkills) {
    const lowerSkillId = skillId.toLowerCase();

    const requestPatterns = [
      `use ${lowerSkillId}`,
      `run ${lowerSkillId}`,
      `apply ${lowerSkillId}`,
      `execute ${lowerSkillId}`,
      `with ${lowerSkillId}`,
      `using ${lowerSkillId}`,
    ];

    for (const pattern of requestPatterns) {
      if (lowerInput.indexOf(pattern) !== -1) {
        return skillId;
      }
    }
  }
  return null;
}
