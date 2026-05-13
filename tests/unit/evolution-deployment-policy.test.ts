import { describe, expect, it } from 'vitest';
import {
  decideEvolutionDeployment,
  type EvolutionDeploymentPolicy,
} from '../../src/core/evolution/deployment-policy.js';
import type { EvolutionApplication } from '../../src/core/evolution/domain.js';

const application: EvolutionApplication = {
  proposalId: 'proposal-1',
  appliedAt: '2026-05-13T00:03:00.000Z',
  revision: 2,
  previousRevision: 1,
};

const policy: EvolutionDeploymentPolicy = {
  runtimeSync: true,
  backupBeforeDeploy: true,
};

describe('evolution deployment policy', () => {
  it('deploys created revisions when runtime sync is enabled', () => {
    expect(
      decideEvolutionDeployment({
        application,
        policy,
      })
    ).toEqual({
      status: 'version_created',
      action: 'deploy_to_runtime',
      requiresBackup: true,
      reason: 'runtime sync is enabled',
    });
  });

  it('skips runtime deployment when runtime sync is disabled', () => {
    expect(
      decideEvolutionDeployment({
        application,
        policy: { ...policy, runtimeSync: false },
      })
    ).toEqual({
      status: 'runtime_sync_skipped',
      action: 'skip_runtime_deploy',
      requiresBackup: false,
      reason: 'runtime sync is disabled',
    });
  });

  it('marks failed deployments as partial application outcomes', () => {
    expect(
      decideEvolutionDeployment({
        application,
        policy,
        deploymentError: 'permission denied',
      })
    ).toEqual({
      status: 'runtime_sync_failed',
      action: 'mark_partial',
      requiresBackup: false,
      reason: 'permission denied',
    });
  });
});
