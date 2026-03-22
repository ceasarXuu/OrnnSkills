import { BaseStrategy } from '../base-strategy.js';
import { createUnifiedDiff } from '../../../utils/diff.js';
import type { PatchResult } from '../../../types/index.ts';

/**
 * Append Context 策略
 * 在 skill 文件中追加上下文信息
 */
export class AppendContextStrategy extends BaseStrategy {
  constructor() {
    super(
      'append-context',
      'Append context information to skill file',
      'append_context'
    );
  }

  generate(currentContent: string, context: Record<string, unknown>): PatchResult {
    try {
      const pattern = context.pattern as string;
      const reason = context.reason as string;

      if (!pattern) {
        return this.createFailureResult('Pattern not provided');
      }

      // 解析文件结构
      const lines = currentContent.split('\n');
      
      // 查找插入点：优先在 ## Context 后，否则在文件末尾
      let insertIndex = this.findContextSection(lines);
      
      // 如果没有 Context section，创建一个
      const needsContextSection = insertIndex === -1;
      
      if (needsContextSection) {
        // 在 ## Examples 或 ## Instructions 后插入，或在文件末尾
        insertIndex = this.findInsertPoint(lines);
      }

      // 构建要追加的上下文内容
      const contextLines = this.buildContextContent(pattern, reason, needsContextSection);

      // 插入内容
      const newLines = [
        ...lines.slice(0, insertIndex),
        ...contextLines,
        ...lines.slice(insertIndex),
      ];

      const newContent = newLines.join('\n');
      const patch = createUnifiedDiff('skill.md', currentContent, newContent);

      return this.createSuccessResult(patch, newContent);
    } catch (error) {
      return this.createFailureResult(`Failed to generate patch: ${error}`);
    }
  }

  /**
   * 查找 Context section 的位置
   */
  private findContextSection(lines: string[]): number {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim().toLowerCase();
      if (line.startsWith('## context') || line.startsWith('## additional context')) {
        // 找到 section 结尾
        let j = i + 1;
        while (j < lines.length && !lines[j].trim().startsWith('##')) {
          j++;
        }
        return j; // 在 section 结尾插入
      }
    }
    return -1;
  }

  /**
   * 查找合适的插入点
   */
  private findInsertPoint(lines: string[]): number {
    // 优先级：Examples > Instructions > 文件末尾
    const sectionPriorities = ['examples', 'instructions', 'usage'];
    
    for (const section of sectionPriorities) {
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i].trim().toLowerCase();
        if (line.startsWith(`## ${section}`)) {
          // 找到下一个 section 或文件末尾
          let j = i + 1;
          while (j < lines.length && !lines[j].trim().startsWith('##')) {
            j++;
          }
          return j;
        }
      }
    }

    // 默认在文件末尾
    return lines.length;
  }

  /**
   * 构建上下文内容
   */
  private buildContextContent(pattern: string, reason: string, needsSection: boolean): string[] {
    const lines: string[] = [];

    if (needsSection) {
      lines.push('');
      lines.push('## Context');
      lines.push('');
    }

    // 添加上下文条目
    lines.push(`<!-- OrnnSkills: Auto-appended context -->`);
    lines.push(`**Pattern**: ${pattern}`);
    
    if (reason) {
      lines.push(`**Reason**: ${reason}`);
    }

    // 添加建议的处理方式
    lines.push('');
    lines.push('**When to apply**:');
    lines.push(`- When the agent output matches: "${pattern}"`);
    lines.push('- When similar patterns appear in user input');
    
    lines.push('');

    return lines;
  }
}