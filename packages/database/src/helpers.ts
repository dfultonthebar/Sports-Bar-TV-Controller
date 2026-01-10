/**
 * Drizzle Database Helpers
 * Provides high-level database operations with optional logging
 */

import { eq, and, or, desc, asc, inArray, like, gte, lte, gt, lt, ne, not, count as drizzleCount, sql, isNotNull, isNull } from 'drizzle-orm'
import { db, schema } from './db'

// Re-export operators for convenience
export { eq, and, or, desc, asc, inArray, like, gte, lte, gt, lt, ne, not, sql, isNotNull, isNull }

// Re-export schema for external usage
export { schema }

// Type for table names
type TableName = keyof typeof schema

// Optional logger interface
export interface DbHelperLogger {
  query?: (operation: string, table: string, options?: any) => void;
  success?: (operation: string, table: string, result?: any) => void;
  error?: (operation: string, table: string, error?: any) => void;
}

// Default no-op logger
let logger: DbHelperLogger = {}

/**
 * Set logger for db helpers
 */
export function setDbHelperLogger(newLogger: DbHelperLogger): void {
  logger = newLogger
}

/**
 * Helper to get table name from schema key
 */
function getTableDisplayName(tableName: string): string {
  return tableName.replace(/([A-Z])/g, ' $1').trim()
}

/**
 * Helper to sanitize data for SQLite
 */
function sanitizeData(data: any): any {
  const sanitized: any = {}
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) {
      continue
    } else if (value === null) {
      sanitized[key] = null
    } else if (value instanceof Date) {
      sanitized[key] = value.toISOString()
    } else if (typeof value === 'boolean') {
      sanitized[key] = value ? 1 : 0
    } else if (typeof value === 'number' || typeof value === 'bigint' || typeof value === 'string') {
      sanitized[key] = value
    } else if (Buffer.isBuffer(value)) {
      sanitized[key] = value
    } else if (typeof value === 'object') {
      sanitized[key] = JSON.stringify(value)
    } else {
      sanitized[key] = String(value)
    }
  }
  return sanitized
}

/**
 * Serialize Drizzle query result to plain object
 */
export function serializeDrizzleResult<T>(result: T): T {
  if (!result) return result
  if (Array.isArray(result)) {
    return result.map(item => serializeDrizzleResult(item)) as T
  }
  if (typeof result === 'object') {
    const seen = new WeakSet()
    const serialize = (obj: any): any => {
      if (obj === null || typeof obj !== 'object') return obj
      if (seen.has(obj)) return undefined
      seen.add(obj)
      if (Array.isArray(obj)) return obj.map(item => serialize(item))
      const serialized: any = {}
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          const value = obj[key]
          if (typeof value !== 'function' && typeof value !== 'symbol') {
            serialized[key] = serialize(value)
          }
        }
      }
      return serialized
    }
    return serialize(result) as T
  }
  return result
}

/**
 * Find many records
 */
export async function findMany<T extends TableName>(
  tableName: T,
  options?: {
    where?: any
    orderBy?: any | any[]
    limit?: number
    offset?: number
  }
) {
  const table = schema[tableName] as any
  const displayName = getTableDisplayName(tableName)

  logger.query?.('findMany', displayName, options)

  try {
    let query = db.select().from(table)
    if (options?.where) query = query.where(options.where) as any
    if (options?.orderBy) {
      const orderByArray = Array.isArray(options.orderBy) ? options.orderBy : [options.orderBy]
      query = query.orderBy(...orderByArray) as any
    }
    if (options?.limit) query = query.limit(options.limit) as any
    if (options?.offset) query = query.offset(options.offset) as any

    const result = await query.all()
    const serialized = serializeDrizzleResult(result)
    logger.success?.('findMany', displayName, { count: serialized.length })
    return serialized
  } catch (error) {
    logger.error?.('findMany', displayName, error)
    throw error
  }
}

/**
 * Find first record
 */
export async function findFirst<T extends TableName>(
  tableName: T,
  options?: { where?: any; orderBy?: any | any[] }
) {
  const table = schema[tableName] as any
  const displayName = getTableDisplayName(tableName)

  logger.query?.('findFirst', displayName, options)

  try {
    let query = db.select().from(table)
    if (options?.where) query = query.where(options.where) as any
    if (options?.orderBy) {
      const orderByArray = Array.isArray(options.orderBy) ? options.orderBy : [options.orderBy]
      query = query.orderBy(...orderByArray) as any
    }
    const result = await query.limit(1).get()
    logger.success?.('findFirst', displayName, result ? { found: true } : { found: false })
    return serializeDrizzleResult(result)
  } catch (error) {
    logger.error?.('findFirst', displayName, error)
    throw error
  }
}

/**
 * Find unique record
 */
export async function findUnique<T extends TableName>(tableName: T, where: any) {
  const table = schema[tableName] as any
  const displayName = getTableDisplayName(tableName)

  logger.query?.('findUnique', displayName, { where })

  try {
    const result = await db.select().from(table).where(where).limit(1).get()
    logger.success?.('findUnique', displayName, result ? { found: true } : { found: false })
    return serializeDrizzleResult(result)
  } catch (error) {
    logger.error?.('findUnique', displayName, error)
    throw error
  }
}

/**
 * Create record
 */
export async function create<T extends TableName>(tableName: T, data: any) {
  const table = schema[tableName] as any
  const displayName = getTableDisplayName(tableName)

  logger.query?.('create', displayName, { data })

  try {
    const dataWithTimestamp = { ...data }
    if ('updatedAt' in table && !dataWithTimestamp.updatedAt) {
      dataWithTimestamp.updatedAt = new Date().toISOString()
    }
    const sanitizedData = sanitizeData(dataWithTimestamp)
    const result = await db.insert(table).values(sanitizedData).returning().get()
    logger.success?.('create', displayName, { id: result?.id })
    return serializeDrizzleResult(result)
  } catch (error) {
    logger.error?.('create', displayName, error)
    throw error
  }
}

/**
 * Create many records
 */
export async function createMany<T extends TableName>(tableName: T, data: any[]) {
  const table = schema[tableName] as any
  const displayName = getTableDisplayName(tableName)

  logger.query?.('createMany', displayName, { count: data.length })

  try {
    const sanitizedData = data.map(item => {
      const itemWithTimestamp = { ...item }
      if ('updatedAt' in table && !itemWithTimestamp.updatedAt) {
        itemWithTimestamp.updatedAt = new Date().toISOString()
      }
      return sanitizeData(itemWithTimestamp)
    })
    const result = await db.insert(table).values(sanitizedData).returning().all() as any[]
    logger.success?.('createMany', displayName, { count: result.length })
    return serializeDrizzleResult(result)
  } catch (error) {
    logger.error?.('createMany', displayName, error)
    throw error
  }
}

/**
 * Update record
 */
export async function update<T extends TableName>(tableName: T, where: any, data: any) {
  const table = schema[tableName] as any
  const displayName = getTableDisplayName(tableName)

  logger.query?.('update', displayName, { where, data })

  try {
    const dataWithTimestamp = { ...data }
    if ('updatedAt' in table) {
      dataWithTimestamp.updatedAt = new Date().toISOString()
    }
    const sanitizedData = sanitizeData(dataWithTimestamp)
    const result = await db.update(table).set(sanitizedData).where(where).returning().get()
    logger.success?.('update', displayName, { id: result?.id })
    return serializeDrizzleResult(result)
  } catch (error) {
    logger.error?.('update', displayName, error)
    throw error
  }
}

/**
 * Update many records
 */
export async function updateMany<T extends TableName>(tableName: T, where: any, data: any) {
  const table = schema[tableName] as any
  const displayName = getTableDisplayName(tableName)

  logger.query?.('updateMany', displayName, { where, data })

  try {
    const dataWithTimestamp = { ...data }
    if ('updatedAt' in table) {
      dataWithTimestamp.updatedAt = new Date().toISOString()
    }
    const sanitizedData = sanitizeData(dataWithTimestamp)
    const result = await db.update(table).set(sanitizedData).where(where).returning().all() as any[]
    logger.success?.('updateMany', displayName, { count: result.length })
    return serializeDrizzleResult(result)
  } catch (error) {
    logger.error?.('updateMany', displayName, error)
    throw error
  }
}

/**
 * Delete record
 */
export async function deleteRecord<T extends TableName>(tableName: T, where: any) {
  const table = schema[tableName] as any
  const displayName = getTableDisplayName(tableName)

  logger.query?.('delete', displayName, { where })

  try {
    const result = await db.delete(table).where(where).returning().get()
    logger.success?.('delete', displayName, { id: result?.id })
    return serializeDrizzleResult(result)
  } catch (error) {
    logger.error?.('delete', displayName, error)
    throw error
  }
}

/**
 * Delete many records
 */
export async function deleteMany<T extends TableName>(tableName: T, where: any) {
  const table = schema[tableName] as any
  const displayName = getTableDisplayName(tableName)

  logger.query?.('deleteMany', displayName, { where })

  try {
    const result = await db.delete(table).where(where).returning().all() as any[]
    logger.success?.('deleteMany', displayName, { count: result.length })
    return serializeDrizzleResult(result)
  } catch (error) {
    logger.error?.('deleteMany', displayName, error)
    throw error
  }
}

/**
 * Count records
 */
export async function count<T extends TableName>(tableName: T, where?: any) {
  const table = schema[tableName] as any
  const displayName = getTableDisplayName(tableName)

  logger.query?.('count', displayName, { where })

  try {
    let query = db.select({ count: drizzleCount() }).from(table)
    if (where) query = query.where(where) as any
    const result = await query.get()
    const countValue = result?.count || 0
    logger.success?.('count', displayName, { count: countValue })
    return countValue
  } catch (error) {
    logger.error?.('count', displayName, error)
    throw error
  }
}

/**
 * Upsert record
 */
export async function upsert<T extends TableName>(
  tableName: T,
  where: any,
  createData: any,
  updateData: any
) {
  const table = schema[tableName] as any
  const displayName = getTableDisplayName(tableName)

  logger.query?.('upsert', displayName, { where, createData, updateData })

  try {
    const existing = await db.select().from(table).where(where).limit(1).get()

    if (existing) {
      const dataWithTimestamp = { ...updateData }
      if ('updatedAt' in table) {
        dataWithTimestamp.updatedAt = new Date().toISOString()
      }
      const sanitizedData = sanitizeData(dataWithTimestamp)
      const result = await db.update(table).set(sanitizedData).where(where).returning().get()
      logger.success?.('upsert (update)', displayName, { id: result?.id })
      return serializeDrizzleResult(result)
    } else {
      const dataWithTimestamp = { ...createData }
      if ('updatedAt' in table && !dataWithTimestamp.updatedAt) {
        dataWithTimestamp.updatedAt = new Date().toISOString()
      }
      const sanitizedData = sanitizeData(dataWithTimestamp)
      const result = await db.insert(table).values(sanitizedData).returning().get()
      logger.success?.('upsert (create)', displayName, { id: result?.id })
      return serializeDrizzleResult(result)
    }
  } catch (error) {
    logger.error?.('upsert', displayName, error)
    throw error
  }
}

/**
 * Execute raw SQL
 */
export async function executeRaw(query: string, _params?: any[]) {
  logger.query?.('executeRaw', 'SQL', { query })

  try {
    const result = await db.run(sql.raw(query))
    logger.success?.('executeRaw', 'SQL')
    return result
  } catch (error) {
    logger.error?.('executeRaw', 'SQL', error)
    throw error
  }
}

/**
 * Transaction helper
 */
export async function transaction<T>(callback: (tx: typeof db) => Promise<T>): Promise<T> {
  logger.query?.('transaction', 'START', {})

  try {
    const result = await db.transaction(callback as any) as T
    logger.success?.('transaction', 'COMMIT', {})
    return result
  } catch (error) {
    logger.error?.('transaction', 'ROLLBACK', error)
    throw error
  }
}

// Export database instance for direct usage
export { db }
