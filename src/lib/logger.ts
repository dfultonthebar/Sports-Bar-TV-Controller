/**
 * Comprehensive Logging Utility for Sports Bar TV Controller
 * Provides verbose logging for debugging database operations, API calls, and system events
 */

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  SUCCESS = 'SUCCESS',
}

export enum LogCategory {
  DATABASE = 'DATABASE',
  API = 'API',
  ATLAS = 'ATLAS',
  NETWORK = 'NETWORK',
  AUTH = 'AUTH',
  SYSTEM = 'SYSTEM',
  CACHE = 'CACHE',
}

interface LogOptions {
  category?: LogCategory
  level?: LogLevel
  data?: any
  error?: Error | unknown
  timestamp?: boolean
}

class Logger {
  private colors = {
    [LogLevel.DEBUG]: '\x1b[36m',    // Cyan
    [LogLevel.INFO]: '\x1b[34m',     // Blue
    [LogLevel.WARN]: '\x1b[33m',     // Yellow
    [LogLevel.ERROR]: '\x1b[31m',    // Red
    [LogLevel.SUCCESS]: '\x1b[32m',  // Green
    reset: '\x1b[0m',
  }

  private categoryColors = {
    [LogCategory.DATABASE]: '\x1b[35m',  // Magenta
    [LogCategory.API]: '\x1b[36m',       // Cyan
    [LogCategory.ATLAS]: '\x1b[33m',     // Yellow
    [LogCategory.NETWORK]: '\x1b[34m',   // Blue
    [LogCategory.AUTH]: '\x1b[32m',      // Green
    [LogCategory.SYSTEM]: '\x1b[37m',    // White
    [LogCategory.CACHE]: '\x1b[35m',     // Magenta
  }

  private getTimestamp(): string {
    const now = new Date()
    return now.toISOString()
  }

  private formatMessage(
    level: LogLevel,
    category: LogCategory | undefined,
    message: string,
    options?: LogOptions
  ): string {
    const timestamp = options?.timestamp !== false ? `[${this.getTimestamp()}]` : ''
    const levelColor = this.colors[level]
    const categoryStr = category ? `[${category}]` : ''
    const categoryColor = category ? this.categoryColors[category] : ''
    const reset = this.colors.reset
    
    return `${timestamp}${levelColor}[${level}]${reset}${categoryColor}${categoryStr}${reset} ${message}`
  }

  /**
   * Safely stringify data, handling circular references
   */
  private safeStringify(data: any): string {
    const seen = new WeakSet()
    return JSON.stringify(data, (key, value) => {
      // Skip Drizzle ORM internal properties
      if (key === 'table' || key === 'queryConfig' || key === '_' || key === 'session') {
        return undefined
      }
      
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular]'
        }
        seen.add(value)
      }
      return value
    }, 2)
  }

  private logWithData(
    level: LogLevel,
    message: string,
    options?: LogOptions
  ) {
    const formattedMessage = this.formatMessage(level, options?.category, message, options)
    
    // Choose console method based on level
    const consoleMethod = level === LogLevel.ERROR ? console.error :
                         level === LogLevel.WARN ? console.warn :
                         console.log

    consoleMethod(formattedMessage)
    
    // Log additional data if provided
    if (options?.data) {
      try {
        console.log('  Data:', this.safeStringify(options.data))
      } catch (error) {
        console.log('  Data: [Unable to serialize - circular reference detected]')
      }
    }
    
    // Log error details if provided
    if (options?.error) {
      if (options.error instanceof Error) {
        console.error('  Error:', options.error.message)
        if (options.error.stack) {
          console.error('  Stack:', options.error.stack)
        }
      } else {
        console.error('  Error:', options.error)
      }
    }
  }

  // Database logging methods
  database = {
    query: (operation: string, table: string, params?: any) => {
      this.logWithData(LogLevel.DEBUG, `DB Query: ${operation} on ${table}`, {
        category: LogCategory.DATABASE,
        data: params,
      })
    },
    
    success: (operation: string, table: string, result?: any) => {
      this.logWithData(LogLevel.SUCCESS, `DB Success: ${operation} on ${table}`, {
        category: LogCategory.DATABASE,
        data: result ? { rowCount: Array.isArray(result) ? result.length : 1 } : undefined,
      })
    },
    
    error: (operation: string, table: string, error: Error | unknown) => {
      this.logWithData(LogLevel.ERROR, `DB Error: ${operation} on ${table}`, {
        category: LogCategory.DATABASE,
        error,
      })
    },
    
    connection: (status: 'connected' | 'disconnected', dbPath?: string) => {
      this.logWithData(
        status === 'connected' ? LogLevel.SUCCESS : LogLevel.WARN,
        `Database ${status}${dbPath ? `: ${dbPath}` : ''}`,
        { category: LogCategory.DATABASE }
      )
    },
  }

  // API logging methods
  api = {
    request: (method: string, endpoint: string, body?: any) => {
      this.logWithData(LogLevel.INFO, `API Request: ${method} ${endpoint}`, {
        category: LogCategory.API,
        data: body,
      })
    },
    
    response: (method: string, endpoint: string, status: number, data?: any) => {
      const level = status >= 200 && status < 300 ? LogLevel.SUCCESS :
                   status >= 400 && status < 500 ? LogLevel.WARN :
                   LogLevel.ERROR
      
      this.logWithData(level, `API Response: ${method} ${endpoint} - ${status}`, {
        category: LogCategory.API,
        data: data ? { dataSize: JSON.stringify(data).length } : undefined,
      })
    },
    
    error: (method: string, endpoint: string, error: Error | unknown) => {
      this.logWithData(LogLevel.ERROR, `API Error: ${method} ${endpoint}`, {
        category: LogCategory.API,
        error,
      })
    },
  }

  // Atlas processor logging methods
  atlas = {
    connect: (ip: string, port: number) => {
      this.logWithData(LogLevel.INFO, `Atlas: Connecting to ${ip}:${port}`, {
        category: LogCategory.ATLAS,
      })
    },
    
    connected: (ip: string, port: number) => {
      this.logWithData(LogLevel.SUCCESS, `Atlas: Connected to ${ip}:${port}`, {
        category: LogCategory.ATLAS,
      })
    },
    
    command: (command: string, params?: any) => {
      this.logWithData(LogLevel.DEBUG, `Atlas: Sending command: ${command}`, {
        category: LogCategory.ATLAS,
        data: params,
      })
    },
    
    response: (command: string, response: any) => {
      this.logWithData(LogLevel.SUCCESS, `Atlas: Received response for: ${command}`, {
        category: LogCategory.ATLAS,
        data: response,
      })
    },
    
    error: (operation: string, error: Error | unknown) => {
      this.logWithData(LogLevel.ERROR, `Atlas: Error in ${operation}`, {
        category: LogCategory.ATLAS,
        error,
      })
    },
    
    disconnect: (ip: string, port: number) => {
      this.logWithData(LogLevel.WARN, `Atlas: Disconnected from ${ip}:${port}`, {
        category: LogCategory.ATLAS,
      })
    },
    
    info: (message: string, data?: any) => {
      this.logWithData(LogLevel.INFO, `Atlas: ${message}`, {
        category: LogCategory.ATLAS,
        data,
      })
    },
  }

  // Network logging methods
  network = {
    request: (url: string, method: string = 'GET') => {
      this.logWithData(LogLevel.DEBUG, `Network: ${method} request to ${url}`, {
        category: LogCategory.NETWORK,
      })
    },
    
    response: (url: string, status: number) => {
      const level = status >= 200 && status < 300 ? LogLevel.SUCCESS : LogLevel.ERROR
      this.logWithData(level, `Network: Response from ${url} - ${status}`, {
        category: LogCategory.NETWORK,
      })
    },
    
    error: (url: string, error: Error | unknown) => {
      this.logWithData(LogLevel.ERROR, `Network: Error requesting ${url}`, {
        category: LogCategory.NETWORK,
        error,
      })
    },
  }

  // Authentication logging methods
  auth = {
    attempt: (username: string) => {
      this.logWithData(LogLevel.INFO, `Auth: Login attempt for user: ${username}`, {
        category: LogCategory.AUTH,
      })
    },
    
    success: (username: string) => {
      this.logWithData(LogLevel.SUCCESS, `Auth: Login successful for user: ${username}`, {
        category: LogCategory.AUTH,
      })
    },
    
    failure: (username: string, reason?: string) => {
      this.logWithData(LogLevel.WARN, `Auth: Login failed for user: ${username}${reason ? ` - ${reason}` : ''}`, {
        category: LogCategory.AUTH,
      })
    },
    
    logout: (username: string) => {
      this.logWithData(LogLevel.INFO, `Auth: User logged out: ${username}`, {
        category: LogCategory.AUTH,
      })
    },
  }

  // System logging methods
  system = {
    startup: (component: string) => {
      this.logWithData(LogLevel.INFO, `System: Starting ${component}`, {
        category: LogCategory.SYSTEM,
      })
    },
    
    ready: (component: string) => {
      this.logWithData(LogLevel.SUCCESS, `System: ${component} is ready`, {
        category: LogCategory.SYSTEM,
      })
    },
    
    shutdown: (component: string) => {
      this.logWithData(LogLevel.WARN, `System: Shutting down ${component}`, {
        category: LogCategory.SYSTEM,
      })
    },
    
    error: (component: string, error: Error | unknown) => {
      this.logWithData(LogLevel.ERROR, `System: Error in ${component}`, {
        category: LogCategory.SYSTEM,
        error,
      })
    },
  }

  // Cache logging methods
  cache = {
    hit: (key: string) => {
      this.logWithData(LogLevel.DEBUG, `Cache: Hit for key: ${key}`, {
        category: LogCategory.CACHE,
      })
    },
    
    miss: (key: string) => {
      this.logWithData(LogLevel.DEBUG, `Cache: Miss for key: ${key}`, {
        category: LogCategory.CACHE,
      })
    },
    
    set: (key: string, ttl?: number) => {
      this.logWithData(LogLevel.DEBUG, `Cache: Set key: ${key}${ttl ? ` (TTL: ${ttl}s)` : ''}`, {
        category: LogCategory.CACHE,
      })
    },
    
    invalidate: (key: string) => {
      this.logWithData(LogLevel.DEBUG, `Cache: Invalidated key: ${key}`, {
        category: LogCategory.CACHE,
      })
    },
  }

  // Generic logging methods
  debug(message: string, options?: LogOptions) {
    this.logWithData(LogLevel.DEBUG, message, options)
  }

  info(message: string, options?: LogOptions) {
    this.logWithData(LogLevel.INFO, message, options)
  }

  warn(message: string, options?: LogOptions) {
    this.logWithData(LogLevel.WARN, message, options)
  }

  error(message: string, options?: LogOptions) {
    this.logWithData(LogLevel.ERROR, message, options)
  }

  success(message: string, options?: LogOptions) {
    this.logWithData(LogLevel.SUCCESS, message, options)
  }
}

// Export singleton instance
export const logger = new Logger()

// Export for direct usage
export default logger
