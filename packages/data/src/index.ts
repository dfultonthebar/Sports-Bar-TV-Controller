/**
 * @sports-bar/data
 *
 * Data layer utilities for Sports Bar TV Controller
 *
 * Provides:
 * - Database helpers with logging (factory pattern for DI)
 * - Pagination utilities (offset and cursor-based)
 * - Database operation logging
 * - Operation audit logging with AI learning data
 */

// Database helpers (factory pattern)
export {
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
  isNull,
  type DbHelperDependencies,
  type DbHelpers
} from './db-helpers'

// Pagination utilities
export {
  parsePaginationParams,
  paginateArray,
  paginateArrayWithCursor,
  createCursor,
  decodeCursor,
  buildPaginationMetadata,
  getOffset,
  getPaginationInfo,
  createPaginationResponse,
  createCursorPaginationResponse,
  validatePaginationParams,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  MIN_PAGE_SIZE,
  type PaginationParams,
  type PaginatedResponse,
  type CursorPaginationParams,
  type CursorPaginatedResponse
} from './pagination'

// Database logging utilities
export {
  logDatabaseOperation,
  logError,
  logInfo,
  logWarning
} from './database-logger'

// Operation logging with AI learning data
export {
  OperationLogger,
  operationLogger,
  type OperationLog,
  type ErrorLog,
  type AIAccessibleLog
} from './operation-logger'
