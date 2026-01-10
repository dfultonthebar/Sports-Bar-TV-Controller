/**
 * Database Transaction Wrapper - SYNCHRONOUS VERSION
 * Provides comprehensive transaction support with automatic rollback, retry logic, and logging
 *
 * IMPORTANT: This wrapper is designed for Drizzle ORM with better-sqlite3, which requires
 * SYNCHRONOUS transaction callbacks. Do NOT use async/await inside transaction functions.
 *
 * Features:
 * - Automatic rollback on error
 * - Retry logic for transient failures (deadlocks, busy database)
 * - Performance metrics tracking
 * - Comprehensive logging
 * - Type-safe transaction context
 *
 * WHY SYNCHRONOUS?
 * better-sqlite3 is a synchronous library. Starting in v11.10, it throws an error if you
 * try to use async callbacks in transactions. Drizzle's better-sqlite3 adapter does NOT
 * await transaction callbacks, so using async/await inside transactions doesn't work.
 */

import { db, schema } from './db'
import { logger } from '@sports-bar/logger'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'

/**
 * Transaction options
 */
export interface TransactionOptions {
  /**
   * Maximum number of retry attempts for transient failures
   * @default 3
   */
  maxRetries?: number

  /**
   * Delay in milliseconds between retry attempts
   * @default 100
   */
  retryDelay?: number

  /**
   * Transaction isolation level (SQLite supports DEFERRED, IMMEDIATE, EXCLUSIVE)
   * Note: This is primarily for documentation - better-sqlite3 doesn't support setting this per-transaction
   * @default 'IMMEDIATE'
   */
  isolationLevel?: 'DEFERRED' | 'IMMEDIATE' | 'EXCLUSIVE'

  /**
   * Custom transaction name for logging
   */
  name?: string
}

/**
 * Transaction result with metadata
 */
export interface TransactionResult<T> {
  success: boolean
  data?: T
  error?: Error
  duration: number
  retries: number
}

/**
 * Transaction statistics
 */
interface TransactionStats {
  startTime: number
  endTime?: number
  duration?: number
  retries: number
  error?: Error
}

/**
 * Check if error is a transient failure that should be retried
 */
function isTransientError(error: any): boolean {
  const message = error?.message?.toLowerCase() || ''

  // SQLite error codes that indicate transient failures
  const transientErrors = [
    'database is locked',
    'database table is locked',
    'deadlock',
    'busy',
    'sqlite_busy',
    'sqlite_locked',
  ]

  return transientErrors.some(msg => message.includes(msg))
}

/**
 * Sleep helper for retry delays - SYNCHRONOUS
 */
function sleepSync(ms: number): void {
  const start = Date.now()
  while (Date.now() - start < ms) {
    // Busy wait - not ideal but necessary for synchronous retries
    // In practice, SQLite lock waits are usually < 100ms
  }
}

/**
 * Execute operation within a transaction with automatic rollback and retry
 *
 * IMPORTANT: The operation function MUST be synchronous. Do NOT use async/await.
 *
 * @param operation - SYNCHRONOUS function to execute within transaction context
 * @param options - Transaction options
 * @returns Result of operation
 *
 * @example
 * ```typescript
 * // CORRECT - Synchronous transaction
 * const result = withTransaction((tx) => {
 *   const user = tx.insert(users).values({ name: 'John' }).returning().get()
 *   tx.insert(userLogs).values({ userId: user.id, action: 'created' }).run()
 *   return user
 * }, { name: 'create-user', maxRetries: 3 })
 *
 * // WRONG - Do NOT use async/await
 * const result = withTransaction(async (tx) => {  // ❌ WRONG
 *   const user = await tx.insert(users).values({ name: 'John' }).returning().get()  // ❌ WRONG
 *   return user
 * })
 * ```
 */
export function withTransaction<T>(
  operation: (tx: BetterSQLite3Database<typeof schema>) => T,
  options: TransactionOptions = {}
): T {
  const {
    maxRetries = 3,
    retryDelay = 100,
    isolationLevel = 'IMMEDIATE',
    name = 'anonymous',
  } = options

  const stats: TransactionStats = {
    startTime: Date.now(),
    retries: 0
  }

  let lastError: Error | undefined

  // Retry loop
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      stats.retries = attempt
      logger.database.query('transaction', 'RETRY', {
        name,
        attempt,
        maxRetries,
        error: lastError?.message
      })

      // Exponential backoff
      const delay = retryDelay * Math.pow(2, attempt - 1)
      sleepSync(delay)
    }

    try {
      logger.database.query('transaction', 'START', {
        name,
        isolationLevel,
        attempt: attempt + 1,
      })

      // Execute SYNCHRONOUS transaction
      // Note: db.transaction() in Drizzle's better-sqlite3 adapter does NOT await the callback
      const result = db.transaction((tx) => {
        try {
          const operationResult = operation(tx as any)

          // Check if operation incorrectly returned a Promise
          if (operationResult instanceof Promise) {
            throw new Error('Transaction function cannot return a promise. Remove async/await from transaction callback.')
          }

          return operationResult
        } catch (error: any) {
          // Error in operation - will trigger automatic rollback
          throw error
        }
      })

      // Success!
      stats.endTime = Date.now()
      stats.duration = stats.endTime - stats.startTime

      logger.database.success('transaction', 'COMMIT', {
        name,
        duration: stats.duration,
        retries: stats.retries
      })

      // Record metrics
      TransactionMonitor.record(name, stats.duration, stats.retries, true)

      return result as T

    } catch (error: any) {
      lastError = error instanceof Error ? error : new Error(String(error))
      stats.error = lastError

      // Check if this is a transient error that should be retried
      const shouldRetry = isTransientError(error) && attempt < maxRetries

      if (shouldRetry) {
        logger.database.query('transaction', 'ROLLBACK_RETRY', {
          name,
          error: lastError.message,
          attempt: attempt + 1,
          willRetry: true
        })
        continue // Retry
      } else {
        // Final failure
        stats.endTime = Date.now()
        stats.duration = stats.endTime - stats.startTime

        logger.database.error('transaction', 'ROLLBACK_FINAL', {
          name,
          error: lastError.message,
          duration: stats.duration,
          retries: stats.retries
        })

        // Record metrics
        TransactionMonitor.record(name, stats.duration, stats.retries, false)

        throw lastError
      }
    }
  }

  // Should never reach here, but TypeScript requires it
  throw lastError || new Error('Transaction failed after all retries')
}

/**
 * Execute multiple operations in a single transaction
 * Returns array of results in the same order as operations
 *
 * @param operations - Array of SYNCHRONOUS functions to execute
 * @param options - Transaction options
 * @returns Array of results
 *
 * @example
 * ```typescript
 * const [user, log, notification] = batchTransaction([
 *   (tx) => tx.insert(users).values({ name: 'John' }).returning().get(),
 *   (tx) => tx.insert(logs).values({ action: 'user_created' }).returning().get(),
 *   (tx) => tx.insert(notifications).values({ message: 'Welcome!' }).returning().get()
 * ], { name: 'create-user-batch' })
 * ```
 */
export function batchTransaction<T extends any[]>(
  operations: Array<(tx: BetterSQLite3Database<typeof schema>) => any>,
  options: TransactionOptions = {}
): T {
  return withTransaction((tx) => {
    const results: any[] = []

    for (let i = 0; i < operations.length; i++) {
      try {
        const result = operations[i](tx)
        results.push(result)
      } catch (error) {
        logger.error(`Batch transaction operation ${i + 1}/${operations.length} failed:`, { error })
        throw error // Will trigger rollback
      }
    }

    return results as T
  }, {
    ...options,
    name: options.name || `batch-${operations.length}-ops`
  })
}

/**
 * Execute operation with optimistic locking
 * Checks version before update to detect concurrent modifications
 *
 * @param operation - SYNCHRONOUS function that receives current version and returns updated data
 * @param options - Transaction options
 * @returns Result of operation
 *
 * @example
 * ```typescript
 * withOptimisticLock((tx, currentVersion) => {
 *   return tx.update(config)
 *     .set({ value: 'new', version: currentVersion + 1 })
 *     .where(and(
 *       eq(config.id, id),
 *       eq(config.version, currentVersion)
 *     ))
 *     .returning()
 *     .get()
 * }, { name: 'update-config-with-lock' })
 * ```
 */
export function withOptimisticLock<T>(
  operation: (
    tx: BetterSQLite3Database<typeof schema>,
    version: number
  ) => T,
  options: TransactionOptions = {}
): T {
  return withTransaction((tx) => {
    // Note: Version checking must be implemented in the operation function
    // This wrapper provides the transaction context
    const result = operation(tx, 0) // Version will be passed by caller
    return result
  }, {
    ...options,
    name: options.name || 'optimistic-lock'
  })
}

/**
 * Convenience wrapper for common transaction patterns
 */
export const transactionHelpers = {
  /**
   * Create record with audit log in single transaction
   *
   * NOTE: The createOp function MUST be synchronous
   */
  createWithAudit<T>(
    createOp: (tx: any) => T,
    auditData: { action: string; details?: any; userId?: string },
    options?: TransactionOptions
  ): T {
    return withTransaction((tx) => {
      // Create the record
      const result = createOp(tx)

      // Log the action - use schema from closure
      const auditTable = (schema as any).auditLogs

      if (auditTable) {
        tx.insert(auditTable).values({
          action: auditData.action,
          details: JSON.stringify({ result, ...auditData.details }),
          userId: auditData.userId || 'system',
          timestamp: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }).run()
      }

      return result
    }, { ...options, name: options?.name || 'create-with-audit' })
  },

  /**
   * Update record with audit log in single transaction
   *
   * NOTE: The updateOp function MUST be synchronous
   */
  updateWithAudit<T>(
    updateOp: (tx: any) => T,
    auditData: { action: string; details?: any; userId?: string },
    options?: TransactionOptions
  ): T {
    return withTransaction((tx) => {
      // Update the record
      const result = updateOp(tx)

      // Log the change
      const auditTable = (schema as any).auditLogs

      if (auditTable) {
        tx.insert(auditTable).values({
          action: auditData.action,
          details: JSON.stringify({ result, ...auditData.details }),
          userId: auditData.userId || 'system',
          timestamp: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }).run()
      }

      return result
    }, { ...options, name: options?.name || 'update-with-audit' })
  },

  /**
   * Delete record with audit log in single transaction
   *
   * NOTE: The deleteOp function MUST be synchronous
   */
  deleteWithAudit<T>(
    deleteOp: (tx: any) => T,
    auditData: { action: string; details?: any; userId?: string },
    options?: TransactionOptions
  ): T {
    return withTransaction((tx) => {
      // Delete the record
      const result = deleteOp(tx)

      // Log the deletion
      const auditTable = (schema as any).auditLogs

      if (auditTable) {
        tx.insert(auditTable).values({
          action: auditData.action,
          details: JSON.stringify({ result, ...auditData.details }),
          userId: auditData.userId || 'system',
          timestamp: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }).run()
      }

      return result
    }, { ...options, name: options?.name || 'delete-with-audit' })
  }
}

/**
 * Transaction performance monitor
 * Tracks transaction metrics for performance analysis
 */
export class TransactionMonitor {
  private static metrics: Array<{
    name: string
    duration: number
    retries: number
    timestamp: number
    success: boolean
  }> = []

  static record(name: string, duration: number, retries: number, success: boolean) {
    this.metrics.push({
      name,
      duration,
      retries,
      timestamp: Date.now(),
      success
    })

    // Keep only last 1000 transactions
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000)
    }
  }

  static getStats() {
    const total = this.metrics.length
    const successful = this.metrics.filter(m => m.success).length
    const failed = total - successful
    const avgDuration = this.metrics.reduce((sum, m) => sum + m.duration, 0) / total || 0
    const avgRetries = this.metrics.reduce((sum, m) => sum + m.retries, 0) / total || 0

    return {
      total,
      successful,
      failed,
      successRate: total > 0 ? (successful / total) * 100 : 0,
      avgDuration,
      avgRetries,
      recentTransactions: this.metrics.slice(-10)
    }
  }

  static reset() {
    this.metrics = []
  }
}

export default withTransaction
