/**
 * Enhanced Logging Utility
 * Provides verbose logging for debugging and monitoring
 */

import fs from 'fs/promises'
import path from 'path'

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

export class Logger {
  private context: string
  private logDir: string

  constructor(context: string) {
    this.context = context
    this.logDir = path.join(process.cwd(), 'logs')
  }

  private async ensureLogDir() {
    try {
      await fs.mkdir(this.logDir, { recursive: true })
    } catch (error) {
      // Directory already exists or couldn't be created
    }
  }

  private formatMessage(level: LogLevel, message: string, data?: any): string {
    const timestamp = new Date().toISOString()
    const dataStr = data ? ` | Data: ${JSON.stringify(data)}` : ''
    return `[${timestamp}] [${level}] [${this.context}] ${message}${dataStr}`
  }

  private async writeToFile(level: LogLevel, message: string) {
    try {
      await this.ensureLogDir()
      const logFile = path.join(this.logDir, `${this.context.toLowerCase()}.log`)
      await fs.appendFile(logFile, message + '\n')
    } catch (error) {
      // Fail silently to avoid breaking the application
      console.error('Failed to write to log file:', error)
    }
  }

  async debug(message: string, data?: any) {
    const formatted = this.formatMessage(LogLevel.DEBUG, message, data)
    console.log(formatted)
    await this.writeToFile(LogLevel.DEBUG, formatted)
  }

  async info(message: string, data?: any) {
    const formatted = this.formatMessage(LogLevel.INFO, message, data)
    console.log(formatted)
    await this.writeToFile(LogLevel.INFO, formatted)
  }

  async warn(message: string, data?: any) {
    const formatted = this.formatMessage(LogLevel.WARN, message, data)
    console.warn(formatted)
    await this.writeToFile(LogLevel.WARN, formatted)
  }

  async error(message: string, data?: any) {
    const formatted = this.formatMessage(LogLevel.ERROR, message, data)
    console.error(formatted)
    await this.writeToFile(LogLevel.ERROR, formatted)
  }
}

export function createLogger(context: string): Logger {
  return new Logger(context)
}
