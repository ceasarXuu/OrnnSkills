import { BaseStrategy } from '../base-strategy.js';
import { createUnifiedDiff } from '../../../utils/diff.js';
import type { PatchResult } from '../../../types/index.ts';

/**
 * Tighten Trigger 策略
 * 收紧触发条件，减少误触发
 */
export class TightenTriggerStrategy extends BaseStrategy {
  constructor() {
    super(
      'tighten-trigger',
      'Tighten trigger conditions to reduce false positives',
      'tighten_trigger'
    );
  }

  generate(currentContent: string, context: Record<string, unknown>): PatchResult {
    try {
      const pattern = context.pattern as string;
      const reason = context.reason as string;

      // 解析文件结构
      const lines = currentContent.split('\n');
      
      // 查找 Trigger section
      const triggerSection = this.findTriggerSection(lines);
      
      if (!triggerSection.found) {
        return this.createFailureResult('No trigger section found in skill file');
      }

      // 生成更精确的触发条件
      const tightenedCondition = this.tightenCondition(
        triggerSection.content,
        pattern,
        reason
      );

      // 替换原有的触发条件
      const newLines = [
        ...lines.slice(0, triggerSection.startIndex),
        ...tightenedCondition,
        ...lines.slice(triggerSection.endIndex),
      ];

      const newContent = newLines.join('\n');
      const patch = createUnifiedDiff('skill.md', currentContent, newContent);

      return this.createSuccessResult(patch, newContent);
    } catch (error) {
      return this.createFailureResult(`Failed to generate patch: ${error}`);
    }
  }

  /**
   * 查找 Trigger section
   */
  private findTriggerSection(lines: string[]): {
    found: boolean;
    startIndex: number;
    endIndex: number;
    content: string[];
  } {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim().toLowerCase();
      if (line.startsWith('## trigger') || line.startsWith('## triggers')) {
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
        };
      }
    }

    return { found: false, startIndex: -1, endIndex: -1, content: [] };
  }

  /**
   * 收紧触发条件
   */
  private tightenCondition(
    originalContent: string[],
    falsePositivePattern: string,
    reason: string
  ): string[] {
    const result: string[] = [];
    let inTriggerList = false;

    for (const line of originalContent) {
      result.push(line);

      // 检测是否进入触发条件列表
      if (line.trim().startsWith('-') || line.trim().startsWith('*')) {
        inTriggerList = true;
      }

      // 在触发条件后添加排除条件
      if (inTriggerList && !line.trim().startsWith('-') && !line.trim().startsWith('*') && line.trim() !== '') {
        // 列表结束，添加排除条件
        result.push('');
        result.push('<!-- OrnnSkills: Auto-added exclusions -->');
        result.push('**Exclusions** (do NOT trigger when):');
        result.push(`- Pattern: "${falsePositivePattern}"`);
        if (reason) {
          result.push(`- Reason: ${reason}`);
        }
        result.push('- Any similar variations of the above pattern');
        result.push('');
        
        inTriggerList = false;
      }
    }

    // 如果列表一直延续到末尾
    if (inTriggerList) {
      result.push('');
      result.push('<!-- OrnnSkills: Auto-added exclusions -->');
      result.push('**Exclusions** (do NOT trigger when):');
      result.push(`- Pattern: "${falsePositivePattern}"`);
      if (reason) {
        result.push(`- Reason: ${reason}`);
      }
      result.push('- Any similar variations of the above pattern');
      result.push('');
    }

    return result;
  }
}