/**
 * Distribution Engine - Bridge File
 *
 * Re-exports from @sports-bar/scheduler package.
 * This maintains backwards compatibility with existing imports.
 */

export {
  DistributionEngine,
  getDistributionEngine,
  resetDistributionEngine,
  type DistributionPlan,
  type GameAssignment,
  type TVAssignment,
  type DefaultAssignment,
  type DistributionOptions
} from '@sports-bar/scheduler'
