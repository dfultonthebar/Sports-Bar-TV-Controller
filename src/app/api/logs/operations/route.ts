
import { NextRequest, NextResponse } from 'next/server'
import { operationLogger } from '@/lib/operation-logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@/lib/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DATABASE_WRITE)
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
    const { searchParams } = new URL(request.url)
    const hours = parseInt(searchParams.get('hours') || '24')
    const type = searchParams.get('type') || 'all'

    switch (type) {
      case 'operations':
        const operations = await operationLogger.getRecentOperations(hours)
        return NextResponse.json({ operations })
      
      case 'errors':
        const errors = await operationLogger.getRecentErrors(hours)
        return NextResponse.json({ errors })
      
      case 'learning':
        const learningData = await operationLogger.getLearningData(hours)
        return NextResponse.json({ learningData })
      
      case 'summary':
        const summary = await operationLogger.getOperationSummary(hours)
        return NextResponse.json({ summary })
      
      default:
        const allOperations = await operationLogger.getRecentOperations(hours)
        const allErrors = await operationLogger.getRecentErrors(hours)
        const allSummary = await operationLogger.getOperationSummary(hours)
        
        return NextResponse.json({
          operations: allOperations,
          errors: allErrors,
          summary: allSummary
        })
    }
  } catch (error) {
    logger.error('Error fetching logs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch logs' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DATABASE_WRITE)
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
    const logData = bodyValidation.data
    
    if (logData.type === 'operation') {
      await operationLogger.logOperation(logData)
    } else if (logData.type === 'error') {
      await operationLogger.logError(logData)
    } else {
      return NextResponse.json(
        { error: 'Invalid log type' },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Error logging data:', error)
    return NextResponse.json(
      { error: 'Failed to log data' },
      { status: 500 }
    )
  }
}
