/**
 * State Reader - Bridge File
 *
 * Re-exports from @sports-bar/scheduler package.
 * This maintains backwards compatibility with existing imports.
 */

export {
  StateReader,
  getStateReader,
  resetStateReader,
  type SystemState,
  type InputChannelState,
  type OutputState,
  type AvailableInput
} from '@sports-bar/scheduler'
