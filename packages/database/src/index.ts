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
