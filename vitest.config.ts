import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'tests/fixtures/',
        '**/*.d.ts',
        '**/*.config.ts',
        // External service dependencies - not unit-testable without extensive mocking
        'src/llm/',
        'src/daemon/',
        'src/cli/commands/',
        'src/commands/',
        'src/config/wizard.ts',
        'src/core/user-confirmation/',
        'src/core/skill-deployer/',
        'src/core/analyzer/analyzer-agent.ts',
        'src/core/router/llm-router-agent.ts',
        'src/core/observer/codex-observer.ts',
        'src/core/observer/claude-observer.ts',
        'src/core/observer/project-observer.ts',
        'src/core/phase2-integration.ts',
        'src/core/phase4-integration.ts',
        'src/core/phase5-integration.ts',
      ],
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 45,
        statements: 60,
      },
    },
  },
});
