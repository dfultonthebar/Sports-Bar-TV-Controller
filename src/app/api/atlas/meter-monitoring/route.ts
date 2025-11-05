/**
 * Atlas Meter Monitoring Control API
 * Start/stop real-time audio level monitoring for Atlas processors
 */

import { NextRequest, NextResponse } from 'next/server'
import { atlasMeterService } from '@/lib/atlas-meter-service'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@/lib/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
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
    const { action, processorId, intervalMs } = await request.json()
    
    if (!processorId) {
      return NextResponse.json(
        { error: 'Processor ID is required' },
        { status: 400 }
      )
    }
    
    if (action === 'start') {
      await atlasMeterService.startMonitoring(processorId, intervalMs || 5000)
      
      return NextResponse.json({
        success: true,
        message: `Started meter monitoring for processor ${processorId}`,
        intervalMs: intervalMs || 5000
      })
      
    } else if (action === 'stop') {
      atlasMeterService.stopMonitoring(processorId)
      
      return NextResponse.json({
        success: true,
        message: `Stopped meter monitoring for processor ${processorId}`
      })
      
    } else {
      return NextResponse.json(
        { error: 'Action must be "start" or "stop"' },
        { status: 400 }
      )
    }
    
  } catch (error) {
    logger.error('Atlas meter monitoring API error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to control meter monitoring',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
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
    const action = searchParams.get('action')
    
    if (action === 'cleanup') {
      const hours = parseInt(searchParams.get('hours') || '24')
      const count = await atlasMeterService.cleanupOldData(hours)
      
      return NextResponse.json({
        success: true,
        message: `Cleaned up ${count} old meter readings`,
        deletedCount: count
      })
    }
    
    return NextResponse.json({
      success: true,
      message: 'Atlas meter monitoring service is running',
      availableActions: ['start', 'stop', 'cleanup']
    })
    
  } catch (error) {
    logger.error('Atlas meter monitoring API error:', error)
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    )
  }
}
