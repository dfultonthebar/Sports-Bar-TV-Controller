/**
 * Security Logger
 * Persists security validation events to database for audit and monitoring
 */

import { db } from '@/db';
import { securityValidationLogs } from '@/db/schema';

import { logger } from '@/lib/logger'
export interface SecurityLogEntry {
  validationType: 'file_system' | 'code_execution' | 'bash_command' | 'resource_limit';
  operationType?: string; // e.g., 'read', 'write', 'execute', 'delete'
  allowed: boolean;
  blockedReason?: string;
  blockedPatterns?: string[]; // Matched dangerous patterns
  requestPath?: string; // File path or command that was validated
  requestContent?: string; // Sanitized content of the request (truncated if too long)
  sanitizedInput?: any; // Sanitized input if allowed
  severity?: 'info' | 'warning' | 'critical';
  ipAddress?: string;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, any>;
}

/**
 * Log a security validation event to the database
 * This runs asynchronously and does not block the validation process
 */
export async function logSecurityEvent(entry: SecurityLogEntry): Promise<void> {
  try {
    // Determine severity if not provided
    const severity = entry.severity || (entry.allowed ? 'info' : 'warning');

    // Truncate long content to avoid database bloat
    const truncateContent = (content: string | undefined, maxLength = 1000): string | undefined => {
      if (!content) return undefined;
      return content.length > maxLength ? content.substring(0, maxLength) + '...' : content;
    };

    // Insert log entry
    await db.insert(securityValidationLogs).values({
      validationType: entry.validationType,
      operationType: entry.operationType || null,
      allowed: entry.allowed ? 1 : 0,
      blockedReason: entry.blockedReason || null,
      blockedPatterns: entry.blockedPatterns ? JSON.stringify(entry.blockedPatterns) : null,
      requestPath: truncateContent(entry.requestPath) || null,
      requestContent: truncateContent(entry.requestContent, 2000) || null,
      sanitizedInput: entry.sanitizedInput ? JSON.stringify(entry.sanitizedInput) : null,
      severity: severity,
      ipAddress: entry.ipAddress || null,
      userId: entry.userId || null,
      sessionId: entry.sessionId || null,
      metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
    });
  } catch (error) {
    // Log error but don't throw - we don't want logging failures to break validation
    logger.error('Failed to log security event:', error);
  }
}

/**
 * Log a security event synchronously (without waiting for database write)
 * Preferred method to avoid blocking validation
 */
export function logSecurityEventAsync(entry: SecurityLogEntry): void {
  // Fire and forget - log asynchronously
  logSecurityEvent(entry).catch(error => {
    logger.error('Failed to log security event (async):', error);
  });
}

/**
 * Query security logs with filters
 */
export interface SecurityLogQuery {
  validationType?: string;
  allowed?: boolean;
  severity?: string;
  userId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Retrieve security logs from database
 */
export async function getSecurityLogs(query: SecurityLogQuery = {}) {
  try {
    const { sql, and, eq, gte, lte, desc } = await import('drizzle-orm');

    // Build where conditions
    const conditions = [];

    if (query.validationType) {
      conditions.push(eq(securityValidationLogs.validationType, query.validationType));
    }

    if (query.allowed !== undefined) {
      conditions.push(eq(securityValidationLogs.allowed, query.allowed ? 1 : 0));
    }

    if (query.severity) {
      conditions.push(eq(securityValidationLogs.severity, query.severity));
    }

    if (query.userId) {
      conditions.push(eq(securityValidationLogs.userId, query.userId));
    }

    if (query.startDate) {
      conditions.push(gte(securityValidationLogs.timestamp, query.startDate.toISOString()));
    }

    if (query.endDate) {
      conditions.push(lte(securityValidationLogs.timestamp, query.endDate.toISOString()));
    }

    // Build query
    let dbQuery = db
      .select()
      .from(securityValidationLogs)
      .orderBy(desc(securityValidationLogs.timestamp));

    if (conditions.length > 0) {
      dbQuery = dbQuery.where(and(...conditions)) as any;
    }

    if (query.limit) {
      dbQuery = dbQuery.limit(query.limit) as any;
    }

    if (query.offset) {
      dbQuery = dbQuery.offset(query.offset) as any;
    }

    const logs = await dbQuery;

    // Parse JSON fields
    return logs.map(log => ({
      ...log,
      blockedPatterns: log.blockedPatterns ? JSON.parse(log.blockedPatterns) : null,
      sanitizedInput: log.sanitizedInput ? JSON.parse(log.sanitizedInput) : null,
      metadata: log.metadata ? JSON.parse(log.metadata) : null,
    }));
  } catch (error) {
    logger.error('Failed to query security logs:', error);
    throw error;
  }
}

/**
 * Get security log statistics
 */
export async function getSecurityLogStats(days: number = 7) {
  try {
    const { sql, and, gte, count } = await import('drizzle-orm');

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Total events
    const totalResult = await db
      .select({ count: count() })
      .from(securityValidationLogs)
      .where(gte(securityValidationLogs.timestamp, startDate.toISOString()));

    // Blocked events
    const blockedResult = await db
      .select({ count: count() })
      .from(securityValidationLogs)
      .where(
        and(
          gte(securityValidationLogs.timestamp, startDate.toISOString()),
          sql`${securityValidationLogs.allowed} = 0`
        )
      );

    // Critical events
    const criticalResult = await db
      .select({ count: count() })
      .from(securityValidationLogs)
      .where(
        and(
          gte(securityValidationLogs.timestamp, startDate.toISOString()),
          sql`${securityValidationLogs.severity} = 'critical'`
        )
      );

    // Group by validation type
    const byTypeResult = await db
      .select({
        validationType: securityValidationLogs.validationType,
        count: count(),
      })
      .from(securityValidationLogs)
      .where(gte(securityValidationLogs.timestamp, startDate.toISOString()))
      .groupBy(securityValidationLogs.validationType);

    return {
      period: `Last ${days} days`,
      total: totalResult[0]?.count || 0,
      blocked: blockedResult[0]?.count || 0,
      critical: criticalResult[0]?.count || 0,
      byType: byTypeResult,
    };
  } catch (error) {
    logger.error('Failed to get security log stats:', error);
    throw error;
  }
}
