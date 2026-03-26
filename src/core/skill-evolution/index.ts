/**
 * Skill Evolution Module
 *
 * 管理 Skill 的演化生命周期
 */

export {
  SkillEvolutionThread,
  createSkillEvolutionThread,
  type SkillEvolutionState,
  type SkillEvolutionOptions,
  type TriggerResult,
} from './thread.js';

export {
  SkillEvolutionManager,
  createSkillEvolutionManager,
  type SkillEvolutionManagerOptions,
  type TrackedSkill,
} from './manager.js';
