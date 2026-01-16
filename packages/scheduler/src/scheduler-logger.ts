/**
 * Scheduler Logger
 * Centralized logging for all scheduler operations with database persistence
 * and metrics tracking with correlation IDs for tracing related operations.
 */

import { db, schema, eq, and } from '@sports-bar/database'
import { logger } from '@sports-bar/logger'
import { v4 as uuidv4 } from 'uuid'

// ============================================================================
// Types
// ============================================================================

export type SchedulerComponent =
  | 'scheduler-service'
  | 'auto-reallocator'
  | 'distribution-engine'
  | 'smart-input-allocator'
  | 'priority-calculator'
  | 'conflict-detector'
  | 'espn-sync'
  | 'state-reader'
  | 'tournament-detector'
  | 'firetv-detector'
  | 'bartender-remote'
  | 'directv-api'
  | 'cable-ir-api'

export type SchedulerOperation =
  | 'tune'
  | 'recover'
  | 'allocate'
  | 'reallocate'
  | 'distribute'
  | 'calculate-priority'
  | 'detect-conflict'
  | 'sync'
  | 'cleanup'
  | 'startup'
  | 'check'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface SchedulerLogEntry {
  correlationId: string
  component: SchedulerComponent
  operation: SchedulerOperation
  level: LogLevel
  message: string
  gameId?: string
  inputSourceId?: string
  allocationId?: string
  channelNumber?: string
  deviceType?: 'cable' | 'directv' | 'firetv'
  deviceId?: string
  success: boolean
  durationMs?: number
  errorMessage?: string
  errorStack?: string
  metadata?: Record<string, any>
}

interface MetricsBufferEntry {
  successCount: number
  failureCount: number
  totalDurationMs: number
  minDurationMs: number
  maxDurationMs: number
  componentBreakdown: Record<string, number>
}

// ============================================================================
// Scheduler Logger Class
// ============================================================================

class SchedulerLogger {
  private metricsBuffer: Map<string, MetricsBufferEntry> = new Map()
  private flushInterval: NodeJS.Timeout | null = null
  private isInitialized: boolean = false

  /**
   * Initialize the logger and start metrics flushing
   */
  init(): void {
    if (this.isInitialized) return

    // Flush metrics every 5 minutes
    this.flushInterval = setInterval(() => {
      this.flushMetrics().catch((err) => {
        logger.error('[SCHEDULER-LOGGER] Error flushing metrics:', err)
      })
    }, 5 * 60 * 1000)

    this.isInitialized = true
    logger.info('[SCHEDULER-LOGGER] Scheduler logger initialized')
  }

  /**
   * Generate a new correlation ID for tracking related operations
   */
  generateCorrelationId(): string {
    return uuidv4()
  }

  /**
   * Log a scheduler operation to database and console
   */
  async log(entry: SchedulerLogEntry): Promise<void> {
    try {
      // Write to database
      await db.insert(schema.schedulerLogs).values({
        id: uuidv4(),
        correlationId: entry.correlationId,
        component: entry.component,
        operation: entry.operation,
        level: entry.level,
        message: entry.message,
        gameId: entry.gameId || null,
        inputSourceId: entry.inputSourceId || null,
        allocationId: entry.allocationId || null,
        channelNumber: entry.channelNumber || null,
        deviceType: entry.deviceType || null,
        deviceId: entry.deviceId || null,
        success: entry.success,
        durationMs: entry.durationMs ?? null,
        errorMessage: entry.errorMessage || null,
        errorStack: entry.errorStack || null,
        metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
      })

      // Update metrics buffer
      this.updateMetricsBuffer(entry)

      // Also log to console for real-time debugging
      const componentTag = `[${entry.component.toUpperCase()}]`
      const prefix = entry.success ? '✅' : '❌'

      if (entry.level === 'error') {
        logger.error(`${componentTag} ${prefix} ${entry.message}`, {
          correlationId: entry.correlationId,
          operation: entry.operation,
          durationMs: entry.durationMs,
          error: entry.errorMessage,
        })
      } else if (entry.level === 'warn') {
        logger.warn(`${componentTag} ⚠️ ${entry.message}`, {
          correlationId: entry.correlationId,
          operation: entry.operation,
        })
      } else if (entry.level === 'debug') {
        logger.debug(`${componentTag} ${entry.message}`, {
          correlationId: entry.correlationId,
        })
      } else {
        logger.info(`${componentTag} ${prefix} ${entry.message}`, {
          correlationId: entry.correlationId,
          operation: entry.operation,
          durationMs: entry.durationMs,
        })
      }
    } catch (error: any) {
      // Fallback to console if DB write fails - don't lose the log
      logger.error('[SCHEDULER-LOGGER] Failed to write log to database:', {
        error: error.message,
        entry: { ...entry, errorStack: undefined }, // Don't log stack in fallback
      })
    }
  }

  /**
   * Log an info level message
   */
  async info(
    component: SchedulerComponent,
    operation: SchedulerOperation,
    message: string,
    correlationId: string,
    context?: Partial<SchedulerLogEntry>
  ): Promise<void> {
    await this.log({
      correlationId,
      component,
      operation,
      level: 'info',
      message,
      success: true,
      ...context,
    })
  }

  /**
   * Log an error level message
   */
  async error(
    component: SchedulerComponent,
    operation: SchedulerOperation,
    message: string,
    correlationId: string,
    error: Error,
    context?: Partial<SchedulerLogEntry>
  ): Promise<void> {
    await this.log({
      correlationId,
      component,
      operation,
      level: 'error',
      message,
      success: false,
      errorMessage: error.message,
      errorStack: error.stack,
      ...context,
    })
  }

  /**
   * Log a warning level message
   */
  async warn(
    component: SchedulerComponent,
    operation: SchedulerOperation,
    message: string,
    correlationId: string,
    context?: Partial<SchedulerLogEntry>
  ): Promise<void> {
    await this.log({
      correlationId,
      component,
      operation,
      level: 'warn',
      message,
      success: true,
      ...context,
    })
  }

  /**
   * Log a debug level message
   */
  async debug(
    component: SchedulerComponent,
    operation: SchedulerOperation,
    message: string,
    correlationId: string,
    context?: Partial<SchedulerLogEntry>
  ): Promise<void> {
    await this.log({
      correlationId,
      component,
      operation,
      level: 'debug',
      message,
      success: true,
      ...context,
    })
  }

  /**
   * Track an async operation with automatic timing and logging
   */
  async trackOperation<T>(
    component: SchedulerComponent,
    operation: SchedulerOperation,
    correlationId: string,
    fn: () => Promise<T>,
    context?: Partial<SchedulerLogEntry>
  ): Promise<T> {
    const startTime = Date.now()

    try {
      const result = await fn()
      const durationMs = Date.now() - startTime

      await this.log({
        correlationId,
        component,
        operation,
        level: 'info',
        message: `${operation} completed successfully`,
        success: true,
        durationMs,
        ...context,
      })

      return result
    } catch (error: any) {
      const durationMs = Date.now() - startTime

      await this.log({
        correlationId,
        component,
        operation,
        level: 'error',
        message: `${operation} failed: ${error.message}`,
        success: false,
        durationMs,
        errorMessage: error.message,
        errorStack: error.stack,
        ...context,
      })

      throw error
    }
  }

  /**
   * Update in-memory metrics buffer
   */
  private updateMetricsBuffer(entry: SchedulerLogEntry): void {
    const now = new Date()
    const hourStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      now.getHours()
    )
    const key = `${entry.operation}_hourly_${hourStart.getTime()}`

    let metrics = this.metricsBuffer.get(key)
    if (!metrics) {
      metrics = {
        successCount: 0,
        failureCount: 0,
        totalDurationMs: 0,
        minDurationMs: Infinity,
        maxDurationMs: 0,
        componentBreakdown: {},
      }
      this.metricsBuffer.set(key, metrics)
    }

    if (entry.success) {
      metrics.successCount++
    } else {
      metrics.failureCount++
    }

    if (entry.durationMs !== undefined) {
      metrics.totalDurationMs += entry.durationMs
      metrics.minDurationMs = Math.min(metrics.minDurationMs, entry.durationMs)
      metrics.maxDurationMs = Math.max(metrics.maxDurationMs, entry.durationMs)
    }

    metrics.componentBreakdown[entry.component] =
      (metrics.componentBreakdown[entry.component] || 0) + 1
  }

  /**
   * Flush accumulated metrics to database
   */
  async flushMetrics(): Promise<void> {
    if (this.metricsBuffer.size === 0) return

    const entries = Array.from(this.metricsBuffer.entries())
    this.metricsBuffer.clear()

    for (const [key, metrics] of entries) {
      const [metricType, period, periodStartStr] = key.split('_')
      const periodStart = parseInt(periodStartStr, 10)
      const totalCount = metrics.successCount + metrics.failureCount

      try {
        // Check if metrics entry already exists
        const existing = await db
          .select()
          .from(schema.schedulerMetrics)
          .where(
            and(
              eq(schema.schedulerMetrics.metricType, metricType),
              eq(schema.schedulerMetrics.period, period),
              eq(schema.schedulerMetrics.periodStart, periodStart)
            )
          )
          .limit(1)

        const now = Math.floor(Date.now() / 1000)

        if (existing.length > 0) {
          // Update existing metrics
          const prev = existing[0]
          const newTotal = (prev.totalCount || 0) + totalCount
          const newTotalDuration =
            (prev.totalDurationMs || 0) + metrics.totalDurationMs

          await db
            .update(schema.schedulerMetrics)
            .set({
              successCount: (prev.successCount || 0) + metrics.successCount,
              failureCount: (prev.failureCount || 0) + metrics.failureCount,
              totalCount: newTotal,
              totalDurationMs: newTotalDuration,
              minDurationMs:
                metrics.minDurationMs === Infinity
                  ? prev.minDurationMs
                  : Math.min(
                      prev.minDurationMs ?? Infinity,
                      metrics.minDurationMs
                    ),
              maxDurationMs: Math.max(
                prev.maxDurationMs ?? 0,
                metrics.maxDurationMs
              ),
              avgDurationMs:
                newTotal > 0 ? Math.floor(newTotalDuration / newTotal) : null,
              componentBreakdown: JSON.stringify(metrics.componentBreakdown),
              updatedAt: now,
            })
            .where(eq(schema.schedulerMetrics.id, prev.id))
        } else {
          // Insert new metrics entry
          await db.insert(schema.schedulerMetrics).values({
            id: uuidv4(),
            metricType,
            period,
            periodStart,
            successCount: metrics.successCount,
            failureCount: metrics.failureCount,
            totalCount,
            totalDurationMs: metrics.totalDurationMs,
            minDurationMs:
              metrics.minDurationMs === Infinity
                ? null
                : metrics.minDurationMs,
            maxDurationMs:
              metrics.maxDurationMs === 0 ? null : metrics.maxDurationMs,
            avgDurationMs:
              totalCount > 0
                ? Math.floor(metrics.totalDurationMs / totalCount)
                : null,
            componentBreakdown: JSON.stringify(metrics.componentBreakdown),
            createdAt: now,
            updatedAt: now,
          })
        }
      } catch (error: any) {
        logger.error('[SCHEDULER-LOGGER] Failed to flush metrics:', {
          error: error.message,
          key,
        })
      }
    }

    logger.debug(
      `[SCHEDULER-LOGGER] Flushed ${entries.length} metrics entries`
    )
  }

  /**
   * Stop the logger and flush remaining metrics
   */
  async stop(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval)
      this.flushInterval = null
    }

    // Flush any remaining metrics
    await this.flushMetrics()

    this.isInitialized = false
    logger.info('[SCHEDULER-LOGGER] Scheduler logger stopped')
  }
}

// ============================================================================
// Export singleton instance
// ============================================================================

export const schedulerLogger = new SchedulerLogger()
