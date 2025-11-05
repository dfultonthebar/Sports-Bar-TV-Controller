
import { NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { eq, and } from 'drizzle-orm'
import { routeWolfpackToMatrix } from '@/services/wolfpackMatrixService'
import { logger } from '@/lib/logger'
import { upsert, create } from '@/lib/db-helpers'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, ValidationSchemas.matrixRouting)
  if (isValidationError(bodyValidation)) return bodyValidation.error


  try {
    logger.api.request('POST', '/api/wolfpack/route-to-matrix')
    
    const { wolfpackInputNumber, matrixOutputNumber } = await request.json()

    if (!wolfpackInputNumber || !matrixOutputNumber) {
      logger.api.response('POST', '/api/wolfpack/route-to-matrix', 400, { error: 'Missing parameters' })
      return NextResponse.json(
        { error: 'wolfpackInputNumber and matrixOutputNumber are required' },
        { status: 400 }
      )
    }

    if (matrixOutputNumber < 1 || matrixOutputNumber > 4) {
      logger.api.response('POST', '/api/wolfpack/route-to-matrix', 400, { error: 'Invalid output number' })
      return NextResponse.json(
        { error: 'matrixOutputNumber must be between 1 and 4' },
        { status: 400 }
      )
    }

    // Get the active matrix configuration
    const config = await db
      .select()
      .from(schema.matrixConfigurations)
      .where(eq(schema.matrixConfigurations.isActive, true))
      .limit(1)
      .get()

    if (!config) {
      logger.api.response('POST', '/api/wolfpack/route-to-matrix', 404, { error: 'No active config' })
      return NextResponse.json(
        { error: 'No active matrix configuration found' },
        { status: 404 }
      )
    }

    // Get the Wolfpack input details
    const wolfpackInput = await db
      .select()
      .from(schema.matrixInputs)
      .where(
        and(
          eq(schema.matrixInputs.configId, config.id),
          eq(schema.matrixInputs.channelNumber, wolfpackInputNumber),
          eq(schema.matrixInputs.isActive, true)
        )
      )
      .limit(1)
      .get()

    if (!wolfpackInput) {
      logger.api.response('POST', '/api/wolfpack/route-to-matrix', 404, { 
        error: `Input ${wolfpackInputNumber} not found` 
      })
      return NextResponse.json(
        { error: `Wolfpack input ${wolfpackInputNumber} not found` },
        { status: 404 }
      )
    }

    // Route the Wolfpack input to the Matrix output
    const result = await routeWolfpackToMatrix(
      config,
      wolfpackInputNumber,
      matrixOutputNumber,
      wolfpackInput.label
    )

    if (!result.success) {
      logger.api.response('POST', '/api/wolfpack/route-to-matrix', 500, { 
        error: result.error 
      })
      return NextResponse.json(
        { error: result.error || 'Failed to route Wolfpack to Matrix' },
        { status: 500 }
      )
    }

    // Update the routing state in database
    await upsert(
      'wolfpackMatrixRoutings',
      eq(schema.wolfpackMatrixRoutings.matrixOutputNumber, matrixOutputNumber),
      {
        matrixOutputNumber,
        wolfpackInputNumber,
        wolfpackInputLabel: wolfpackInput.label,
        atlasInputLabel: `Matrix ${matrixOutputNumber}`,
        isActive: true,
        lastRouted: new Date().toISOString()
      },
      {
        wolfpackInputNumber,
        wolfpackInputLabel: wolfpackInput.label,
        lastRouted: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    )

    // Log the routing state
    await create('wolfpackMatrixStates', {
      matrixOutputNumber,
      wolfpackInputNumber,
      wolfpackInputLabel: wolfpackInput.label,
      channelInfo: JSON.stringify({
        deviceType: wolfpackInput.deviceType,
        inputType: wolfpackInput.inputType
      })
    })

    logger.api.response('POST', '/api/wolfpack/route-to-matrix', 200, { 
      inputNumber: wolfpackInputNumber,
      outputNumber: matrixOutputNumber
    })

    return NextResponse.json({
      success: true,
      message: `Routed ${wolfpackInput.label} to Matrix ${matrixOutputNumber}`,
      routing: {
        wolfpackInput: {
          number: wolfpackInputNumber,
          label: wolfpackInput.label
        },
        matrixOutput: matrixOutputNumber
      }
    })

  } catch (error) {
    logger.api.error('POST', '/api/wolfpack/route-to-matrix', error)
    return NextResponse.json(
      { error: 'Failed to route Wolfpack to Matrix' },
      { status: 500 }
    )
  }
}
