import { afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const mocks = vi.hoisted(() => ({
  registerProject: vi.fn(),
}));

vi.mock('../../src/dashboard/projects-registry.js', () => ({
  registerProject: mocks.registerProject,
}));

describe('initCommand', () => {
  const tempRoots: string[] = [];

  afterEach(() => {
    mocks.registerProject.mockReset();
    for (const root of tempRoots.splice(0)) {
      if (existsSync(root)) {
        rmSync(root, { recursive: true, force: true });
      }
    }
  });

  it('registers the project even when .ornn already exists', async () => {
    const projectRoot = join(tmpdir(), `ornn-init-existing-${Date.now()}`);
    tempRoots.push(projectRoot);

    mkdirSync(join(projectRoot, '.ornn'), { recursive: true });

    const { initCommand } = await import('../../src/commands/init.js');

    await initCommand(projectRoot);

    expect(mocks.registerProject).toHaveBeenCalledWith(projectRoot);
  });
});
