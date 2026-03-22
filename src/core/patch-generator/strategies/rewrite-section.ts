import { BaseStrategy } from '../base-strategy.js';
import { createUnifiedDiff } from '../../../utils/diff.js';
import type { PatchResult } from '../../../types/index.ts';

/**
 * Rewrite Section 策略
 * 重写 skill 文件中的特定段落
 */
export class RewriteSectionStrategy extends BaseStrategy {
  constructor() {
    super(
      'rewrite-section',
      'Rewrite a specific section of the skill file',
      'rewrite_section'
    );
  }

  generate(currentContent: string, context: Record<string, unknown>): PatchResult {
    try {
      const pattern = context.pattern as string;
      const reason = context.reason as string;
      const section = context.section as string;

      // 解析文件结构
      const lines = currentContent.split('\n');
      
      // 查找问题段落
      const problemSection = this.identifyProblemSection(lines, pattern, section);
      
      if (!problemSection.found) {
        return this.createFailureResult('Could not identify problem section');
      }

      // 生成改进版本
      const improvedContent = this.generateImprovedVersion(
        problemSection.content,
        pattern,
        reason
      );

      // 替换原有段落
      const newLines = [
        ...lines.slice(0, problemSection.startIndex),
        ...improvedContent,
        ...lines.slice(problemSection.endIndex),
      ];

      const newContent = newLines.join('\n');
      const patch = createUnifiedDiff('skill.md', currentContent, newContent);

      return this.createSuccessResult(patch, newContent);
    } catch (error) {
      return this.createFailureResult(`Failed to generate patch: ${error}`);
    }
  }

  /**
   * 识别问题段落
   */
  private identifyProblemSection(
    lines: string[],
    pattern: string,
    targetSection?: string
  ): {
    found: boolean;
    startIndex: number;
    endIndex: number;
    content: string[];
    sectionName: string;
  } {
    // 如果指定了目标 section，直接查找
    if (targetSection) {
      const section = this.findSectionByName(lines, targetSection);
      if (section.found) {
        return section;
      }
    }

    // 否则查找包含 pattern 的段落
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(pattern)) {
        // 向上找到 section 开头
        let start = i;
        while (start > 0 && !lines[start].trim().startsWith('##')) {
          start--;
        }

        // 向下找到 section 结尾
        let end = start + 1;
        while (end < lines.length && !lines[end].trim().startsWith('##')) {
          end++;
        }

        // 提取 section 名称
        const sectionName = lines[start].trim().replace(/^##\s*/, '');

        return {
          found: true,
          startIndex: start,
          endIndex: end,
          content: lines.slice(start, end),
          sectionName,
        };
      }
    }

    return { found: false, startIndex: -1, endIndex: -1, content: [], sectionName: '' };
  }

  /**
   * 按名称查找 section
   */
  private findSectionByName(
    lines: string[],
    sectionName: string
  ): {
    found: boolean;
    startIndex: number;
    endIndex: number;
    content: string[];
    sectionName: string;
  } {
    const normalizedName = sectionName.toLowerCase().trim();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim().toLowerCase();
      if (line.startsWith('##') && line.includes(normalizedName)) {
        // 找到 section 结尾
        let j = i + 1;
        while (j < lines.length && !lines[j].trim().startsWith('##')) {
          j++;
        }

        return {
          found: true,
          startIndex: i,
          endIndex: j,
          content: lines.slice(i, j),
          sectionName: lines[i].trim().replace(/^##\s*/, ''),
        };
      }
    }

    return { found: false, startIndex: -1, endIndex: -1, content: [], sectionName: '' };
  }

  /**
   * 生成改进版本
   */
  private generateImprovedVersion(
    originalContent: string[],
    problemPattern: string,
    reason: string
  ): string[] {
    const result: string[] = [];

    // 保留 section 标题
    if (originalContent.length > 0) {
      result.push(originalContent[0]); // ## Section Title
    }

    // 添加改进说明
    result.push('');
    result.push('<!-- OrnnSkills: Auto-rewritten section -->');
    result.push(`**Improvement**: ${reason}`);
    result.push('');

    // 处理原有内容
    for (let i = 1; i < originalContent.length; i++) {
      const line = originalContent[i];
      
      // 跳过包含问题模式的行
      if (line.includes(problemPattern)) {
        // 添加改进后的版本
        result.push(this.improveLine(line, problemPattern));
      } else {
        result.push(line);
      }
    }

    // 如果内容太少，添加通用指导
    if (originalContent.length <= 3) {
      result.push('');
      result.push('**Guidelines**:');
      result.push('- Be specific and unambiguous');
      result.push('- Include clear examples');
      result.push('- Handle edge cases explicitly');
      result.push('');
    }

    return result;
  }

  /**
   * 改进行内容
   */
  private improveLine(line: string, pattern: string): string {
    // 简单的改进逻辑：添加更明确的说明
    const improved = line.replace(
      pattern,
      `${pattern} (with explicit validation)`
    );
    return improved;
  }
}