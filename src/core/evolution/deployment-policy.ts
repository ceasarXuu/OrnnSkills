import type { EvolutionApplication } from './domain.js';

export type EvolutionDeploymentStatus =
  | 'applied_to_shadow'
  | 'version_created'
  | 'deployed_to_runtime'
  | 'runtime_sync_skipped'
  | 'runtime_sync_failed';

export type EvolutionDeploymentAction =
  | 'deploy_to_runtime'
  | 'skip_runtime_deploy'
  | 'mark_partial';

export interface EvolutionDeploymentPolicy {
  runtimeSync: boolean;
  backupBeforeDeploy: boolean;
}

export interface EvolutionDeploymentDecisionInput {
  application: EvolutionApplication;
  policy: EvolutionDeploymentPolicy;
  deploymentError?: string | null;
}

export interface EvolutionDeploymentDecision {
  status: EvolutionDeploymentStatus;
  action: EvolutionDeploymentAction;
  requiresBackup: boolean;
  reason: string;
}

export function decideEvolutionDeployment(
  input: EvolutionDeploymentDecisionInput
): EvolutionDeploymentDecision {
  if (input.deploymentError) {
    return {
      status: 'runtime_sync_failed',
      action: 'mark_partial',
      requiresBackup: false,
      reason: input.deploymentError,
    };
  }

  if (!input.policy.runtimeSync) {
    return {
      status: 'runtime_sync_skipped',
      action: 'skip_runtime_deploy',
      requiresBackup: false,
      reason: 'runtime sync is disabled',
    };
  }

  return {
    status: 'version_created',
    action: 'deploy_to_runtime',
    requiresBackup: input.policy.backupBeforeDeploy,
    reason: 'runtime sync is enabled',
  };
}
