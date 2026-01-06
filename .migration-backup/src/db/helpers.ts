/**
 * Drizzle Query Helpers
 * Provides Prisma-like interface for Drizzle queries to ease migration
 */

import { eq, and, or, like, gte, lte, gt, lt, ne, inArray, desc, asc, sql } from 'drizzle-orm'
import { db } from './index'
import * as schema from './schema'

// Type definitions for better TypeScript support
type Table = keyof typeof schema
type WhereClause = any
type OrderByClause = any
type SelectClause = any

/**
 * Generic find many helper
 */
export function findMany<T extends Table>(
  table: T,
  options?: {
    where?: WhereClause
    orderBy?: OrderByClause | OrderByClause[]
    limit?: number
    offset?: number
    select?: SelectClause
  }
) {
  let query = db.select(options?.select).from(schema[table] as any)
  
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
  
  return query.all()
}

/**
 * Generic find unique/first helper
 */
export function findFirst<T extends Table>(
  table: T,
  options?: {
    where?: WhereClause
    orderBy?: OrderByClause | OrderByClause[]
    select?: SelectClause
  }
) {
  let query = db.select(options?.select).from(schema[table] as any)
  
  if (options?.where) {
    query = query.where(options.where) as any
  }
  
  if (options?.orderBy) {
    const orderByArray = Array.isArray(options.orderBy) ? options.orderBy : [options.orderBy]
    query = query.orderBy(...orderByArray) as any
  }
  
  return query.limit(1).get()
}

/**
 * Generic create helper
 */
export function create<T extends Table>(
  table: T,
  data: any
) {
  return db.insert(schema[table] as any).values(data).returning().get()
}

/**
 * Generic create many helper
 */
export function createMany<T extends Table>(
  table: T,
  data: any[]
) {
  return db.insert(schema[table] as any).values(data).returning().all()
}

/**
 * Generic update helper
 */
export function update<T extends Table>(
  table: T,
  where: WhereClause,
  data: any
) {
  return db.update(schema[table] as any).set(data).where(where).returning().get()
}

/**
 * Generic delete helper
 */
export function deleteRecord<T extends Table>(
  table: T,
  where: WhereClause
) {
  return db.delete(schema[table] as any).where(where).returning().get()
}

/**
 * Generic delete many helper
 */
export function deleteMany<T extends Table>(
  table: T,
  where: WhereClause
) {
  return db.delete(schema[table] as any).where(where).returning().all()
}

/**
 * Generic count helper
 */
export function count<T extends Table>(
  table: T,
  where?: WhereClause
) {
  let query = db.select({ count: sql<number>`count(*)` }).from(schema[table] as any)
  
  if (where) {
    query = query.where(where) as any
  }
  
  const result = query.get()
  return result?.count || 0
}

/**
 * Generic upsert helper (insert or update)
 */
export function upsert<T extends Table>(
  table: T,
  where: WhereClause,
  create: any,
  update: any
) {
  const existing = findFirst(table, { where })
  
  if (existing) {
    return db.update(schema[table] as any).set(update).where(where).returning().get()
  } else {
    return db.insert(schema[table] as any).values(create).returning().get()
  }
}

// Export common operators for convenience
export { eq, and, or, like, gte, lte, gt, lt, ne, inArray, desc, asc, sql }
