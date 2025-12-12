/**
 * Drizzle Database Helpers with Verbose Logging
 * Provides high-level database operations with comprehensive logging
 */

import { eq, and, or, desc, asc, inArray, like, gte, lte, gt, lt, ne, count as drizzleCount, sql, isNotNull, isNull } from 'drizzle-orm'
import { db, schema } from '@/db'
import { logger } from './logger'

// Re-export operators for convenience
export { eq, and, or, desc, asc, inArray, like, gte, lte, gt, lt, ne, sql, isNotNull, isNull }

// Re-export schema for external usage
export { schema }

// Type for table names
type TableName = keyof typeof schema

/**
 * Helper to get table name from schema key
 */
function getTableDisplayName(tableName: string): string {
  // Convert camelCase to readable format
  return tableName.replace(/([A-Z])/g, ' $1').trim()
}

/**
 * Helper to sanitize data for SQLite
 * SQLite3 can only bind: numbers, strings, bigints, buffers, and null
 */
function sanitizeData(data: any): any {
  const sanitized: any = {}
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) {
      continue // Skip undefined values
    } else if (value === null) {
      sanitized[key] = null
    } else if (value instanceof Date) {
      sanitized[key] = value.toISOString()
    } else if (typeof value === 'boolean') {
      sanitized[key] = value ? 1 : 0
    } else if (typeof value === 'number') {
      sanitized[key] = value
    } else if (typeof value === 'bigint') {
      sanitized[key] = value
    } else if (typeof value === 'string') {
      sanitized[key] = value
    } else if (Buffer.isBuffer(value)) {
      sanitized[key] = value
    } else if (typeof value === 'object') {
      // Convert objects to JSON strings for SQLite storage
      sanitized[key] = JSON.stringify(value)
    } else {
      // Convert any other type to string
      sanitized[key] = String(value)
    }
  }
  return sanitized
}

/**
 * Serialize Drizzle query result to plain object
 * This removes circular references from Drizzle proxy objects
 */
export function serializeDrizzleResult<T>(result: T): T {
  if (!result) return result
  if (Array.isArray(result)) {
    return result.map(item => serializeDrizzleResult(item)) as T
  }
  if (typeof result === 'object') {
    // Use a WeakSet to track seen objects and prevent infinite recursion
    const seen = new WeakSet()
    
    const serialize = (obj: any): any => {
      if (obj === null || typeof obj !== 'object') {
        return obj
      }
      
      // Check for circular reference
      if (seen.has(obj)) {
        return undefined  // Skip circular references
      }
      seen.add(obj)
      
      // Handle arrays
      if (Array.isArray(obj)) {
        return obj.map(item => serialize(item))
      }
      
      // Handle plain objects - copy only enumerable own properties
      const serialized: any = {}
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          const value = obj[key]
          // Skip functions and symbols
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
 * Find many records with logging
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
  
  logger.database.query('findMany', displayName, options)
  
  try {
    let query = db.select().from(table)
    
    if (options?.where) {
      query = query.where(options.where) as any
    }
    
    if (options?.orderBy) {
      const orderByArray = Array.isArray(options.orderBy) ? options.orderBy : [options.orderBy]
      query = query.orderBy(...orderByArray) as any
    }
    
    if (options?.limit) {
      query = query.limit(options.limit) as any
    }
    
    if (options?.offset) {
      query = query.offset(options.offset) as any
    }
    
    const result = await query.all()
    
    // Serialize result to remove circular references BEFORE logging
    const serialized = serializeDrizzleResult(result)
    logger.database.success('findMany', displayName, serialized)
    
    return serialized
  } catch (error) {
    logger.database.error('findMany', displayName, error)
    throw error
  }
}

/**
 * Find first record with logging
 */
export async function findFirst<T extends TableName>(
  tableName: T,
  options?: {
    where?: any
    orderBy?: any | any[]
  }
) {
  const table = schema[tableName] as any
  const displayName = getTableDisplayName(tableName)
  
  logger.database.query('findFirst', displayName, options)
  
  try {
    let query = db.select().from(table)
    
    if (options?.where) {
      query = query.where(options.where) as any
    }
    
    if (options?.orderBy) {
      const orderByArray = Array.isArray(options.orderBy) ? options.orderBy : [options.orderBy]
      query = query.orderBy(...orderByArray) as any
    }
    
    const result = await query.limit(1).get()
    logger.database.success('findFirst', displayName, result ? { found: true } : { found: false })
    
    // Serialize result to remove circular references
    return serializeDrizzleResult(result)
  } catch (error) {
    logger.database.error('findFirst', displayName, error)
    throw error
  }
}

/**
 * Find unique record with logging
 */
export async function findUnique<T extends TableName>(
  tableName: T,
  where: any
) {
  const table = schema[tableName] as any
  const displayName = getTableDisplayName(tableName)
  
  logger.database.query('findUnique', displayName, { where })
  
  try {
    const result = await db.select().from(table).where(where).limit(1).get()
    logger.database.success('findUnique', displayName, result ? { found: true } : { found: false })
    
    // Serialize result to remove circular references
    return serializeDrizzleResult(result)
  } catch (error) {
    logger.database.error('findUnique', displayName, error)
    throw error
  }
}

/**
 * Create record with logging
 */
export async function create<T extends TableName>(
  tableName: T,
  data: any
) {
  const table = schema[tableName] as any
  const displayName = getTableDisplayName(tableName)
  
  logger.database.query('create', displayName, { data })
  
  try {
    // Add updatedAt if the table has it
    const dataWithTimestamp = { ...data }
    if ('updatedAt' in table && !dataWithTimestamp.updatedAt) {
      dataWithTimestamp.updatedAt = new Date().toISOString()
    }
    
    const sanitizedData = sanitizeData(dataWithTimestamp)
    const result = await db.insert(table).values(sanitizedData).returning().get()
    
    logger.database.success('create', displayName, { id: result?.id })
    
    // Serialize result to remove circular references
    return serializeDrizzleResult(result)
  } catch (error) {
    logger.database.error('create', displayName, error)
    throw error
  }
}

/**
 * Create many records with logging
 */
export async function createMany<T extends TableName>(
  tableName: T,
  data: any[]
) {
  const table = schema[tableName] as any
  const displayName = getTableDisplayName(tableName)
  
  logger.database.query('createMany', displayName, { count: data.length })
  
  try {
    const sanitizedData = data.map(item => {
      const itemWithTimestamp = { ...item }
      if ('updatedAt' in table && !itemWithTimestamp.updatedAt) {
        itemWithTimestamp.updatedAt = new Date().toISOString()
      }
      return sanitizeData(itemWithTimestamp)
    })
    
    const result = await db.insert(table).values(sanitizedData).returning().all() as any[]

    logger.database.success('createMany', displayName, { count: result.length })
    
    // Serialize result to remove circular references
    return serializeDrizzleResult(result)
  } catch (error) {
    logger.database.error('createMany', displayName, error)
    throw error
  }
}

/**
 * Update record with logging
 */
export async function update<T extends TableName>(
  tableName: T,
  where: any,
  data: any
) {
  const table = schema[tableName] as any
  const displayName = getTableDisplayName(tableName)
  
  logger.database.query('update', displayName, { where, data })
  
  try {
    // Add updatedAt if the table has it
    const dataWithTimestamp = { ...data }
    if ('updatedAt' in table) {
      dataWithTimestamp.updatedAt = new Date().toISOString()
    }
    
    const sanitizedData = sanitizeData(dataWithTimestamp)
    const result = await db.update(table).set(sanitizedData).where(where).returning().get()
    
    logger.database.success('update', displayName, { id: result?.id })
    
    // Serialize result to remove circular references
    return serializeDrizzleResult(result)
  } catch (error) {
    logger.database.error('update', displayName, error)
    throw error
  }
}

/**
 * Update many records with logging
 */
export async function updateMany<T extends TableName>(
  tableName: T,
  where: any,
  data: any
) {
  const table = schema[tableName] as any
  const displayName = getTableDisplayName(tableName)
  
  logger.database.query('updateMany', displayName, { where, data })
  
  try {
    // Add updatedAt if the table has it
    const dataWithTimestamp = { ...data }
    if ('updatedAt' in table) {
      dataWithTimestamp.updatedAt = new Date().toISOString()
    }
    
    const sanitizedData = sanitizeData(dataWithTimestamp)
    const result = await db.update(table).set(sanitizedData).where(where).returning().all() as any[]

    logger.database.success('updateMany', displayName, { count: result.length })
    
    // Serialize result to remove circular references
    return serializeDrizzleResult(result)
  } catch (error) {
    logger.database.error('updateMany', displayName, error)
    throw error
  }
}

/**
 * Delete record with logging
 */
export async function deleteRecord<T extends TableName>(
  tableName: T,
  where: any
) {
  const table = schema[tableName] as any
  const displayName = getTableDisplayName(tableName)
  
  logger.database.query('delete', displayName, { where })
  
  try {
    const result = await db.delete(table).where(where).returning().get()
    
    logger.database.success('delete', displayName, { id: result?.id })
    
    // Serialize result to remove circular references
    return serializeDrizzleResult(result)
  } catch (error) {
    logger.database.error('delete', displayName, error)
    throw error
  }
}

/**
 * Delete many records with logging
 */
export async function deleteMany<T extends TableName>(
  tableName: T,
  where: any
) {
  const table = schema[tableName] as any
  const displayName = getTableDisplayName(tableName)
  
  logger.database.query('deleteMany', displayName, { where })
  
  try {
    const result = await db.delete(table).where(where).returning().all() as any[]

    logger.database.success('deleteMany', displayName, { count: result.length })
    
    // Serialize result to remove circular references
    return serializeDrizzleResult(result)
  } catch (error) {
    logger.database.error('deleteMany', displayName, error)
    throw error
  }
}

/**
 * Count records with logging
 */
export async function count<T extends TableName>(
  tableName: T,
  where?: any
) {
  const table = schema[tableName] as any
  const displayName = getTableDisplayName(tableName)
  
  logger.database.query('count', displayName, { where })
  
  try {
    let query = db.select({ count: drizzleCount() }).from(table)
    
    if (where) {
      query = query.where(where) as any
    }
    
    const result = await query.get()
    const countValue = result?.count || 0
    
    logger.database.success('count', displayName, { count: countValue })
    
    return countValue
  } catch (error) {
    logger.database.error('count', displayName, error)
    throw error
  }
}

/**
 * Upsert record with logging
 */
export async function upsert<T extends TableName>(
  tableName: T,
  where: any,
  createData: any,
  updateData: any
) {
  const table = schema[tableName] as any
  const displayName = getTableDisplayName(tableName)
  
  logger.database.query('upsert', displayName, { where, createData, updateData })
  
  try {
    const existing = await db.select().from(table).where(where).limit(1).get()
    
    if (existing) {
      const dataWithTimestamp = { ...updateData }
      if ('updatedAt' in table) {
        dataWithTimestamp.updatedAt = new Date().toISOString()
      }
      
      const sanitizedData = sanitizeData(dataWithTimestamp)
      const result = await db.update(table).set(sanitizedData).where(where).returning().get()
      
      logger.database.success('upsert (update)', displayName, { id: result?.id })
      
      // Serialize result to remove circular references
      return serializeDrizzleResult(result)
    } else {
      const dataWithTimestamp = { ...createData }
      if ('updatedAt' in table && !dataWithTimestamp.updatedAt) {
        dataWithTimestamp.updatedAt = new Date().toISOString()
      }
      
      const sanitizedData = sanitizeData(dataWithTimestamp)
      const result = await db.insert(table).values(sanitizedData).returning().get()
      
      logger.database.success('upsert (create)', displayName, { id: result?.id })
      
      // Serialize result to remove circular references
      return serializeDrizzleResult(result)
    }
  } catch (error) {
    logger.database.error('upsert', displayName, error)
    throw error
  }
}

/**
 * Execute raw SQL with logging
 */
export async function executeRaw(query: string, params?: any[]) {
  logger.database.query('executeRaw', 'SQL', { query, params })
  
  try {
    const result = await db.run(sql.raw(query))
    logger.database.success('executeRaw', 'SQL')
    return result
  } catch (error) {
    logger.database.error('executeRaw', 'SQL', error)
    throw error
  }
}

/**
 * Transaction helper with logging
 */
export async function transaction<T>(
  callback: (tx: typeof db) => Promise<T>
): Promise<T> {
  logger.database.query('transaction', 'START', {})

  try {
    const result = await db.transaction(callback as any) as T
    logger.database.success('transaction', 'COMMIT', {})
    return result
  } catch (error) {
    logger.database.error('transaction', 'ROLLBACK', error)
    throw error
  }
}

// Export database instance for direct usage
export { db }
