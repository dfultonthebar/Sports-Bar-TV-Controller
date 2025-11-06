
import { NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { eq, and, gte, lte, asc } from 'drizzle-orm'
import { findFirst, findMany, update, create } from '@/lib/db-helpers'
import { logger } from '@/lib/logger'
import { routeWolfpackToMatrix } from '@/services/wolfpackMatrixService'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'

/**
 * Matrix Video Input Selection API
 * Handles video input selection for matrix outputs and routes audio accordingly
 * Migrated to Drizzle ORM
 */

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

  logger.api.request('POST', '/api/matrix/video-input-selection')

  // Security: use validated data
  const { data } = bodyValidation
  const { matrixOutputNumber: matrixOutputRaw, videoInputNumber: videoInputRaw, videoInputLabel } = data

  // Convert to numbers
  const matrixOutputNumber = typeof matrixOutputRaw === 'string' ? parseInt(matrixOutputRaw, 10) : Number(matrixOutputRaw)
  const videoInputNumber = typeof videoInputRaw === 'string' ? parseInt(videoInputRaw, 10) : Number(videoInputRaw)

  try {

    // Validate input parameters
    if (!matrixOutputNumber || !videoInputNumber) {
      logger.api.error('POST', '/api/matrix/video-input-selection', new Error('Missing required parameters'))
      return NextResponse.json(
        { error: 'Matrix output number and video input number are required' },
        { status: 400 }
      )
    }

    // Validate matrix output is 1-4 (Matrix outputs)
    if (matrixOutputNumber < 1 || matrixOutputNumber > 4) {
      logger.api.error('POST', '/api/matrix/video-input-selection', new Error('Invalid matrix output number'))
      return NextResponse.json(
        { error: 'Matrix output number must be between 1 and 4' },
        { status: 400 }
      )
    }

    // Get active matrix configuration
    const config = await findFirst('matrixConfigurations', {
      where: eq(schema.matrixConfigurations.isActive, true)
    })

    if (!config) {
      logger.api.error('POST', '/api/matrix/video-input-selection', new Error('No active matrix configuration'))
      return NextResponse.json(
        { error: 'No active matrix configuration found' },
        { status: 404 }
      )
    }

    // Get the video input
    const videoInputs = await findMany('matrixInputs', {
      where: and(
        eq(schema.matrixInputs.configId, config.id as string),
        eq(schema.matrixInputs.channelNumber, parseInt(videoInputNumber))
      )
    })

    const videoInput = videoInputs[0]
    if (!videoInput) {
      logger.api.error('POST', '/api/matrix/video-input-selection', new Error(`Video input ${videoInputNumber} not found`))
      return NextResponse.json(
        { error: `Video input ${videoInputNumber} not found` },
        { status: 404 }
      )
    }

    // Get the matrix output (channels 33-36 for Matrix 1-4)
    const matrixOutputs = await findMany('matrixOutputs', {
      where: and(
        eq(schema.matrixOutputs.configId, config.id as string),
        eq(schema.matrixOutputs.channelNumber, 32 + parseInt(matrixOutputNumber))
      )
    })

    const matrixOutput = matrixOutputs[0]
    if (!matrixOutput) {
      logger.api.error('POST', '/api/matrix/video-input-selection', new Error(`Matrix output ${matrixOutputNumber} not found`))
      return NextResponse.json(
        { error: `Matrix output ${matrixOutputNumber} not found` },
        { status: 404 }
      )
    }

    // Step 1: Route the video input to the matrix output via Wolfpack
    logger.info(`Routing video input ${videoInputNumber} (${videoInput.label}) to Matrix ${matrixOutputNumber}`)
    
    const routingResult = await routeWolfpackToMatrix(
      config as any,
      videoInputNumber,
      matrixOutputNumber,
      videoInput.label
    )

    if (!routingResult.success) {
      logger.api.error('POST', '/api/matrix/video-input-selection', new Error(routingResult.error))
      return NextResponse.json(
        { 
          error: 'Failed to route video input to matrix output',
          details: routingResult.error 
        },
        { status: 500 }
      )
    }

    // Step 2: Update the matrix output with selected video input info
    await update('matrixOutputs', matrixOutput.id, {
      selectedVideoInput: parseInt(videoInputNumber),
      videoInputLabel: videoInput.label,
      label: videoInput.label
    })

    // Step 3: Update or create the Wolfpack-Matrix routing state
    const existingRouting = await findFirst('wolfpackMatrixRoutings', {
      where: eq(schema.wolfpackMatrixRoutings.matrixOutputNumber, parseInt(matrixOutputNumber))
    })

    if (existingRouting) {
      await update('wolfpackMatrixRoutings', existingRouting.id, {
        wolfpackInputNumber: parseInt(videoInputNumber),
        wolfpackInputLabel: videoInput.label,
        atlasInputLabel: `Matrix ${matrixOutputNumber}`,
        lastRouted: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
    } else {
      await create('wolfpackMatrixRoutings', {
        matrixOutputNumber: parseInt(matrixOutputNumber),
        wolfpackInputNumber: parseInt(videoInputNumber),
        wolfpackInputLabel: videoInput.label,
        atlasInputLabel: `Matrix ${matrixOutputNumber}`,
        isActive: true,
        lastRouted: new Date().toISOString()
      })
    }

    // Step 4: Log the routing state
    await create('wolfpackMatrixStates', {
      matrixOutputNumber: parseInt(matrixOutputNumber),
      wolfpackInputNumber: parseInt(videoInputNumber),
      wolfpackInputLabel: videoInput.label,
      channelInfo: JSON.stringify({
        deviceType: videoInput.deviceType,
        inputType: videoInput.inputType,
        selectedAt: new Date().toISOString()
      })
    })

    logger.api.response('POST', '/api/matrix/video-input-selection', 200, { success: true })
    return NextResponse.json({
      success: true,
      message: `Successfully routed ${videoInput.label} to Matrix ${matrixOutputNumber}`,
      routing: {
        videoInput: {
          number: videoInputNumber,
          label: videoInput.label
        },
        matrixOutput: {
          number: matrixOutputNumber,
          label: `Matrix ${matrixOutputNumber}`
        },
        atlasInput: `Matrix ${matrixOutputNumber}`,
        command: routingResult.command
      }
    })

  } catch (error) {
    logger.api.error('POST', '/api/matrix/video-input-selection', error)
    return NextResponse.json(
      { 
        error: 'Failed to process video input selection',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * GET endpoint to retrieve current video input selections for matrix outputs
 */
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Query parameter validation
  const queryValidation = validateQueryParams(request, z.record(z.string()).optional())
  if (isValidationError(queryValidation)) return queryValidation.error

  logger.api.request('GET', '/api/matrix/video-input-selection')
  
  try {
    const { searchParams } = new URL(request.url)
    const matrixOutputNumber = searchParams.get('matrixOutputNumber')

    // Get active matrix configuration
    const config = await findFirst('matrixConfigurations', {
      where: eq(schema.matrixConfigurations.isActive, true)
    })

    if (!config) {
      logger.api.error('GET', '/api/matrix/video-input-selection', new Error('No active matrix configuration'))
      return NextResponse.json(
        { error: 'No active matrix configuration found' },
        { status: 404 }
      )
    }

    // Get matrix outputs (channels 33-36 for Matrix 1-4)
    const outputs = await findMany('matrixOutputs', {
      where: matrixOutputNumber 
        ? and(
            eq(schema.matrixOutputs.configId, config.id as string),
            eq(schema.matrixOutputs.channelNumber, 32 + parseInt(matrixOutputNumber))
          )
        : and(
            eq(schema.matrixOutputs.configId, config.id as string),
            gte(schema.matrixOutputs.channelNumber, 33),
            lte(schema.matrixOutputs.channelNumber, 36)
          ),
      orderBy: asc(schema.matrixOutputs.channelNumber)
    })

    // Get routing states
    const routingStates = await findMany('wolfpackMatrixRoutings', {
      where: matrixOutputNumber 
        ? eq(schema.wolfpackMatrixRoutings.matrixOutputNumber, parseInt(matrixOutputNumber))
        : and(
            gte(schema.wolfpackMatrixRoutings.matrixOutputNumber, 1),
            lte(schema.wolfpackMatrixRoutings.matrixOutputNumber, 4)
          ),
      orderBy: asc(schema.wolfpackMatrixRoutings.matrixOutputNumber)
    })

    // Combine output info with routing state
    const selections = outputs.map(output => {
      const matrixNum = output.channelNumber - 32 // Convert 33-36 to 1-4
      const routingState = routingStates.find(r => r.matrixOutputNumber === matrixNum)
      
      return {
        matrixOutputNumber: matrixNum,
        matrixOutputLabel: output.label,
        selectedVideoInput: output.selectedVideoInput,
        videoInputLabel: output.videoInputLabel,
        atlasInputLabel: routingState?.atlasInputLabel || `Matrix ${matrixNum}`,
        lastRouted: routingState?.lastRouted,
        isActive: routingState?.isActive || false
      }
    })

    logger.api.response('GET', '/api/matrix/video-input-selection', 200, { count: selections.length })
    return NextResponse.json({
      success: true,
      selections
    })

  } catch (error) {
    logger.api.error('GET', '/api/matrix/video-input-selection', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch video input selections',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
