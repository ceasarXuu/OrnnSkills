import { createChildLogger } from '../../utils/logger.js';
import { configManager } from '../../config/index.js';
import { BaseStrategy } from './base-strategy.js';
import { AddFallbackStrategy } from './strategies/add-fallback.js';
import { PruneNoiseStrategy } from './strategies/prune-noise.js';
import type { PatchResult, ChangeType } from '../../types/index.js';

const logger = createChildLogger('patch-generator');

/**
 * Patch Generator
 * 负责生成具体的 patch
 */
export class PatchGenerator {
  private strategies: Map<ChangeType, BaseStrategy> = new Map();

  constructor() {
    this.registerDefaultStrategies();
  }

  /**
   * 注册默认策略
   */
  private registerDefaultStrategies(): void {
    this.registerStrategy(new AddFallbackStrategy());
    this.registerStrategy(new PruneNoiseStrategy());
    logger.info('Default patch strategies registered');
  }

  /**
   * 注册策略
   */
  registerStrategy(strategy: BaseStrategy): void {
    this.strategies.set(strategy.getChangeType(), strategy);
    logger.info(`Strategy registered: ${strategy.getName()}`);
  }

  /**
   * 生成 patch
   */
  generate(
    changeType: ChangeType,
    currentContent: string,
    context: Record<string, unknown>
  ): PatchResult {
    const strategy = this.strategies.get(changeType);

    if (!strategy) {
      logger.warn(`No strategy found for change type: ${changeType}`);
      return {
        success: false,
        patch: '',
        newContent: '',
        changeType,
        error: `No strategy found for change type: ${changeType}`,
      };
    }

    // 检查是否允许此类型的 patch
    const allowedTypes = configManager.getPatchConfig().allowed_types;
    if (!allowedTypes.includes(changeType)) {
      logger.warn(`Change type ${changeType} is not allowed`);
      return {
        success: false,
        patch: '',
        newContent: '',
        changeType,
        error: `Change type ${changeType} is not allowed`,
      };
    }

    logger.debug(`Generating patch with strategy: ${strategy.getName()}`);

    try {
      const result = strategy.generate(currentContent, context);

      if (result.success) {
        logger.info(`Patch generated successfully`, {
          strategy: strategy.getName(),
          changeType,
        });
      } else {
        logger.warn(`Patch generation failed`, {
          strategy: strategy.getName(),
          error: result.error,
        });
      }

      return result;
    } catch (error) {
      logger.error(`Strategy execution failed`, { error });
      return {
        success: false,
        patch: '',
        newContent: '',
        changeType,
        error: `Strategy execution failed: ${error}`,
      };
    }
  }

  /**
   * 获取所有策略
   */
  getStrategies(): BaseStrategy[] {
    return Array.from(this.strategies.values());
  }

  /**
   * 检查是否支持某个变更类型
   */
  supportsChangeType(changeType: ChangeType): boolean {
    return this.strategies.has(changeType);
  }
}

// 导出单例实例
export const patchGenerator = new PatchGenerator();