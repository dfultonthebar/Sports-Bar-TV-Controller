
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { aiGainConfigurations, audioInputMeters, audioProcessors } from '@/db/schema'
import { findMany, findUnique, findFirst, create, update, updateMany, deleteRecord, upsert, count, eq, desc, asc, and, or, ne } from '@/lib/db-helpers'
import { schema } from '@/db'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@sports-bar/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'
interface RouteContext {
  params: Promise<{
    id: string
  }>
}

// GET: Get AI gain control settings for all inputs
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  // Query parameter validation
  const queryValidation = validateQueryParams(request, z.record(z.string()).optional())
  if (isValidationError(queryValidation)) return queryValidation.error

  // Path parameter validation
  const params = await context.params
  const paramsValidation = validatePathParams(params, z.object({ id: z.string().min(1) }))
  if (isValidationError(paramsValidation)) return paramsValidation.error

  try {
    const processorId = params.id

    const processor = await findUnique('audioProcessors', {
      where: eq(schema.audioProcessors.id, processorId)
    })

    if (!processor) {
      return NextResponse.json(
        { error: 'Audio processor not found' },
        { status: 404 }
      )
    }

    // Get input meters with AI gain config separately (Drizzle doesn't support nested includes)
    const inputMeters = await findMany('audioInputMeters', {
      where: eq(schema.audioInputMeters.processorId, processorId),
      orderBy: asc(schema.audioInputMeters.inputNumber),
      limit: 1000
    })

    // Get AI gain configs for these input meters
    const aiGainConfigs = await findMany('aiGainConfigurations', {
      where: eq(schema.aiGainConfigurations.processorId, processorId),
      limit: 1000
    })

    // Merge AI gain configs into input meters
    const inputMetersWithConfig = inputMeters.map(meter => {
      const aiGainConfig = aiGainConfigs.find(
        config => config.inputNumber === meter.inputNumber
      )
      return {
        ...meter,
        aiGainConfig: aiGainConfig || null
      }
    })

    return NextResponse.json({
      success: true,
      processor: {
        id: processor.id,
        name: processor.name,
        model: processor.model
      },
      inputMeters: inputMetersWithConfig
    })

  } catch (error) {
    logger.error('Error fetching AI gain control settings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch AI gain control settings' },
      { status: 500 }
    )
  }
}

// POST: Enable/disable AI control and configure settings for an input
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.object({
    inputNumber: z.number(),
    aiEnabled: z.boolean().optional(),
    inputType: z.enum(['mic', 'line']).optional(),
    targetLevel: z.number().optional(),
    fastModeThreshold: z.number().optional(),
    silenceThreshold: z.number().optional(),
    silenceDuration: z.number().optional(),
    fastModeStep: z.number().optional(),
    slowModeStep: z.number().optional(),
    minGain: z.number().optional(),
    maxGain: z.number().optional()
  }))
  if (isValidationError(bodyValidation)) return bodyValidation.error

  // Path parameter validation
  const params = await context.params
  const paramsValidation = validatePathParams(params, z.object({ id: z.string().min(1) }))
  if (isValidationError(paramsValidation)) return paramsValidation.error


  try {
    const processorId = params.id
    const {
      inputNumber,
      aiEnabled,
      inputType,
      targetLevel,
      fastModeThreshold,
      silenceThreshold,
      silenceDuration,
      fastModeStep,
      slowModeStep,
      minGain,
      maxGain
    } = bodyValidation.data

    // Find or create the input meter
    let inputMeter = await findFirst('audioInputMeters', {
      where: and(
        eq(schema.audioInputMeters.processorId, processorId),
        eq(schema.audioInputMeters.inputNumber, inputNumber)
      )
    })

    if (!inputMeter) {
      // Create input meter if it doesn't exist
      inputMeter = await create('audioInputMeters', {
        data: {
          processorId: processorId,
          inputNumber: inputNumber,
          parameterName: `SourceMeter_${inputNumber}`,
          inputName: `Input ${inputNumber + 1}`,
          isActive: true
        }
      })
    }

    // Find or create AI gain configuration
    let aiConfig = await findFirst('aiGainConfigurations', {
      where: and(
        eq(schema.aiGainConfigurations.processorId, processorId),
        eq(schema.aiGainConfigurations.inputNumber, inputNumber)
      )
    })

    const configData: any = {
      enabled: aiEnabled !== undefined ? aiEnabled : false
    }

    // Add optional parameters if provided
    if (targetLevel !== undefined) configData.targetLevel = targetLevel

    if (aiConfig) {
      // Update existing configuration
      aiConfig = await update('aiGainConfigurations',
        eq(schema.aiGainConfigurations.id, aiConfig.id),
        configData
      )
    } else {
      // Create new configuration
      aiConfig = await create('aiGainConfigurations', {
        data: {
          processorId: processorId,
          inputNumber: inputNumber,
          inputName: `Input ${inputNumber + 1}`,
          ...configData
        }
      })
    }

    return NextResponse.json({ 
      success: true,
      aiConfig,
      message: `AI gain control ${aiEnabled ? 'enabled' : 'disabled'} for input ${inputNumber}`
    })

  } catch (error) {
    logger.error('Error updating AI gain control settings:', error)
    return NextResponse.json(
      { error: 'Failed to update AI gain control settings' },
      { status: 500 }
    )
  }
}

// DELETE: Remove AI gain configuration for an input
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  // Query parameter validation
  const queryValidation = validateQueryParams(request, z.record(z.string()).optional())
  if (isValidationError(queryValidation)) return queryValidation.error

  // Path parameter validation
  const params = await context.params
  const paramsValidation = validatePathParams(params, z.object({ id: z.string().min(1) }))
  if (isValidationError(paramsValidation)) return paramsValidation.error

  try {
    const processorId = params.id
    const { searchParams } = new URL(request.url)
    const inputNumber = parseInt(searchParams.get('inputNumber') || '')

    if (isNaN(inputNumber)) {
      return NextResponse.json(
        { error: 'Valid input number is required' },
        { status: 400 }
      )
    }

    const aiConfig = await db.select().from(aiGainConfigurations).where(eq(aiGainConfigurations.processorId, processorId)).limit(1).get()

    if (!aiConfig) {
      return NextResponse.json(
        { error: 'AI gain configuration not found' },
        { status: 404 }
      )
    }

    await db.delete(aiGainConfigurations).where(eq(aiGainConfigurations.id, aiConfig.id)).returning().get()

    return NextResponse.json({ 
      success: true,
      message: `AI gain configuration removed for input ${inputNumber}`
    })

  } catch (error) {
    logger.error('Error deleting AI gain configuration:', error)
    return NextResponse.json(
      { error: 'Failed to delete AI gain configuration' },
      { status: 500 }
    )
  }
}
