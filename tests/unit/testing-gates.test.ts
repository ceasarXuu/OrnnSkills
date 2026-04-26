import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

const root = new URL('../../', import.meta.url);
const packageJson = JSON.parse(
  readFileSync(new URL('package.json', root), 'utf-8')
) as { scripts?: Record<string, string> };

function readWorkspaceFile(path: string): string {
  return readFileSync(new URL(path, root), 'utf-8');
}

describe('testing gates', () => {
  it('exposes smoke and regression scripts for routine changes', () => {
    expect(packageJson.scripts?.['test:runtime']).toBe(
      'npm run build:dashboard-v3 && tsx tests/runtime/dashboard-v3-runtime-smoke.ts'
    );
    expect(packageJson.scripts?.['test:smoke']).toBe(
      'npm run typecheck && npm --prefix frontend-v3 run typecheck && vitest run tests/unit/dashboard-v3-layout.test.ts tests/unit/dashboard-v3-skills-workspace.test.ts tests/unit/dashboard-v3-project-contract.test.ts tests/unit/dashboard-v3-config-contract.test.ts tests/unit/dashboard-v3-cost-contract.test.ts tests/unit/dashboard-v3-storybook.test.ts tests/unit/dashboard-skill-evaluation-count.test.ts && npm run test:runtime && npm run test:storybook:dashboard-v3 && npm run benchmark:dashboard:smoke'
    );
    expect(packageJson.scripts?.['test:regression']).toBe(
      'npm run test:smoke && npm test -- --run && npm run benchmark:check && npm run build'
    );
  });

  it('documents the project-specific smoke and regression coverage map', () => {
    expect(existsSync(new URL('docs/TESTING-STRATEGY.md', root))).toBe(true);
    const doc = readWorkspaceFile('docs/TESTING-STRATEGY.md');

    expect(doc).toContain('Dashboard V3 Skills');
    expect(doc).toContain('Dashboard V3 Project');
    expect(doc).toContain('Dashboard V3 Config');
    expect(doc).toContain('Cost Visibility');
    expect(doc).toContain('Daemon / SSE / Dashboard Read Path');
    expect(doc).toContain('npm run test:smoke');
    expect(doc).toContain('npm run test:regression');
  });
});
