import { createChildLogger } from '../../utils/logger.js';
import { withTimeoutSync } from '../../utils/timeout.js';
import { configManager } from '../../config/index.js';
import { BaseStrategy } from './base-strategy.js';
import { AddFallbackStrategy } from './strategies/add-fallback.js';
import { PruneNoiseStrategy } from './strategies/prune-noise.js';
import { AppendContextStrategy } from './strategies/append-context.js';
import { TightenTriggerStrategy } from './strategies/tighten-trigger.js';
import { RewriteSectionStrategy } from './strategies/rewrite-section.js';
import type { PatchResult, ChangeType } from '../../types/index.js';

const logger = createChildLogger('patch-generator');

/**
 * 策略配置接口
 */
interface StrategyConfig {
  name: string;
  priority: number;
  timeout: number; // 超时时间（毫秒）
  enabled: boolean;
}

/**
 * 默认策略配置
 */
const DEFAULT_STRATEGY_CONFIGS: Record<string, StrategyConfig> = {
  'add-fallback': { name: 'add-fallback', priority: 1, timeout: 5000, enabled: true },
  'prune-noise': { name: 'prune-noise', priority: 2, timeout: 3000, enabled: true },
  'append-context': { name: 'append-context', priority: 3, timeout: 5000, enabled: true },
  'tighten-trigger': { name: 'tighten-trigger', priority: 4, timeout: 5000, enabled: true },
  'rewrite-section': { name: 'rewrite-section', priority: 5, timeout: 10000, enabled: true },
};

/**
 * Patch Generator
 * 负责生成具体的 patch
 */
export class PatchGenerator {
  private strategies: Map<ChangeType, BaseStrategy> = new Map();
  private strategyConfigs: Map<string, StrategyConfig> = new Map();

  constructor() {
    this.registerDefaultStrategies();
    this.loadStrategyConfigs();
  }

  /**
   * 注册默认策略
   */
  private registerDefaultStrategies(): void {
    this.registerStrategy(new AddFallbackStrategy());
    this.registerStrategy(new PruneNoiseStrategy());
    this.registerStrategy(new AppendContextStrategy());
    this.registerStrategy(new TightenTriggerStrategy());
    this.registerStrategy(new RewriteSectionStrategy());
    logger.debug('Default patch strategies registered');
  }

  /**
   * 加载策略配置
   */
  private loadStrategyConfigs(): void {
    // 从默认配置加载
    for (const [name, config] of Object.entries(DEFAULT_STRATEGY_CONFIGS)) {
      this.strategyConfigs.set(name, config);
    }
    logger.debug('Strategy configurations loaded');
  }

  /**
   * 注册策略
   */
  registerStrategy(strategy: BaseStrategy): void {
    this.strategies.set(strategy.getChangeType(), strategy);
    logger.debug(`Strategy registered: ${strategy.getName()}`);
  }

  /**
   * 更新策略配置
   */
  updateStrategyConfig(name: string, config: Partial<StrategyConfig>): void {
    const existing = this.strategyConfigs.get(name);
    if (existing) {
      this.strategyConfigs.set(name, { ...existing, ...config });
      logger.info(`Strategy config updated: ${name}`, config);
    } else {
      logger.warn(`Strategy config not found: ${name}`);
    }
  }

  /**
   * 获取策略配置
   */
  getStrategyConfig(name: string): StrategyConfig | undefined {
    return this.strategyConfigs.get(name);
  }

  /**
   * 生成 patch
   */
  async generate(
    changeType: ChangeType,
    currentContent: string,
    context: Record<string, unknown>
  ): Promise<PatchResult> {
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

    // 检查策略是否启用
    const strategyConfig = this.strategyConfigs.get(strategy.getName());
    if (strategyConfig && !strategyConfig.enabled) {
      logger.warn(`Strategy ${strategy.getName()} is disabled`);
      return {
        success: false,
        patch: '',
        newContent: '',
        changeType,
        error: `Strategy ${strategy.getName()} is disabled`,
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
      // 使用共享超时控制执行策略
      const result = await withTimeoutSync(
        () => strategy.generate(currentContent, context),
        strategyConfig?.timeout ?? 5000,
        `Strategy ${strategy.getName()}`
      );

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
        error: `Strategy execution failed: ${error instanceof Error ? error.message : String(error)}`,
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
   * 获取所有策略配置
   */
  getAllStrategyConfigs(): Map<string, StrategyConfig> {
    return new Map(this.strategyConfigs);
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
