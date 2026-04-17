/**
 * Keep-Awake Scheduler Bridge
 *
 * Re-exports from scheduler-bridge for backward compatibility.
 * The actual implementation is in @sports-bar/firecube package.
 */

export {
  getKeepAwakeScheduler,
  type KeepAwakeScheduler,
  type KeepAwakeStatus,
  type KeepAwakeLog
} from './scheduler-bridge'
