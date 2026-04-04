import { cosmiconfig } from 'cosmiconfig';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import type { EVOConfig, ProjectConfig } from '../types/index.js';
import { DEFAULT_CONFIG } from './defaults.js';
import { createChildLogger } from '../utils/logger.js';

const logger = createChildLogger('config');

const MODULE_NAME = 'ornn';
const GLOBAL_CONFIG_DIR = join(homedir(), '.ornn');
const GLOBAL_CONFIG_FILE = join(GLOBAL_CONFIG_DIR, 'settings.toml');

/**
 * 类型守卫：检查值是否为普通对象
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * 类型守卫：验证 EVOConfig 结构（更严格的验证）
 */
function isValidEVOConfig(config: unknown): config is EVOConfig {
  if (!isPlainObject(config)) return false;
  
  // 检查必要的顶层属性
  const requiredKeys = ['origin_paths', 'observer', 'evaluator', 'patch', 'journal', 'daemon'];
  for (const key of requiredKeys) {
    if (!(key in config)) {
      logger.warn(`Missing required config key: ${key}`);
      return false;
    }
  }
  
  // 检查 origin_paths
  if (!isPlainObject(config.origin_paths)) {
    logger.warn('origin_paths must be an object');
    return false;
  }
  if (!Array.isArray(config.origin_paths.paths)) {
    logger.warn('origin_paths.paths must be an array');
    return false;
  }
  if (!config.origin_paths.paths.every(p => typeof p === 'string' && p.length > 0)) {
    logger.warn('origin_paths.paths must contain non-empty strings');
    return false;
  }
  
  // 检查 observer
  if (!isPlainObject(config.observer)) {
    logger.warn('observer must be an object');
    return false;
  }
  if (!Array.isArray(config.observer.enabled_runtimes)) {
    logger.warn('observer.enabled_runtimes must be an array');
    return false;
  }
  const validRuntimes = ['codex', 'opencode', 'claude'];
  if (!config.observer.enabled_runtimes.every(r => validRuntimes.includes(r as string))) {
    logger.warn('observer.enabled_runtimes contains invalid runtime');
    return false;
  }
  if (typeof config.observer.trace_retention_days !== 'number' || 
      !Number.isInteger(config.observer.trace_retention_days) ||
      config.observer.trace_retention_days < 1 || 
      config.observer.trace_retention_days > 365) {
    logger.warn('observer.trace_retention_days must be an integer between 1 and 365');
    return false;
  }
  
  // 检查 evaluator
  if (!isPlainObject(config.evaluator)) {
    logger.warn('evaluator must be an object');
    return false;
  }
  if (typeof config.evaluator.min_signal_count !== 'number' || 
      !Number.isInteger(config.evaluator.min_signal_count) ||
      config.evaluator.min_signal_count < 1) {
    logger.warn('evaluator.min_signal_count must be an integer >= 1');
    return false;
  }
  if (typeof config.evaluator.min_source_sessions !== 'number' || 
      !Number.isInteger(config.evaluator.min_source_sessions) ||
      config.evaluator.min_source_sessions < 1) {
    logger.warn('evaluator.min_source_sessions must be an integer >= 1');
    return false;
  }
  if (typeof config.evaluator.min_confidence !== 'number' || 
      config.evaluator.min_confidence < 0 || 
      config.evaluator.min_confidence > 1) {
    logger.warn('evaluator.min_confidence must be a number between 0 and 1');
    return false;
  }
  
  // 检查 patch
  if (!isPlainObject(config.patch)) {
    logger.warn('patch must be an object');
    return false;
  }
  const validChangeTypes = ['append_context', 'tighten_trigger', 'add_fallback', 'prune_noise', 'rewrite_section'];
  if (!Array.isArray(config.patch.allowed_types)) {
    logger.warn('patch.allowed_types must be an array');
    return false;
  }
  if (!config.patch.allowed_types.every(t => validChangeTypes.includes(t as string))) {
    logger.warn('patch.allowed_types contains invalid change type');
    return false;
  }
  if (typeof config.patch.cooldown_hours !== 'number' || 
      config.patch.cooldown_hours < 0) {
    logger.warn('patch.cooldown_hours must be a non-negative number');
    return false;
  }
  if (typeof config.patch.max_patches_per_day !== 'number' || 
      !Number.isInteger(config.patch.max_patches_per_day) ||
      config.patch.max_patches_per_day < 1) {
    logger.warn('patch.max_patches_per_day must be an integer >= 1');
    return false;
  }
  
  // 检查 journal
  if (!isPlainObject(config.journal)) {
    logger.warn('journal must be an object');
    return false;
  }
  if (typeof config.journal.snapshot_interval !== 'number' || 
      !Number.isInteger(config.journal.snapshot_interval) ||
      config.journal.snapshot_interval < 1) {
    logger.warn('journal.snapshot_interval must be an integer >= 1');
    return false;
  }
  if (typeof config.journal.max_snapshots !== 'number' || 
      !Number.isInteger(config.journal.max_snapshots) ||
      config.journal.max_snapshots < 1) {
    logger.warn('journal.max_snapshots must be an integer >= 1');
    return false;
  }
  
  // 检查 daemon
  if (!isPlainObject(config.daemon)) {
    logger.warn('daemon must be an object');
    return false;
  }
  if (typeof config.daemon.auto_start !== 'boolean') {
    logger.warn('daemon.auto_start must be a boolean');
    return false;
  }
  const validLogLevels = ['debug', 'info', 'warn', 'error'];
  if (!validLogLevels.includes(config.daemon.log_level as string)) {
    logger.warn('daemon.log_level must be one of: debug, info, warn, error');
    return false;
  }
  
  return true;
}

/**
 * 类型守卫：验证 ProjectConfig 结构
 */
function isValidProjectConfig(config: unknown): config is ProjectConfig {
  if (!isPlainObject(config)) return false;
  
  // 检查 project 属性
  if (!isPlainObject(config.project)) return false;
  if (typeof config.project.name !== 'string') return false;
  if (typeof config.project.auto_optimize !== 'boolean') return false;
  
  // 检查 skills 属性
  if (!isPlainObject(config.skills)) return false;
  
  return true;
}

/**
 * 配置管理器
 */
export class ConfigManager {
  private globalConfig: EVOConfig;
  private projectConfig: ProjectConfig | null = null;
  private projectRoot: string | null = null;

  constructor() {
    this.globalConfig = { ...DEFAULT_CONFIG };
  }

  /**
   * 初始化配置管理器
   */
  async init(projectRoot?: string): Promise<void> {
    // 加载全局配置
    await this.loadGlobalConfig();

    // 如果指定了项目根目录，加载项目配置
    if (projectRoot) {
      this.projectRoot = projectRoot;
      await this.loadProjectConfig();
    }
  }

  /**
   * 加载全局配置
   */
  private async loadGlobalConfig(): Promise<void> {
    const explorer = cosmiconfig(MODULE_NAME, {
      searchPlaces: [
        'settings.toml',
        '.eorc',
        '.eorc.json',
        '.eorc.yaml',
        '.eorc.yml',
        'package.json',
      ],
    });

    try {
      const result = await explorer.search(GLOBAL_CONFIG_DIR);
      if (result && !result.isEmpty) {
        if (isValidEVOConfig(result.config)) {
          this.globalConfig = this.mergeConfig(DEFAULT_CONFIG, result.config);
        } else {
          console.warn('Invalid EVOConfig structure, using default config');
        }
      }
    } catch (error) {
      // Config file missing or malformed — fall back to default
      logger.debug('Global config not loaded, using defaults', { error });
    }
  }

  /**
   * 加载项目配置
   */
  private async loadProjectConfig(): Promise<void> {
    if (!this.projectRoot) return;

    const projectConfigPath = join(this.projectRoot, '.ornn', 'config', 'settings.toml');
    const explorer = cosmiconfig(MODULE_NAME, {
      searchPlaces: [projectConfigPath],
    });

    try {
      const result = await explorer.search(this.projectRoot);
      if (result && !result.isEmpty) {
        if (isValidProjectConfig(result.config)) {
          this.projectConfig = result.config;
        } else {
          console.warn('Invalid ProjectConfig structure, ignoring project config');
        }
      }
    } catch (error) {
      // Project config missing — use global/default config
      logger.debug('Project config not loaded, using defaults', { error });
    }
  }

  /**
   * 深度合并配置对象
   */
  private mergeConfig<T extends object>(base: T, override: Partial<T>): T {
    const result = { ...base };

    for (const key in override) {
      if (Object.prototype.hasOwnProperty.call(override, key)) {
        const baseValue = base[key];
        const overrideValue = override[key];

        if (
          typeof baseValue === 'object' &&
          baseValue !== null &&
          !Array.isArray(baseValue) &&
          typeof overrideValue === 'object' &&
          overrideValue !== null &&
          !Array.isArray(overrideValue)
        ) {
          (result as Record<string, unknown>)[key] = this.mergeConfig(
            baseValue as object,
            overrideValue as object
          );
        } else if (overrideValue !== undefined) {
          (result as Record<string, unknown>)[key] = overrideValue;
        }
      }
    }

    return result;
  }

  /**
   * 获取全局配置
   */
  getGlobalConfig(): EVOConfig {
    return { ...this.globalConfig };
  }

  /**
   * 获取项目配置
   */
  getProjectConfig(): ProjectConfig | null {
    return this.projectConfig ? { ...this.projectConfig } : null;
  }

  /**
   * 获取 origin skill 路径列表
   */
  getOriginPaths(): string[] {
    return this.globalConfig.origin_paths.paths.map((p) =>
      p.startsWith('~') ? p.replace('~', homedir()) : resolve(p)
    );
  }

  /**
   * 获取评估器配置
   */
  getEvaluatorConfig(): EVOConfig['evaluator'] {
    return { ...this.globalConfig.evaluator };
  }

  /**
   * 获取 patch 配置
   */
  getPatchConfig(): EVOConfig['patch'] {
    return { ...this.globalConfig.patch };
  }

  /**
   * 获取 journal 配置
   */
  getJournalConfig(): EVOConfig['journal'] {
    return { ...this.globalConfig.journal };
  }

  /**
   * 检查 skill 是否在项目中被冻结
   */
  isSkillFrozen(skillId: string): boolean {
    if (!this.projectConfig) return false;
    const skillConfig = this.projectConfig.skills[skillId];
    return skillConfig?.auto_optimize === false;
  }

  /**
   * 获取 skill 允许的 patch 类型
   */
  getAllowedPatchTypes(skillId: string): string[] {
    if (!this.projectConfig) return this.globalConfig.patch.allowed_types;
    const skillConfig = this.projectConfig.skills[skillId];
    return skillConfig?.allowed_patch_types ?? this.globalConfig.patch.allowed_types;
  }

  /**
   * 创建默认全局配置文件
   */
  ensureGlobalConfig(): void {
    if (!existsSync(GLOBAL_CONFIG_DIR)) {
      mkdirSync(GLOBAL_CONFIG_DIR, { recursive: true });
    }

    if (!existsSync(GLOBAL_CONFIG_FILE)) {
      const tomlContent = this.configToToml(DEFAULT_CONFIG);
      writeFileSync(GLOBAL_CONFIG_FILE, tomlContent, 'utf-8');
    }
  }

  /**
   * 简单的配置转 TOML（仅支持一层嵌套）
   */
  private configToToml(config: object, indent = 0): string {
    let result = '';
    const prefix = '  '.repeat(indent);

    for (const [key, value] of Object.entries(config)) {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        result += `${prefix}[${key}]\n`;
        result += this.configToToml(value as object, indent + 1);
        result += '\n';
      } else if (Array.isArray(value)) {
        result += `${prefix}${key} = [${value.map((v) => `"${v}"`).join(', ')}]\n`;
      } else if (typeof value === 'string') {
        result += `${prefix}${key} = "${value}"\n`;
      } else if (typeof value === 'boolean') {
        result += `${prefix}${key} = ${value}\n`;
      } else if (typeof value === 'number') {
        result += `${prefix}${key} = ${value}\n`;
      }
    }

    return result;
  }
}

// 导出单例实例
export const configManager = new ConfigManager();