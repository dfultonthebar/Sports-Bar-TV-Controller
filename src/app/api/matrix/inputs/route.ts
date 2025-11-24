import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { schema } from '@/db'
import { eq } from 'drizzle-orm'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { validateRequestBody, ValidationSchemas, z } from '@/lib/validation'
import { logger } from '@/lib/logger'

/**
 * GET /api/matrix/inputs
 * Get all matrix inputs
 */
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const inputs = await db.select()
      .from(schema.matrixInputs)
      .orderBy(schema.matrixInputs.channelNumber)
      .all()

    return NextResponse.json({
      success: true,
      inputs
    })
  } catch (error: any) {
    logger.error('Error fetching matrix inputs:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch matrix inputs',
        details: error.message
      },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/matrix/inputs
 * Update matrix input scheduling status
 */
export async function PATCH(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  const bodyValidation = await validateRequestBody(
    request,
    z.object({
      inputId: z.string().uuid(),
      isSchedulingEnabled: z.boolean()
    })
  )

  if (!bodyValidation.success) {
    return bodyValidation.error
  }

  const { inputId, isSchedulingEnabled } = bodyValidation.data

  try {
    // Update the input
    const updated = await db
      .update(schema.matrixInputs)
      .set({
        isSchedulingEnabled,
        updatedAt: new Date().toISOString()
      })
      .where(eq(schema.matrixInputs.id, inputId))
      .returning()

    if (updated.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Matrix input not found'
        },
        { status: 404 }
      )
    }

    logger.info(
      `[MATRIX_INPUT] Updated scheduling status for input ${updated[0].label}: ${isSchedulingEnabled}`
    )

    return NextResponse.json({
      success: true,
      input: updated[0]
    })
  } catch (error: any) {
    logger.error('[MATRIX_INPUT] Error updating scheduling status:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update matrix input',
        details: error.message
      },
      { status: 500 }
    )
  }
}
