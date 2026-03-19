import { BaseStrategy } from '../base-strategy.js';
import { createUnifiedDiff } from '../../../utils/diff.js';
import type { PatchResult } from '../../../types/index.js';

/**
 * Prune Noise 策略
 * 删除被忽略的冗余说明
 */
export class PruneNoiseStrategy extends BaseStrategy {
  constructor() {
    super(
      'prune-noise',
      'Remove redundant or ignored instructions',
      'prune_noise'
    );
  }

  generate(currentContent: string, context: Record<string, unknown>): PatchResult {
    try {
      const section = context.section as string;

      if (!section) {
        return this.createFailureResult('Section not provided');
      }

      // 查找要删除的 section
      const lines = currentContent.split('\n');
      const sectionIndex = lines.findIndex((line) =>
        line.toLowerCase().includes(section.toLowerCase())
      );

      if (sectionIndex === -1) {
        return this.createFailureResult(`Section "${section}" not found`);
      }

      // 找到 section 的结束位置
      let endIndex = sectionIndex + 1;
      const sectionLevel = lines[sectionIndex]?.match(/^(#{1,6})/)?.[1]?.length ?? 0;

      while (endIndex < lines.length) {
        const line = lines[endIndex];
        const match = line?.match(/^(#{1,6})\s/);

        if (match && match[1].length <= sectionLevel) {
          break;
        }

        endIndex++;
      }

      // 删除 section
      const newLines = [
        ...lines.slice(0, sectionIndex),
        ...lines.slice(endIndex),
      ];

      const newContent = newLines.join('\n');
      const patch = createUnifiedDiff('skill.md', currentContent, newContent);

      return this.createSuccessResult(patch, newContent);
    } catch (error) {
      return this.createFailureResult(`Failed to generate patch: ${error}`);
    }
  }
}