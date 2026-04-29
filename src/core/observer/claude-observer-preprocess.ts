/**
 * Claude Observer — Preprocessing helpers
 *
 * Extracted from claude-observer.ts to keep individual files under the
 * 500-line policy. These helpers are pure and don't depend on the observer
 * instance, so they can be unit-tested independently.
 */
import type { PreprocessedTrace, Trace, TraceStatus } from '../../types/index.js';
import type { ClaudeRawEvent } from './claude-observer-types.js';

/**
 * 提取消息内容
 */
export function extractMessageContent(content: unknown): string {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    // 处理 Claude 的内容数组格式
    const textParts: string[] = [];
    for (const part of content as Array<string | { type?: string; text?: unknown }>) {
      if (typeof part === 'string') {
        textParts.push(part);
      } else if (part?.type === 'text' && typeof part.text === 'string') {
        textParts.push(part.text);
      }
    }
    return textParts.join('\n');
  }

  return JSON.stringify(content);
}

/**
 * 提取 skill 引用
 * 格式: [$skillname] 或 @skillname
 */
export function extractSkillReferences(text: string): string[] {
  const refs: string[] = [];

  // 匹配 [$skillname] 格式
  const bracketMatches = text.match(/\[\$([^\]]+)\]/g);
  if (bracketMatches) {
    refs.push(...bracketMatches.map((match) => match.slice(2, -1)));
  }

  // 匹配 @skillname 格式（Claude 可能使用的格式）
  // 支持连字符，如 @business-opportunity-assessment
  // 注意：过滤掉代码中的装饰器（如 @dataclass, @prisma 等）
  const atMatches = text.match(/@([\w-]+)/g);
  if (atMatches) {
    const codeKeywords = [
      'dataclass',
      'prisma',
      'staticmethod',
      'classmethod',
      'property',
      'app',
      'tool',
    ];
    const filteredMatches = atMatches
      .map((match) => match.slice(1))
      .filter((match) => !codeKeywords.includes(match.toLowerCase()) && match.length > 2);
    refs.push(...filteredMatches);
  }

  return [...new Set(refs)]; // 去重
}

/**
 * 预处理用户输入事件
 */
export function preprocessUserEvent(
  sessionId: string,
  turnId: string,
  timestamp: string,
  event: ClaudeRawEvent,
): PreprocessedTrace {
  const content = extractMessageContent(event.message?.content);
  const skillRefs = extractSkillReferences(content);

  return {
    sessionId,
    turnId,
    timestamp,
    eventType: 'user_input',
    content,
    projectContext: {
      cwd: event.cwd ?? '',
      gitBranch: event.gitBranch,
    },
    skillRefs,
    metadata: {
      uuid: event.uuid,
      version: event.version,
    },
  };
}

/**
 * 预处理助手输出事件
 */
export function preprocessAssistantEvent(
  sessionId: string,
  turnId: string,
  timestamp: string,
  event: ClaudeRawEvent,
): PreprocessedTrace {
  const content = extractMessageContent(event.message?.content);
  const skillRefs = extractSkillReferences(content);

  return {
    sessionId,
    turnId,
    timestamp,
    eventType: 'assistant_output',
    content,
    projectContext: {
      cwd: event.cwd ?? '',
      gitBranch: event.gitBranch,
    },
    skillRefs,
    metadata: {
      uuid: event.uuid,
      parentUuid: event.parentUuid,
      error: event.error,
      isApiErrorMessage: event.isApiErrorMessage,
      version: event.version,
    },
  };
}

/**
 * 把预处理 trace 转换为标准 Trace 结构
 */
export function convertToStandardTrace(preprocessed: PreprocessedTrace): Trace {
  const base = {
    trace_id: `${preprocessed.sessionId}_${preprocessed.turnId}`,
    runtime: 'claude' as const,
    session_id: preprocessed.sessionId,
    turn_id: preprocessed.turnId,
    event_type: preprocessed.eventType,
    timestamp: preprocessed.timestamp,
    skill_refs: preprocessed.skillRefs,
    status: 'success' as TraceStatus,
  };

  switch (preprocessed.eventType) {
    case 'user_input':
      return {
        ...base,
        user_input: preprocessed.content as string,
      };

    case 'assistant_output':
      return {
        ...base,
        assistant_output: preprocessed.content as string,
      };

    case 'tool_call': {
      const toolContent = preprocessed.content as { tool: string; args: Record<string, unknown> };
      return {
        ...base,
        tool_name: toolContent.tool,
        tool_args: toolContent.args,
      };
    }

    case 'tool_result': {
      const resultContent = preprocessed.content as { output: Record<string, unknown> };
      return {
        ...base,
        tool_result: resultContent.output,
      };
    }

    case 'file_change':
      return {
        ...base,
        files_changed: preprocessed.content as string[],
      };

    case 'status':
    default:
      return base;
  }
}
