/**
 * Database Helpers — re-exports from @sports-bar/database.
 *
 * Historical note: this file used to wire a `createDbHelpers` factory
 * from the now-deleted @sports-bar/data package, threading in app-specific
 * `db`, `schema`, and `logger` instances. The factory pattern was never
 * used as DI (the only caller passed the production singleton), so v2.54.16
 * collapsed it: pagination + operation-logger moved into @sports-bar/database
 * and this bridge is a thin re-export. See VERSION_SETUP_GUIDE.md v2.54.16.
 */

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
} from '@sports-bar/database'

// Re-export db + schema from the app's instance (the singleton runtime binding)
export { db, schema } from '@/db'
