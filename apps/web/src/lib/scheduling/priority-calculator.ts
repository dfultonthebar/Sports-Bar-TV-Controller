/**
 * Bridge file - Priority Calculator
 *
 * Re-exports GamePriorityUpdater from @sports-bar/scheduler package.
 * This service handles bulk priority calculation and database updates.
 *
 * For real-time game scoring without database updates, use PriorityCalculator
 * from @sports-bar/scheduler instead.
 */

export {
  GamePriorityUpdater,
  getGamePriorityUpdater,
  resetGamePriorityUpdater,
  gamePriorityUpdater as priorityCalculator,
  type PriorityFactors,
  type PriorityConfig
} from '@sports-bar/scheduler'
