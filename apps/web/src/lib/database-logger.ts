/**
 * Database Logger - Re-exported from @sports-bar/data
 *
 * This file bridges the local import path (@/lib/database-logger) to the shared package.
 * All database logging functionality is maintained in the @sports-bar/data package.
 */

// Re-export everything from the data package database-logger module
export {
  logDatabaseOperation,
  logError,
  logInfo,
  logWarning
} from '@sports-bar/data'
