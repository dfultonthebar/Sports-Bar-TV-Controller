import fs from 'fs'
import path from 'path'

import { logger } from '@/lib/logger'
const AUDIT_LOG_PATH = '/home/ubuntu/sports-bar-data/audit.log'

export interface AuditLogEntry {
  timestamp: string
  operation: string
  table: string
  data: any
  user?: string
  metadata?: Record<string, any>
}

export function logDatabaseOperation(
  operation: string,
  table: string,
  data: any,
  user?: string,
  metadata?: Record<string, any>
) {
  const timestamp = new Date().toISOString()
  const logEntry: AuditLogEntry = {
    timestamp,
    operation,
    table,
    data,
    user: user || 'system',
    metadata,
  }
  
  try {
    // Ensure directory exists
    const logDir = path.dirname(AUDIT_LOG_PATH)
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true })
    }
    
    // Write to audit log
    const logLine = JSON.stringify(logEntry) + '\n'
    fs.appendFileSync(AUDIT_LOG_PATH, logLine)
    
    // Also log to console for PM2
    logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    logger.info(`📝 [DB AUDIT] ${operation} on ${table}`)
    logger.info(`User: ${user || 'system'}`)
    logger.info(`Data:`, { data: JSON.stringify(data, null, 2) })
    if (metadata) {
      logger.info(`Metadata:`, { data: JSON.stringify(metadata, null, 2) })
    }
    logger.info(`Timestamp: ${timestamp}`)
    logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  } catch (error) {
    logger.error('Failed to write audit log:', error)
  }
}

export function logDatabaseError(
  operation: string,
  table: string,
  error: any,
  context?: Record<string, any>
) {
  const timestamp = new Date().toISOString()
  const logEntry = {
    timestamp,
    level: 'ERROR',
    operation,
    table,
    error: error.message || String(error),
    stack: error.stack,
    context,
  }
  
  try {
    const logLine = JSON.stringify(logEntry) + '\n'
    fs.appendFileSync(AUDIT_LOG_PATH, logLine)
    
    logger.error(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    logger.error(`❌ [DB ERROR] ${operation} on ${table}`)
    logger.error(`Error:`, error.message || String(error))
    if (context) {
      logger.error(`Context:`, { data: JSON.stringify(context, null, 2) })
    }
    logger.error(`Timestamp: ${timestamp}`)
    logger.error(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  } catch (err) {
    logger.error('Failed to write error log:', err)
  }
}

export default {
  logDatabaseOperation,
  logDatabaseError,
}
