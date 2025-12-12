/**
 * Database Helpers - Bridge to @sports-bar/data
 *
 * This file bridges the local import path (@/lib/db-helpers) to the shared package.
 * It initializes the factory-based helpers with app-specific dependencies.
 */

import {
  createDbHelpers,
  sanitizeData,
  serializeDrizzleResult,
  // Re-export Drizzle operators
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
  sql,
  isNotNull,
  isNull
} from '@sports-bar/data'
import { db, schema } from '@/db'
import { logger } from './logger'

// Re-export operators for convenience
export { eq, and, or, desc, asc, inArray, like, gte, lte, gt, lt, ne, sql, isNotNull, isNull }

// Re-export schema for external usage
export { schema }

// Re-export utilities
export { sanitizeData, serializeDrizzleResult }

// Initialize helpers with app-specific dependencies
const helpers = createDbHelpers({ db, schema, logger })

// Export all helper functions
export const {
  findMany,
  findFirst,
  findUnique,
  create,
  createMany,
  update,
  updateMany,
  deleteRecord,
  deleteMany,
  count,
  upsert,
  executeRaw,
  transaction
} = helpers

// Export database instance for direct usage
export { db }
