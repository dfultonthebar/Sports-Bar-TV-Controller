
import { promises as fs } from 'fs'
import path from 'path'

export interface OperationLog {
  timestamp: string
  type: 'volume_change' | 'channel_change' | 'power_control' | 'input_switch' | 'audio_zone' | 'matrix_control' | 'error'
  device?: string
  action: string
  details: any
  user?: string
  success: boolean
  errorMessage?: string
}

export interface ErrorLog {
  timestamp: string
  level: 'error' | 'warning' | 'info'
  source: string
  message: string
  stack?: string
  details?: any
}

export interface AIAccessibleLog {
  timestamp: string
  summary: string
  details: any
  frequency: number
  patterns: string[]
}

export class OperationLogger {
  private logsDir = path.join(process.cwd(), 'logs')
  private operationLogPath = path.join(this.logsDir, 'bartender-operations.log')
  private errorLogPath = path.join(this.logsDir, 'system-errors.log')
  private aiLogPath = path.join(this.logsDir, 'ai-learning-data.log')

  constructor() {
    this.ensureLogsDirectory()
  }

  private async ensureLogsDirectory() {
    try {
      await fs.mkdir(this.logsDir, { recursive: true })
    } catch (error) {
      console.error('Failed to create logs directory:', error)
    }
  }

  async logOperation(operation: Omit<OperationLog, 'timestamp'>) {
    const logEntry: OperationLog = {
      ...operation,
      timestamp: new Date().toISOString()
    }

    const logLine = JSON.stringify(logEntry) + '\n'

    try {
      await fs.appendFile(this.operationLogPath, logLine)
      
      // If successful operation, also create AI learning data
      if (operation.success) {
        await this.updateAILearningData(logEntry)
      }
    } catch (error) {
      console.error('Failed to log operation:', error)
      await this.logError({
        level: 'error',
        source: 'operation-logger',
        message: 'Failed to write operation log',
        details: { operation, error: error instanceof Error ? error.message : error }
      })
    }
  }

  async logError(error: Omit<ErrorLog, 'timestamp'>) {
    const logEntry: ErrorLog = {
      ...error,
      timestamp: new Date().toISOString()
    }

    const logLine = JSON.stringify(logEntry) + '\n'

    try {
      await fs.appendFile(this.errorLogPath, logLine)
    } catch (writeError) {
      console.error('Failed to log error:', writeError)
    }
  }

  private async updateAILearningData(operation: OperationLog) {
    try {
      // Create condensed learning data for AI
      const learningData: AIAccessibleLog = {
        timestamp: operation.timestamp,
        summary: `${operation.type}: ${operation.action} on ${operation.device || 'system'}`,
        details: {
          type: operation.type,
          action: operation.action,
          device: operation.device,
          success: operation.success,
          timeOfDay: new Date().getHours(),
          dayOfWeek: new Date().getDay()
        },
        frequency: 1,
        patterns: this.extractPatterns(operation)
      }

      const logLine = JSON.stringify(learningData) + '\n'
      await fs.appendFile(this.aiLogPath, logLine)
    } catch (error) {
      console.error('Failed to update AI learning data:', error)
    }
  }

  private extractPatterns(operation: OperationLog): string[] {
    const patterns: string[] = []
    const now = new Date()
    const hour = now.getHours()
    const day = now.getDay()

    // Time-based patterns
    if (hour >= 6 && hour < 12) patterns.push('morning_operation')
    else if (hour >= 12 && hour < 17) patterns.push('afternoon_operation')
    else if (hour >= 17 && hour < 22) patterns.push('evening_operation')
    else patterns.push('late_night_operation')

    // Day-based patterns
    if (day === 0 || day === 6) patterns.push('weekend_operation')
    else patterns.push('weekday_operation')

    // Operation-specific patterns
    if (operation.type === 'volume_change' && operation.details?.volume > 70) {
      patterns.push('high_volume_request')
    }
    if (operation.type === 'channel_change' && operation.details?.channel?.toLowerCase().includes('sport')) {
      patterns.push('sports_content_request')
    }

    return patterns
  }

  // AI-accessible methods for reading logs
  async getRecentOperations(hours: number = 24): Promise<OperationLog[]> {
    try {
      const content = await fs.readFile(this.operationLogPath, 'utf-8')
      const lines = content.trim().split('\n').filter(line => line)
      const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
      
      return lines
        .map(line => JSON.parse(line) as OperationLog)
        .filter(log => log.timestamp > cutoff)
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    } catch (error) {
      await this.logError({
        level: 'error',
        source: 'operation-logger',
        message: 'Failed to read operation logs',
        details: { error: error instanceof Error ? error.message : error }
      })
      return []
    }
  }

  async getRecentErrors(hours: number = 24): Promise<ErrorLog[]> {
    try {
      const content = await fs.readFile(this.errorLogPath, 'utf-8')
      const lines = content.trim().split('\n').filter(line => line)
      const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
      
      return lines
        .map(line => JSON.parse(line) as ErrorLog)
        .filter(log => log.timestamp > cutoff)
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    } catch (error) {
      console.error('Failed to read error logs:', error)
      return []
    }
  }

  async getLearningData(hours: number = 168): Promise<AIAccessibleLog[]> {
    try {
      const content = await fs.readFile(this.aiLogPath, 'utf-8')
      const lines = content.trim().split('\n').filter(line => line)
      const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
      
      return lines
        .map(line => JSON.parse(line) as AIAccessibleLog)
        .filter(log => log.timestamp > cutoff)
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    } catch (error) {
      await this.logError({
        level: 'warning',
        source: 'operation-logger',
        message: 'Failed to read learning data',
        details: { error: error instanceof Error ? error.message : error }
      })
      return []
    }
  }

  async getOperationSummary(hours: number = 24): Promise<{
    totalOperations: number
    successRate: number
    mostCommonOperations: Array<{ type: string, count: number }>
    errorCount: number
    patterns: Array<{ pattern: string, count: number }>
  }> {
    const operations = await this.getRecentOperations(hours)
    const errors = await this.getRecentErrors(hours)
    
    const operationTypes = operations.reduce((acc, op) => {
      acc[op.type] = (acc[op.type] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const learningData = await this.getLearningData(hours)
    const patterns = learningData.flatMap(data => data.patterns)
      .reduce((acc, pattern) => {
        acc[pattern] = (acc[pattern] || 0) + 1
        return acc
      }, {} as Record<string, number>)

    return {
      totalOperations: operations.length,
      successRate: operations.length ? (operations.filter(op => op.success).length / operations.length) * 100 : 0,
      mostCommonOperations: Object.entries(operationTypes)
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count),
      errorCount: errors.length,
      patterns: Object.entries(patterns)
        .map(([pattern, count]) => ({ pattern, count }))
        .sort((a, b) => b.count - a.count)
    }
  }
}

// Global instance
export const operationLogger = new OperationLogger()
