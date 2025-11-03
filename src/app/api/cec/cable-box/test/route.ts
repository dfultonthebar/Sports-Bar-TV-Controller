/**
 * Test CEC Connection API
 *
 * POST /api/cec/cable-box/test
 * Test connectivity to a cable box
 */

import { NextRequest, NextResponse } from 'next/server'
import { CableBoxCECService } from '@/lib/cable-box-cec-service'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@/lib/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas } from '@/lib/validation'
export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (!bodyValidation.success) return bodyValidation.error


  try {
    const body = await request.json()
    const { cableBoxId } = body

    if (!cableBoxId) {
      return NextResponse.json(
        {
          success: false,
          error: 'cableBoxId is required',
        },
        { status: 400 }
      )
    }

    logger.info(`[API] Testing connection to cable box ${cableBoxId}`)

    const cecService = CableBoxCECService.getInstance()
    const result = await cecService.testConnection(cableBoxId)

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Cable box is responding',
        executionTime: result.executionTime,
        responsive: true,
      })
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Cable box not responding',
          executionTime: result.executionTime,
          responsive: false,
        },
        { status: 500 }
      )
    }
  } catch (error: any) {
    logger.error('[API] Error testing cable box:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to test connection',
      },
      { status: 500 }
    )
  }
}
