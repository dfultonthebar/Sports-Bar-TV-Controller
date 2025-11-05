
import { NextRequest, NextResponse } from 'next/server'
import { and, asc, desc, eq, or } from 'drizzle-orm'
import { db, schema } from '@/db'
import { logger } from '@/lib/logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'


export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    // Get the active matrix configuration
    const activeConfig = await db.select()
      .from(schema.matrixConfigurations)
      .where(eq(schema.matrixConfigurations.isActive, true))
      .limit(1)
      .get()

    if (!activeConfig) {
      return NextResponse.json({
        success: false,
        message: 'No active matrix configuration found'
      }, { status: 404 })
    }

    // Get active outputs for this configuration
    const outputs = await db.select()
      .from(schema.matrixOutputs)
      .where(
        and(
          eq(schema.matrixOutputs.configId, activeConfig.id),
          eq(schema.matrixOutputs.status, 'active')
        )
      )
      .orderBy(asc(schema.matrixOutputs.channelNumber))
      .all()

    // Get outputs with daily turn-on/off settings
    const dailyTurnOnOutputs = outputs.filter(o => o.dailyTurnOn)
    const dailyTurnOffOutputs = outputs.filter(o => o.dailyTurnOff)
    const availableOutputs = outputs.filter(o => !o.dailyTurnOn && !o.dailyTurnOff)

    return NextResponse.json({
      success: true,
      outputs,
      dailyTurnOnOutputs,
      dailyTurnOffOutputs,
      availableOutputs,
      configName: activeConfig.name
    })
  } catch (error: any) {
    logger.error('Error fetching outputs for schedule:', error)
    return NextResponse.json({
      success: false,
      message: error.message || 'Failed to fetch outputs'
    }, { status: 500 })
  }
}

// Update an output's daily turn-on/off settings
export async function PUT(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (isValidationError(bodyValidation)) return bodyValidation.error

  // Security: use validated data
  const { data } = bodyValidation
  const { outputId, dailyTurnOn, dailyTurnOff } = data
  try {

    if (!outputId) {
      return NextResponse.json({
        success: false,
        message: 'Output ID is required'
      }, { status: 400 })
    }

    // Prepare update data
    const updateData: any = {
      updatedAt: new Date().toISOString()
    }
    
    if (dailyTurnOn !== undefined) {
      updateData.dailyTurnOn = dailyTurnOn
    }
    
    if (dailyTurnOff !== undefined) {
      updateData.dailyTurnOff = dailyTurnOff
    }

    await db.update(schema.matrixOutputs)
      .set(updateData)
      .where(eq(schema.matrixOutputs.id, outputId))
      .run()

    const updated = await db.select()
      .from(schema.matrixOutputs)
      .where(eq(schema.matrixOutputs.id, outputId))
      .limit(1)
      .get()

    return NextResponse.json({
      success: true,
      output: updated
    })
  } catch (error: any) {
    logger.error('Error updating output schedule settings:', error)
    return NextResponse.json({
      success: false,
      message: error.message || 'Failed to update output'
    }, { status: 500 })
  }
}
