
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { wolfpackMatrixRoutings, wolfpackMatrixStates } from '@/db/schema'
import { findMany, findUnique, findFirst, create, update, updateMany, deleteRecord, upsert, count, eq, desc, asc, and, or, ne } from '@/lib/db-helpers'
import { schema } from '@/db'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@sports-bar/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    // Get all Matrix routing configurations
    const routings = await findMany('wolfpackMatrixRoutings', {
      where: eq(schema.wolfpackMatrixRoutings.isActive, true),
      orderBy: asc(schema.wolfpackMatrixRoutings.matrixOutputNumber),
      limit: 1000
    })

    // Get recent routing history
    const recentStates = await findMany('wolfpackMatrixStates', {
      orderBy: desc(schema.wolfpackMatrixStates.routedAt),
      limit: 20
    })

    return NextResponse.json({
      success: true,
      routings,
      recentStates
    })

  } catch (error) {
    logger.error('Error fetching Matrix routing state:', error)
    return NextResponse.json(
      { error: 'Failed to fetch Matrix routing state' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.object({
    matrixOutputNumber: z.number(),
    atlasInputLabel: z.string().optional()
  }))
  if (isValidationError(bodyValidation)) return bodyValidation.error


  try {
    const { matrixOutputNumber, atlasInputLabel } = bodyValidation.data

    if (!matrixOutputNumber) {
      return NextResponse.json(
        { error: 'matrixOutputNumber is required' },
        { status: 400 }
      )
    }

    // Update or create Matrix routing configuration
    const routing = await upsert('wolfpackMatrixRoutings',
      eq(schema.wolfpackMatrixRoutings.matrixOutputNumber, matrixOutputNumber),
      {
        matrixOutputNumber,
        wolfpackInputNumber: matrixOutputNumber,
        wolfpackInputLabel: `Input ${matrixOutputNumber}`,
        atlasInputLabel: atlasInputLabel || `Matrix ${matrixOutputNumber}`,
        isActive: true
      },
      {
        atlasInputLabel: atlasInputLabel || `Matrix ${matrixOutputNumber}`,
        updatedAt: new Date()
      }
    )

    return NextResponse.json({
      success: true,
      routing
    })

  } catch (error) {
    logger.error('Error updating Matrix routing configuration:', error)
    return NextResponse.json(
      { error: 'Failed to update Matrix routing configuration' },
      { status: 500 }
    )
  }
}
