import fs from 'fs'
import path from 'path'

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
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.log(`📝 [DB AUDIT] ${operation} on ${table}`)
    console.log(`User: ${user || 'system'}`)
    console.log(`Data:`, JSON.stringify(data, null, 2))
    if (metadata) {
      console.log(`Metadata:`, JSON.stringify(metadata, null, 2))
    }
    console.log(`Timestamp: ${timestamp}`)
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  } catch (error) {
    console.error('Failed to write audit log:', error)
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
    
    console.error(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.error(`❌ [DB ERROR] ${operation} on ${table}`)
    console.error(`Error:`, error.message || String(error))
    if (context) {
      console.error(`Context:`, JSON.stringify(context, null, 2))
    }
    console.error(`Timestamp: ${timestamp}`)
    console.error(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  } catch (err) {
    console.error('Failed to write error log:', err)
  }
}

export default {
  logDatabaseOperation,
  logDatabaseError,
}
