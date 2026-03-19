import { BaseStrategy } from '../base-strategy.js';
import { createUnifiedDiff } from '../../../utils/diff.js';
import type { PatchResult } from '../../../types/index.js';

/**
 * Add Fallback 策略
 * 在相关步骤后添加 fallback 说明
 */
export class AddFallbackStrategy extends BaseStrategy {
  constructor() {
    super(
      'add-fallback',
      'Add fallback instructions after relevant steps',
      'add_fallback'
    );
  }

  generate(currentContent: string, context: Record<string, unknown>): PatchResult {
    try {
      const pattern = context.pattern as string;
      const reason = context.reason as string;

      if (!pattern) {
        return this.createFailureResult('Pattern not provided');
      }

      // 查找插入点（在文件末尾或特定 section 后）
      const lines = currentContent.split('\n');
      let insertIndex = lines.length;

      // 尝试找到 "## Fallback" 或类似的 section
      for (let i = 0; i < lines.length; i++) {
        if (lines[i]?.toLowerCase().includes('fallback') ||
            lines[i]?.toLowerCase().includes('error handling')) {
          // 在这个 section 后插入
          insertIndex = i + 1;
          while (insertIndex < lines.length && lines[insertIndex]?.startsWith('-')) {
            insertIndex++;
          }
          break;
        }
      }

      // 创建新的 fallback 内容
      const fallbackContent = [
        '',
        `## Additional Fallback`,
        '',
        `- If the agent output does not include "${pattern}", manually add it`,
        `- Reason: ${reason}`,
        '',
      ];

      // 插入内容
      const newLines = [
        ...lines.slice(0, insertIndex),
        ...fallbackContent,
        ...lines.slice(insertIndex),
      ];

      const newContent = newLines.join('\n');
      const patch = createUnifiedDiff('skill.md', currentContent, newContent);

      return this.createSuccessResult(patch, newContent);
    } catch (error) {
      return this.createFailureResult(`Failed to generate patch: ${error}`);
    }
  }
}