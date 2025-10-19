
/**
 * Atlas Communication Logger
 * 
 * Provides comprehensive logging for all Atlas TCP communication including:
 * - Connection attempts and status
 * - All commands sent to Atlas (with timestamps)
 * - All responses received from Atlas (with timestamps)
 * - Any errors or exceptions
 * - Connection state changes
 */

import fs from 'fs'
import path from 'path'

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

export interface LogEntry {
  timestamp: string
  level: LogLevel
  category: string
  message: string
  data?: any
}

class AtlasLogger {
  private logFilePath: string
  private logToConsole: boolean = true
  private logToFile: boolean = true

  constructor() {
    // Ensure log directory exists
    const logDir = path.join(process.cwd(), 'log')
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true })
    }
    
    this.logFilePath = path.join(logDir, 'atlas-communication.log')
  }

  private formatLogEntry(entry: LogEntry): string {
    const dataStr = entry.data ? `\n${JSON.stringify(entry.data, null, 2)}` : ''
    return `[${entry.timestamp}] [${entry.level}] [${entry.category}] ${entry.message}${dataStr}\n`
  }

  private writeToFile(entry: LogEntry): void {
    if (!this.logToFile) return

    try {
      const logLine = this.formatLogEntry(entry)
      fs.appendFileSync(this.logFilePath, logLine, 'utf8')
    } catch (error) {
      console.error('[Atlas Logger] Failed to write to log file:', error)
    }
  }

  private writeToConsole(entry: LogEntry): void {
    if (!this.logToConsole) return

    const logLine = this.formatLogEntry(entry).trim()
    
    switch (entry.level) {
      case LogLevel.ERROR:
        console.error(logLine)
        break
      case LogLevel.WARN:
        console.warn(logLine)
        break
      case LogLevel.DEBUG:
        console.debug(logLine)
        break
      default:
        console.log(logLine)
    }
  }

  private log(level: LogLevel, category: string, message: string, data?: any): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      data
    }

    this.writeToConsole(entry)
    this.writeToFile(entry)
  }

  // Connection logging
  connectionAttempt(ipAddress: string, port: number): void {
    this.log(LogLevel.INFO, 'CONNECTION', `Attempting to connect to Atlas at ${ipAddress}:${port}`)
  }

  connectionSuccess(ipAddress: string, port: number): void {
    this.log(LogLevel.INFO, 'CONNECTION', `Successfully connected to Atlas at ${ipAddress}:${port}`)
  }

  connectionFailed(ipAddress: string, port: number, error: any): void {
    this.log(LogLevel.ERROR, 'CONNECTION', `Failed to connect to Atlas at ${ipAddress}:${port}`, { error: error.message || error })
  }

  connectionClosed(ipAddress: string, port: number): void {
    this.log(LogLevel.INFO, 'CONNECTION', `Connection closed to Atlas at ${ipAddress}:${port}`)
  }

  connectionTimeout(ipAddress: string, port: number): void {
    this.log(LogLevel.ERROR, 'CONNECTION', `Connection timeout to Atlas at ${ipAddress}:${port}`)
  }

  // Command logging
  commandSent(command: any, ipAddress: string): void {
    this.log(LogLevel.DEBUG, 'COMMAND', `Sent command to ${ipAddress}`, command)
  }

  commandResponse(response: any, ipAddress: string): void {
    this.log(LogLevel.DEBUG, 'RESPONSE', `Received response from ${ipAddress}`, response)
  }

  commandError(command: any, error: any, ipAddress: string): void {
    this.log(LogLevel.ERROR, 'COMMAND', `Command failed on ${ipAddress}`, { command, error: error.message || error })
  }

  commandTimeout(command: any, ipAddress: string): void {
    this.log(LogLevel.WARN, 'COMMAND', `Command timeout on ${ipAddress}`, command)
  }

  // Parameter update logging
  parameterUpdate(param: string, value: any, ipAddress: string): void {
    this.log(LogLevel.DEBUG, 'UPDATE', `Parameter update from ${ipAddress}`, { param, value })
  }

  // General logging methods
  debug(category: string, message: string, data?: any): void {
    this.log(LogLevel.DEBUG, category, message, data)
  }

  info(category: string, message: string, data?: any): void {
    this.log(LogLevel.INFO, category, message, data)
  }

  warn(category: string, message: string, data?: any): void {
    this.log(LogLevel.WARN, category, message, data)
  }

  error(category: string, message: string, data?: any): void {
    this.log(LogLevel.ERROR, category, message, data)
  }

  // Configuration
  setConsoleLogging(enabled: boolean): void {
    this.logToConsole = enabled
  }

  setFileLogging(enabled: boolean): void {
    this.logToFile = enabled
  }

  getLogFilePath(): string {
    return this.logFilePath
  }
}

// Export singleton instance
export const atlasLogger = new AtlasLogger()
