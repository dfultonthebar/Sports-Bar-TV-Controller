
/**
 * Logging utility for AI Assistant
 */

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

class Logger {
  private prefix = '[AI-Assistant]'
  
  private log(level: LogLevel, message: string, data?: any) {
    const timestamp = new Date().toISOString()
    const logMessage = `${timestamp} ${this.prefix} [${level}] ${message}`
    
    switch (level) {
      case LogLevel.DEBUG:
        console.debug(logMessage, data || '')
        break
      case LogLevel.INFO:
        console.info(logMessage, data || '')
        break
      case LogLevel.WARN:
        console.warn(logMessage, data || '')
        break
      case LogLevel.ERROR:
        console.error(logMessage, data || '')
        break
    }
  }
  
  debug(message: string, data?: any) {
    this.log(LogLevel.DEBUG, message, data)
  }
  
  info(message: string, data?: any) {
    this.log(LogLevel.INFO, message, data)
  }
  
  warn(message: string, data?: any) {
    this.log(LogLevel.WARN, message, data)
  }
  
  error(message: string, data?: any) {
    this.log(LogLevel.ERROR, message, data)
  }
}

export const logger = new Logger()
