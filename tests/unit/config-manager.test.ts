import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdirSync, rmSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import { ConfigManager } from '../../src/config/index.js';

describe('ConfigManager', () => {
  const testDir = join(tmpdir(), 'ornn-config-mgr-test-' + Date.now());

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) rmSync(testDir, { recursive: true, force: true });
  });

  describe('getGlobalConfig', () => {
    it('should return default config initially', () => {
      const manager = new ConfigManager();
      const config = manager.getGlobalConfig();
      expect(config).toHaveProperty('origin_paths');
      expect(config).toHaveProperty('observer');
      expect(config).toHaveProperty('evaluator');
      expect(config).toHaveProperty('patch');
      expect(config).toHaveProperty('journal');
      expect(config).toHaveProperty('daemon');
    });

    it('should return a copy', () => {
      const manager = new ConfigManager();
      const config1 = manager.getGlobalConfig();
      const config2 = manager.getGlobalConfig();
      expect(config1).not.toBe(config2);
      expect(config1).toEqual(config2);
    });
  });

  describe('getEvaluatorConfig', () => {
    it('should return evaluator config', () => {
      const manager = new ConfigManager();
      const config = manager.getEvaluatorConfig();
      expect(config).toHaveProperty('min_signal_count');
      expect(config).toHaveProperty('min_source_sessions');
      expect(config).toHaveProperty('min_confidence');
    });
  });

  describe('getPatchConfig', () => {
    it('should return patch config', () => {
      const manager = new ConfigManager();
      const config = manager.getPatchConfig();
      expect(config).toHaveProperty('allowed_types');
      expect(config).toHaveProperty('cooldown_hours');
      expect(config).toHaveProperty('max_patches_per_day');
    });
  });

  describe('getJournalConfig', () => {
    it('should return journal config', () => {
      const manager = new ConfigManager();
      const config = manager.getJournalConfig();
      expect(config).toHaveProperty('snapshot_interval');
      expect(config).toHaveProperty('max_snapshots');
    });
  });

  describe('isSkillFrozen', () => {
    it('should return false when no project config', () => {
      const manager = new ConfigManager();
      expect(manager.isSkillFrozen('test-skill')).toBe(false);
    });
  });

  describe('getAllowedPatchTypes', () => {
    it('should return default patch types when no project config', () => {
      const manager = new ConfigManager();
      const types = manager.getAllowedPatchTypes('test-skill');
      expect(Array.isArray(types)).toBe(true);
      expect(types.length).toBeGreaterThan(0);
    });
  });

  describe('getProjectConfig', () => {
    it('should return null when no project config loaded', () => {
      const manager = new ConfigManager();
      expect(manager.getProjectConfig()).toBeNull();
    });
  });

  describe('getOriginPaths', () => {
    it('should return origin paths', () => {
      const manager = new ConfigManager();
      const paths = manager.getOriginPaths();
      expect(Array.isArray(paths)).toBe(true);
    });
  });

  describe('ensureGlobalConfig', () => {
    it('should create global config file', () => {
      const manager = new ConfigManager();
      manager.ensureGlobalConfig();
      const globalDir = join(process.env.HOME || '', '.ornn');
      expect(existsSync(globalDir)).toBe(true);
    });
  });
});

describe('Config File Operations', () => {
  const testDir = join(tmpdir(), 'ornn-config-file-test-' + Date.now());

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
    mkdirSync(join(testDir, '.ornn', 'config'), { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) rmSync(testDir, { recursive: true, force: true });
  });

  it('should write and list providers', async () => {
    const { writeConfig, listConfiguredProviders } = await import('../../src/config/manager.js');
    const config = { provider: 'deepseek', modelName: 'deepseek-chat', apiKeyEnvVar: 'ORNN_DEEPSEEK_API_KEY' };
    await writeConfig(testDir, config, true);

    const providers = await listConfiguredProviders(testDir);
    expect(providers.length).toBe(1);
    expect(providers[0].provider).toBe('deepseek');
  });

  it('should return empty list when no config', async () => {
    const { listConfiguredProviders } = await import('../../src/config/manager.js');
    const providers = await listConfiguredProviders(testDir);
    expect(providers).toEqual([]);
  });

  it('should get and set default provider', async () => {
    const { writeConfig, getDefaultProvider, setDefaultProvider, listConfiguredProviders } = await import('../../src/config/manager.js');
    const config1 = { provider: 'openai', modelName: 'gpt-4', apiKeyEnvVar: 'ORNN_OPENAI_API_KEY' };
    const config2 = { provider: 'deepseek', modelName: 'deepseek-chat', apiKeyEnvVar: 'ORNN_DEEPSEEK_API_KEY' };
    await writeConfig(testDir, config1, true);
    await writeConfig(testDir, config2, false);

    const defaultProvider = await getDefaultProvider(testDir);
    expect(defaultProvider).toBe('openai');

    await setDefaultProvider(testDir, 'deepseek');
    const newDefault = await getDefaultProvider(testDir);
    expect(newDefault).toBe('deepseek');

    const providers = await listConfiguredProviders(testDir);
    expect(providers.length).toBe(2);
  });

  it('should write env file', async () => {
    const { writeEnvFile } = await import('../../src/config/manager.js');
    await writeEnvFile(testDir, 'deepseek', 'sk-test-key-123');
    const envPath = join(testDir, '.env.local');
    const content = readFileSync(envPath, 'utf-8');
    expect(content).toContain('ORNN_DEEPSEEK_API_KEY=sk-test-key-123');
  });

  it('should append to existing env file', async () => {
    const { writeEnvFile } = await import('../../src/config/manager.js');
    await writeEnvFile(testDir, 'deepseek', 'sk-key-1');
    await writeEnvFile(testDir, 'openai', 'sk-key-2');
    const envPath = join(testDir, '.env.local');
    const content = readFileSync(envPath, 'utf-8');
    expect(content).toContain('ORNN_DEEPSEEK_API_KEY=sk-key-1');
    expect(content).toContain('ORNN_OPENAI_API_KEY=sk-key-2');
  });
});
