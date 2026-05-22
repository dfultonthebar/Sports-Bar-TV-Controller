/**
 * Operation Logger - Re-exported from @sports-bar/database
 *
 * This file bridges the local import path (@/lib/operation-logger) to the shared package.
 * All operation logging functionality is maintained in the @sports-bar/database package.
 */

// Re-export everything from the data package operation-logger module
export {
  OperationLogger,
  operationLogger,
  type OperationLog,
  type ErrorLog,
  type AIAccessibleLog
} from '@sports-bar/database'
