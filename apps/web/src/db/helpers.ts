/**
 * Database Helpers - Bridge to @sports-bar/database
 *
 * This file bridges the local import path (@/db/helpers) to the shared package.
 * Re-exports all CRUD helpers and Drizzle operators.
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
  serializeDrizzleResult,

  // Drizzle operators
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
  isNull,
} from '@sports-bar/database'
