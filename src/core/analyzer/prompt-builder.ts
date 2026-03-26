/**
 * Prompt Builder
 *
 * 构建 LLM Analyzer 的 prompt，包括：
 * - Skill 内容
 * - Trace 上下文
 * - 优化指令
 */

import type { Trace } from '../../types/index.js';

export interface PromptContext {
  skillId: string;
  skillContent: string;
  currentVersion: number;
  traces: Trace[];
  previousVersions?: Array<{
    version: number;
    reason: string;
    improvements: string[];
  }>;
}

export interface AnalysisPrompt {
  systemPrompt: string;
  userPrompt: string;
}

/**
 * Build analysis prompt for skill optimization
 */
export function buildAnalysisPrompt(context: PromptContext): AnalysisPrompt {
  const systemPrompt = `You are an expert skill optimization analyzer for AI coding assistants.

Your task is to analyze a skill's usage traces and suggest improvements to make the skill more effective.

## Analysis Guidelines

1. **Identify Gaps**: Look for patterns where the skill didn't fully meet user needs
2. **Edge Cases**: Find scenarios that weren't covered by the current skill
3. **Clarity**: Check if instructions are clear and unambiguous
4. **Completeness**: Ensure all necessary context is provided
5. **Practicality**: Verify examples are realistic and helpful

## Output Format

You must respond with a JSON object in this exact format:

{\n  "analysis": {\n    "summary": "Brief summary of what you found",\n    "strengths": ["List of current strengths"],\n    "weaknesses": ["List of areas for improvement"],\n    "missingScenarios": ["Scenarios not covered"],\n    "userPainPoints": ["Issues users encountered"]\n  },\n  "suggestions": [\n    {\n      "type": "add|modify|clarify|remove",\n      "section": "Which section to change",\n      "description": "What to change",\n      "rationale": "Why this change helps",\n      "priority": "high|medium|low"\n    }\n  ],\n  "improvedSkill": "The complete improved skill content in markdown format",\n  "confidence": 0.85\n}

## Rules

- Only modify the existing skill, do not create new skills
- Preserve the skill's core purpose and approach
- Ensure all changes are justified by the traces
- Maintain consistent formatting and style
- Confidence should reflect how certain you are about the improvements`;

  const userPrompt = `## Skill Information

**Skill ID**: ${context.skillId}
**Current Version**: v${context.currentVersion}

## Current Skill Content

\`\`\`markdown
${context.skillContent}
\`\`\`

## Usage Traces

${formatTraces(context.traces)}

${formatPreviousVersions(context.previousVersions)}

## Analysis Request

Please analyze the traces to understand how this skill is being used and what improvements would make it more effective.

Focus on:
1. What users are trying to accomplish with this skill
2. Where the current skill falls short
3. What edge cases or scenarios are missing
4. How to make instructions clearer and more actionable

Provide your analysis and the improved skill content in the JSON format specified in your instructions.`;

  return { systemPrompt, userPrompt };
}

// Maximum traces to include in prompt to avoid exceeding context limits
const MAX_TRACES_IN_PROMPT = 10;
// Maximum characters per trace section
const MAX_TRACE_LENGTH = 500;

/**
 * Format traces for prompt
 */
function formatTraces(traces: Trace[]): string {
  if (traces.length === 0) {
    return 'No traces available.';
  }

  // Limit traces to prevent prompt from becoming too long
  const limitedTraces = traces.slice(-MAX_TRACES_IN_PROMPT);
  const omittedCount = traces.length - limitedTraces.length;

  const formatted = limitedTraces
    .map((trace, index) => {
      const parts: string[] = [`### Trace ${index + 1}`];
      
      if (trace.user_input) {
        parts.push(`**User**: ${truncate(trace.user_input, MAX_TRACE_LENGTH)}`);
      }
      
      if (trace.assistant_output) {
        parts.push(`**Assistant**: ${truncate(trace.assistant_output, MAX_TRACE_LENGTH)}`);
      }
      
      if (trace.tool_name) {
        parts.push(`**Tool**: ${trace.tool_name}`);
        if (trace.tool_result !== undefined) {
          parts.push(`**Result**: ${truncate(JSON.stringify(trace.tool_result), MAX_TRACE_LENGTH)}`);
        }
      }
      
      if (trace.metadata?.projectPath) {
        parts.push(`**Context**: ${trace.metadata.projectPath}`);
      }

      return parts.join('\n');
    })
    .join('\n\n');

  if (omittedCount > 0) {
    return `${formatted}\n\n*(${omittedCount} older traces omitted for brevity)*`;
  }

  return formatted;
}

/**
 * Truncate text to max length with ellipsis
 */
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength) + '...';
}

/**
 * Format previous versions for prompt
 */
function formatPreviousVersions(versions?: PromptContext['previousVersions']): string {
  if (!versions || versions.length === 0) {
    return '';
  }

  const parts = ['## Previous Optimization History\n'];
  
  for (const version of versions.slice(-3)) {
    parts.push(`### v${version.version}`);
    parts.push(`**Reason**: ${version.reason}`);
    parts.push(`**Improvements**: ${version.improvements.join(', ')}`);
    parts.push('');
  }

  return parts.join('\n');
}

/**
 * Build prompt for incremental analysis (when only a few new traces are available)
 */
export function buildIncrementalPrompt(
  context: PromptContext,
  previousAnalysis: string
): AnalysisPrompt {
  const basePrompt = buildAnalysisPrompt(context);
  
  const incrementalInstructions = `

## Previous Analysis

The following analysis was done previously. Focus on the new traces and see if they reveal any new issues or confirm previous findings.

${previousAnalysis}

## Incremental Analysis Instructions

1. Review the previous analysis
2. Check if new traces confirm or contradict previous findings
3. Identify any NEW issues that weren't apparent before
4. Suggest updates to the skill based on new evidence
5. Maintain consistency with previous improvements unless new evidence suggests otherwise`;

  return {
    systemPrompt: basePrompt.systemPrompt,
    userPrompt: basePrompt.userPrompt + incrementalInstructions,
  };
}
