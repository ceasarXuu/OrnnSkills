import type { PatchResult, ChangeType } from '../../types/index.js';

/**
 * Patch 策略基类
 */
export abstract class BaseStrategy {
  protected name: string;
  protected description: string;
  protected changeType: ChangeType;

  constructor(name: string, description: string, changeType: ChangeType) {
    this.name = name;
    this.description = description;
    this.changeType = changeType;
  }

  /**
   * 生成 patch
   */
  abstract generate(currentContent: string, context: Record<string, unknown>): PatchResult;

  /**
   * 获取策略名称
   */
  getName(): string {
    return this.name;
  }

  /**
   * 获取策略描述
   */
  getDescription(): string {
    return this.description;
  }

  /**
   * 获取变更类型
   */
  getChangeType(): ChangeType {
    return this.changeType;
  }

  /**
   * 创建成功的 PatchResult
   */
  protected createSuccessResult(patch: string, newContent: string): PatchResult {
    return {
      success: true,
      patch,
      newContent,
      changeType: this.changeType,
    };
  }

  /**
   * 创建失败的 PatchResult
   */
  protected createFailureResult(error: string): PatchResult {
    return {
      success: false,
      patch: '',
      newContent: '',
      changeType: this.changeType,
      error,
    };
  }
}