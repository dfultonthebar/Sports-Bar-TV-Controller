/**
 * Bridge file for backwards compatibility
 * Re-exports from @sports-bar/database package
 */
export {
  withTransaction,
  batchTransaction,
  withOptimisticLock,
  transactionHelpers,
  TransactionMonitor,
  type TransactionOptions,
  type TransactionResult,
} from '@sports-bar/database'

// Default export for backwards compatibility
export { withTransaction as default } from '@sports-bar/database'
