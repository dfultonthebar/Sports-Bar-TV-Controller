
import { NextRequest, NextResponse } from 'next/server'
import { enhancedLogger } from '@/lib/enhanced-logger'
import type { LogAnalytics } from '@/lib/enhanced-logger'
import type { AIAnalysisResult } from '@/lib/local-ai-analyzer'
import { localAIAnalyzer } from '@/lib/local-ai-analyzer'
import { parsePaginationParams, paginateArray } from '@/lib/pagination'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@/lib/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'
// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DATABASE_WRITE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Query parameter validation
  const queryValidation = validateQueryParams(request, z.record(z.string()).optional())
  if (isValidationError(queryValidation)) return queryValidation.error


  try {
    const searchParams = request.nextUrl.searchParams
    const hours = parseInt(searchParams.get('hours') || '24')
    const category = searchParams.get('category') || undefined
    const level = searchParams.get('level') || undefined
    const format = searchParams.get('format') || 'json'
    const includeAnalytics = searchParams.get('includeAnalytics') === 'true'
    const includeAIInsights = searchParams.get('includeAIInsights') === 'true'
    const search = searchParams.get('search') || ''
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

    // Parse pagination parameters
    const paginationParams = parsePaginationParams(searchParams)
    const { page, limit } = paginationParams

    // Get logs based on filters
    let logs = await enhancedLogger.getRecentLogs(
      hours,
      category as any,
      level as any
    )

    // Apply search filter
    if (search) {
      const searchLower = search.toLowerCase()
      logs = logs.filter(log =>
        log.message.toLowerCase().includes(searchLower) ||
        log.action.toLowerCase().includes(searchLower) ||
        log.source.toLowerCase().includes(searchLower) ||
        (log.deviceType && log.deviceType.toLowerCase().includes(searchLower))
      )
    }

    // Apply date range filter if custom dates provided
    if (dateFrom && dateTo) {
      logs = logs.filter(log => {
        const logDate = new Date(log.timestamp)
        return logDate >= new Date(dateFrom) && logDate <= new Date(dateTo)
      })
    }

    // Apply pagination
    const paginatedResult = paginateArray(logs, page, limit)
    const exportLogs = paginatedResult.data

    // Generate analytics if requested
    let analytics: LogAnalytics | null = null
    if (includeAnalytics) {
      analytics = await enhancedLogger.getLogAnalytics(hours)
    }

    // Generate AI insights if requested
    let aiInsights: AIAnalysisResult | { error: string; message: string } | null = null
    if (includeAIInsights && exportLogs.length > 0) {
      try {
        aiInsights = await localAIAnalyzer.analyzeLogData(exportLogs, {
          timeRange: hours,
          category,
          level,
          totalEntries: logs.length
        })
      } catch (error) {
        logger.error('AI analysis failed:', error)
        aiInsights = {
          error: 'AI analysis failed',
          message: 'Basic log export completed without AI insights'
        }
      }
    }

    // Create filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const categoryStr = category ? `_${category}` : ''
    const levelStr = level ? `_${level}` : ''
    const filename = `sports_bar_logs${categoryStr}${levelStr}_${timestamp}.${format}`

    // Generate content based on format
    let content = ''
    const exportData = {
      metadata: {
        exportTime: new Date().toISOString(),
        category: category || 'all',
        level: level || 'all',
        hoursIncluded: hours,
        totalEntries: exportLogs.length,
        totalAvailable: logs.length,
        search,
        format,
        systemVersion: process.env.npm_package_version || '1.0.0',
        exportedBy: 'Sports Bar AI Assistant',
        filters: {
          dateFrom,
          dateTo,
          includeAnalytics,
          includeAIInsights
        }
      },
      pagination: paginatedResult.pagination,
      ...(analytics && { analytics }),
      ...(aiInsights && { aiInsights }),
      logs: exportLogs
    }

    switch (format) {
      case 'csv':
        content = convertToCSV(exportData)
        break
      case 'txt':
        content = convertToText(exportData)
        break
      default:
        content = JSON.stringify(exportData, null, 2)
    }

    // Log the export action
    await enhancedLogger.info(
      'api',
      'logs-export-api',
      'export_logs',
      'Enhanced log export completed',
      { 
        hours, 
        category, 
        level,
        format,
        filename,
        totalLogs: exportLogs.length,
        totalAvailable: logs.length,
        includeAnalytics,
        includeAIInsights,
        search,
        aiAnalysisSuccess: !!aiInsights && !('error' in aiInsights)
      }
    )

    return NextResponse.json({
      filename,
      content,
      pagination: paginatedResult.pagination,
      summary: {
        totalLogs: exportLogs.length,
        totalAvailable: logs.length,
        exportTime: new Date().toISOString(),
        format,
        ...(analytics && { errorRate: analytics.errorRate }),
        ...(aiInsights && !('error' in aiInsights) && {
          aiSeverity: aiInsights.severity,
          aiConfidence: aiInsights.confidence
        })
      }
    })
  } catch (error) {
    logger.error('Failed to export logs:', error)
    
    await enhancedLogger.error(
      'api',
      'logs-export-api',
      'export_logs',
      'Failed to export logs',
      { error: error instanceof Error ? error.message : error },
      error instanceof Error ? error.stack : undefined
    )

    return NextResponse.json(
      { error: 'Failed to export logs' },
      { status: 500 }
    )
  }
}

function convertToCSV(data: any): string {
  const logs = data.logs || []
  if (logs.length === 0) return 'No log data available'

  const headers = [
    'Timestamp', 'Level', 'Category', 'Source', 'Action', 'Message', 
    'Success', 'Duration', 'Device Type', 'Device ID', 'User ID', 'Session ID'
  ]

  const csvLines = [
    headers.join(','),
    ...logs.map((log: any) => [
      log.timestamp || '',
      log.level || '',
      log.category || '',
      log.source || '',
      log.action || '',
      `"${(log.message || '').replace(/"/g, '""')}"`,
      log.success || '',
      log.duration || '',
      log.deviceType || '',
      log.deviceId || '',
      log.userId || '',
      log.sessionId || ''
    ].join(','))
  ]

  // Add analytics summary if available
  if (data.analytics) {
    csvLines.push('')
    csvLines.push('ANALYTICS SUMMARY')
    csvLines.push(`Total Logs,${data.analytics.totalLogs}`)
    csvLines.push(`Error Rate,${data.analytics.errorRate}%`)
    csvLines.push(`Average Response Time,${data.analytics.performanceMetrics.averageResponseTime}ms`)
  }

  // Add AI insights if available
  if (data.aiInsights && !data.aiInsights.error) {
    csvLines.push('')
    csvLines.push('AI INSIGHTS')
    csvLines.push(`Severity,${data.aiInsights.severity}`)
    csvLines.push(`Confidence,${data.aiInsights.confidence}`)
    csvLines.push(`Summary,"${data.aiInsights.summary.replace(/"/g, '""')}"`)
    
    if (data.aiInsights.recommendations?.length > 0) {
      csvLines.push('RECOMMENDATIONS')
      data.aiInsights.recommendations.forEach((rec: string) => {
        csvLines.push(`,"${rec.replace(/"/g, '""')}"`)
      })
    }
  }

  return csvLines.join('\n')
}

function convertToText(data: any): string {
  let text = `SPORTS BAR AI ASSISTANT - LOG EXPORT\n`
  text += `==========================================\n\n`
  
  text += `Export Details:\n`
  text += `- Export Time: ${data.metadata.exportTime}\n`
  text += `- Time Range: ${data.metadata.hoursIncluded} hours\n`
  text += `- Category Filter: ${data.metadata.category}\n`
  text += `- Level Filter: ${data.metadata.level}\n`
  text += `- Total Entries: ${data.metadata.totalEntries}\n`
  text += `- Search Query: ${data.metadata.search || 'None'}\n\n`

  // Add analytics summary
  if (data.analytics) {
    text += `SYSTEM ANALYTICS:\n`
    text += `- Total Log Entries: ${data.analytics.totalLogs}\n`
    text += `- Error Rate: ${data.analytics.errorRate.toFixed(2)}%\n`
    text += `- Average Response Time: ${data.analytics.performanceMetrics.averageResponseTime.toFixed(2)}ms\n`
    text += `- Active Devices: ${data.analytics.deviceUsage.length}\n\n`

    if (data.analytics.recommendations?.length > 0) {
      text += `SYSTEM RECOMMENDATIONS:\n`
      data.analytics.recommendations.forEach((rec: string, index: number) => {
        text += `${index + 1}. ${rec}\n`
      })
      text += '\n'
    }
  }

  // Add AI insights
  if (data.aiInsights && !data.aiInsights.error) {
    text += `AI ANALYSIS INSIGHTS:\n`
    text += `- Severity Assessment: ${data.aiInsights.severity.toUpperCase()}\n`
    text += `- Analysis Confidence: ${(data.aiInsights.confidence * 100).toFixed(1)}%\n`
    text += `- Summary: ${data.aiInsights.summary}\n\n`

    if (data.aiInsights.patterns?.length > 0) {
      text += `IDENTIFIED PATTERNS:\n`
      data.aiInsights.patterns.forEach((pattern: string, index: number) => {
        text += `${index + 1}. ${pattern}\n`
      })
      text += '\n'
    }

    if (data.aiInsights.recommendations?.length > 0) {
      text += `AI RECOMMENDATIONS:\n`
      data.aiInsights.recommendations.forEach((rec: string, index: number) => {
        text += `${index + 1}. ${rec}\n`
      })
      text += '\n'
    }

    if (data.aiInsights.anomalies?.length > 0) {
      text += `DETECTED ANOMALIES:\n`
      data.aiInsights.anomalies.forEach((anomaly: string, index: number) => {
        text += `${index + 1}. ${anomaly}\n`
      })
      text += '\n'
    }
  }

  // Add log entries
  text += `LOG ENTRIES:\n`
  text += `============\n\n`

  const logs = data.logs || []
  logs.forEach((log: any, index: number) => {
    text += `[${index + 1}] ${log.timestamp} | ${log.level.toUpperCase()} | ${log.category}\n`
    text += `Source: ${log.source} → Action: ${log.action}\n`
    text += `Message: ${log.message}\n`
    
    if (log.deviceType) {
      text += `Device: ${log.deviceType}${log.deviceId ? ` (${log.deviceId})` : ''}\n`
    }
    
    if (log.duration) {
      text += `Duration: ${log.duration}ms\n`
    }
    
    if (log.details && typeof log.details === 'object') {
      text += `Details: ${JSON.stringify(log.details, null, 2)}\n`
    }
    
    text += `Success: ${log.success}\n`
    text += `${'-'.repeat(80)}\n\n`
  })

  return text
}
