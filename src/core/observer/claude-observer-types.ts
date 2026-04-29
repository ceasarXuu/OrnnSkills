/**
 * Claude Observer — Types
 *
 * Extracted from claude-observer.ts to keep individual files under the
 * 500-line policy.
 */

/**
 * Claude Code 原始事件类型
 */
export interface ClaudeRawEvent {
  type: string;
  timestamp: string;
  sessionId: string;
  uuid?: string;
  parentUuid?: string | null;
  cwd?: string;
  gitBranch?: string;
  version?: string;
  message?: {
    role: string;
    content: string | Array<{ type: string; text?: string }>;
  };
  error?: string;
  isApiErrorMessage?: boolean;
  summary?: string;
  leafUuid?: string;
  operation?: string;
  [key: string]: unknown;
}

/**
 * 文件读取位置跟踪
 */
export interface FilePosition {
  path: string;
  lastPosition: number;
  lastModified: number;
}
