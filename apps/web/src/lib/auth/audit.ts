/**
 * Audit Logging System
 *
 * Tracks administrative and sensitive operations including:
 * - System modifications
 * - Configuration changes
 * - Destructive operations
 * - Authentication events
 */

import { db } from '@/db'
import { auditLogs } from '@/db/schema'
import { eq, and, gte, lte, desc } from 'drizzle-orm'
import { AUTH_CONFIG } from './config'
import { logger } from '@/lib/logger'

export interface AuditLogEntry {
  id: string
  locationId: string
  sessionId: string | null
  apiKeyId: string | null
  action: string
  resource: string
  resourceId: string | null
  endpoint: string
  method: string
  ipAddress: string
  userAgent: string | null
  requestData: string | null
  responseStatus: number | null
  success: boolean
  errorMessage: string | null
  metadata: string | null
  timestamp: string
}

export interface AuditLogFilters {
  locationId?: string
  sessionId?: string
  apiKeyId?: string
  action?: string
  resource?: string
  success?: boolean
  startDate?: Date
  endDate?: Date
  limit?: number
  offset?: number
}

/**
 * Log an administrative action
 */
export async function logAuditAction(params: {
  action: string
  resource: string
  resourceId?: string
  endpoint: string
  method: string
  ipAddress: string
  userAgent?: string
  sessionId?: string
  apiKeyId?: string
  requestData?: any
  responseStatus?: number
  success: boolean
  errorMessage?: string
  metadata?: any
  locationId?: string
}): Promise<{ success: boolean; logId?: string; error?: string }> {
  try {
    const locId = params.locationId || AUTH_CONFIG.LOCATION_ID

    const logEntry = await db.insert(auditLogs).values({
      locationId: locId,
      sessionId: params.sessionId || null,
      apiKeyId: params.apiKeyId || null,
      action: params.action,
      resource: params.resource,
      resourceId: params.resourceId || null,
      endpoint: params.endpoint,
      method: params.method,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent || null,
      requestData: params.requestData ? JSON.stringify(sanitizeRequestData(params.requestData)) : null,
      responseStatus: params.responseStatus || null,
      success: params.success,
      errorMessage: params.errorMessage || null,
      metadata: params.metadata ? JSON.stringify(params.metadata) : null,
    }).returning()

    logger.info(`Audit log created: ${params.action} on ${params.resource} (${params.success ? 'success' : 'failed'})`)

    return {
      success: true,
      logId: logEntry[0].id,
    }
  } catch (error) {
    logger.error('Error creating audit log:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create audit log',
    }
  }
}

/**
 * Sanitize request data to remove sensitive information
 */
function sanitizeRequestData(data: any): any {
  if (!data || typeof data !== 'object') {
    return data
  }

  const sanitized = { ...data }
  const sensitiveFields = ['password', 'pin', 'apiKey', 'api_key', 'token', 'secret', 'key']

  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]'
    }
  }

  return sanitized
}

/**
 * Get audit logs with optional filters
 */
export async function getAuditLogs(filters: AuditLogFilters = {}): Promise<AuditLogEntry[]> {
  try {
    const locId = filters.locationId || AUTH_CONFIG.LOCATION_ID
    const limit = filters.limit || 100
    const offset = filters.offset || 0

    let query = db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.locationId, locId))
      .orderBy(desc(auditLogs.timestamp))
      .limit(limit)
      .offset(offset)

    // Note: Drizzle ORM doesn't support dynamic query building easily
    // For production, you'd want to build the where clause conditionally
    // This is a simplified version

    const logs = await query

    // Filter in memory for now (not ideal for production)
    let filteredLogs = logs

    if (filters.sessionId) {
      filteredLogs = filteredLogs.filter(log => log.sessionId === filters.sessionId)
    }

    if (filters.apiKeyId) {
      filteredLogs = filteredLogs.filter(log => log.apiKeyId === filters.apiKeyId)
    }

    if (filters.action) {
      filteredLogs = filteredLogs.filter(log => log.action === filters.action)
    }

    if (filters.resource) {
      filteredLogs = filteredLogs.filter(log => log.resource === filters.resource)
    }

    if (filters.success !== undefined) {
      filteredLogs = filteredLogs.filter(log => log.success === filters.success)
    }

    if (filters.startDate) {
      filteredLogs = filteredLogs.filter(log => new Date(log.timestamp) >= filters.startDate!)
    }

    if (filters.endDate) {
      filteredLogs = filteredLogs.filter(log => new Date(log.timestamp) <= filters.endDate!)
    }

    return filteredLogs.map(log => ({
      id: log.id,
      locationId: log.locationId,
      sessionId: log.sessionId,
      apiKeyId: log.apiKeyId,
      action: log.action,
      resource: log.resource,
      resourceId: log.resourceId,
      endpoint: log.endpoint,
      method: log.method,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      requestData: log.requestData,
      responseStatus: log.responseStatus,
      success: log.success,
      errorMessage: log.errorMessage,
      metadata: log.metadata,
      timestamp: log.timestamp,
    }))
  } catch (error) {
    logger.error('Error getting audit logs:', error)
    return []
  }
}

/**
 * Get audit log by ID
 */
export async function getAuditLogById(logId: string): Promise<AuditLogEntry | null> {
  try {
    const logs = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.id, logId))
      .limit(1)

    if (logs.length === 0) {
      return null
    }

    const log = logs[0]
    return {
      id: log.id,
      locationId: log.locationId,
      sessionId: log.sessionId,
      apiKeyId: log.apiKeyId,
      action: log.action,
      resource: log.resource,
      resourceId: log.resourceId,
      endpoint: log.endpoint,
      method: log.method,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      requestData: log.requestData,
      responseStatus: log.responseStatus,
      success: log.success,
      errorMessage: log.errorMessage,
      metadata: log.metadata,
      timestamp: log.timestamp,
    }
  } catch (error) {
    logger.error('Error getting audit log by ID:', error)
    return null
  }
}

/**
 * Get audit log statistics
 */
export async function getAuditLogStats(
  locationId?: string,
  startDate?: Date,
  endDate?: Date
): Promise<{
  total: number
  successful: number
  failed: number
  byAction: Record<string, number>
  byResource: Record<string, number>
  uniqueUsers: number
}> {
  try {
    const locId = locationId || AUTH_CONFIG.LOCATION_ID

    let logs = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.locationId, locId))

    // Filter by date range if provided
    if (startDate) {
      logs = logs.filter(log => new Date(log.timestamp) >= startDate)
    }

    if (endDate) {
      logs = logs.filter(log => new Date(log.timestamp) <= endDate)
    }

    const total = logs.length
    const successful = logs.filter(log => log.success).length
    const failed = logs.filter(log => !log.success).length

    // Count by action
    const byAction: Record<string, number> = {}
    logs.forEach(log => {
      byAction[log.action] = (byAction[log.action] || 0) + 1
    })

    // Count by resource
    const byResource: Record<string, number> = {}
    logs.forEach(log => {
      byResource[log.resource] = (byResource[log.resource] || 0) + 1
    })

    // Count unique users (sessions + API keys)
    const uniqueSessions = new Set(logs.map(log => log.sessionId).filter(Boolean))
    const uniqueApiKeys = new Set(logs.map(log => log.apiKeyId).filter(Boolean))
    const uniqueUsers = uniqueSessions.size + uniqueApiKeys.size

    return {
      total,
      successful,
      failed,
      byAction,
      byResource,
      uniqueUsers,
    }
  } catch (error) {
    logger.error('Error getting audit log stats:', error)
    return {
      total: 0,
      successful: 0,
      failed: 0,
      byAction: {},
      byResource: {},
      uniqueUsers: 0,
    }
  }
}

/**
 * Get recent audit logs for a session
 */
export async function getSessionAuditLogs(
  sessionId: string,
  limit: number = 50
): Promise<AuditLogEntry[]> {
  try {
    const logs = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.sessionId, sessionId))
      .orderBy(desc(auditLogs.timestamp))
      .limit(limit)

    return logs.map(log => ({
      id: log.id,
      locationId: log.locationId,
      sessionId: log.sessionId,
      apiKeyId: log.apiKeyId,
      action: log.action,
      resource: log.resource,
      resourceId: log.resourceId,
      endpoint: log.endpoint,
      method: log.method,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      requestData: log.requestData,
      responseStatus: log.responseStatus,
      success: log.success,
      errorMessage: log.errorMessage,
      metadata: log.metadata,
      timestamp: log.timestamp,
    }))
  } catch (error) {
    logger.error('Error getting session audit logs:', error)
    return []
  }
}

/**
 * Clean up old audit logs beyond retention period
 */
export async function cleanupOldAuditLogs(
  retentionDays: number = AUTH_CONFIG.AUDIT_LOG_RETENTION_DAYS
): Promise<{ deleted: number; error?: string }> {
  try {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays)

    const result = await db
      .delete(auditLogs)
      .where(lte(auditLogs.timestamp, cutoffDate.toISOString()))
      .returning()

    const deletedCount = result.length

    if (deletedCount > 0) {
      logger.info(`Cleaned up ${deletedCount} old audit logs (older than ${retentionDays} days)`)
    }

    return { deleted: deletedCount }
  } catch (error) {
    logger.error('Error cleaning up old audit logs:', error)
    return {
      deleted: 0,
      error: error instanceof Error ? error.message : 'Failed to cleanup audit logs',
    }
  }
}

/**
 * Export audit logs to JSON
 */
export async function exportAuditLogs(filters: AuditLogFilters = {}): Promise<string> {
  try {
    const logs = await getAuditLogs(filters)
    return JSON.stringify(logs, null, 2)
  } catch (error) {
    logger.error('Error exporting audit logs:', error)
    throw error
  }
}
