export type EvolutionArchitectureModuleStatus = 'production' | 'legacy' | 'to_migrate' | 'to_remove';

export interface EvolutionArchitectureModule {
  module: string;
  path: string;
  status: EvolutionArchitectureModuleStatus;
  role: string;
  decision: string;
}

export interface EvolutionArchitectureStatus {
  productionEntryPoint: typeof EVOLUTION_PRODUCTION_ENTRYPOINT;
  productionTracePath: readonly string[];
  modules: readonly EvolutionArchitectureModule[];
}

export const EVOLUTION_PRODUCTION_ENTRYPOINT = 'shadow-manager' as const;

export const EVOLUTION_PRODUCTION_TRACE_PATH = [
  'Observer',
  'Daemon',
  'ProjectRuntimeRegistry',
  'ShadowManager',
  'TaskEpisode',
  'SkillCallAnalyzer',
  'OptimizationRunner',
  'PatchGenerator',
  'Journal / Version / Decision Events',
] as const;

export const EVOLUTION_ARCHITECTURE_MODULES: readonly EvolutionArchitectureModule[] = [
  {
    module: 'ShadowManager',
    path: 'src/core/shadow-manager/index.ts',
    status: 'production',
    role: 'Online evolution facade used by daemon-managed project runtimes.',
    decision: 'Keep as the only production entrypoint until the explicit workflow layer lands.',
  },
  {
    module: 'SkillEvolutionManager',
    path: 'src/core/skill-evolution/index.ts',
    status: 'legacy',
    role: 'Earlier evolution manager kept for compatibility tests and migration reference.',
    decision: 'Do not extend; migrate useful contracts into the new evolution domain model.',
  },
  {
    module: 'OptimizationPipeline',
    path: 'src/core/pipeline/index.ts',
    status: 'to_migrate',
    role: 'Sidecar pipeline abstraction that overlaps with ShadowManager orchestration.',
    decision: 'Extract valid workflow concepts before retiring the parallel orchestration path.',
  },
  {
    module: 'ReadinessProbeAnalyzer',
    path: 'src/core/readiness-probe/index.ts',
    status: 'to_remove',
    role: 'Standalone readiness analyzer not connected to the current daemon production path.',
    decision: 'Remove after confirming no dashboard or migration workflow depends on it.',
  },
] as const;

export function getEvolutionArchitectureStatus(): EvolutionArchitectureStatus {
  return {
    productionEntryPoint: EVOLUTION_PRODUCTION_ENTRYPOINT,
    productionTracePath: EVOLUTION_PRODUCTION_TRACE_PATH,
    modules: EVOLUTION_ARCHITECTURE_MODULES,
  };
}

export function assertSingleProductionEvolutionEntrypoint(
  status: EvolutionArchitectureStatus = getEvolutionArchitectureStatus()
): void {
  const productionModules = status.modules.filter((module) => module.status === 'production');
  if (
    status.productionEntryPoint !== EVOLUTION_PRODUCTION_ENTRYPOINT ||
    productionModules.length !== 1 ||
    productionModules[0]?.module !== 'ShadowManager'
  ) {
    throw new Error('Evolution production entrypoint must remain ShadowManager only');
  }
}
