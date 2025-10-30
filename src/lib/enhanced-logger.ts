
import { promises as fs } from 'fs'
import * as path from 'path'
import { createHash } from 'crypto'

// Enhanced log types with more granular tracking
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'critical'
export type LogCategory = 'user_interaction' | 'system' | 'api' | 'hardware' | 'configuration' | 'performance' | 'security' | 'cec'
export type DeviceType = 'wolf_pack' | 'directv' | 'ir_device' | 'tv' | 'audio_system' | 'network'

export interface EnhancedLogEntry {
  id: string
  timestamp: string
  level: LogLevel
  category: LogCategory
  source: string
  action: string
  message: string
  details?: any
  userId?: string
  sessionId?: string
  ipAddress?: string
  userAgent?: string
  deviceType?: DeviceType
  deviceId?: string
  success: boolean
  duration?: number
  errorStack?: string
  contextData?: {
    route?: string
    component?: string
    function?: string
    lineNumber?: number
  }
  tags?: string[]
  metadata?: Record<string, any>
}

export interface LogAnalytics {
  totalLogs: number
  errorRate: number
  performanceMetrics: {
    averageResponseTime: number
    slowestOperations: Array<{ operation: string; duration: number }>
  }
  topErrors: Array<{ message: string; count: number; lastOccurred: string }>
  userActivity: Array<{ action: string; count: number }>
  deviceUsage: Array<{ device: string; operations: number; errorRate: number }>
  timePatterns: Array<{ hour: number; activity: number }>
  recommendations: string[]
}

export class EnhancedLogger {
  private logsDir = path.join(process.cwd(), 'logs')
  private logFiles = {
    all: path.join(this.logsDir, 'all-operations.log'),
    errors: path.join(this.logsDir, 'system-errors.log'),
    userInteractions: path.join(this.logsDir, 'user-interactions.log'),
    user_interaction: path.join(this.logsDir, 'user-interactions.log'),
    system: path.join(this.logsDir, 'system-events.log'),
    api: path.join(this.logsDir, 'api-calls.log'),
    hardware: path.join(this.logsDir, 'hardware-operations.log'),
    configuration: path.join(this.logsDir, 'configuration-changes.log'),
    performance: path.join(this.logsDir, 'performance-metrics.log'),
    security: path.join(this.logsDir, 'security-events.log'),
    cec: path.join(this.logsDir, 'cec-operations.log'),
    aiAnalysis: path.join(this.logsDir, 'ai-analysis.log')
  }

  private maxLogSize = 50 * 1024 * 1024 // 50MB per file
  private maxLogFiles = 10

  constructor() {
    this.initializeLogger()
  }

  private async initializeLogger() {
    try {
      await fs.mkdir(this.logsDir, { recursive: true })
      await this.initializeLogFiles()
    } catch (error) {
      console.error('Failed to initialize enhanced logger:', error)
    }
  }

  private async initializeLogFiles() {
    for (const [category, filePath] of Object.entries(this.logFiles)) {
      try {
        await fs.access(filePath)
      } catch {
        // File doesn't exist, create it
        await fs.writeFile(filePath, '')
      }
    }
  }

  private generateLogId(): string {
    const timestamp = Date.now().toString()
    const randomStr = Math.random().toString(36).substring(2, 15)
    return createHash('md5').update(`${timestamp}-${randomStr}`).digest('hex').substring(0, 16)
  }

  private async rotateLogIfNeeded(filePath: string) {
    try {
      const stats = await fs.stat(filePath)
      if (stats.size > this.maxLogSize) {
        const baseFileName = path.basename(filePath, '.log')
        const dirName = path.dirname(filePath)
        
        // Rotate existing files
        for (let i = this.maxLogFiles - 1; i > 0; i--) {
          const oldFile = path.join(dirName, `${baseFileName}.${i}.log`)
          const newFile = path.join(dirName, `${baseFileName}.${i + 1}.log`)
          try {
            await fs.rename(oldFile, newFile)
          } catch {
            // File might not exist, continue
          }
        }

        // Move current file to .1
        const rotatedFile = path.join(dirName, `${baseFileName}.1.log`)
        await fs.rename(filePath, rotatedFile)
        
        // Create new empty file
        await fs.writeFile(filePath, '')
      }
    } catch (error) {
      console.error('Failed to rotate log file:', error)
    }
  }

  // Main logging method with comprehensive tracking
  async log(entry: Omit<EnhancedLogEntry, 'id' | 'timestamp'>): Promise<void> {
    const logEntry: EnhancedLogEntry = {
      ...entry,
      id: this.generateLogId(),
      timestamp: new Date().toISOString(),
    }

    try {
      const logLine = JSON.stringify(logEntry) + '\n'
      
      // Write to main log file
      await this.rotateLogIfNeeded(this.logFiles.all)
      await fs.appendFile(this.logFiles.all, logLine)

      // Write to category-specific log file
      const categoryFile = this.logFiles[entry.category]
      if (categoryFile) {
        await this.rotateLogIfNeeded(categoryFile)
        await fs.appendFile(categoryFile, logLine)
      }

      // If it's an error, also log to errors file
      if (entry.level === 'error' || entry.level === 'critical') {
        await this.rotateLogIfNeeded(this.logFiles.errors)
        await fs.appendFile(this.logFiles.errors, logLine)
      }

      // Trigger AI analysis for critical events
      if (entry.level === 'critical' || entry.level === 'error') {
        await this.triggerAIAnalysis(logEntry)
      }

    } catch (error) {
      console.error('Failed to write log entry:', error)
    }
  }

  // Convenience methods for different log levels
  async debug(category: LogCategory, source: string, action: string, message: string, details?: any) {
    await this.log({ level: 'debug', category, source, action, message, details, success: true })
  }

  async info(category: LogCategory, source: string, action: string, message: string, details?: any) {
    await this.log({ level: 'info', category, source, action, message, details, success: true })
  }

  async warn(category: LogCategory, source: string, action: string, message: string, details?: any) {
    await this.log({ level: 'warn', category, source, action, message, details, success: false })
  }

  async error(category: LogCategory, source: string, action: string, message: string, details?: any, errorStack?: string) {
    await this.log({ level: 'error', category, source, action, message, details, success: false, errorStack })
  }

  async critical(category: LogCategory, source: string, action: string, message: string, details?: any, errorStack?: string) {
    await this.log({ level: 'critical', category, source, action, message, details, success: false, errorStack })
  }

  // User interaction logging
  async logUserInteraction(action: string, details?: any, userId?: string, sessionId?: string) {
    await this.log({
      level: 'info',
      category: 'user_interaction',
      source: 'frontend',
      action,
      message: `User performed action: ${action}`,
      details,
      userId,
      sessionId,
      success: true
    })
  }

  // Hardware operation logging
  async logHardwareOperation(deviceType: DeviceType, deviceId: string, operation: string, success: boolean, details?: any, duration?: number) {
    await this.log({
      level: success ? 'info' : 'error',
      category: 'hardware',
      source: 'hardware-controller',
      action: operation,
      message: `${deviceType} ${operation} ${success ? 'succeeded' : 'failed'}`,
      deviceType,
      deviceId,
      details,
      duration,
      success
    })
  }

  // API call logging
  async logAPICall(endpoint: string, method: string, statusCode: number, duration: number, details?: any) {
    const success = statusCode < 400
    await this.log({
      level: success ? 'info' : 'error',
      category: 'api',
      source: 'api-handler',
      action: `${method} ${endpoint}`,
      message: `API call to ${endpoint} returned ${statusCode}`,
      details: { ...details, statusCode, duration },
      duration,
      success
    })
  }

  // Configuration change logging
  async logConfigurationChange(component: string, setting: string, oldValue: any, newValue: any, userId?: string) {
    await this.log({
      level: 'info',
      category: 'configuration',
      source: 'configuration-manager',
      action: 'config_change',
      message: `Configuration changed: ${component}.${setting}`,
      details: { component, setting, oldValue, newValue },
      userId,
      success: true
    })
  }

  // Performance monitoring
  async logPerformanceMetric(operation: string, duration: number, metadata?: any) {
    await this.log({
      level: duration > 5000 ? 'warn' : 'info', // Warn for operations taking > 5s
      category: 'performance',
      source: 'performance-monitor',
      action: operation,
      message: `Operation ${operation} took ${duration}ms`,
      duration,
      details: metadata,
      success: duration < 10000 // Consider failed if > 10s
    })
  }

  // Security event logging
  async logSecurityEvent(event: string, severity: LogLevel, details?: any, ipAddress?: string, userAgent?: string) {
    await this.log({
      level: severity,
      category: 'security',
      source: 'security-monitor',
      action: event,
      message: `Security event: ${event}`,
      details,
      ipAddress,
      userAgent,
      success: false
    })
  }

  private async triggerAIAnalysis(logEntry: EnhancedLogEntry) {
    try {
      const analysis = await this.analyzeLogEntry(logEntry)
      const analysisLog = {
        timestamp: new Date().toISOString(),
        logId: logEntry.id,
        analysis,
        recommendations: this.generateRecommendations(logEntry, analysis)
      }
      
      await fs.appendFile(this.logFiles.aiAnalysis, JSON.stringify(analysisLog) + '\n')
    } catch (error) {
      console.error('Failed to perform AI analysis:', error)
    }
  }

  private async analyzeLogEntry(logEntry: EnhancedLogEntry): Promise<any> {
    // Get recent similar events
    const recentLogs = await this.getRecentLogs(24, logEntry.category)
    const similarEvents = recentLogs.filter(log => 
      log.action === logEntry.action && 
      log.source === logEntry.source
    )

    return {
      frequency: similarEvents.length,
      pattern: this.identifyPattern(similarEvents),
      severity: this.calculateSeverity(logEntry, similarEvents),
      context: this.extractContext(logEntry, recentLogs)
    }
  }

  private identifyPattern(events: EnhancedLogEntry[]): string {
    if (events.length < 2) return 'isolated'
    
    const timeDeltas = events.slice(1).map((event, index) => {
      const prevTime = new Date(events[index].timestamp).getTime()
      const currTime = new Date(event.timestamp).getTime()
      return currTime - prevTime
    })

    const avgDelta = timeDeltas.reduce((sum, delta) => sum + delta, 0) / timeDeltas.length
    
    if (avgDelta < 60000) return 'rapid_succession' // < 1 minute
    if (avgDelta < 3600000) return 'frequent' // < 1 hour
    return 'periodic'
  }

  private calculateSeverity(logEntry: EnhancedLogEntry, similarEvents: EnhancedLogEntry[]): number {
    let severity = 1
    
    if (logEntry.level === 'critical') severity += 5
    else if (logEntry.level === 'error') severity += 3
    else if (logEntry.level === 'warn') severity += 1
    
    // Increase severity based on frequency
    severity += Math.min(similarEvents.length * 0.1, 2)
    
    return Math.min(severity, 10)
  }

  private extractContext(logEntry: EnhancedLogEntry, recentLogs: EnhancedLogEntry[]): any {
    const contextualLogs = recentLogs.filter(log => 
      Math.abs(new Date(log.timestamp).getTime() - new Date(logEntry.timestamp).getTime()) < 300000 // 5 minutes
    )

    return {
      surroundingEvents: contextualLogs.length,
      deviceInvolved: logEntry.deviceId || 'unknown',
      userSession: logEntry.sessionId || 'anonymous',
      systemState: this.inferSystemState(contextualLogs)
    }
  }

  private inferSystemState(logs: EnhancedLogEntry[]): string {
    const errorCount = logs.filter(log => log.level === 'error' || log.level === 'critical').length
    const totalLogs = logs.length
    
    if (totalLogs === 0) return 'idle'
    if (errorCount / totalLogs > 0.3) return 'problematic'
    if (totalLogs > 50) return 'high_activity'
    return 'normal'
  }

  private generateRecommendations(logEntry: EnhancedLogEntry, analysis: any): string[] {
    const recommendations: string[] = []
    
    if (analysis.severity > 7) {
      recommendations.push('Immediate attention required - high severity issue detected')
    }
    
    if (analysis.pattern === 'rapid_succession') {
      recommendations.push('Consider implementing rate limiting or circuit breaker pattern')
    }
    
    if (logEntry.category === 'hardware' && !logEntry.success) {
      recommendations.push('Check hardware connections and device status')
    }
    
    if (analysis.frequency > 10) {
      recommendations.push('This appears to be a recurring issue - investigate root cause')
    }
    
    return recommendations
  }

  // Enhanced log retrieval methods
  async getRecentLogs(hours: number = 24, category?: LogCategory, level?: LogLevel): Promise<EnhancedLogEntry[]> {
    try {
      const filePath = category ? this.logFiles[category] || this.logFiles.all : this.logFiles.all
      const content = await fs.readFile(filePath, 'utf-8')
      const lines = content.trim().split('\n').filter(line => line)
      const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
      
      return lines
        .map(line => {
          try {
            return JSON.parse(line) as EnhancedLogEntry
          } catch {
            return null
          }
        })
        .filter((log): log is EnhancedLogEntry => 
          log !== null && 
          log.timestamp > cutoff &&
          (!level || log.level === level)
        )
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    } catch (error) {
      console.error(`Failed to read logs from ${category || 'all'}:`, error)
      return []
    }
  }

  // Enhanced analytics
  async getLogAnalytics(hours: number = 24, category?: LogCategory): Promise<LogAnalytics> {
    const logs = await this.getRecentLogs(hours, category)
    const errors = logs.filter(log => log.level === 'error' || log.level === 'critical')
    
    // Performance metrics
    const performanceLogs = logs.filter(log => log.duration !== undefined)
    const averageResponseTime = performanceLogs.length > 0
      ? performanceLogs.reduce((sum, log) => sum + (log.duration || 0), 0) / performanceLogs.length
      : 0

    const slowestOperations = performanceLogs
      .sort((a, b) => (b.duration || 0) - (a.duration || 0))
      .slice(0, 10)
      .map(log => ({ operation: log.action, duration: log.duration || 0 }))

    // Error analysis
    const errorCounts = errors.reduce((acc, error) => {
      const key = error.message
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const topErrors = Object.entries(errorCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([message, count]) => ({
        message,
        count,
        lastOccurred: errors.find(e => e.message === message)?.timestamp || ''
      }))

    // User activity
    const userActions = logs
      .filter(log => log.category === 'user_interaction')
      .reduce((acc, log) => {
        acc[log.action] = (acc[log.action] || 0) + 1
        return acc
      }, {} as Record<string, number>)

    const userActivity = Object.entries(userActions)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([action, count]) => ({ action, count }))

    // Device usage analysis
    const deviceLogs = logs.filter(log => log.deviceType && log.deviceId)
    const deviceStats = deviceLogs.reduce((acc, log) => {
      const key = `${log.deviceType}-${log.deviceId}`
      if (!acc[key]) {
        acc[key] = { operations: 0, errors: 0 }
      }
      acc[key].operations++
      if (!log.success) acc[key].errors++
      return acc
    }, {} as Record<string, { operations: number; errors: number }>)

    const deviceUsage = Object.entries(deviceStats).map(([device, stats]) => ({
      device,
      operations: stats.operations,
      errorRate: stats.operations > 0 ? (stats.errors / stats.operations) * 100 : 0
    }))

    // Time pattern analysis
    const hourlyActivity = new Array(24).fill(0)
    logs.forEach(log => {
      const hour = new Date(log.timestamp).getHours()
      hourlyActivity[hour]++
    })

    const timePatterns = hourlyActivity.map((activity, hour) => ({ hour, activity }))

    // Generate recommendations
    const recommendations: string[] = []
    
    if (errors.length / logs.length > 0.1) {
      recommendations.push('High error rate detected - investigate system stability')
    }
    
    if (averageResponseTime > 3000) {
      recommendations.push('Performance degradation detected - optimize slow operations')
    }
    
    const highErrorDevices = deviceUsage.filter(d => d.errorRate > 20)
    if (highErrorDevices.length > 0) {
      recommendations.push(`Check these devices with high error rates: ${highErrorDevices.map(d => d.device).join(', ')}`)
    }

    return {
      totalLogs: logs.length,
      errorRate: logs.length > 0 ? (errors.length / logs.length) * 100 : 0,
      performanceMetrics: {
        averageResponseTime,
        slowestOperations
      },
      topErrors,
      userActivity,
      deviceUsage,
      timePatterns,
      recommendations
    }
  }

  // Log export functionality for user download
  async exportLogsForDownload(hours: number = 24, category?: LogCategory): Promise<{
    filename: string
    content: string
    summary: any
  }> {
    const logs = await this.getRecentLogs(hours, category)
    const analytics = await this.getLogAnalytics(hours)
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const categoryStr = category ? `_${category}` : ''
    const filename = `sports_bar_logs${categoryStr}_${timestamp}.json`
    
    const exportData = {
      metadata: {
        exportTime: new Date().toISOString(),
        category,
        hoursIncluded: hours,
        totalEntries: logs.length,
        systemVersion: process.env.npm_package_version || '1.0.0'
      },
      analytics,
      logs: logs.slice(0, 1000) // Limit to prevent huge downloads
    }
    
    return {
      filename,
      content: JSON.stringify(exportData, null, 2),
      summary: analytics
    }
  }

  // Clean up old logs
  async cleanupOldLogs(daysToKeep: number = 30): Promise<void> {
    const cutoff = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000)
    
    for (const filePath of Object.values(this.logFiles)) {
      try {
        const content = await fs.readFile(filePath, 'utf-8')
        const lines = content.trim().split('\n').filter(line => line)
        
        const filteredLines = lines.filter(line => {
          try {
            const log = JSON.parse(line)
            return new Date(log.timestamp) > cutoff
          } catch {
            return false
          }
        })
        
        await fs.writeFile(filePath, filteredLines.join('\n') + '\n')
      } catch (error) {
        console.error(`Failed to cleanup log file ${filePath}:`, error)
      }
    }
  }
}

// Global enhanced logger instance
export const enhancedLogger = new EnhancedLogger()

// React hook for logging user interactions
export const useLogger = () => {
  const logUserAction = (action: string, details?: any) => {
    enhancedLogger.logUserInteraction(action, details)
  }

  const logError = (error: Error, context?: string) => {
    enhancedLogger.error('system', context || 'unknown', 'error', error.message, {
      name: error.name,
      stack: error.stack
    }, error.stack)
  }

  const logPerformance = (operation: string, startTime: number, metadata?: any) => {
    const duration = Date.now() - startTime
    enhancedLogger.logPerformanceMetric(operation, duration, metadata)
  }

  return { logUserAction, logError, logPerformance }
}
