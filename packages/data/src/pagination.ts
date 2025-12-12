/**
 * Pagination Utilities
 *
 * Provides cursor-based and offset-based pagination helpers
 * for efficient data retrieval and API responses.
 */

export interface PaginationParams {
  page?: number
  limit?: number
  cursor?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    total: number
    page: number
    limit: number
    totalPages: number
    hasNextPage: boolean
    hasPreviousPage: boolean
    nextCursor?: string | null
    previousCursor?: string | null
  }
}

export interface CursorPaginationParams {
  limit?: number
  cursor?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface CursorPaginatedResponse<T> {
  data: T[]
  pagination: {
    limit: number
    hasNextPage: boolean
    hasPreviousPage: boolean
    nextCursor: string | null
    previousCursor: string | null
  }
}

export const DEFAULT_PAGE_SIZE = 50
export const MAX_PAGE_SIZE = 200
export const MIN_PAGE_SIZE = 1

/**
 * Parse and validate pagination parameters from request
 */
export function parsePaginationParams(searchParams: URLSearchParams): PaginationParams {
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const limit = Math.min(
    MAX_PAGE_SIZE,
    Math.max(MIN_PAGE_SIZE, parseInt(searchParams.get('limit') || String(DEFAULT_PAGE_SIZE), 10))
  )
  const cursor = searchParams.get('cursor') || undefined
  const sortBy = searchParams.get('sortBy') || undefined
  const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc'

  return {
    page,
    limit,
    cursor,
    sortBy,
    sortOrder
  }
}

/**
 * Paginate an array with offset-based pagination
 */
export function paginateArray<T>(
  data: T[],
  page: number = 1,
  limit: number = DEFAULT_PAGE_SIZE
): PaginatedResponse<T> {
  const normalizedPage = Math.max(1, page)
  const normalizedLimit = Math.min(MAX_PAGE_SIZE, Math.max(MIN_PAGE_SIZE, limit))
  const total = data.length
  const totalPages = Math.ceil(total / normalizedLimit)
  const offset = (normalizedPage - 1) * normalizedLimit

  const paginatedData = data.slice(offset, offset + normalizedLimit)

  return {
    data: paginatedData,
    pagination: {
      total,
      page: normalizedPage,
      limit: normalizedLimit,
      totalPages,
      hasNextPage: normalizedPage < totalPages,
      hasPreviousPage: normalizedPage > 1,
      nextCursor: null,
      previousCursor: null
    }
  }
}

/**
 * Create cursor from data item
 */
export function createCursor(item: any, sortBy: string = 'id'): string {
  const value = item[sortBy]
  const encoded = Buffer.from(JSON.stringify({ [sortBy]: value })).toString('base64')
  return encoded
}

/**
 * Decode cursor to get filter value
 */
export function decodeCursor(cursor: string): Record<string, any> | null {
  try {
    const decoded = Buffer.from(cursor, 'base64').toString('utf-8')
    return JSON.parse(decoded)
  } catch {
    return null
  }
}

/**
 * Paginate array with cursor-based pagination
 */
export function paginateArrayWithCursor<T>(
  data: T[],
  params: CursorPaginationParams,
  idField: string = 'id'
): CursorPaginatedResponse<T> {
  const limit = Math.min(
    MAX_PAGE_SIZE,
    Math.max(MIN_PAGE_SIZE, params.limit || DEFAULT_PAGE_SIZE)
  )
  const sortBy = params.sortBy || idField
  const sortOrder = params.sortOrder || 'desc'

  let filteredData = [...data]

  // Sort data
  filteredData.sort((a: any, b: any) => {
    const aVal = a[sortBy]
    const bVal = b[sortBy]

    if (sortOrder === 'asc') {
      return aVal > bVal ? 1 : aVal < bVal ? -1 : 0
    } else {
      return aVal < bVal ? 1 : aVal > bVal ? -1 : 0
    }
  })

  // Apply cursor filter if provided
  if (params.cursor) {
    const cursorData = decodeCursor(params.cursor)
    if (cursorData && cursorData[sortBy] !== undefined) {
      const cursorValue = cursorData[sortBy]
      filteredData = filteredData.filter((item: any) => {
        if (sortOrder === 'asc') {
          return item[sortBy] > cursorValue
        } else {
          return item[sortBy] < cursorValue
        }
      })
    }
  }

  // Get page + 1 to check if there's a next page
  const paginatedData = filteredData.slice(0, limit + 1)
  const hasNextPage = paginatedData.length > limit
  const actualData = hasNextPage ? paginatedData.slice(0, limit) : paginatedData

  // Create cursors
  const nextCursor =
    hasNextPage && actualData.length > 0
      ? createCursor(actualData[actualData.length - 1], sortBy)
      : null
  const previousCursor = params.cursor || null

  return {
    data: actualData,
    pagination: {
      limit,
      hasNextPage,
      hasPreviousPage: !!params.cursor,
      nextCursor,
      previousCursor
    }
  }
}

/**
 * Build pagination metadata for responses
 */
export function buildPaginationMetadata(
  total: number,
  page: number,
  limit: number
): PaginatedResponse<never>['pagination'] {
  const totalPages = Math.ceil(total / limit)

  return {
    total,
    page,
    limit,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
    nextCursor: null,
    previousCursor: null
  }
}

/**
 * Calculate offset from page and limit
 */
export function getOffset(page: number, limit: number): number {
  return (Math.max(1, page) - 1) * Math.max(1, limit)
}

/**
 * Get pagination info from array slice
 */
export function getPaginationInfo(
  totalCount: number,
  page: number = 1,
  limit: number = DEFAULT_PAGE_SIZE
): {
  offset: number
  limit: number
  totalPages: number
  hasMore: boolean
} {
  const normalizedPage = Math.max(1, page)
  const normalizedLimit = Math.min(MAX_PAGE_SIZE, Math.max(MIN_PAGE_SIZE, limit))
  const offset = getOffset(normalizedPage, normalizedLimit)
  const totalPages = Math.ceil(totalCount / normalizedLimit)
  const hasMore = normalizedPage < totalPages

  return {
    offset,
    limit: normalizedLimit,
    totalPages,
    hasMore
  }
}

/**
 * Helper to create standardized pagination response
 */
export function createPaginationResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
): PaginatedResponse<T> {
  return {
    data,
    pagination: buildPaginationMetadata(total, page, limit)
  }
}

/**
 * Helper to create cursor-based pagination response
 */
export function createCursorPaginationResponse<T>(
  data: T[],
  hasNextPage: boolean,
  nextCursor: string | null,
  previousCursor: string | null,
  limit: number
): CursorPaginatedResponse<T> {
  return {
    data,
    pagination: {
      limit,
      hasNextPage,
      hasPreviousPage: !!previousCursor,
      nextCursor,
      previousCursor
    }
  }
}

/**
 * Validate pagination parameters
 */
export function validatePaginationParams(params: PaginationParams): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (params.page && params.page < 1) {
    errors.push('Page must be greater than 0')
  }

  if (params.limit) {
    if (params.limit < MIN_PAGE_SIZE) {
      errors.push(`Limit must be at least ${MIN_PAGE_SIZE}`)
    }
    if (params.limit > MAX_PAGE_SIZE) {
      errors.push(`Limit cannot exceed ${MAX_PAGE_SIZE}`)
    }
  }

  if (params.sortOrder && !['asc', 'desc'].includes(params.sortOrder)) {
    errors.push('Sort order must be either "asc" or "desc"')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}
