import { describe, expect, it } from 'vitest';

describe('deprecated llm module cleanup', () => {
  it('removes the legacy analyzer entrypoint', async () => {
    await expect(import('../../src/core/analyzer/index.js')).rejects.toBeTruthy();
  });

  it('removes the legacy llm router agent implementation', async () => {
    await expect(import('../../src/core/router/llm-router-agent.js')).rejects.toBeTruthy();
  });

  it('stops re-exporting deprecated llm router agent symbols', async () => {
    const routerModule = await import('../../src/core/router/index.js');

    expect('LLMRouterAgent' in routerModule).toBe(false);
    expect('createLLMRouterAgent' in routerModule).toBe(false);
    expect('SkillRecognitionResult' in routerModule).toBe(false);
  });
});
