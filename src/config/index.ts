import { cosmiconfig } from 'cosmiconfig';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import type { EVOConfig, ProjectConfig } from '../types/index.js';
import { DEFAULT_CONFIG } from './defaults.js';

const MODULE_NAME = 'evo';
const GLOBAL_CONFIG_DIR = join(homedir(), '.evo');
const GLOBAL_CONFIG_FILE = join(GLOBAL_CONFIG_DIR, 'settings.toml');

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
        this.globalConfig = this.mergeConfig(DEFAULT_CONFIG, result.config as EVOConfig);
      }
    } catch {
      // 配置文件不存在或格式错误，使用默认配置
    }
  }

  /**
   * 加载项目配置
   */
  private async loadProjectConfig(): Promise<void> {
    if (!this.projectRoot) return;

    const projectConfigPath = join(this.projectRoot, '.evo', 'config', 'settings.toml');
    const explorer = cosmiconfig(MODULE_NAME, {
      searchPlaces: [projectConfigPath],
    });

    try {
      const result = await explorer.search(this.projectRoot);
      if (result && !result.isEmpty) {
        this.projectConfig = result.config as ProjectConfig;
      }
    } catch {
      // 项目配置不存在
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