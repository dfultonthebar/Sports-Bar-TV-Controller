/**
 * Matrix CEC Input Configuration API
 *
 * POST /api/matrix/config/cec-input
 * Updates the CEC input channel for the active matrix configuration
 */

import { NextRequest, NextResponse } from 'next/server'
import { findFirst, update, eq } from '@/lib/db-helpers'
import { schema } from '@/db'
import { logger } from '@/lib/logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
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
    const { cecInputChannel } = body

    if (typeof cecInputChannel !== 'number') {
      return NextResponse.json(
        { success: false, error: 'Invalid cecInputChannel' },
        { status: 400 }
      )
    }

    // Find the active matrix configuration
    const activeConfig = await findFirst('matrixConfigurations', {
      where: eq(schema.matrixConfigurations.isActive, true)
    })

    if (!activeConfig) {
      return NextResponse.json(
        { success: false, error: 'No active matrix configuration found' },
        { status: 404 }
      )
    }

    // Update the CEC input channel
    await update('matrixConfigurations', eq(schema.matrixConfigurations.id, activeConfig.id), { cecInputChannel })

    logger.info('[API] Updated CEC input channel to:', cecInputChannel)

    return NextResponse.json({
      success: true,
      cecInputChannel
    })
  } catch (error) {
    logger.error('[API] Error updating CEC input channel:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update CEC input channel'
      },
      { status: 500 }
    )
  }
}
