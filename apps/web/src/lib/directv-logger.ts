/**
 * DirecTV Operations Logger
 * Comprehensive logging for all DirecTV operations with detailed diagnostics
 * Logs are stored in files accessible by local AI for analysis
 */

import { writeFile, appendFile, mkdir, readFile } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'

import { logger } from '@/lib/logger'
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL'
}

export enum DirecTVOperation {
  CONNECTION_TEST = 'CONNECTION_TEST',
  SUBSCRIPTION_POLL = 'SUBSCRIPTION_POLL',
  DEVICE_INFO_QUERY = 'DEVICE_INFO_QUERY',
  PACKAGE_QUERY = 'PACKAGE_QUERY',
  API_REQUEST = 'API_REQUEST',
  DEVICE_DISCOVERY = 'DEVICE_DISCOVERY',
  COMMAND_SEND = 'COMMAND_SEND',
  CACHE_OPERATION = 'CACHE_OPERATION'
}

export interface DirecTVLogEntry {
  timestamp: string
  level: LogLevel
  operation: DirecTVOperation
  deviceId?: string
  deviceName?: string
  ipAddress?: string
  port?: number
  message: string
  details?: any
  error?: {
    name: string
    message: string
    stack?: string
    code?: string
  }
  request?: {
    url: string
    method: string
    headers?: Record<string, string>
    timeout?: number
  }
  response?: {
    status?: number
    statusText?: string
    body?: any
    duration?: number
  }
  diagnostics?: {
    networkReachable?: boolean
    dnsResolved?: boolean
    portOpen?: boolean
    httpResponseTime?: number
    lastSuccessfulConnection?: string
  }
}

class DirecTVLogger {
  private logDir: string
  private currentLogFile: string
  private maxLogSize: number = 10 * 1024 * 1024 // 10MB
  private rotationSize: number = 5 * 1024 * 1024 // 5MB

  constructor() {
    this.logDir = join(process.cwd(), 'logs', 'directv')
    this.currentLogFile = this.getLogFileName()
  }

  private getLogFileName(): string {
    const date = new Date().toISOString().split('T')[0]
    return join(this.logDir, `directv-${date}.log`)
  }

  private async ensureLogDirectory(): Promise<void> {
    if (!existsSync(this.logDir)) {
      await mkdir(this.logDir, { recursive: true })
    }
  }

  private async checkAndRotateLog(): Promise<void> {
    try {
      if (existsSync(this.currentLogFile)) {
        const stats = await readFile(this.currentLogFile)
        if (stats.length > this.rotationSize) {
          const timestamp = new Date().getTime()
          const rotatedFile = this.currentLogFile.replace('.log', `-${timestamp}.log`)
          await writeFile(rotatedFile, stats)
          await writeFile(this.currentLogFile, '')
        }
      }
    } catch (error) {
      logger.error('Log rotation error:', error)
    }
  }

  private formatLogEntry(entry: DirecTVLogEntry): string {
    return JSON.stringify(entry, null, 2) + '\n' + '='.repeat(80) + '\n'
  }

  async log(entry: Omit<DirecTVLogEntry, 'timestamp'>): Promise<void> {
    try {
      await this.ensureLogDirectory()
      await this.checkAndRotateLog()

      const fullEntry: DirecTVLogEntry = {
        timestamp: new Date().toISOString(),
        ...entry
      }

      const logLine = this.formatLogEntry(fullEntry)
      
      // Append to file
      await appendFile(this.currentLogFile, logLine)

      // Also log to console for immediate visibility
      const consolePrefix = `[${fullEntry.timestamp}] [${fullEntry.level}] [${fullEntry.operation}]`
      if (fullEntry.ipAddress) {
        logger.info(`${consolePrefix} [${fullEntry.ipAddress}:${fullEntry.port || 8080}] ${fullEntry.message}`)
      } else {
        logger.info(`${consolePrefix} ${fullEntry.message}`)
      }

      if (fullEntry.details) {
        logger.info('Details:', { data: JSON.stringify(fullEntry.details, null, 2) })
      }

      if (fullEntry.error) {
        logger.error('Error:', { data: fullEntry.error.message })
        if (fullEntry.error.stack) {
          logger.error('Stack:', { data: fullEntry.error.stack })
        }
      }

    } catch (error) {
      logger.error('Failed to write to DirecTV log:', error)
    }
  }

  async logConnectionTest(
    deviceId: string,
    deviceName: string,
    ipAddress: string,
    port: number,
    success: boolean,
    details?: any,
    error?: Error
  ): Promise<void> {
    await this.log({
      level: success ? LogLevel.INFO : LogLevel.ERROR,
      operation: DirecTVOperation.CONNECTION_TEST,
      deviceId,
      deviceName,
      ipAddress,
      port,
      message: success 
        ? `Connection test successful for ${deviceName}` 
        : `Connection test failed for ${deviceName}`,
      details,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: (error as any).code
      } : undefined
    })
  }

  async logSubscriptionPoll(
    deviceId: string,
    deviceName: string,
    ipAddress: string,
    port: number,
    success: boolean,
    subscriptionCount?: number,
    details?: any,
    error?: Error
  ): Promise<void> {
    await this.log({
      level: success ? LogLevel.INFO : LogLevel.ERROR,
      operation: DirecTVOperation.SUBSCRIPTION_POLL,
      deviceId,
      deviceName,
      ipAddress,
      port,
      message: success 
        ? `Subscription poll successful for ${deviceName} - Found ${subscriptionCount} subscriptions`
        : `Subscription poll failed for ${deviceName}`,
      details,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: (error as any).code
      } : undefined
    })
  }

  async logApiRequest(
    operation: DirecTVOperation,
    deviceName: string,
    ipAddress: string,
    port: number,
    url: string,
    method: string,
    success: boolean,
    responseStatus?: number,
    responseBody?: any,
    duration?: number,
    error?: Error
  ): Promise<void> {
    await this.log({
      level: success ? LogLevel.DEBUG : LogLevel.ERROR,
      operation,
      deviceName,
      ipAddress,
      port,
      message: success 
        ? `API request successful: ${method} ${url}` 
        : `API request failed: ${method} ${url}`,
      request: {
        url,
        method,
        timeout: 5000
      },
      response: {
        status: responseStatus,
        body: responseBody,
        duration
      },
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: (error as any).code
      } : undefined
    })
  }

  async logDiagnostics(
    deviceId: string,
    deviceName: string,
    ipAddress: string,
    port: number,
    diagnostics: DirecTVLogEntry['diagnostics']
  ): Promise<void> {
    await this.log({
      level: LogLevel.INFO,
      operation: DirecTVOperation.CONNECTION_TEST,
      deviceId,
      deviceName,
      ipAddress,
      port,
      message: `Network diagnostics for ${deviceName}`,
      diagnostics
    })
  }

  async getRecentLogs(limit: number = 100): Promise<DirecTVLogEntry[]> {
    try {
      const logContent = await readFile(this.currentLogFile, 'utf-8')
      const entries = logContent.split('='.repeat(80)).filter(e => e.trim())
      
      const parsed = entries
        .slice(-limit)
        .map(entry => {
          try {
            return JSON.parse(entry.trim())
          } catch {
            return null
          }
        })
        .filter((e): e is DirecTVLogEntry => e !== null)
      
      return parsed.reverse()
    } catch (error) {
      return []
    }
  }

  async getLogsByDevice(deviceId: string, limit: number = 50): Promise<DirecTVLogEntry[]> {
    const allLogs = await this.getRecentLogs(500)
    return allLogs.filter(log => log.deviceId === deviceId).slice(0, limit)
  }

  async getLogsByIpAddress(ipAddress: string, limit: number = 50): Promise<DirecTVLogEntry[]> {
    const allLogs = await this.getRecentLogs(500)
    return allLogs.filter(log => log.ipAddress === ipAddress).slice(0, limit)
  }

  async getErrorLogs(limit: number = 50): Promise<DirecTVLogEntry[]> {
    const allLogs = await this.getRecentLogs(500)
    return allLogs
      .filter(log => log.level === LogLevel.ERROR || log.level === LogLevel.CRITICAL)
      .slice(0, limit)
  }

  getLogFilePath(): string {
    return this.currentLogFile
  }

  getLogDirectory(): string {
    return this.logDir
  }
}

// Singleton instance
export const direcTVLogger = new DirecTVLogger()

// Helper function for creating detailed error objects
export function createErrorDetails(error: unknown): {
  name: string
  message: string
  stack?: string
  code?: string
} {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: (error as any).code
    }
  }
  
  return {
    name: 'UnknownError',
    message: String(error)
  }
}

// Helper function to measure execution time
export async function withTiming<T>(
  operation: () => Promise<T>
): Promise<{ result: T; duration: number }> {
  const start = Date.now()
  const result = await operation()
  const duration = Date.now() - start
  return { result, duration }
}
