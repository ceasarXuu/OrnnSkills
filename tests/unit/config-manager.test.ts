import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdirSync, rmSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import { ConfigManager } from '../../src/config/index.js';
import { parse } from 'smol-toml';

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
    const previousApiKey = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = 'sk-test-openai';

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
      if (previousApiKey === undefined) {
        delete process.env.OPENAI_API_KEY;
      } else {
        process.env.OPENAI_API_KEY = previousApiKey;
      }
      globalThis.fetch = originalFetch;
    }
  });

  it('should use connectivity probe for deepseek reasoner providers', async () => {
    const { checkProvidersConnectivity } = await import('../../src/config/manager.js');
    const previousApiKey = process.env.DEEPSEEK_API_KEY;
    process.env.DEEPSEEK_API_KEY = 'sk-test-deepseek';

    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.endsWith('/models')) {
        return new Response(
          JSON.stringify({
            data: [{ id: 'deepseek-chat' }, { id: 'deepseek-reasoner' }],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          model: 'deepseek-reasoner',
          choices: [
            {
              index: 0,
              finish_reason: 'length',
              message: {
                role: 'assistant',
                content: '',
                reasoning_content: 'thinking',
              },
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as typeof fetch;

    try {
      const result = await checkProvidersConnectivity(testDir, [
        { provider: 'deepseek', modelName: 'deepseek/deepseek-reasoner', apiKeyEnvVar: 'DEEPSEEK_API_KEY' },
      ]);
      expect(result).toHaveLength(1);
      expect(result[0].ok).toBe(true);
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.deepseek.com/v1/models',
        expect.objectContaining({ method: 'GET' })
      );
    } finally {
      if (previousApiKey === undefined) {
        delete process.env.DEEPSEEK_API_KEY;
      } else {
        process.env.DEEPSEEK_API_KEY = previousApiKey;
      }
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
    const oldHome = process.env.HOME;
    const globalHome = join(testDir, 'global-home-read');
    mkdirSync(join(globalHome, '.ornn', 'config'), { recursive: true });
    process.env.HOME = globalHome;
    vi.resetModules();

    try {
    const { readDashboardConfig } = await import('../../src/config/manager.js');
    writeFileSync(
      join(globalHome, '.ornn', 'config', 'settings.toml'),
      `[ornn]
version = "0.1.9"
log_level = "debug"
project_path = "${globalHome}/.ornn"

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
    writeFileSync(
      join(globalHome, '.ornn', 'config', '.env.local'),
      'OPENAI_API_KEY=openai-secret\nDEEPSEEK_API_KEY=deepseek-secret\n',
      'utf-8'
    );

    const config = await readDashboardConfig(testDir);
    expect(config.defaultProvider).toBe('openai');
    expect(config.logLevel).toBe('debug');
    expect(config.providers).toHaveLength(2);
    expect(config.providers[0]?.apiKey).toBe('openai-secret');
    expect(config.providers[1]?.apiKey).toBe('deepseek-secret');
    } finally {
      process.env.HOME = oldHome;
      vi.resetModules();
    }
  });

  it('should persist dashboard default provider and log level when writing config', async () => {
    const oldHome = process.env.HOME;
    const globalHome = join(testDir, 'global-home-write');
    mkdirSync(globalHome, { recursive: true });
    process.env.HOME = globalHome;
    vi.resetModules();

    try {
    const { writeDashboardConfig } = await import('../../src/config/manager.js');
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

    const rawConfig = readFileSync(join(globalHome, '.ornn', 'config', 'settings.toml'), 'utf-8');
    const parsed = parse(rawConfig) as {
      llm?: { default_provider?: string };
      ornn?: { log_level?: string };
    };
    expect(parsed.llm?.default_provider).toBe('deepseek');
    expect(parsed.ornn?.log_level).toBe('warn');
    } finally {
      process.env.HOME = oldHome;
      vi.resetModules();
    }
  });

  it('should migrate legacy project dashboard config into global config when global config is missing', async () => {
    const oldHome = process.env.HOME;
    const globalHome = join(testDir, 'global-home-migrate');
    mkdirSync(join(globalHome, '.ornn'), { recursive: true });
    mkdirSync(join(testDir, '.ornn', 'config'), { recursive: true });
    process.env.HOME = globalHome;
    vi.resetModules();

    try {
      const { readDashboardConfig } = await import('../../src/config/manager.js');
      writeFileSync(
        join(testDir, '.ornn', 'config', 'settings.toml'),
        `[ornn]
version = "0.1.9"
log_level = "error"
project_path = "${testDir}"

[llm]
default_provider = "deepseek"

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
      writeFileSync(join(testDir, '.env.local'), 'DEEPSEEK_API_KEY=legacy-project-secret\n', 'utf-8');

      const config = await readDashboardConfig(testDir);
      expect(config.defaultProvider).toBe('deepseek');
      expect(config.logLevel).toBe('error');
      expect(config.providers).toHaveLength(1);
      expect(config.providers[0]?.apiKey).toBe('legacy-project-secret');

      expect(existsSync(join(globalHome, '.ornn', 'config', 'settings.toml'))).toBe(true);
      expect(readFileSync(join(globalHome, '.ornn', 'config', '.env.local'), 'utf-8')).toContain(
        'DEEPSEEK_API_KEY=legacy-project-secret'
      );
      const migratedConfig = readFileSync(join(globalHome, '.ornn', 'config', 'settings.toml'), 'utf-8');
      expect(migratedConfig).toContain('default_provider = "deepseek"');
      expect(migratedConfig).toContain('log_level = "error"');
    } finally {
      process.env.HOME = oldHome;
      vi.resetModules();
    }
  });
});
