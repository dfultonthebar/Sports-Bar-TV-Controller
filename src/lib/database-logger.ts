
/**
 * Database Logger
 * Provides centralized logging for database operations and system events
 */

interface LogEntry {
  timestamp: string
  category: string
  operation: string
  data?: any
}

/**
 * Log a database operation with structured data
 */
export function logDatabaseOperation(
  category: string,
  operation: string,
  data?: any
): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    category,
    operation,
    data
  }

  // Format log output
  const logLine = `[${entry.timestamp}] [${entry.category}] ${entry.operation}`
  
  if (data) {
    console.log(logLine, JSON.stringify(data, null, 2))
  } else {
    console.log(logLine)
  }

  // In production, you might want to:
  // - Write to a log file
  // - Send to a logging service (e.g., Winston, Pino)
  // - Store in a separate logging database
  // - Send to monitoring services (e.g., Sentry, DataDog)
}

/**
 * Log an error with context
 */
export function logError(
  category: string,
  error: Error | string,
  context?: any
): void {
  const errorMessage = error instanceof Error ? error.message : error
  const errorStack = error instanceof Error ? error.stack : undefined

  console.error(`[ERROR] [${category}]`, {
    message: errorMessage,
    stack: errorStack,
    context,
    timestamp: new Date().toISOString()
  })
}

/**
 * Log an informational message
 */
export function logInfo(
  category: string,
  message: string,
  data?: any
): void {
  console.log(`[INFO] [${category}] ${message}`, data || '')
}

/**
 * Log a warning
 */
export function logWarning(
  category: string,
  message: string,
  data?: any
): void {
  console.warn(`[WARN] [${category}] ${message}`, data || '')
}
