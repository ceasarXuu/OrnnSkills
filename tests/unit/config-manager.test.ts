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

  it('should check providers connectivity with litellm client path', async () => {
    const { checkProvidersConnectivity } = await import('../../src/config/manager.js');
    const envPath = join(testDir, '.env.local');
    writeFileSync(envPath, 'OPENAI_API_KEY=sk-test-openai\n', 'utf-8');

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: 'pong', role: 'assistant' }, finish_reason: 'stop', index: 0 }],
          model: 'gpt-4o-mini',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )) as typeof fetch;

    try {
      const result = await checkProvidersConnectivity(testDir, [
        { provider: 'openai', modelName: 'openai/gpt-4o-mini', apiKeyEnvVar: 'OPENAI_API_KEY' },
      ]);
      expect(result.length).toBe(1);
      expect(result[0].ok).toBe(true);
      expect(result[0].provider).toBe('openai');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('should return missing api key error when env var is absent', async () => {
    const { checkProvidersConnectivity } = await import('../../src/config/manager.js');
    const result = await checkProvidersConnectivity(testDir, [
      { provider: 'openai', modelName: 'openai/gpt-4o-mini', apiKeyEnvVar: 'OPENAI_API_KEY' },
    ]);
    expect(result.length).toBe(1);
    expect(result[0].ok).toBe(false);
    expect(result[0].message).toContain('Missing API key env var');
  });

  it('should read dashboard config with default provider and log level', async () => {
    const { readDashboardConfig } = await import('../../src/config/manager.js');
    writeFileSync(
      join(testDir, '.ornn', 'config', 'settings.toml'),
      `[ornn]
version = "0.1.9"
log_level = "debug"
project_path = "${testDir}"

[llm]
default_provider = "openai"

[providers.openai]
provider = "openai"
model_name = "openai/gpt-4o-mini"
api_key_env_var = "OPENAI_API_KEY"

[providers.deepseek]
provider = "deepseek"
model_name = "deepseek/deepseek-chat"
api_key_env_var = "DEEPSEEK_API_KEY"

[tracking]
auto_optimize = true
user_confirm = false
runtime_sync = true
`,
      'utf-8'
    );

    const config = await readDashboardConfig(testDir);
    expect(config.defaultProvider).toBe('openai');
    expect(config.logLevel).toBe('debug');
    expect(config.providers).toHaveLength(2);
  });

  it('should persist dashboard default provider and log level when writing config', async () => {
    const { writeDashboardConfig, readConfig } = await import('../../src/config/manager.js');
    await writeDashboardConfig(testDir, {
      autoOptimize: true,
      userConfirm: false,
      runtimeSync: true,
      defaultProvider: 'deepseek',
      logLevel: 'warn',
      providers: [
        { provider: 'openai', modelName: 'openai/gpt-4o-mini', apiKeyEnvVar: 'OPENAI_API_KEY' },
        { provider: 'deepseek', modelName: 'deepseek/deepseek-chat', apiKeyEnvVar: 'DEEPSEEK_API_KEY' },
      ],
    });

    const config = await readConfig(testDir);
    expect(config?.llm?.default_provider).toBe('deepseek');
    expect(config?.ornn?.log_level).toBe('warn');
  });
});
