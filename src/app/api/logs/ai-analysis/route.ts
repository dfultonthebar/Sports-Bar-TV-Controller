

import { NextRequest, NextResponse } from 'next/server'
import { enhancedLogger } from '@/lib/enhanced-logger'
import { localAIAnalyzer } from '@/lib/local-ai-analyzer'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@/lib/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.AI)
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

    // Get recent logs for analysis
    const logs = await enhancedLogger.getRecentLogs(hours, category as any)
    
    if (logs.length === 0) {
      return NextResponse.json({
        available: false,
        message: 'No logs available for analysis',
        timestamp: new Date().toISOString()
      })
    }

    // Perform AI analysis
    const analysis = await localAIAnalyzer.analyzeLogData(logs, {
      timeRange: hours,
      category,
      analysisType: 'comprehensive'
    })

    // Check AI system status
    const aiStatus = await localAIAnalyzer.getSystemStatus()

    const response = {
      available: aiStatus.available,
      analysis,
      aiCapabilities: aiStatus.capabilities,
      logsAnalyzed: logs.length,
      timeRange: hours,
      category: category || 'all',
      timestamp: new Date().toISOString()
    }

    // Log the AI analysis request
    await enhancedLogger.info(
      'api',
      'ai-analysis-api',
      'analyze_logs',
      'AI log analysis completed',
      {
        logsAnalyzed: logs.length,
        severity: analysis.severity,
        confidence: analysis.confidence,
        patternsFound: analysis.patterns.length,
        recommendationsGenerated: analysis.recommendations.length
      }
    )

    return NextResponse.json(response)
  } catch (error) {
    logger.error('Failed to perform AI analysis:', error)
    
    await enhancedLogger.error(
      'api',
      'ai-analysis-api',
      'analyze_logs',
      'AI analysis failed',
      { error: error instanceof Error ? error.message : error },
      error instanceof Error ? error.stack : undefined
    )

    return NextResponse.json(
      { 
        available: false,
        error: 'AI analysis failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.AI)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (isValidationError(bodyValidation)) return bodyValidation.error
  // Query parameter validation
  const queryValidation = validateQueryParams(request, z.record(z.string()).optional())
  if (isValidationError(queryValidation)) return queryValidation.error


  try {
    const { logs, context } = bodyValidation.data

    if (!logs || !Array.isArray(logs)) {
      return NextResponse.json(
        { error: 'Invalid logs data provided' },
        { status: 400 }
      )
    }

    // Perform AI analysis on provided logs
    const analysis = await localAIAnalyzer.analyzeLogData(logs, context)

    // Log the custom analysis request
    await enhancedLogger.info(
      'api',
      'ai-analysis-api',
      'analyze_custom_logs',
      'Custom AI log analysis completed',
      {
        logsProvided: logs.length,
        severity: analysis.severity,
        confidence: analysis.confidence,
        context
      }
    )

    return NextResponse.json({
      analysis,
      logsAnalyzed: logs.length,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    logger.error('Failed to perform custom AI analysis:', error)
    
    await enhancedLogger.error(
      'api',
      'ai-analysis-api',
      'analyze_custom_logs',
      'Custom AI analysis failed',
      { error: error instanceof Error ? error.message : error },
      error instanceof Error ? error.stack : undefined
    )

    return NextResponse.json(
      { error: 'Custom AI analysis failed' },
      { status: 500 }
    )
  }
}
