/**
 * @sports-bar/database
 *
 * Drizzle ORM database layer for Sports Bar TV Controller
 * Provides database connection, schema, and CRUD helpers
 */

// Database connection and schema
export { db, schema, setDatabaseLogger } from './db'
export type { DatabaseLogger } from './db'

// Re-export all schema tables for direct access
export * from './schema'

// CRUD helpers and utilities
export {
  // Query functions
  findMany,
  findFirst,
  findUnique,
  count,

  // Mutation functions
  create,
  createMany,
  update,
  updateMany,
  deleteRecord,
  deleteMany,
  upsert,

  // Raw SQL
  executeRaw,
  transaction,

  // Utilities
  sanitizeData,
  serializeDrizzleResult,
  setDbHelperLogger,

  // Drizzle operators (re-exported for convenience)
  eq,
  and,
  or,
  desc,
  asc,
  inArray,
  like,
  gte,
  lte,
  gt,
  lt,
  ne,
  not,
  sql,
  isNotNull,
  isNull,
} from './helpers'

export type { DbHelperLogger } from './helpers'

// Transaction wrapper utilities
export {
  withTransaction,
  batchTransaction,
  withOptimisticLock,
  transactionHelpers,
  TransactionMonitor,
  type TransactionOptions,
  type TransactionResult,
} from './transaction-wrapper'

// Pagination utilities (moved from @sports-bar/data in v2.54.16)
export * from './pagination'

// Database operation logging (moved from @sports-bar/data in v2.54.16)
export {
  logDatabaseOperation,
  logError,
  logInfo,
  logWarning,
} from './database-logger'

// File-based operation logger (moved from @sports-bar/data in v2.54.16)
export {
  OperationLogger,
  operationLogger,
  type OperationLog,
  type ErrorLog,
  type AIAccessibleLog,
} from './operation-logger'
