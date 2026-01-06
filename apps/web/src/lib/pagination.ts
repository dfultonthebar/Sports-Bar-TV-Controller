/**
 * Pagination Utilities - Re-exported from @sports-bar/data
 *
 * This file bridges the local import path (@/lib/pagination) to the shared package.
 * All pagination functionality is maintained in the @sports-bar/data package.
 */

// Re-export everything from the data package pagination module
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
} from '@sports-bar/data'
